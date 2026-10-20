// Cloudflare Worker: campusnotes-pdf-api
// Secure R2 PDF Storage and Streaming Service for CampusNotes
// Enforces Firebase metadata validation, admin authorization, and binary streaming.

import type { Env, PublicMaterialRecord } from './types.ts';
import { verifyAdminRequest } from './auth.ts';
import { getPublicMaterialMetadata, getAdminMaterialMetadata } from './firebase.ts';

const DEFAULT_ALLOWED_ORIGINS = [
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
  headers.set('Access-Control-Allow-Methods', 'GET, HEAD, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, Range, X-Filename, If-None-Match');
  headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Disposition, Content-Range, ETag, Accept-Ranges');
  headers.set('Access-Control-Max-Age', '86400');
  return headers;
}

function jsonResponse(data: unknown, status = 200, corsHeaders?: Headers): Response {
  const headers = corsHeaders ? new Headers(corsHeaders) : new Headers();
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(data), { status, headers });
}

function sanitizeFilename(name: string): string {
  const clean = name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
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
  async fetch(request: Request, env: Env): Promise<Response> {
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

    // 4. Match /materials/:materialId/pdf route
    const materialPdfMatch = pathname.match(/^\/materials\/([^/]+)\/pdf$/);
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
    if (request.method === 'GET' || request.method === 'HEAD') {
      let material: PublicMaterialRecord | null = null;
      let isDraftView = false;

      // Check public partition first
      material = await getPublicMaterialMetadata(materialId, env);

      // If not in publicMaterials, check if request is by an authorized administrator
      if (!material) {
        const auth = await verifyAdminRequest(request, env);
        if (auth.isAuthorized) {
          const authHeader = request.headers.get('Authorization') || '';
          let token = authHeader.replace(/^Bearer\s+/i, '').trim();
          if (!token) {
            token = url.searchParams.get('token') || url.searchParams.get('auth') || '';
          }
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
      const safeFilename = sanitizeFilename(rawName);
      const isDownload = url.searchParams.get('download') === '1';
      const rangeHeader = request.headers.get('Range');
      const ifNoneMatch = request.headers.get('If-None-Match');

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
        headers.set('Content-Type', 'application/pdf');
        headers.set(
          'Content-Disposition',
          `${isDownload ? 'attachment' : 'inline'}; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(safeFilename)}`
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

        return new Response(fullObj.body, { status: 200, headers });
      }

      // Path B: HEAD requests or Range requests
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
      headers.set('Content-Type', 'application/pdf');
      headers.set(
        'Content-Disposition',
        `${isDownload ? 'attachment' : 'inline'}; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(safeFilename)}`
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
    // PUT: Administrator Upload / Replacement of PDF
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

      // Validate %PDF- magic bytes header
      const headerBytes = new Uint8Array(buffer.slice(0, 5));
      const headerString = String.fromCharCode(...headerBytes);
      if (headerString !== '%PDF-') {
        return jsonResponse(
          { error: 'Invalid file format: File header does not match PDF signature (%PDF-).' },
          400,
          corsHeaders
        );
      }

      // Extract filename from header or query
      const rawFilename =
        request.headers.get('X-Filename') ||
        url.searchParams.get('filename') ||
        `${materialId}.pdf`;
      const fileName = sanitizeFilename(decodeURIComponent(rawFilename));
      const r2Key = `materials/${materialId}/${Date.now()}_${fileName}`;

      // Upload directly into R2
      const uploadedObject = await env.PDF_BUCKET.put(r2Key, buffer, {
        httpMetadata: {
          contentType: 'application/pdf',
          contentDisposition: `inline; filename="${fileName}"`,
        },
        customMetadata: {
          materialId,
          fileName,
          uploadedBy: auth.email || auth.uid || 'admin',
          uploadedAt: String(Date.now()),
        },
      });

      return jsonResponse(
        {
          ok: true,
          materialId,
          r2Key,
          fileName,
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
