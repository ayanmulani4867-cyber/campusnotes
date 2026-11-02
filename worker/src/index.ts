// Cloudflare Worker: campusnotes-pdf-api
// Secure R2 Multi-Format Storage, Streaming Service, and Student Contributions API
// Enforces Firebase metadata validation, admin authorization, and binary streaming.

import type { Env, PublicMaterialRecord, StudentSubmission, SubmissionStatus } from './types.ts';
import { verifyAdminRequest } from './auth.ts';
import { getPublicMaterialMetadata, getAdminMaterialMetadata, invalidatePublicMaterialCache } from './firebase.ts';
import {
  getWorkerFileFormatInfo,
  sanitizeWorkerFilename,
  validateMagicBytes,
  getFileExtension,
  isDangerousExtension,
  WORKER_SUPPORTED_FORMATS,
} from './fileTypes.ts';
import {
  MAX_FILE_SIZE_BYTES,
  MAX_FILE_SIZE_ERROR,
  parseByteRange,
  sanitizeFilename,
} from './utils.ts';
import type { ParsedByteRange } from './utils.ts';

const DEFAULT_ALLOWED_ORIGINS = [
  'https://campusnotes.space',
  'https://www.campusnotes.space',
  'https://campusnotes-ifpr.onrender.com',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:3000',
];




// Rate limiting state: IP -> timestamps
const ipSubmissionTimestamps = new Map<string, number[]>();
const MAX_SUBMISSIONS_PER_IP = 10;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

// In-memory active upload tokens for secure two-step public submissions
interface ActiveUploadToken {
  uploadToken?: string;
  submissionId: string;
  expiresAt: number;
  expectedSizeBytes: number;
  originalFilename: string;
  safeFilename: string;
  mimeType: string;
  metadata: {
    studentName: string;
    email?: string;
    college?: string;
    materialTitle: string;
    description?: string;
    semesterId: string;
    subjectId: string;
    category: string;
  };
}
const activeUploadTokens = new Map<string, ActiveUploadToken>();

// In-memory cache for pending submission metadata to avoid excessive R2 round-trips
const submissionMetadataCache = new Map<string, StudentSubmission>();

/**
 * Builds standard CORS headers based on request origin
 */
function buildCorsHeaders(request: Request, env: Env): Headers {
  const origin = request.headers.get('Origin') || '';
  const configured = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  const allowedOrigins = Array.from(new Set([...DEFAULT_ALLOWED_ORIGINS, ...configured]));
  const isAllowed = allowedOrigins.includes('*') || allowedOrigins.includes(origin);
  const allowOriginValue = isAllowed ? origin : (origin || '*');

  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', allowOriginValue);
  headers.set('Access-Control-Allow-Methods', 'GET, HEAD, PUT, POST, PATCH, DELETE, OPTIONS');
  headers.set(
    'Access-Control-Allow-Headers',
    'Authorization, Content-Type, Range, X-Filename, If-None-Match, If-Range, If-Match, X-Upload-Token, X-Submission-Id'
  );
  headers.set(
    'Access-Control-Expose-Headers',
    'Content-Length, Content-Disposition, Content-Range, ETag, Accept-Ranges, Retry-After'
  );
  headers.set('Access-Control-Max-Age', '86400');
  headers.set('Vary', 'Origin');
  return headers;
}

function jsonResponse(data: unknown, status = 200, corsHeaders?: Headers): Response {
  const headers = corsHeaders ? new Headers(corsHeaders) : new Headers();
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(data), { status, headers });
}

