// Cloudflare Worker: campusnotes-pdf-api
// Secure R2 PDF & Multi-Format Storage, Streaming, and Private Assignment Sharing Service
// Enforces Firebase metadata validation, admin authorization, token hashing, and binary streaming.

import type { Env, PublicMaterialRecord } from './types.ts';
import { verifyAdminRequest } from './auth.ts';
import { getPublicMaterialMetadata, getAdminMaterialMetadata, invalidatePublicMaterialCache } from './firebase.ts';
import {
  getWorkerFileFormatInfo,
  sanitizeWorkerFilename,
  validateMagicBytes,
  getFileExtension,
  isDangerousExtension,
} from './fileTypes.ts';
import {
  generateSecureToken,
  sha256Hex,
  isValidTokenFormat,
  getShareRecordByHash,
  saveShareRecord,
  deleteShareRecordFromR2,
  listAllShareRecords,
  resolveMaterialForShare,
  checkRateLimit,
  recordFailedTokenAttempt,
  type PrivateShareRecord,
} from './privateShares.ts';

const DEFAULT_ALLOWED_ORIGINS = [
  'https://campusnotes.space',
  'https://www.campusnotes.space',
  'https://campusnotes-ifpr.onrender.com',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:3000',
];

const MAX_PDF_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB limit for Cloudflare R2 binary storage

/**
 * Builds standard CORS headers based on request origin
 */
function buildCorsHeaders(request: Request, env: Env): Headers {
  const origin = request.headers.get('Origin') || '';
  const configured = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  const allowedOrigins = configured.length > 0 ? configured : DEFAULT_ALLOWED_ORIGINS;
  const isAllowed = allowedOrigins.includes('*') || allowedOrigins.includes(origin);
  const allowOriginValue = isAllowed ? origin : (allowedOrigins[0] || '*');

  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', allowOriginValue);
  headers.set('Access-Control-Allow-Methods', 'GET, HEAD, PUT, POST, PATCH, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, Range, X-Filename, If-None-Match, If-Range, If-Match');
  headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Disposition, Content-Range, ETag, Accept-Ranges, Retry-After');
  headers.set('Access-Control-Max-Age', '86400');
  return headers;
}

function jsonResponse(data: unknown, status = 200, corsHeaders?: Headers): Response {
  const headers = corsHeaders ? new Headers(corsHeaders) : new Headers();
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(data), { status, headers });
}

function sanitizeFilename(name: string): string {
  const clean = name
    .replace(/[^\w\s.-]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^\.+/, '')
    .trim();
  if (clean.length === 0) return 'material.pdf';
  return clean.toLowerCase().endsWith('.pdf') ? clean : `${clean}.pdf`;
}

export interface ParsedByteRange {
  start: number;
  end: number;
}

/**
 * Parses HTTP Range header according to RFC 7233 / RFC 9110
 * Supports single byte range specs:
 * - bytes=start-end
 * - bytes=start-
 * - bytes=-suffix
 */
export function parseByteRange(
  rangeHeader: string,
  totalSize: number
): ParsedByteRange | 'unsatisfiable' | 'invalid' | null {
  if (!rangeHeader.startsWith('bytes=')) {
    return null; // Ignore non-byte range units per RFC
  }

  const spec = rangeHeader.slice('bytes='.length).trim();
  if (spec.includes(',')) {
    // Multi-range is not supported for PDF streaming
    return 'invalid';
  }

  const parts = spec.split('-');
  if (parts.length !== 2) {
    return 'invalid';
  }

  const [startStr, endStr] = parts;
  if (!startStr && !endStr) {
    return 'invalid';
  }

  // Suffix range: bytes=-500 (last 500 bytes)
  if (!startStr) {
    const suffix = parseInt(endStr, 10);
    if (isNaN(suffix) || suffix <= 0) return 'invalid';
    if (totalSize === 0) return 'unsatisfiable';
    const start = Math.max(0, totalSize - suffix);
    const end = totalSize - 1;
    return { start, end };
  }

  // Open-ended range: bytes=500- (from offset 500 to end)
  if (!endStr) {
    const start = parseInt(startStr, 10);
    if (isNaN(start) || start < 0) return 'invalid';
    if (start >= totalSize) return 'unsatisfiable';
    return { start, end: totalSize - 1 };
  }

  // Explicit range: bytes=500-999
  const start = parseInt(startStr, 10);
  const end = parseInt(endStr, 10);
  if (isNaN(start) || isNaN(end) || start < 0 || start > end) {
    return 'invalid';
  }
  if (start >= totalSize) {
    return 'unsatisfiable';
  }

  return { start, end: Math.min(end, totalSize - 1) };
}

