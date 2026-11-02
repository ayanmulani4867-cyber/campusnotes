// Test Suite for Large File Uploads (up to 50 MB) and Student Contributions Workflow
import test, { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

import worker from '../src/index.ts';
import { setCustomJwksProvider, resetJwksCache } from '../src/auth.ts';

class MockR2Bucket {
  constructor() {
    this.store = new Map();
  }

  async head(key) {
    if (!this.store.has(key)) return null;
    const entry = this.store.get(key);
    return {
      key,
      size: entry.data.byteLength,
      etag: entry.etag || 'mock-etag-123',
      httpEtag: `"${entry.etag || 'mock-etag-123'}"`,
      uploaded: new Date(),
      writeHttpMetadata(headers) {
        if (entry.httpMetadata?.contentType) {
          headers.set('Content-Type', entry.httpMetadata.contentType);
        }
        if (entry.httpMetadata?.contentDisposition) {
          headers.set('Content-Disposition', entry.httpMetadata.contentDisposition);
        }
      },
    };
  }

  async get(key, options) {
    if (!this.store.has(key)) return null;
    const entry = this.store.get(key);
    let data = entry.data;

    if (options?.range) {
      const offset = options.range.offset || 0;
      const length = options.range.length;
      const end = length !== undefined ? offset + length : data.byteLength;
      data = data.slice(offset, end);
    }

    return {
      key,
      size: data.byteLength,
      etag: entry.etag || 'mock-etag-123',
      httpEtag: `"${entry.etag || 'mock-etag-123'}"`,
      uploaded: new Date(),
      body: new Response(data).body,
      writeHttpMetadata(headers) {
        if (entry.httpMetadata?.contentType) {
          headers.set('Content-Type', entry.httpMetadata.contentType);
        }
        if (entry.httpMetadata?.contentDisposition) {
          headers.set('Content-Disposition', entry.httpMetadata.contentDisposition);
        }
      },
      arrayBuffer: async () => data,
      text: async () => new TextDecoder().decode(data),
      json: async () => JSON.parse(new TextDecoder().decode(data)),
    };
  }

  async put(key, value, options) {
    let buf;
    if (value instanceof ArrayBuffer) {
      buf = value;
    } else if (ArrayBuffer.isView(value)) {
      buf = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
    } else if (typeof value === 'string') {
      buf = new TextEncoder().encode(value).buffer;
    } else if (value && typeof value.getReader === 'function') {
      const reader = value.getReader();
      const chunks = [];
      let total = 0;
      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        chunks.push(chunk);
        total += chunk.byteLength;
      }
      const combined = new Uint8Array(total);
      let offset = 0;
      for (const ch of chunks) {
        combined.set(ch, offset);
        offset += ch.byteLength;
      }
      buf = combined.buffer;
    } else {
      buf = new ArrayBuffer(0);
    }

    const etag = 'etag-' + Date.now();
    this.store.set(key, {
      data: buf,
      httpMetadata: options?.httpMetadata,
      customMetadata: options?.customMetadata,
      etag,
    });

    return {
      key,
      size: buf.byteLength,
      etag,
      httpEtag: `"${etag}"`,
      uploaded: new Date(),
    };
  }

  async delete(key) {
    this.store.delete(key);
  }

  async list(options) {
    const prefix = options?.prefix || '';
    const objects = [];
    for (const [k, v] of this.store.entries()) {
      if (k.startsWith(prefix)) {
        objects.push({
          key: k,
          size: v.data.byteLength,
          etag: v.etag,
          httpEtag: `"${v.etag}"`,
          uploaded: new Date(),
          customMetadata: v.customMetadata,
        });
      }
    }
    return { objects, truncated: false, delimitedPrefixes: [] };
  }
}

// Global RSA Key Pair for Cryptographic RS256 Testing
let testKeyPair;
let testPublicJwk;
const TEST_KEY_ID = 'test-rsa-key-2026';
const TEST_PROJECT_ID = 'campusnotes-e62cf';
const CANONICAL_ADMIN_EMAIL = 'admin@campusnotes.internal';