function checkRateLimit(ip: string): boolean {
  if (!ip) return true;
  const now = Date.now();
  const existing = (ipSubmissionTimestamps.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (existing.length >= MAX_SUBMISSIONS_PER_IP) {
    return false;
  }
  existing.push(now);
  ipSubmissionTimestamps.set(ip, existing);
  return true;
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
          version: '2.1.0',
          bucket: 'campusnotes-pdfs',
          maxFileSize: MAX_FILE_SIZE_BYTES,
          timestamp: Date.now(),
        },
        200,
        corsHeaders
      );
    }

    // 3. Decommission temporary test endpoint
    if (normalizedPath === '/test-pdf') {
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
    // STUDENT CONTRIBUTIONS ROUTES
    // -------------------------------------------------------------

    // Route: POST /submissions/init — Initialize anonymous student submission
    if (normalizedPath === '/submissions/init' && request.method === 'POST') {
      const clientIp = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
      if (!checkRateLimit(clientIp)) {
        return jsonResponse(
          { error: 'Rate limit exceeded. Please wait a few minutes before submitting another study material.' },
          429,
          corsHeaders
        );
      }

      let payload: Record<string, unknown>;
      try {
        payload = (await request.json()) as Record<string, unknown>;
      } catch {
        return jsonResponse({ error: 'Invalid JSON request body.' }, 400, corsHeaders);
      }

      // Spam Protection: Honeypot check
      if (payload.honeypot && String(payload.honeypot).trim().length > 0) {
        return jsonResponse({ error: 'Spam detected.' }, 400, corsHeaders);
      }

      // Timing check: Minimum 1 second form duration
      if (typeof payload.formStartTime === 'number') {
        const elapsed = Date.now() - payload.formStartTime;
        if (elapsed < 1000) {
          return jsonResponse({ error: 'Spam detected: form submitted too quickly.' }, 400, corsHeaders);
        }
      }

      // Required field validation
      const studentName = String(payload.studentName || '').trim();
      const materialTitle = String(payload.materialTitle || '').trim();
      const semesterId = String(payload.semesterId || '').trim();
      const subjectId = String(payload.subjectId || '').trim();
      const category = String(payload.category || '').trim();
      const description = String(payload.description || '').trim();
      const email = String(payload.email || '').trim();
      const college = String(payload.college || '').trim();
      const fileName = String(payload.fileName || '').trim();
      const fileSize = Number(payload.fileSize || 0);

      if (!studentName || studentName.length < 2 || studentName.length > 100) {
        return jsonResponse({ error: 'Student name must be between 2 and 100 characters.' }, 400, corsHeaders);
      }
      if (!materialTitle || materialTitle.length < 2 || materialTitle.length > 150) {
        return jsonResponse({ error: 'Material title must be between 2 and 150 characters.' }, 400, corsHeaders);
      }
      if (!semesterId) {
        return jsonResponse({ error: 'Please select a valid semester.' }, 400, corsHeaders);
      }
      if (!subjectId) {
        return jsonResponse({ error: 'Please select a valid subject.' }, 400, corsHeaders);
      }
      if (!category) {
        return jsonResponse({ error: 'Please select a material category.' }, 400, corsHeaders);
      }
      if (!fileName) {
        return jsonResponse({ error: 'File name is required.' }, 400, corsHeaders);
      }

      // File size enforcement: exactly 50 MB
      if (fileSize <= 0) {
        return jsonResponse({ error: 'Uploaded file is empty.' }, 400, corsHeaders);
      }
      if (fileSize > MAX_FILE_SIZE_BYTES) {
        return jsonResponse({ error: MAX_FILE_SIZE_ERROR }, 413, corsHeaders);
      }

      // Extension & dangerous file validation
      const ext = getFileExtension(fileName);
      if (isDangerousExtension(fileName)) {
        return jsonResponse({ error: 'Prohibited file type: Executable files are strictly rejected.' }, 400, corsHeaders);
      }
      if (!ext || !WORKER_SUPPORTED_FORMATS[ext]) {
        return jsonResponse(
          { error: `Unsupported file format (.${ext}). CampusNotes supports 15 standard academic document, image, and archive formats.` },
          400,
          corsHeaders
        );
      }

      const formatInfo = getWorkerFileFormatInfo(fileName);
      const safeFilename = sanitizeWorkerFilename(fileName, 'contribution');
      const submissionId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const uploadToken = `tok_${Date.now()}_${Math.random().toString(36).substring(2, 12)}`;

      // Save token state for binary upload (15 min expiry)
      const tokenRecord: ActiveUploadToken = {
        submissionId,
        uploadToken,
        expiresAt: Date.now() + 15 * 60 * 1000,
        expectedSizeBytes: fileSize,
        originalFilename: fileName,
        safeFilename,
        mimeType: formatInfo.mimeType,
        metadata: {
          studentName,
          email: email || undefined,
          college: college || undefined,
          materialTitle,
          description: description || undefined,
          semesterId,
          subjectId,
          category,
        },
      };
      activeUploadTokens.set(uploadToken, tokenRecord);
      try {
        await env.PDF_BUCKET.put(
          `pending_submissions/${submissionId}/_init.json`,
          JSON.stringify(tokenRecord),
          { httpMetadata: { contentType: 'application/json' } }
        );
      } catch (initSaveErr) {
        console.error('Failed to persist token to R2:', initSaveErr);
      }

      return jsonResponse(
        {
          ok: true,
          submissionId,
          uploadToken,
          uploadUrl: `${url.origin}/submissions/${encodeURIComponent(submissionId)}/upload`,
          maxSizeBytes: MAX_FILE_SIZE_BYTES,
        },
        200,
        corsHeaders
      );
    }

    // Route: PUT or POST /submissions/:submissionId/upload — Direct binary upload of student material
    const subUploadMatch = pathname.match(/^\/submissions\/([^/]+)\/upload$/);
    if (subUploadMatch && (request.method === 'PUT' || request.method === 'POST')) {
      const submissionId = decodeURIComponent(subUploadMatch[1]);
      const uploadToken = request.headers.get('X-Upload-Token') || url.searchParams.get('token') || '';

      let tokenData = activeUploadTokens.get(uploadToken);
      if (!tokenData || tokenData.submissionId !== submissionId) {
        try {
          const initObj = await env.PDF_BUCKET.get(`pending_submissions/${submissionId}/_init.json`);
          if (initObj) {
            const raw = await initObj.text();
            const parsed = JSON.parse(raw);
            if (parsed && parsed.uploadToken === uploadToken) {
              tokenData = parsed;
            }
          }
        } catch (r2TokenErr) {
          console.error('Failed to read persistent token from R2:', r2TokenErr);
        }
      }
      if (!tokenData || tokenData.submissionId !== submissionId || Date.now() > tokenData.expiresAt) {
        return jsonResponse(
          { error: 'Invalid, missing, or expired upload token. Please restart your submission.' },
          403,
          corsHeaders
        );
      }

      // Check Content-Length if provided
      const contentLengthHeader = request.headers.get('Content-Length');
      const contentLength = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;
      if (contentLength > MAX_FILE_SIZE_BYTES) {
        return jsonResponse({ error: MAX_FILE_SIZE_ERROR }, 413, corsHeaders);
      }

      // Read binary buffer
      const buffer = await request.arrayBuffer();
      if (buffer.byteLength === 0) {
        return jsonResponse({ error: 'Uploaded file is empty.' }, 400, corsHeaders);
      }
      if (buffer.byteLength > MAX_FILE_SIZE_BYTES) {
        return jsonResponse({ error: MAX_FILE_SIZE_ERROR }, 413, corsHeaders);
      }

      // Validate magic bytes
      const ext = getFileExtension(tokenData.safeFilename);
      const magicCheck = validateMagicBytes(buffer, ext);
      if (!magicCheck.isValid) {
        return jsonResponse({ error: magicCheck.error || 'Invalid file format.' }, 400, corsHeaders);
      }

      const storageKey = `pending_submissions/${submissionId}/${tokenData.safeFilename}`;
      const metadataKey = `pending_submissions/${submissionId}/metadata.json`;

      // 1. Upload binary file to pending R2 storage
      const uploadedFile = await env.PDF_BUCKET.put(storageKey, buffer, {
        httpMetadata: {
          contentType: tokenData.mimeType,
          contentDisposition: `attachment; filename="${tokenData.safeFilename}"`,
        },
        customMetadata: {
          submissionId,
          studentName: tokenData.metadata.studentName,
          status: 'pending',
          submittedAt: String(Date.now()),
        },
      });

      // 2. Save complete submission metadata record in R2
      const submissionRecord: StudentSubmission = {
        submissionId,
        studentName: tokenData.metadata.studentName,
        email: tokenData.metadata.email,
        college: tokenData.metadata.college,
        materialTitle: tokenData.metadata.materialTitle,
        description: tokenData.metadata.description,
        semesterId: tokenData.metadata.semesterId,
        subjectId: tokenData.metadata.subjectId,
        category: tokenData.metadata.category,
        originalFilename: tokenData.originalFilename,
        safeFilename: tokenData.safeFilename,
        mimeType: tokenData.mimeType,
        fileSize: uploadedFile.size,
        storageKey,
        status: 'pending',
        submittedAt: Date.now(),
      };

      await env.PDF_BUCKET.put(metadataKey, JSON.stringify(submissionRecord), {
        httpMetadata: {
          contentType: 'application/json',
        },
      });

      // Invalidate cache
      submissionMetadataCache.set(submissionId, submissionRecord);
      activeUploadTokens.delete(uploadToken);
      try {
        await env.PDF_BUCKET.delete(`pending_submissions/${submissionId}/_init.json`);
      } catch {}

      return jsonResponse(
        {
          ok: true,
          submissionId,
          message:
            'Thank you for contributing to CampusNotes! Your material has been submitted successfully. It will become available after administrator approval.',
        },
        201,
        corsHeaders
      );
    }

    // Route: POST /submissions — Direct multipart single-call upload (alternate path)
    if (normalizedPath === '/submissions' && request.method === 'POST') {
      const clientIp = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
      if (!checkRateLimit(clientIp)) {
        return jsonResponse(
          { error: 'Rate limit exceeded. Please wait a few minutes before submitting another study material.' },
          429,
          corsHeaders
        );
      }

      let formData: FormData;
      try {
        formData = await request.formData();
      } catch {
        return jsonResponse({ error: 'Expected multipart/form-data.' }, 400, corsHeaders);
      }

      // Spam check
      const honeypot = formData.get('honeypot');
      if (honeypot && String(honeypot).trim().length > 0) {
        return jsonResponse({ error: 'Spam detected.' }, 400, corsHeaders);
      }

      const file = formData.get('file');
      if (!file || !(file instanceof File)) {
        return jsonResponse({ error: 'Please select a file to upload.' }, 400, corsHeaders);
      }

      if (file.size === 0) {
        return jsonResponse({ error: 'Uploaded file is empty.' }, 400, corsHeaders);
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        return jsonResponse({ error: MAX_FILE_SIZE_ERROR }, 413, corsHeaders);
      }

      const studentName = String(formData.get('studentName') || '').trim();
      const materialTitle = String(formData.get('materialTitle') || '').trim();
      const semesterId = String(formData.get('semesterId') || '').trim();
      const subjectId = String(formData.get('subjectId') || '').trim();
      const category = String(formData.get('category') || '').trim();
      const description = String(formData.get('description') || '').trim();
      const email = String(formData.get('email') || '').trim();
      const college = String(formData.get('college') || '').trim();

      if (!studentName || !materialTitle || !semesterId || !subjectId || !category) {
        return jsonResponse({ error: 'All required contribution fields must be filled.' }, 400, corsHeaders);
      }

      const ext = getFileExtension(file.name);
      if (isDangerousExtension(file.name)) {
        return jsonResponse({ error: 'Prohibited file type: Executable files are strictly rejected.' }, 400, corsHeaders);
      }
      if (!ext || !WORKER_SUPPORTED_FORMATS[ext]) {
        return jsonResponse({ error: `Unsupported file format (.${ext}).` }, 400, corsHeaders);
      }

      const buffer = await file.arrayBuffer();
      const magicCheck = validateMagicBytes(buffer, ext);
      if (!magicCheck.isValid) {
        return jsonResponse({ error: magicCheck.error || 'Invalid file format.' }, 400, corsHeaders);
      }

      const formatInfo = getWorkerFileFormatInfo(file.name);
      const safeFilename = sanitizeWorkerFilename(file.name, 'contribution');
      const submissionId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const storageKey = `pending_submissions/${submissionId}/${safeFilename}`;
      const metadataKey = `pending_submissions/${submissionId}/metadata.json`;

      await env.PDF_BUCKET.put(storageKey, buffer, {
        httpMetadata: {
          contentType: formatInfo.mimeType,
          contentDisposition: `attachment; filename="${safeFilename}"`,
        },
        customMetadata: {
          submissionId,
          studentName,
          status: 'pending',
          submittedAt: String(Date.now()),
        },
      });

      const submissionRecord: StudentSubmission = {
        submissionId,
        studentName,
        email: email || undefined,
        college: college || undefined,
        materialTitle,
        description: description || undefined,
        semesterId,
        subjectId,
        category,
        originalFilename: file.name,
        safeFilename,
        mimeType: formatInfo.mimeType,
        fileSize: buffer.byteLength,
        storageKey,
        status: 'pending',
        submittedAt: Date.now(),
      };

      await env.PDF_BUCKET.put(metadataKey, JSON.stringify(submissionRecord), {
        httpMetadata: { contentType: 'application/json' },
      });

      submissionMetadataCache.set(submissionId, submissionRecord);

      return jsonResponse(
        {
          ok: true,
          submissionId,
          message:
            'Thank you for contributing to CampusNotes! Your material has been submitted successfully. It will become available after administrator approval.',
        },
        201,
        corsHeaders
      );
    }

    // Route: GET /submissions — List all submissions (Admin Only)
    if (normalizedPath === '/submissions' && request.method === 'GET') {
      const auth = await verifyAdminRequest(request, env);
      if (!auth.isAuthorized) {
        return jsonResponse({ error: auth.error || 'Administrator authorization required.' }, 401, corsHeaders);
      }

      const statusFilter = url.searchParams.get('status') || 'all';

      // List all metadata files under pending_submissions/
      let listed = await env.PDF_BUCKET.list({ prefix: 'pending_submissions/' });
      const metadataKeys = listed.objects
        .map((o) => o.key)
        .filter((k) => k.endsWith('/metadata.json'));

      const submissions: StudentSubmission[] = [];
      for (const key of metadataKeys) {
        const subIdMatch = key.match(/^pending_submissions\/([^/]+)\/metadata\.json$/);
        const subId = subIdMatch ? subIdMatch[1] : '';

        // Check memory cache first
        let record = subId ? submissionMetadataCache.get(subId) : undefined;
        if (!record) {
          const obj = await env.PDF_BUCKET.get(key);
          if (obj) {
            try {
              record = (await obj.json()) as StudentSubmission;
              if (record && record.submissionId) {
                submissionMetadataCache.set(record.submissionId, record);
              }
            } catch {
              // ignore parse errors
            }
          }
        }

        if (record) {
          if (statusFilter === 'all' || record.status === statusFilter) {
            submissions.push(record);
          }
        }
      }

      // Sort newest first
      submissions.sort((a, b) => b.submittedAt - a.submittedAt);

      return jsonResponse({ ok: true, submissions }, 200, corsHeaders);
    }

    // Route: GET /submissions/:submissionId/file — Preview/Download pending file (Admin Only)
    const subFileMatch = pathname.match(/^\/submissions\/([^/]+)\/file$/);
    if (subFileMatch && (request.method === 'GET' || request.method === 'HEAD')) {
      const auth = await verifyAdminRequest(request, env);
      if (!auth.isAuthorized) {
        return jsonResponse({ error: auth.error || 'Administrator authorization required.' }, 401, corsHeaders);
      }

      const submissionId = decodeURIComponent(subFileMatch[1]);
      let record = submissionMetadataCache.get(submissionId);
      if (!record) {
        const metaObj = await env.PDF_BUCKET.get(`pending_submissions/${submissionId}/metadata.json`);
        if (!metaObj) {
          return jsonResponse({ error: 'Submission not found.' }, 404, corsHeaders);
        }
        record = (await metaObj.json()) as StudentSubmission;
        submissionMetadataCache.set(submissionId, record);
      }

      const fileObj = await env.PDF_BUCKET.get(record.storageKey);
      if (!fileObj) {
        return jsonResponse({ error: 'Uploaded submission file not found in storage.' }, 404, corsHeaders);
      }

      const isDownload = url.searchParams.get('download') === '1';
      const headers = new Headers(corsHeaders);
      fileObj.writeHttpMetadata(headers);
      headers.set('Content-Type', record.mimeType);
      headers.set(
        'Content-Disposition',
        `${isDownload ? 'attachment' : 'inline'}; filename="${record.safeFilename}"; filename*=UTF-8''${encodeURIComponent(record.safeFilename)}`
      );
      headers.set('Cache-Control', 'private, no-store');
      headers.set('Content-Length', String(fileObj.size));
      headers.set('X-Content-Type-Options', 'nosniff');

      return new Response(request.method === 'HEAD' ? null : fileObj.body, { status: 200, headers });
    }

    // Route: POST /submissions/:submissionId/approve — Approve submission & publish (Admin Only)
    const subApproveMatch = pathname.match(/^\/submissions\/([^/]+)\/approve$/);
    if (subApproveMatch && request.method === 'POST') {
      const auth = await verifyAdminRequest(request, env);
      if (!auth.isAuthorized) {
        return jsonResponse({ error: auth.error || 'Administrator authorization required.' }, 401, corsHeaders);
      }

      const submissionId = decodeURIComponent(subApproveMatch[1]);
      const metaKey = `pending_submissions/${submissionId}/metadata.json`;
      const metaObj = await env.PDF_BUCKET.get(metaKey);
      if (!metaObj) {
        return jsonResponse({ error: 'Submission not found.' }, 404, corsHeaders);
      }

      const submission = (await metaObj.json()) as StudentSubmission;

      // Prevent duplicate publishing if approval is repeated
      if (submission.status === 'approved' && submission.publishedMaterialId) {
        return jsonResponse(
          {
            ok: true,
            message: 'Submission has already been approved and published.',
            materialId: submission.publishedMaterialId,
            submission,
          },
          200,
          corsHeaders
        );
      }

      // Read source file from pending storage
      const sourceObj = await env.PDF_BUCKET.get(submission.storageKey);
      if (!sourceObj) {
        return jsonResponse({ error: 'Pending file object not found in storage.' }, 404, corsHeaders);
      }

      const materialId = `mat_${Date.now()}_${submissionId.replace(/[^a-zA-Z0-9]/g, '').slice(-6)}`;
      const pubR2Key = `materials/${materialId}/${Date.now()}_${submission.safeFilename}`;

      // 1. Promote / Copy file into public materials namespace
      const buffer = await sourceObj.arrayBuffer();
      await env.PDF_BUCKET.put(pubR2Key, buffer, {
        httpMetadata: {
          contentType: submission.mimeType,
          contentDisposition: `inline; filename="${submission.safeFilename}"`,
        },
        customMetadata: {
          materialId,
          fileName: submission.originalFilename,
          mimeType: submission.mimeType,
          uploadedBy: `student:${submission.studentName}`,
          approvedBy: auth.email || auth.uid || 'admin',
          approvedAt: String(Date.now()),
        },
      });

      // 2. Publish to Firebase Realtime Database (/materials and /publicMaterials)
      const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
      const dbUrl = (env.FIREBASE_DATABASE_URL || 'https://campusnotes-e62cf-default-rtdb.firebaseio.com').replace(/\/+$/, '');

      const publicMaterialData = {
        id: materialId,
        title: submission.materialTitle,
        description: submission.description || '',
        subjectId: submission.subjectId,
        category: submission.category,
        academicYear: '2026-27',
        fileName: submission.originalFilename,
        mimeType: submission.mimeType,
        storagePath: `r2://${pubR2Key}`,
        downloadUrl: `${url.origin}/materials/${encodeURIComponent(materialId)}/pdf`,
        r2Key: pubR2Key,
        storageProvider: 'r2',
        fileSize: buffer.byteLength,
        published: true,
        createdAt: submission.submittedAt,
        updatedAt: Date.now(),
        createdBy: `student:${submission.studentName}`,
        contributedBy: submission.studentName,
        contributorEmail: submission.email || null,
        approvedBy: auth.email || auth.uid || 'admin',
        approvedAt: Date.now(),
      };

      if (token && dbUrl) {
        try {
          await Promise.all([
            fetch(`${dbUrl}/materials/${encodeURIComponent(materialId)}.json?auth=${encodeURIComponent(token)}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(publicMaterialData),
            }),
            fetch(`${dbUrl}/publicMaterials/${encodeURIComponent(materialId)}.json?auth=${encodeURIComponent(token)}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(publicMaterialData),
            }),
          ]);
        } catch (dbErr) {
          console.warn('Notice writing approved material to RTDB:', dbErr);
        }
      }

      // 3. Update submission record to approved
      submission.status = 'approved';
      submission.approvedAt = Date.now();
      submission.approvedBy = auth.email || auth.uid || 'admin';
      submission.publishedMaterialId = materialId;

      await env.PDF_BUCKET.put(metaKey, JSON.stringify(submission), {
        httpMetadata: { contentType: 'application/json' },
      });
      submissionMetadataCache.set(submissionId, submission);

      invalidatePublicMaterialCache(materialId);

      return jsonResponse(
        {
          ok: true,
          materialId,
          submission,
          message: 'Material successfully approved and published.',
        },
        200,
        corsHeaders
      );
    }

    // Route: POST /submissions/:submissionId/reject — Reject submission (Admin Only)
    const subRejectMatch = pathname.match(/^\/submissions\/([^/]+)\/reject$/);
    if (subRejectMatch && request.method === 'POST') {
      const auth = await verifyAdminRequest(request, env);
      if (!auth.isAuthorized) {
        return jsonResponse({ error: auth.error || 'Administrator authorization required.' }, 401, corsHeaders);
      }

      const submissionId = decodeURIComponent(subRejectMatch[1]);
      const metaKey = `pending_submissions/${submissionId}/metadata.json`;
      const metaObj = await env.PDF_BUCKET.get(metaKey);
      if (!metaObj) {
        return jsonResponse({ error: 'Submission not found.' }, 404, corsHeaders);
      }

      const submission = (await metaObj.json()) as StudentSubmission;
      submission.status = 'rejected';
      submission.rejectedAt = Date.now();
      submission.rejectedBy = auth.email || auth.uid || 'admin';

      await env.PDF_BUCKET.put(metaKey, JSON.stringify(submission), {
        httpMetadata: { contentType: 'application/json' },
      });
      submissionMetadataCache.set(submissionId, submission);

      return jsonResponse(
        {
          ok: true,
          submission,
          message: 'Submission rejected.',
        },
        200,
        corsHeaders
      );
    }

    // Route: DELETE /submissions/:submissionId — Safely delete pending submission (Admin Only)
    const subDeleteMatch = pathname.match(/^\/submissions\/([^/]+)$/);
    if (subDeleteMatch && request.method === 'DELETE') {
      const auth = await verifyAdminRequest(request, env);
      if (!auth.isAuthorized) {
        return jsonResponse({ error: auth.error || 'Administrator authorization required.' }, 401, corsHeaders);
      }

      const submissionId = decodeURIComponent(subDeleteMatch[1]);
      const metaKey = `pending_submissions/${submissionId}/metadata.json`;
      const metaObj = await env.PDF_BUCKET.get(metaKey);

      let storageKeyToDelete: string | null = null;
      if (metaObj) {
        try {
          const sub = (await metaObj.json()) as StudentSubmission;
          storageKeyToDelete = sub.storageKey;
        } catch {
          // ignore
        }
      }

      // Delete file and metadata safely
      if (storageKeyToDelete && storageKeyToDelete.startsWith(`pending_submissions/${submissionId}/`)) {
        await env.PDF_BUCKET.delete(storageKeyToDelete);
      }
      await env.PDF_BUCKET.delete(metaKey);
      submissionMetadataCache.delete(submissionId);

      return jsonResponse({ ok: true, deleted: submissionId }, 200, corsHeaders);
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

    // Strictly validate materialId format to prevent path traversal or injection
    if (!/^[a-zA-Z0-9_-]+$/.test(rawMaterialId)) {
      return jsonResponse({ error: 'Invalid material ID format' }, 400, corsHeaders);
    }
    const materialId = rawMaterialId;

    // -------------------------------------------------------------
    // GET / HEAD: Serve PDF for a material (Public or Authorized Admin)
    // -------------------------------------------------------------
    if (request.method === 'GET' || request.method === 'HEAD') {
      const isDownload = url.searchParams.get('download') === '1';
      const rangeHeader = request.headers.get('Range');
      const ifNoneMatch = request.headers.get('If-None-Match');
      const defaultCache =
        typeof caches !== 'undefined'
          ? (
              caches as unknown as {
                default?: {
                  match(r: Request): Promise<Response | undefined>;
                  put(r: Request, res: Response): Promise<void>;
                  delete(r: Request): Promise<boolean>;
                };
              }
            ).default
          : undefined;

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

      // Check public partition first
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

      // Check content-length: strictly enforce 50 MB (52,428,800 bytes)
      const contentLengthHeader = request.headers.get('Content-Length');
      const contentLength = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;
      if (contentLength > MAX_FILE_SIZE_BYTES) {
        return jsonResponse(
          { error: MAX_FILE_SIZE_ERROR },
          413,
          corsHeaders
        );
      }

      // Read binary buffer
      const buffer = await request.arrayBuffer();
      if (buffer.byteLength < 5) {
        return jsonResponse({ error: 'Uploaded file is empty or corrupted.' }, 400, corsHeaders);
      }
      if (buffer.byteLength > MAX_FILE_SIZE_BYTES) {
        return jsonResponse(
          { error: MAX_FILE_SIZE_ERROR },
          413,
          corsHeaders
        );
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
      const defaultCacheObj =
        typeof caches !== 'undefined'
          ? (caches as unknown as { default?: { delete(r: Request): Promise<boolean> } }).default
          : undefined;
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
      const delCacheObj =
        typeof caches !== 'undefined'
          ? (caches as unknown as { default?: { delete(r: Request): Promise<boolean> } }).default
          : undefined;
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