export default {
  async fetch(request: Request, env: Env, ctx?: { waitUntil?: (p: Promise<unknown>) => void }): Promise<Response> {
    const corsHeaders = buildCorsHeaders(request, env);

    // 1. Handle CORS Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const pathname = url.pathname;
    const normalizedPath = pathname.replace(/\/+$/, '') || '/';

    // 2. Health check route
    if (normalizedPath === '/' || normalizedPath === '/health') {
      return jsonResponse(
        {
          status: 'ok',
          service: 'campusnotes-pdf-api',
          version: '2.0.0',
          bucket: 'campusnotes-pdfs',
          timestamp: Date.now(),
        },
        200,
        corsHeaders
      );
    }

    // 3. Decommission temporary test endpoint
    // Per requirements: The current Worker test endpoint is temporary and must not remain publicly accessible.
    // Unauthenticated requests MUST return HTTP 403 and NEVER expose the test PDF.
    if (normalizedPath === '/test-pdf') {
      // Allow only if admin authorized
      const auth = await verifyAdminRequest(request, env);
      if (!auth.isAuthorized) {
        return jsonResponse(
          {
            error: 'Forbidden: The temporary test endpoint has been decommissioned. Please access documents through authorized material routes.',
          },
          403,
          corsHeaders
        );
      }
      // If admin authorized, serve sample test file from R2
      const testObj = await env.PDF_BUCKET.get('test-assignment.pdf');
      if (!testObj) {
        return jsonResponse({ error: 'Sample test file not found in bucket.' }, 404, corsHeaders);
      }
      const headers = new Headers(corsHeaders);
      headers.set('Content-Type', 'application/pdf');
      headers.set('Content-Disposition', 'attachment; filename="test-assignment.pdf"');
      headers.set('Content-Length', String(testObj.size));
      headers.set('Cache-Control', 'private, no-store');
      headers.set('X-Content-Type-Options', 'nosniff');
      return new Response(request.method === 'HEAD' ? null : testObj.body, { status: 200, headers });
    }

    // -------------------------------------------------------------
    // PRIVATE ASSIGNMENT & NOTES SHARING ENDPOINTS
    // -------------------------------------------------------------

    // A. POST /private-shares: Administrator creates a new private share
    if (normalizedPath === '/private-shares' && request.method === 'POST') {
      const auth = await verifyAdminRequest(request, env);
      if (!auth.isAuthorized) {
        return jsonResponse(
          { error: auth.error || 'Administrator authorization required to create private shares.' },
          401,
          corsHeaders
        );
      }

      let body: {
        materialId?: string;
        recipientName?: string;
        recipientEmail?: string;
        instructions?: string;
        dueDate?: number | null;
        expiresAt?: number | null;
      };
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ error: 'Malformed JSON payload.' }, 400, corsHeaders);
      }

      const { materialId, recipientName, recipientEmail, instructions, dueDate, expiresAt } = body;
      if (!materialId || typeof materialId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(materialId)) {
        return jsonResponse({ error: 'Valid material ID is required.' }, 400, corsHeaders);
      }

      const authHeader = request.headers.get('Authorization') || '';
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();

      const material = await resolveMaterialForShare(materialId, token, env);
      if (!material) {
        return jsonResponse(
          { error: `The requested material was not found: ${materialId}` },
          404,
          corsHeaders
        );
      }

      const rawToken = generateSecureToken();
      const tokenHash = await sha256Hex(rawToken);

      const rawFileName = material.fileName || `${material.title || 'study_material'}.pdf`;
      const formatInfo = getWorkerFileFormatInfo(rawFileName);

      const r2Key =
        material.r2Key ||
        (material.storagePath && material.storagePath.startsWith('r2://')
          ? material.storagePath.replace('r2://', '')
          : `materials/${materialId}.pdf`);

      const now = Date.now();
      const parsedDueDate = typeof dueDate === 'number' && dueDate > 0 ? dueDate : null;
      const parsedExpiresAt = typeof expiresAt === 'number' && expiresAt > 0 ? expiresAt : null;

      const shareRecord: PrivateShareRecord = {
        id: tokenHash,
        tokenHash,
        materialId: material.id,
        materialTitle: material.title,
        fileName: rawFileName,
        fileSize: material.fileSize || 0,
        mimeType: formatInfo.mimeType,
        storageProvider: material.blobId ? 'firebase' : 'r2',
        r2Key,
        blobId: material.blobId,
        recipientName: recipientName ? String(recipientName).trim() : undefined,
        recipientEmail: recipientEmail ? String(recipientEmail).trim() : undefined,
        instructions: instructions ? String(instructions).trim() : undefined,
        dueDate: parsedDueDate,
        expiresAt: parsedExpiresAt,
        status: 'active',
        createdAt: now,
        createdBy: auth.email || auth.uid || 'admin',
        accessCount: 0,
      };

      await saveShareRecord(shareRecord, env);

      const requestOrigin = request.headers.get('Origin') || url.origin;
      const canonicalDomain = requestOrigin.includes('localhost') ? requestOrigin : 'https://campusnotes.space';
      const shareUrl = `${canonicalDomain}/private-assignment/${rawToken}`;

      return jsonResponse(
        {
          ok: true,
          shareId: tokenHash,
          token: rawToken,
          shareUrl,
          materialId: shareRecord.materialId,
          materialTitle: shareRecord.materialTitle,
          fileName: shareRecord.fileName,
          recipientName: shareRecord.recipientName,
          recipientEmail: shareRecord.recipientEmail,
          instructions: shareRecord.instructions,
          dueDate: shareRecord.dueDate,
          expiresAt: shareRecord.expiresAt,
          createdAt: shareRecord.createdAt,
          status: shareRecord.status,
        },
        201,
        corsHeaders
      );
    }

    // B. GET /private-shares: Administrator lists all private shares
    if (normalizedPath === '/private-shares' && request.method === 'GET') {
      const auth = await verifyAdminRequest(request, env);
      if (!auth.isAuthorized) {
        return jsonResponse(
          { error: auth.error || 'Administrator authorization required to list private shares.' },
          401,
          corsHeaders
        );
      }

      const shares = await listAllShareRecords(env);
      return jsonResponse({ ok: true, shares }, 200, corsHeaders);
    }

    // C. PATCH /private-shares/:shareId: Administrator revokes or updates expiration
    const privateShareItemMatch = pathname.match(/^\/private-shares\/([a-zA-Z0-9_-]+)$/);
    if (privateShareItemMatch && request.method === 'PATCH') {
      const auth = await verifyAdminRequest(request, env);
      if (!auth.isAuthorized) {
        return jsonResponse(
          { error: auth.error || 'Administrator authorization required.' },
          401,
          corsHeaders
        );
      }

      const shareId = privateShareItemMatch[1];
      const existing = await getShareRecordByHash(shareId, env);
      if (!existing) {
        return jsonResponse({ error: 'Private share record not found.' }, 404, corsHeaders);
      }

      let body: { status?: 'active' | 'revoked'; expiresAt?: number | null };
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ error: 'Malformed JSON payload.' }, 400, corsHeaders);
      }

      if (body.status === 'revoked') {
        existing.status = 'revoked';
        existing.revokedAt = Date.now();
        existing.revokedBy = auth.email || auth.uid || 'admin';
      } else if (body.status === 'active') {
        existing.status = 'active';
        existing.revokedAt = null;
        existing.revokedBy = null;
      }

      if (body.expiresAt !== undefined) {
        existing.expiresAt = typeof body.expiresAt === 'number' && body.expiresAt > 0 ? body.expiresAt : null;
        if (existing.status === 'expired' && (!existing.expiresAt || Date.now() < existing.expiresAt)) {
          existing.status = 'active';
        }
      }

      await saveShareRecord(existing, env);
      return jsonResponse({ ok: true, share: existing }, 200, corsHeaders);
    }

    // D. DELETE /private-shares/:shareId: Administrator safely removes a share record
    if (privateShareItemMatch && request.method === 'DELETE') {
      const auth = await verifyAdminRequest(request, env);
      if (!auth.isAuthorized) {
        return jsonResponse(
          { error: auth.error || 'Administrator authorization required.' },
          401,
          corsHeaders
        );
      }

      const shareId = privateShareItemMatch[1];
      const existing = await getShareRecordByHash(shareId, env);
      if (!existing) {
        return jsonResponse({ error: 'Private share record not found.' }, 404, corsHeaders);
      }

      await deleteShareRecordFromR2(shareId, env);
      return jsonResponse({ ok: true, deleted: shareId }, 200, corsHeaders);
    }

    // E. GET /private-shares/:token/info: Public validation for recipient (NO LOGIN REQUIRED)
    const privateShareInfoMatch = pathname.match(/^\/private-shares\/([a-zA-Z0-9_-]+)\/info$/);
    if (privateShareInfoMatch && (request.method === 'GET' || request.method === 'HEAD')) {
      const rawToken = privateShareInfoMatch[1];
      const clientIp = request.headers.get('CF-Connecting-IP') || 'anonymous';

      // Rate limiting to mitigate brute-force token enumeration
      const rateLimit = checkRateLimit(clientIp);
      if (rateLimit.isBlocked) {
        const headers = new Headers(corsHeaders);
        headers.set('Retry-After', String(rateLimit.retryAfterSec || 60));
        return jsonResponse(
          { error: 'Too many invalid attempts. Please try again later.' },
          429,
          headers
        );
      }

      if (!isValidTokenFormat(rawToken)) {
        recordFailedTokenAttempt(clientIp);
        return jsonResponse(
          { error: 'This private sharing link is invalid or unavailable.' },
          404,
          corsHeaders
        );
      }

      const tokenHash = await sha256Hex(rawToken);
      const share = await getShareRecordByHash(tokenHash, env);

      if (!share) {
        recordFailedTokenAttempt(clientIp);
        return jsonResponse(
          { error: 'This private sharing link is invalid or unavailable.' },
          404,
          corsHeaders
        );
      }

      const now = Date.now();
      if (share.status === 'revoked') {
        return jsonResponse(
          {
            error: 'This private sharing link has been revoked by an administrator.',
            revoked: true,
          },
          410,
          corsHeaders
        );
      }

      if (share.expiresAt && now > share.expiresAt) {
        return jsonResponse(
          {
            error: 'This private sharing link has expired.',
            expired: true,
          },
          410,
          corsHeaders
        );
      }

      const formatInfo = getWorkerFileFormatInfo(share.fileName);

      return jsonResponse(
        {
          valid: true,
          materialTitle: share.materialTitle,
          fileName: share.fileName,
          fileSize: share.fileSize,
          mimeType: formatInfo.mimeType,
          fileTypeInfo: formatInfo,
          recipientName: share.recipientName,
          instructions: share.instructions,
          dueDate: share.dueDate,
          createdAt: share.createdAt,
          expiresAt: share.expiresAt,
          downloadUrl: `${url.origin}/private-shares/${encodeURIComponent(rawToken)}/file?download=1`,
          previewUrl: formatInfo.previewable
            ? `${url.origin}/private-shares/${encodeURIComponent(rawToken)}/file`
            : undefined,
        },
        200,
        corsHeaders
      );
    }

    // F. GET / HEAD /private-shares/:token/file: Authorized file stream & download (NO LOGIN REQUIRED)
    const privateShareFileMatch = pathname.match(/^\/private-shares\/([a-zA-Z0-9_-]+)\/file$/);
    if (privateShareFileMatch && (request.method === 'GET' || request.method === 'HEAD')) {
      const rawToken = privateShareFileMatch[1];
      const clientIp = request.headers.get('CF-Connecting-IP') || 'anonymous';

      const rateLimit = checkRateLimit(clientIp);
      if (rateLimit.isBlocked) {
        const headers = new Headers(corsHeaders);
        headers.set('Retry-After', String(rateLimit.retryAfterSec || 60));
        return jsonResponse(
          { error: 'Too many requests. Please try again later.' },
          429,
          headers
        );
      }

      if (!isValidTokenFormat(rawToken)) {
        recordFailedTokenAttempt(clientIp);
        return jsonResponse(
          { error: 'This private sharing link is invalid or unavailable.' },
          404,
          corsHeaders
        );
      }

      const tokenHash = await sha256Hex(rawToken);
      const share = await getShareRecordByHash(tokenHash, env);

      if (!share) {
        recordFailedTokenAttempt(clientIp);
        return jsonResponse(
          { error: 'This private sharing link is invalid or unavailable.' },
          404,
          corsHeaders
        );
      }

      const now = Date.now();
      if (share.status === 'revoked') {
        return jsonResponse(
          { error: 'This private sharing link has been revoked by an administrator.' },
          410,
          corsHeaders
        );
      }

      if (share.expiresAt && now > share.expiresAt) {
        return jsonResponse(
          { error: 'This private sharing link has expired.' },
          410,
          corsHeaders
        );
      }

      // Update access stats asynchronously
      share.accessCount = (share.accessCount || 0) + 1;
      share.lastAccessedAt = now;
      if (ctx?.waitUntil) {
        ctx.waitUntil(saveShareRecord(share, env));
      } else {
        saveShareRecord(share, env).catch(() => {});
      }

      const isDownload = url.searchParams.get('download') === '1';
      const formatInfo = getWorkerFileFormatInfo(share.fileName);
      const safeFilename = sanitizeWorkerFilename(share.fileName, 'shared_material');
      const r2Key = share.r2Key || `materials/${share.materialId}.pdf`;

      const rangeHeader = request.headers.get('Range');
      const ifNoneMatch = request.headers.get('If-None-Match');

      // 1. Full GET without Range header
      if (request.method === 'GET' && !rangeHeader) {
        let fullObj = await env.PDF_BUCKET.get(r2Key);
        if (!fullObj && r2Key !== `materials/${share.materialId}.pdf`) {
          fullObj = await env.PDF_BUCKET.get(`materials/${share.materialId}.pdf`);
        }

        if (!fullObj) {
          return jsonResponse({ error: 'The requested file was not found in storage.' }, 404, corsHeaders);
        }

        const headers = new Headers(corsHeaders);
        fullObj.writeHttpMetadata(headers);
        headers.set('Content-Type', formatInfo.mimeType);
        headers.set(
          'Content-Disposition',
          `${isDownload || !formatInfo.previewable ? 'attachment' : 'inline'}; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(safeFilename)}`
        );
        headers.set('ETag', fullObj.httpEtag);
        headers.set('Accept-Ranges', 'bytes');
        headers.set('Content-Length', String(fullObj.size));
        headers.set('Cache-Control', 'private, no-store');
        headers.set('X-Content-Type-Options', 'nosniff');
        headers.set('Referrer-Policy', 'no-referrer');

        if (ifNoneMatch && (ifNoneMatch === fullObj.httpEtag || ifNoneMatch === `W/${fullObj.httpEtag}`)) {
          return new Response(null, { status: 304, headers });
        }

        return new Response(fullObj.body, { status: 200, headers });
      }

      // 2. Range or HEAD requests
      let headObj = typeof env.PDF_BUCKET.head === 'function' ? await env.PDF_BUCKET.head(r2Key) : null;
      if (!headObj) {
        headObj = await env.PDF_BUCKET.get(r2Key);
      }
      if (!headObj) {
        headObj = await env.PDF_BUCKET.get(`materials/${share.materialId}.pdf`);
      }

      if (!headObj) {
        return jsonResponse({ error: 'The requested file was not found in storage.' }, 404, corsHeaders);
      }

      const totalSize = headObj.size;
      const headers = new Headers(corsHeaders);
      headObj.writeHttpMetadata(headers);
      headers.set('Content-Type', formatInfo.mimeType);
      headers.set(
        'Content-Disposition',
        `${isDownload || !formatInfo.previewable ? 'attachment' : 'inline'}; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(safeFilename)}`
      );
      headers.set('ETag', headObj.httpEtag);
      headers.set('Accept-Ranges', 'bytes');
      headers.set('Cache-Control', 'private, no-store');
      headers.set('X-Content-Type-Options', 'nosniff');
      headers.set('Referrer-Policy', 'no-referrer');

      if (ifNoneMatch && (ifNoneMatch === headObj.httpEtag || ifNoneMatch === `W/${headObj.httpEtag}`)) {
        return new Response(null, { status: 304, headers });
      }

      if (rangeHeader) {
        const parsed = parseByteRange(rangeHeader, totalSize);
        if (parsed === 'unsatisfiable' || parsed === 'invalid') {
          headers.set('Content-Range', `bytes */${totalSize}`);
          return new Response(null, { status: 416, headers });
        }
        if (parsed !== null) {
          const { start, end } = parsed;
          const contentLength = end - start + 1;
          headers.set('Content-Range', `bytes ${start}-${end}/${totalSize}`);
          headers.set('Content-Length', String(contentLength));

          if (request.method === 'HEAD') {
            return new Response(null, { status: 206, headers });
          }

          const rangeObj = await env.PDF_BUCKET.get(r2Key, {
            range: { offset: start, length: contentLength },
          });
          if (!rangeObj) {
            return jsonResponse({ error: 'File chunk not found in storage.' }, 404, corsHeaders);
          }
          return new Response(rangeObj.body, { status: 206, headers });
        }
      }

      headers.set('Content-Length', String(totalSize));
      if (request.method === 'HEAD') {
        return new Response(null, { status: 200, headers });
      }

      const fullObj = await env.PDF_BUCKET.get(r2Key);
      if (!fullObj) {
        return jsonResponse({ error: 'The requested file was not found in storage.' }, 404, corsHeaders);
      }
      return new Response(fullObj.body, { status: 200, headers });
    }

    // -------------------------------------------------------------
    // EXISTING PUBLIC & ADMIN MATERIAL ROUTES
    // -------------------------------------------------------------

    // Match /materials/:materialId/(pdf|file) route
    const materialPdfMatch = pathname.match(/^\/materials\/([^/]+)\/(?:pdf|file)$/);
    const rawMaterialId = materialPdfMatch ? decodeURIComponent(materialPdfMatch[1]) : null;

    if (!rawMaterialId) {
      return jsonResponse({ error: 'Not found' }, 404, corsHeaders);
    }

    // Security: strictly validate materialId format to prevent path traversal or injection
    if (!/^[a-zA-Z0-9_-]+$/.test(rawMaterialId)) {
      return jsonResponse({ error: 'Invalid material ID format' }, 400, corsHeaders);
    }
    const materialId = rawMaterialId;

    // -------------------------------------------------------------
    // GET / HEAD: Serve PDF for a material (Public or Authorized Admin)
    // -------------------------------------------------------------
    // -------------------------------------------------------------
    // GET / HEAD: Serve PDF for a material (Public or Authorized Admin)
    // -------------------------------------------------------------
    if (request.method === 'GET' || request.method === 'HEAD') {
      const isDownload = url.searchParams.get('download') === '1';
      const rangeHeader = request.headers.get('Range');
      const ifNoneMatch = request.headers.get('If-None-Match');
      const defaultCache = typeof caches !== 'undefined' ? (caches as unknown as { default?: { match(r: Request): Promise<Response | undefined>; put(r: Request, res: Response): Promise<void>; delete(r: Request): Promise<boolean> } }).default : undefined;

      // Check Cloudflare Edge Cache for full GET requests (published materials only, unauthenticated)
      const hasAuthHeader = Boolean(request.headers.get('Authorization'));
      if (defaultCache && request.method === 'GET' && !rangeHeader && !hasAuthHeader) {
        try {
          const cacheKey = new Request(url.toString(), { method: 'GET' });
          const cachedResponse = await defaultCache.match(cacheKey);
          if (cachedResponse) {
            const cachedEtag = cachedResponse.headers.get('ETag');
            if (ifNoneMatch && cachedEtag && (ifNoneMatch === cachedEtag || ifNoneMatch === `W/${cachedEtag}`)) {
              return new Response(null, { status: 304, headers: cachedResponse.headers });
            }
            return cachedResponse;
          }
        } catch {
          // Proceed to origin if cache read encounters an error
        }
      }

      let material: PublicMaterialRecord | null = null;
      let isDraftView = false;

      // Check public partition first (uses in-memory metadata cache for sub-millisecond retrieval)
      material = await getPublicMaterialMetadata(materialId, env);

      // If not in publicMaterials, check if request is by an authorized administrator
      if (!material) {
        const auth = await verifyAdminRequest(request, env);
        if (auth.isAuthorized) {
          const authHeader = request.headers.get('Authorization') || '';
          const token = authHeader.replace(/^Bearer\s+/i, '').trim();
          material = await getAdminMaterialMetadata(materialId, token, env);
          isDraftView = true;
        }
      }

      // If still not found or not published without admin auth -> reject access
      if (!material) {
        return jsonResponse(
          {
            error: 'The requested study material is unavailable, unpublished, or access is restricted.',
          },
          403,
          corsHeaders
        );
      }

      // Determine R2 object key
      // Prefer explicit r2Key from metadata, fallback to standard path convention
      const r2Key =
        material.r2Key ||
        (material.storagePath && material.storagePath.startsWith('r2://')
          ? material.storagePath.replace('r2://', '')
          : `materials/${materialId}.pdf`);

      const rawName = material.fileName || `${material.title || 'study_material'}.pdf`;
      const formatInfo = getWorkerFileFormatInfo(rawName);
      const safeFilename = sanitizeWorkerFilename(rawName, 'study_material');

      // Optimized Path A: Full GET request without Range header (Stream directly in 1 R2 call)
      if (request.method === 'GET' && !rangeHeader) {
        const fullObj = await env.PDF_BUCKET.get(r2Key);
        if (!fullObj) {
          return jsonResponse(
            { error: `PDF document not found in storage bucket for material: ${materialId}` },
            404,
            corsHeaders
          );
        }

        const headers = new Headers(corsHeaders);
        fullObj.writeHttpMetadata(headers);
        headers.set('Content-Type', formatInfo.mimeType);
        headers.set(
          'Content-Disposition',
          `${isDownload || !formatInfo.previewable ? 'attachment' : 'inline'}; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(safeFilename)}`
        );
        headers.set('ETag', fullObj.httpEtag);
        headers.set('Accept-Ranges', 'bytes');
        headers.set('Content-Length', String(fullObj.size));

        if (isDraftView) {
          headers.set('Cache-Control', 'private, no-store');
        } else {
          headers.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
        }

        // 304 Not Modified check
        if (ifNoneMatch && (ifNoneMatch === fullObj.httpEtag || ifNoneMatch === `W/${fullObj.httpEtag}`)) {
          return new Response(null, { status: 304, headers });
        }

        const response = new Response(fullObj.body, { status: 200, headers });

        // Store published immutable PDF in Cloudflare Edge Cache
        if (defaultCache && !isDraftView) {
          const cacheKey = new Request(url.toString(), { method: 'GET' });
          const responseToCache = response.clone();
          if (ctx?.waitUntil) {
            ctx.waitUntil(defaultCache.put(cacheKey, responseToCache));
          } else {
            defaultCache.put(cacheKey, responseToCache).catch(() => {});
          }
        }

        return response;
      }

      // Path B: HEAD requests or Range requests
      const ifRange = request.headers.get('If-Range');

      let headObj = typeof env.PDF_BUCKET.head === 'function' ? await env.PDF_BUCKET.head(r2Key) : null;
      if (!headObj) {
        const fallbackObj = await env.PDF_BUCKET.get(r2Key);
        if (!fallbackObj) {
          return jsonResponse(
            { error: `PDF document not found in storage bucket for material: ${materialId}` },
            404,
            corsHeaders
          );
        }
        headObj = fallbackObj;
      }

      const totalSize = headObj.size;
      const headers = new Headers(corsHeaders);
      headObj.writeHttpMetadata(headers);
      headers.set('Content-Type', formatInfo.mimeType);
      headers.set(
        'Content-Disposition',
        `${isDownload || !formatInfo.previewable ? 'attachment' : 'inline'}; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(safeFilename)}`
      );
      headers.set('ETag', headObj.httpEtag);
      headers.set('Accept-Ranges', 'bytes');

      if (isDraftView) {
        headers.set('Cache-Control', 'private, no-store');
      } else {
        headers.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
      }

      // 304 Not Modified check
      if (ifNoneMatch && (ifNoneMatch === headObj.httpEtag || ifNoneMatch === `W/${headObj.httpEtag}`)) {
        return new Response(null, { status: 304, headers });
      }

      // Range handling per RFC 7233 / RFC 9110
      // Check If-Range validator if supplied: If-Range must match current ETag to serve 206
      const isRangeApplicable = Boolean(rangeHeader) && (!ifRange || ifRange === headObj.httpEtag || ifRange === `W/${headObj.httpEtag}`);

      if (isRangeApplicable && rangeHeader) {
        const parsed = parseByteRange(rangeHeader, totalSize);
        if (parsed === 'unsatisfiable' || parsed === 'invalid') {
          headers.set('Content-Range', `bytes */${totalSize}`);
          return new Response(null, { status: 416, headers });
        }
        if (parsed !== null) {
          const { start, end } = parsed;
          const contentLength = end - start + 1;
          headers.set('Content-Range', `bytes ${start}-${end}/${totalSize}`);
          headers.set('Content-Length', String(contentLength));

          if (request.method === 'HEAD') {
            return new Response(null, { status: 206, headers });
          }

          const rangeObj = await env.PDF_BUCKET.get(r2Key, {
            range: { offset: start, length: contentLength },
          });
          if (!rangeObj) {
            return jsonResponse(
              { error: `PDF document not found in storage bucket for material: ${materialId}` },
              404,
              corsHeaders
            );
          }
          return new Response(rangeObj.body, { status: 206, headers });
        }
      }

      headers.set('Content-Length', String(totalSize));
      if (request.method === 'HEAD') {
        return new Response(null, { status: 200, headers });
      }

      const fullObj = await env.PDF_BUCKET.get(r2Key);
      if (!fullObj) {
        return jsonResponse(
          { error: `PDF document not found in storage bucket for material: ${materialId}` },
          404,
          corsHeaders
        );
      }
      return new Response(fullObj.body, { status: 200, headers });
    }

    // -------------------------------------------------------------
    // PUT: Administrator Upload / Replacement of Material
    // -------------------------------------------------------------
    if (request.method === 'PUT') {
      const auth = await verifyAdminRequest(request, env);
      if (!auth.isAuthorized) {
        return jsonResponse(
          { error: auth.error || 'Administrator authorization required for PDF upload.' },
          401,
          corsHeaders
        );
      }

      // Check content-length
      const contentLengthHeader = request.headers.get('Content-Length');
      const contentLength = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;
      if (contentLength > MAX_PDF_SIZE_BYTES) {
        return jsonResponse(
          { error: `File exceeds maximum allowed size of 50 MB (${(contentLength / (1024 * 1024)).toFixed(1)} MB).` },
          413,
          corsHeaders
        );
      }

      // Read binary buffer
      const buffer = await request.arrayBuffer();
      if (buffer.byteLength < 5) {
        return jsonResponse({ error: 'Uploaded file is empty or corrupted.' }, 400, corsHeaders);
      }

      // Extract filename from header or query
      const rawFilename =
        request.headers.get('X-Filename') ||
        url.searchParams.get('filename') ||
        `${materialId}.pdf`;
      const fileName = sanitizeWorkerFilename(decodeURIComponent(rawFilename), `${materialId}.pdf`);
      const ext = getFileExtension(fileName);

      if (isDangerousExtension(fileName)) {
        return jsonResponse(
          { error: 'Prohibited file type: Executable and dangerous files are strictly rejected.' },
          400,
          corsHeaders
        );
      }

      // Validate magic bytes header
      const magicCheck = validateMagicBytes(buffer, ext);
      if (!magicCheck.isValid) {
        return jsonResponse(
          { error: magicCheck.error || 'Invalid file format.' },
          400,
          corsHeaders
        );
      }

      const formatInfo = getWorkerFileFormatInfo(fileName);
      const r2Key = `materials/${materialId}/${Date.now()}_${fileName}`;

      // Upload directly into R2
      const uploadedObject = await env.PDF_BUCKET.put(r2Key, buffer, {
        httpMetadata: {
          contentType: formatInfo.mimeType,
          contentDisposition: `${formatInfo.previewable ? 'inline' : 'attachment'}; filename="${fileName}"`,
        },
        customMetadata: {
          materialId,
          fileName,
          mimeType: formatInfo.mimeType,
          uploadedBy: auth.email || auth.uid || 'admin',
          uploadedAt: String(Date.now()),
        },
      });

      // Invalidate in-memory metadata cache and Cloudflare Edge Cache for this material
      invalidatePublicMaterialCache(materialId);
      const defaultCacheObj = typeof caches !== 'undefined' ? (caches as unknown as { default?: { delete(r: Request): Promise<boolean> } }).default : undefined;
      if (defaultCacheObj) {
        try {
          const origin = url.origin;
          await Promise.all([
            defaultCacheObj.delete(new Request(`${origin}/materials/${encodeURIComponent(materialId)}/pdf`, { method: 'GET' })),
            defaultCacheObj.delete(new Request(`${origin}/materials/${encodeURIComponent(materialId)}/pdf?download=1`, { method: 'GET' })),
          ]);
        } catch {
          // Ignore cache deletion errors
        }
      }

      return jsonResponse(
        {
          ok: true,
          materialId,
          r2Key,
          fileName,
          mimeType: formatInfo.mimeType,
          fileSize: uploadedObject.size,
          etag: uploadedObject.httpEtag,
          storagePath: `r2://${r2Key}`,
          downloadUrl: `${url.origin}/materials/${encodeURIComponent(materialId)}/pdf`,
          uploadedAt: Date.now(),
        },
        200,
        corsHeaders
      );
    }

    // -------------------------------------------------------------
    // DELETE: Administrator Deletion of PDF from R2
    // -------------------------------------------------------------
    if (request.method === 'DELETE') {
      const auth = await verifyAdminRequest(request, env);
      if (!auth.isAuthorized) {
        return jsonResponse(
          { error: auth.error || 'Administrator authorization required.' },
          401,
          corsHeaders
        );
      }

      const defaultKey = `materials/${materialId}.pdf`;
      const requestedKey = url.searchParams.get('key');
      let keyToDelete = defaultKey;

      if (requestedKey) {
        // Validate requestedKey strictly belongs to this materialId namespace
        // Must be either materials/${materialId}.pdf OR materials/${materialId}/${single_filename_segment}
        const allowedPrefix = `materials/${materialId}/`;
        const isLegacyKey = requestedKey === defaultKey;
        const isMaterialNamespaceKey =
          requestedKey.startsWith(allowedPrefix) &&
          !requestedKey.includes('..') &&
          !requestedKey.slice(allowedPrefix.length).includes('/') &&
          /^[a-zA-Z0-9._-]+$/.test(requestedKey.slice(allowedPrefix.length));

        if (!isLegacyKey && !isMaterialNamespaceKey) {
          return jsonResponse(
            { error: 'Forbidden: Cannot delete objects outside the namespace of this material.' },
            403,
            corsHeaders
          );
        }
        keyToDelete = requestedKey;
      }

      await env.PDF_BUCKET.delete(keyToDelete);

      // Invalidate in-memory metadata cache and Cloudflare Edge Cache for this material
      invalidatePublicMaterialCache(materialId);
      const delCacheObj = typeof caches !== 'undefined' ? (caches as unknown as { default?: { delete(r: Request): Promise<boolean> } }).default : undefined;
      if (delCacheObj) {
        try {
          const origin = url.origin;
          await Promise.all([
            delCacheObj.delete(new Request(`${origin}/materials/${encodeURIComponent(materialId)}/pdf`, { method: 'GET' })),
            delCacheObj.delete(new Request(`${origin}/materials/${encodeURIComponent(materialId)}/pdf?download=1`, { method: 'GET' })),
          ]);
        } catch {
          // Ignore cache deletion errors
        }
      }

      return jsonResponse(
        {
          ok: true,
          deleted: keyToDelete,
          materialId,
        },
        200,
        corsHeaders
      );
    }

    return jsonResponse({ error: 'Method Not Allowed' }, 405, corsHeaders);
  },
};