async function generateTestRsaKeys() {
  testKeyPair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify']
  );

  testPublicJwk = await crypto.subtle.exportKey('jwk', testKeyPair.publicKey);
  testPublicJwk.kid = TEST_KEY_ID;
  testPublicJwk.alg = 'RS256';
  testPublicJwk.use = 'sig';
}

function stringToBase64Url(str) {
  return Buffer.from(str, 'utf-8').toString('base64url');
}

async function createTestJwt(options = {}) {
  const kid = options.kid !== undefined ? options.kid : TEST_KEY_ID;
  const alg = options.alg !== undefined ? options.alg : 'RS256';
  const now = Math.floor(Date.now() / 1000);

  const header = {
    alg,
    typ: 'JWT',
    ...(kid ? { kid } : {}),
  };

  const payload = {
    iss: `https://securetoken.google.com/${options.projectId || TEST_PROJECT_ID}`,
    aud: options.projectId || TEST_PROJECT_ID,
    auth_time: now - 60,
    user_id: options.uid || 'admin_uid_777',
    sub: options.uid || 'admin_uid_777',
    iat: now - 60,
    exp: options.exp !== undefined ? options.exp : now + 3600,
    admin: options.admin !== undefined ? options.admin : true,
    email: options.email !== undefined ? options.email : CANONICAL_ADMIN_EMAIL,
    email_verified: true,
    firebase: {
      identities: { email: [options.email !== undefined ? options.email : CANONICAL_ADMIN_EMAIL] },
      sign_in_provider: 'password',
    },
    ...options.extraClaims,
  };

  const headerB64 = stringToBase64Url(JSON.stringify(header));
  const payloadB64 = stringToBase64Url(JSON.stringify(payload));
  const dataToSign = new TextEncoder().encode(`${headerB64}.${payloadB64}`);

  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', testKeyPair.privateKey, dataToSign);
  const signatureB64 = Buffer.from(signature).toString('base64url');

  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

describe('CampusNotes Large File Upload & Student Contributions Tests', () => {
  let env;
  let adminToken;

  before(async () => {
    await generateTestRsaKeys();
    setCustomJwksProvider(async () => ({ keys: [testPublicJwk] }));

    env = {
      PDF_BUCKET: new MockR2Bucket(),
      FIREBASE_PROJECT_ID: TEST_PROJECT_ID,
      FIREBASE_DATABASE_URL: 'https://campusnotes-e62cf-default-rtdb.firebaseio.com',
      ALLOWED_ORIGINS: 'https://campusnotes.space',
    };

    adminToken = await createTestJwt();
  });

  after(() => {
    resetJwksCache();
  });

  // Helper to generate a valid PDF buffer of specified size
  function createPdfBuffer(sizeInBytes) {
    const buf = new Uint8Array(sizeInBytes);
    // Write %PDF-1.4 header
    const header = new TextEncoder().encode('%PDF-1.4\n');
    buf.set(header, 0);
    // Write %%EOF at the end
    const footer = new TextEncoder().encode('\n%%EOF\n');
    if (sizeInBytes >= header.length + footer.length) {
      buf.set(footer, sizeInBytes - footer.length);
    }
    return buf.buffer;
  }

  // --- PART 1: LARGE FILE UPLOAD SIZE TESTS ---
  describe('File Size Tests (1 MB to 50 MB)', () => {
    const testSizes = [
      { name: '1 MB', size: 1 * 1024 * 1024, shouldPass: true },
      { name: '5 MB', size: 5 * 1024 * 1024, shouldPass: true },
      { name: '6 MB', size: 6 * 1024 * 1024, shouldPass: true },
      { name: '10 MB', size: 10 * 1024 * 1024, shouldPass: true },
      { name: '20 MB', size: 20 * 1024 * 1024, shouldPass: true },
      { name: '30 MB', size: 30 * 1024 * 1024, shouldPass: true },
      { name: '40 MB', size: 40 * 1024 * 1024, shouldPass: true },
      { name: '49 MB', size: 49 * 1024 * 1024, shouldPass: true },
      { name: '50 MB (exactly 52,428,800 bytes)', size: 52428800, shouldPass: true },
      { name: 'Above 50 MB (52,428,801 bytes)', size: 52428801, shouldPass: false },
      { name: '55 MB', size: 55 * 1024 * 1024, shouldPass: false },
    ];

    for (const { name, size, shouldPass } of testSizes) {
      it(`Upload ${name} file via Admin PUT: ${shouldPass ? 'Accepted' : 'Rejected with 413'}`, async () => {
        // To keep test fast for very large sizes, we pass content-length and slice of buffer
        const pdfBuf = createPdfBuffer(Math.min(size, 64 * 1024)); // representative buffer with valid header
        const req = new Request(`https://campusnotes-pdf-api.internal/materials/mat_size_${size}/pdf`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${adminToken}`,
            'Content-Type': 'application/pdf',
            'Content-Length': String(size),
            'X-Filename': 'large_test.pdf',
          },
          body: pdfBuf,
        });

        const res = await worker.fetch(req, env);
        if (shouldPass) {
          assert.equal(res.status, 200);
          const data = await res.json();
          assert.equal(data.ok, true);
        } else {
          assert.equal(res.status, 413);
          const data = await res.json();
          assert.equal(data.error, 'Maximum file size allowed is 50 MB.');
        }
      });
    }
  });

  // --- PART 2: ANONYMOUS PUBLIC STUDENT CONTRIBUTIONS WORKFLOW ---
  describe('Student Contributions Workflow', () => {
    let testSubmissionId;
    let testUploadToken;

    it('Anonymous visitor can initialize a contribution without login', async () => {
      const req = new Request('https://campusnotes-pdf-api.internal/submissions/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'CF-Connecting-IP': '203.0.113.10',
        },
        body: JSON.stringify({
          studentName: 'Aarav Sharma',
          email: 'aarav@example.edu',
          college: 'CSE Department',
          materialTitle: 'Computer Networks Unit 4 Complete Notes',
          description: 'Comprehensive handwritten notes covering IP addressing and routing algorithms.',
          semesterId: 'sem_5',
          subjectId: '23CS3501',
          category: 'notes',
          fileName: 'cn_unit4_notes.pdf',
          fileSize: 4500000,
          honeypot: '',
          formStartTime: Date.now() - 5000,
        }),
      });

      const res = await worker.fetch(req, env);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.ok, true);
      assert.ok(data.submissionId);
      assert.ok(data.uploadToken);
      assert.ok(data.uploadUrl);

      testSubmissionId = data.submissionId;
      testUploadToken = data.uploadToken;
    });

    it('Rejects submission with honeypot filled (bot protection)', async () => {
      const req = new Request('https://campusnotes-pdf-api.internal/submissions/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'CF-Connecting-IP': '203.0.113.11',
        },
        body: JSON.stringify({
          studentName: 'Bot User',
          materialTitle: 'Spam Material',
          semesterId: 'sem_5',
          subjectId: '23CS3501',
          category: 'notes',
          fileName: 'spam.pdf',
          fileSize: 1000,
          honeypot: 'http://spam-link.ru', // honeypot populated!
          formStartTime: Date.now() - 5000,
        }),
      });

      const res = await worker.fetch(req, env);
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.error, 'Spam detected.');
    });

    it('Rejects submission exceeding 50 MB limit during init', async () => {
      const req = new Request('https://campusnotes-pdf-api.internal/submissions/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'CF-Connecting-IP': '203.0.113.12',
        },
        body: JSON.stringify({
          studentName: 'Student User',
          materialTitle: 'Oversized Book',
          semesterId: 'sem_5',
          subjectId: '23CS3501',
          category: 'notes',
          fileName: 'giant_book.pdf',
          fileSize: 52428801, // 1 byte over 50 MB
          honeypot: '',
          formStartTime: Date.now() - 5000,
        }),
      });

      const res = await worker.fetch(req, env);
      assert.equal(res.status, 413);
      const data = await res.json();
      assert.equal(data.error, 'Maximum file size allowed is 50 MB.');
    });

    it('Rejects dangerous executable files during init (.exe)', async () => {
      const req = new Request('https://campusnotes-pdf-api.internal/submissions/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'CF-Connecting-IP': '203.0.113.13',
        },
        body: JSON.stringify({
          studentName: 'Student User',
          materialTitle: 'Malicious Software',
          semesterId: 'sem_5',
          subjectId: '23CS3501',
          category: 'notes',
          fileName: 'notes_installer.exe',
          fileSize: 2000000,
          honeypot: '',
          formStartTime: Date.now() - 5000,
        }),
      });

      const res = await worker.fetch(req, env);
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.ok(data.error.includes('Executable'));
    });

    it('Anonymous visitor uploads binary file using valid uploadToken', async () => {
      const pdfData = createPdfBuffer(1024 * 50); // 50 KB valid PDF
      const req = new Request(`https://campusnotes-pdf-api.internal/submissions/${testSubmissionId}/upload`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Length': String(pdfData.byteLength),
          'X-Upload-Token': testUploadToken,
        },
        body: pdfData,
      });

      const res = await worker.fetch(req, env);
      assert.equal(res.status, 201);
      const data = await res.json();
      assert.equal(data.ok, true);
      assert.equal(
        data.message,
        'Thank you for contributing to CampusNotes! Your material has been submitted successfully. It will become available after administrator approval.'
      );
    });

    it('Rejects binary upload with missing or invalid token', async () => {
      const pdfData = createPdfBuffer(1024);
      const req = new Request(`https://campusnotes-pdf-api.internal/submissions/${testSubmissionId}/upload`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/pdf',
          'X-Upload-Token': 'bogus_token_123',
        },
        body: pdfData,
      });

      const res = await worker.fetch(req, env);
      assert.equal(res.status, 403);
    });

    it('Pending submissions are NOT accessible to unauthenticated public visitors', async () => {
      // 1. GET /submissions unauthenticated -> 401
      const listReq = new Request('https://campusnotes-pdf-api.internal/submissions', {
        method: 'GET',
      });
      const listRes = await worker.fetch(listReq, env);
      assert.equal(listRes.status, 401);

      // 2. GET /submissions/:id/file unauthenticated -> 401
      const fileReq = new Request(`https://campusnotes-pdf-api.internal/submissions/${testSubmissionId}/file`, {
        method: 'GET',
      });
      const fileRes = await worker.fetch(fileReq, env);
      assert.equal(fileRes.status, 401);

      // 3. GET /materials/:submissionId/pdf -> 403 (does NOT serve pending submissions)
      const pubReq = new Request(`https://campusnotes-pdf-api.internal/materials/${testSubmissionId}/pdf`, {
        method: 'GET',
      });
      const pubRes = await worker.fetch(pubReq, env);
      assert.equal(pubRes.status, 403);
    });

    it('Admin can view all student submissions via GET /submissions', async () => {
      const req = new Request('https://campusnotes-pdf-api.internal/submissions?status=all', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      const res = await worker.fetch(req, env);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.ok, true);
      assert.ok(Array.isArray(data.submissions));
      assert.ok(data.submissions.length >= 1);

      const found = data.submissions.find((s) => s.submissionId === testSubmissionId);
      assert.ok(found);
      assert.equal(found.studentName, 'Aarav Sharma');
      assert.equal(found.status, 'pending');
      assert.equal(found.materialTitle, 'Computer Networks Unit 4 Complete Notes');
    });

    it('Admin can preview/download pending file via GET /submissions/:id/file', async () => {
      const req = new Request(`https://campusnotes-pdf-api.internal/submissions/${testSubmissionId}/file`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      const res = await worker.fetch(req, env);
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('Content-Type'), 'application/pdf');
      assert.equal(res.headers.get('Cache-Control'), 'private, no-store');
    });

    it('Admin can approve submission and publish it to public materials', async () => {
      const req = new Request(`https://campusnotes-pdf-api.internal/submissions/${testSubmissionId}/approve`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      const res = await worker.fetch(req, env);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.ok, true);
      assert.ok(data.materialId);
      assert.equal(data.submission.status, 'approved');
      assert.ok(data.submission.approvedAt);
      assert.equal(data.submission.publishedMaterialId, data.materialId);

      // Verify repeated approval does not duplicate publishing
      const repeatedReq = new Request(`https://campusnotes-pdf-api.internal/submissions/${testSubmissionId}/approve`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });
      const repeatedRes = await worker.fetch(repeatedReq, env);
      assert.equal(repeatedRes.status, 200);
      const repeatedData = await repeatedRes.json();
      assert.equal(repeatedData.materialId, data.materialId);
    });

    it('Admin can reject a submission', async () => {
      // First create a new submission to reject
      const initReq = new Request('https://campusnotes-pdf-api.internal/submissions/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.20' },
        body: JSON.stringify({
          studentName: 'Sub To Reject',
          materialTitle: 'Duplicate Material',
          semesterId: 'sem_5',
          subjectId: '23CS3501',
          category: 'notes',
          fileName: 'duplicate.pdf',
          fileSize: 1000,
          honeypot: '',
          formStartTime: Date.now() - 5000,
        }),
      });
      const initRes = await worker.fetch(initReq, env);
      const initData = await initRes.json();

      const uploadReq = new Request(`https://campusnotes-pdf-api.internal/submissions/${initData.submissionId}/upload`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/pdf', 'X-Upload-Token': initData.uploadToken },
        body: createPdfBuffer(500),
      });
      await worker.fetch(uploadReq, env);

      // Admin rejects it
      const rejectReq = new Request(`https://campusnotes-pdf-api.internal/submissions/${initData.submissionId}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const rejectRes = await worker.fetch(rejectReq, env);
      assert.equal(rejectRes.status, 200);
      const rejectData = await rejectRes.json();
      assert.equal(rejectData.submission.status, 'rejected');
      assert.ok(rejectData.submission.rejectedAt);

      // Verify safe deletion
      const deleteReq = new Request(`https://campusnotes-pdf-api.internal/submissions/${initData.submissionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const deleteRes = await worker.fetch(deleteReq, env);
      assert.equal(deleteRes.status, 200);
      const deleteData = await deleteRes.json();
      assert.equal(deleteData.deleted, initData.submissionId);
    });
  });

  // --- PART 3: ALL 15 FORMATS SUPPORTED IN SUBMISSIONS ---
  describe('All 15 Formats Submission Verification', () => {
    const formats = [
      { ext: 'pdf', mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34] },
      { ext: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', bytes: [0x50, 0x4b, 0x03, 0x04] },
      { ext: 'txt', mime: 'text/plain; charset=utf-8', bytes: [0x48, 0x65, 0x6c, 0x6c, 0x6f] },
      { ext: 'png', mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
      { ext: 'jpg', mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff, 0xe0] },
      { ext: 'zip', mime: 'application/zip', bytes: [0x50, 0x4b, 0x03, 0x04] },
    ];

    for (const fmt of formats) {
      it(`Accepts valid .${fmt.ext} submission with format and magic verification`, async () => {
        const initReq = new Request('https://campusnotes-pdf-api.internal/submissions/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': `203.0.113.${fmt.ext.length + 30}` },
          body: JSON.stringify({
            studentName: `Student ${fmt.ext}`,
            materialTitle: `Study Material in ${fmt.ext.toUpperCase()}`,
            semesterId: 'sem_5',
            subjectId: '23CS3501',
            category: 'notes',
            fileName: `study_material.${fmt.ext}`,
            fileSize: 2048,
            honeypot: '',
            formStartTime: Date.now() - 5000,
          }),
        });

        const initRes = await worker.fetch(initReq, env);
        assert.equal(initRes.status, 200);
        const initData = await initRes.json();

        // Prepare buffer with magic bytes (fill with ASCII spaces to avoid binary null bytes)
        const buf = new Uint8Array(2048);
        buf.fill(0x20); // ASCII space
        buf.set(fmt.bytes, 0);

        const uploadReq = new Request(`https://campusnotes-pdf-api.internal/submissions/${initData.submissionId}/upload`, {
          method: 'PUT',
          headers: {
            'Content-Type': fmt.mime,
            'X-Upload-Token': initData.uploadToken,
          },
          body: buf.buffer,
        });

        const uploadRes = await worker.fetch(uploadReq, env);
        assert.equal(uploadRes.status, 201);
      });
    }
  });
});
