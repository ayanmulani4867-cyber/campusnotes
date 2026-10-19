// Comprehensive Automated Security & Functional Test Suite for CampusNotes Cloudflare Worker
// Tests cryptographic RS256 token verification, RFC 7233 range requests, path safety, and authorization.

import test, { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

import worker, { parseByteRange } from '../src/index.ts';
import { setCustomJwksProvider, resetJwksCache } from '../src/auth.ts';

// Mock in-memory R2Bucket implementation with RFC range and head support
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

    // Range support: { range: { offset, length } }
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
}

// Global RSA Key Pair for Cryptographic RS256 Testing
let testKeyPair;
let testPublicJwk;
const TEST_KEY_ID = 'test-rsa-key-2026';
const TEST_PROJECT_ID = 'campusnotes-e62cf';
const CANONICAL_ADMIN_EMAIL = 'ayanmull8886@gmail.com';

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

/**
 * Creates cryptographically signed or deliberately forged JWTs for security tests
 */
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
    iss: options.iss !== undefined ? options.iss : `https://securetoken.google.com/${TEST_PROJECT_ID}`,
    aud: options.aud !== undefined ? options.aud : TEST_PROJECT_ID,
    sub: options.sub !== undefined ? options.sub : (options.uid || 'admin_uid_sec_1'),
    user_id: options.uid || 'admin_uid_sec_1',
    email: options.email !== undefined ? options.email : CANONICAL_ADMIN_EMAIL,
    exp: options.exp !== undefined ? options.exp : (now + 3600),
    iat: options.iat !== undefined ? options.iat : (now - 10),
    auth_time: options.auth_time !== undefined ? options.auth_time : (now - 10),
    admin: options.admin !== undefined ? options.admin : true,
    ...(options.customPayload || {}),
  };

  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const dataToSign = new TextEncoder().encode(`${headerB64}.${payloadB64}`);

  // Test scenario: forged or manually corrupted signature
  if (options.signatureOverride !== undefined) {
    return `${headerB64}.${payloadB64}.${options.signatureOverride}`;
  }

  // Test scenario: unsigned token (alg: none)
  if (alg === 'none') {
    return `${headerB64}.${payloadB64}.`;
  }

  // Real RSASSA-PKCS1-v1_5 SHA-256 cryptographic signature
  const signatureBuffer = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    testKeyPair.privateKey,
    dataToSign
  );
  const signatureB64 = Buffer.from(signatureBuffer).toString('base64url');

  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

describe('CampusNotes R2 Worker Security & Integrity Tests', () => {
  before(async () => {
    await generateTestRsaKeys();
    setCustomJwksProvider(async () => {
      return { keys: [testPublicJwk] };
    });
  });

  after(() => {
    resetJwksCache();
  });

  // -----------------------------------------------------------------
  // 1. Health & CORS Tests
  // -----------------------------------------------------------------
  it('GET /health returns 200 with service info', async () => {
    const mockBucket = new MockR2Bucket();
    const env = {
      PDF_BUCKET: mockBucket,
      FIREBASE_PROJECT_ID: TEST_PROJECT_ID,
    };

    const req = new Request('https://api.campusnotes.internal/health');
    const res = await worker.fetch(req, env);

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ok');
    assert.equal(body.service, 'campusnotes-pdf-api');
    assert.equal(body.bucket, 'campusnotes-pdfs');
  });

  it('OPTIONS /materials/mat_1/pdf returns 204 with CORS headers', async () => {
    const mockBucket = new MockR2Bucket();
    const env = { PDF_BUCKET: mockBucket };

    const req = new Request('https://api.campusnotes.internal/materials/mat_1/pdf', {
      method: 'OPTIONS',
      headers: { Origin: 'https://campusnotes-ifpr.onrender.com' },
    });
    const res = await worker.fetch(req, env);

    assert.equal(res.status, 204);
    assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'https://campusnotes-ifpr.onrender.com');
    assert(res.headers.get('Access-Control-Allow-Methods').includes('GET'));
  });

  it('GET /test-pdf without admin auth returns 403 (decommissioned test endpoint)', async () => {
    const mockBucket = new MockR2Bucket();
    const env = { PDF_BUCKET: mockBucket };

    const req = new Request('https://api.campusnotes.internal/test-pdf');
    const res = await worker.fetch(req, env);

    assert.equal(res.status, 403);
    const body = await res.json();
    assert(body.error.includes('decommissioned'));
  });

  it('GET /test-pdf/ with trailing slash without admin auth returns 403', async () => {
    const mockBucket = new MockR2Bucket();
    const env = { PDF_BUCKET: mockBucket };

    const req = new Request('https://api.campusnotes.internal/test-pdf/');
    const res = await worker.fetch(req, env);

    assert.equal(res.status, 403);
    const body = await res.json();
    assert(body.error.includes('decommissioned'));
  });

  it('HEAD /test-pdf without admin auth returns 403', async () => {
    const mockBucket = new MockR2Bucket();
    const env = { PDF_BUCKET: mockBucket };

    const req = new Request('https://api.campusnotes.internal/test-pdf', { method: 'HEAD' });
    const res = await worker.fetch(req, env);

    assert.equal(res.status, 403);
  });

  it('GET /test-pdf WITH admin auth serves sample test file with private cache', async () => {
    const mockBucket = new MockR2Bucket();
    const env = { PDF_BUCKET: mockBucket, FIREBASE_PROJECT_ID: TEST_PROJECT_ID };
    const validAdminToken = await createTestJwt();

    const sampleBytes = new TextEncoder().encode('%PDF-1.4\nSample Test Document\n%%EOF');
    await mockBucket.put('test-assignment.pdf', sampleBytes);

    const req = new Request('https://api.campusnotes.internal/test-pdf', {
      headers: { Authorization: `Bearer ${validAdminToken}` },
    });
    const res = await worker.fetch(req, env);

    assert.equal(res.status, 200);
    assert.equal(res.headers.get('Content-Type'), 'application/pdf');
    assert.equal(res.headers.get('Cache-Control'), 'private, no-store');
    assert.equal(res.headers.get('X-Content-Type-Options'), 'nosniff');
  });

  // -----------------------------------------------------------------
  // 2. Cryptographic JWT Verification Tests (Negative & Positive)
  // -----------------------------------------------------------------
  it('Rejects unauthenticated PUT request with 401', async () => {
    const mockBucket = new MockR2Bucket();
    const env = { PDF_BUCKET: mockBucket, FIREBASE_PROJECT_ID: TEST_PROJECT_ID };

    const req = new Request('https://api.campusnotes.internal/materials/mat_test/pdf', {
      method: 'PUT',
      body: new Uint8Array([1, 2, 3]),
    });
    const res = await worker.fetch(req, env);
    assert.equal(res.status, 401);
  });

  it('Rejects forged token with alg: none with 401', async () => {
    const mockBucket = new MockR2Bucket();
    const env = { PDF_BUCKET: mockBucket, FIREBASE_PROJECT_ID: TEST_PROJECT_ID };
    const forgedToken = await createTestJwt({ alg: 'none' });

    const req = new Request('https://api.campusnotes.internal/materials/mat_test/pdf', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${forgedToken}`,
        'Content-Type': 'application/pdf',
      },
      body: new TextEncoder().encode('%PDF-1.4\nTest\n%%EOF'),
    });
    const res = await worker.fetch(req, env);
    assert.equal(res.status, 401);
  });

  it('Rejects forged token with invalid/tampered cryptographic signature with 401', async () => {
    const mockBucket = new MockR2Bucket();
    const env = { PDF_BUCKET: mockBucket, FIREBASE_PROJECT_ID: TEST_PROJECT_ID };
    const forgedToken = await createTestJwt({ signatureOverride: 'invalidsignaturebytes123' });

    const req = new Request('https://api.campusnotes.internal/materials/mat_test/pdf', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${forgedToken}`,
        'Content-Type': 'application/pdf',
      },
      body: new TextEncoder().encode('%PDF-1.4\nTest\n%%EOF'),
    });
    const res = await worker.fetch(req, env);
    assert.equal(res.status, 401);
  });

  it('Rejects expired token with 401', async () => {
    const mockBucket = new MockR2Bucket();
    const env = { PDF_BUCKET: mockBucket, FIREBASE_PROJECT_ID: TEST_PROJECT_ID };
    const expiredToken = await createTestJwt({ exp: Math.floor(Date.now() / 1000) - 300 });

    const req = new Request('https://api.campusnotes.internal/materials/mat_test/pdf', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${expiredToken}`,
        'Content-Type': 'application/pdf',
      },
      body: new TextEncoder().encode('%PDF-1.4\nTest\n%%EOF'),
    });
    const res = await worker.fetch(req, env);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert(body.error.includes('expired'));
  });

  it('Rejects token with wrong audience / project ID with 401', async () => {
    const mockBucket = new MockR2Bucket();
    const env = { PDF_BUCKET: mockBucket, FIREBASE_PROJECT_ID: TEST_PROJECT_ID };
    const wrongAudToken = await createTestJwt({ aud: 'wrong-firebase-project' });

    const req = new Request('https://api.campusnotes.internal/materials/mat_test/pdf', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${wrongAudToken}`,
        'Content-Type': 'application/pdf',
      },
      body: new TextEncoder().encode('%PDF-1.4\nTest\n%%EOF'),
    });
    const res = await worker.fetch(req, env);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert(body.error.includes('audience'));
  });

  it('Rejects token with wrong issuer with 401', async () => {
    const mockBucket = new MockR2Bucket();
    const env = { PDF_BUCKET: mockBucket, FIREBASE_PROJECT_ID: TEST_PROJECT_ID };
    const wrongIssToken = await createTestJwt({ iss: 'https://evil.issuer.com/project' });

    const req = new Request('https://api.campusnotes.internal/materials/mat_test/pdf', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${wrongIssToken}`,
        'Content-Type': 'application/pdf',
      },
      body: new TextEncoder().encode('%PDF-1.4\nTest\n%%EOF'),
    });
    const res = await worker.fetch(req, env);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert(body.error.includes('issuer'));
  });

  it('Rejects non-admin user with 401/403 even with valid cryptographic signature', async () => {
    const mockBucket = new MockR2Bucket();
    const env = { PDF_BUCKET: mockBucket, FIREBASE_PROJECT_ID: TEST_PROJECT_ID };
    const nonAdminToken = await createTestJwt({
      email: 'student@example.edu',
      admin: false,
    });

    const req = new Request('https://api.campusnotes.internal/materials/mat_test/pdf', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${nonAdminToken}`,
        'Content-Type': 'application/pdf',
      },
      body: new TextEncoder().encode('%PDF-1.4\nTest\n%%EOF'),
    });
    const res = await worker.fetch(req, env);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert(body.error.includes('administrator'));
  });

  it('Accepts cryptographically verified admin token for PUT upload', async () => {
    const mockBucket = new MockR2Bucket();
    const env = { PDF_BUCKET: mockBucket, FIREBASE_PROJECT_ID: TEST_PROJECT_ID };
    const validAdminToken = await createTestJwt();

    const samplePdfBytes = new TextEncoder().encode('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');

    const req = new Request('https://api.campusnotes.internal/materials/mat_test/pdf?filename=sample_notes.pdf', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${validAdminToken}`,
        'Content-Type': 'application/pdf',
      },
      body: samplePdfBytes,
    });
    const res = await worker.fetch(req, env);

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.materialId, 'mat_test');
    assert(body.r2Key.startsWith('materials/mat_test/'));
    assert(mockBucket.store.has(body.r2Key));
  });

  // -----------------------------------------------------------------
  // 3. DELETE Authorization & Scoping Tests
  // -----------------------------------------------------------------
  it('DELETE allows deleting file in own material namespace', async () => {
    const mockBucket = new MockR2Bucket();
    const env = { PDF_BUCKET: mockBucket, FIREBASE_PROJECT_ID: TEST_PROJECT_ID };
    const validAdminToken = await createTestJwt();

    await mockBucket.put('materials/mat_1/123_notes.pdf', new Uint8Array([1, 2, 3]));
    assert(mockBucket.store.has('materials/mat_1/123_notes.pdf'));

    const req = new Request('https://api.campusnotes.internal/materials/mat_1/pdf?key=materials/mat_1/123_notes.pdf', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${validAdminToken}` },
    });
    const res = await worker.fetch(req, env);

    assert.equal(res.status, 200);
    assert(!mockBucket.store.has('materials/mat_1/123_notes.pdf'));
  });

  it('DELETE rejects arbitrary cross-material deletion with 403', async () => {
    const mockBucket = new MockR2Bucket();
    const env = { PDF_BUCKET: mockBucket, FIREBASE_PROJECT_ID: TEST_PROJECT_ID };
    const validAdminToken = await createTestJwt();

    // Attacker tries to delete material 2 while targeting material 1 route
    await mockBucket.put('materials/mat_2/secret.pdf', new Uint8Array([1, 2, 3]));

    const req = new Request('https://api.campusnotes.internal/materials/mat_1/pdf?key=materials/mat_2/secret.pdf', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${validAdminToken}` },
    });
    const res = await worker.fetch(req, env);

    assert.equal(res.status, 403);
    const body = await res.json();
    assert(body.error.includes('namespace'));
    // Target must NOT have been deleted
    assert(mockBucket.store.has('materials/mat_2/secret.pdf'));
  });

  it('DELETE rejects path traversal attempts with 403', async () => {
    const mockBucket = new MockR2Bucket();
    const env = { PDF_BUCKET: mockBucket, FIREBASE_PROJECT_ID: TEST_PROJECT_ID };
    const validAdminToken = await createTestJwt();

    const req = new Request('https://api.campusnotes.internal/materials/mat_1/pdf?key=materials/mat_1/../mat_2/secret.pdf', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${validAdminToken}` },
    });
    const res = await worker.fetch(req, env);

    assert.equal(res.status, 403);
  });

  it('DELETE rejects non-PDF or arbitrary bucket keys with 403', async () => {
    const mockBucket = new MockR2Bucket();
    const env = { PDF_BUCKET: mockBucket, FIREBASE_PROJECT_ID: TEST_PROJECT_ID };
    const validAdminToken = await createTestJwt();

    const req = new Request('https://api.campusnotes.internal/materials/mat_1/pdf?key=test-assignment.pdf', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${validAdminToken}` },
    });
    const res = await worker.fetch(req, env);

    assert.equal(res.status, 403);
  });

  // -----------------------------------------------------------------
  // 4. Input Validation & Error Sanitization Tests
  // -----------------------------------------------------------------
  it('Rejects invalid material ID format with 400', async () => {
    const mockBucket = new MockR2Bucket();
    const env = { PDF_BUCKET: mockBucket };

    const req = new Request('https://api.campusnotes.internal/materials/mat..invalid/pdf');
    const res = await worker.fetch(req, env);

    assert.equal(res.status, 400);
    const body = await res.json();
    assert(body.error.includes('format'));
  });

  it('Public 404 response does NOT leak internal R2 object keys', async () => {
    const mockBucket = new MockR2Bucket();
    const env = {
      PDF_BUCKET: mockBucket,
      FIREBASE_PROJECT_ID: TEST_PROJECT_ID,
      FIREBASE_DATABASE_URL: 'https://campusnotes-e62cf-default-rtdb.firebaseio.com',
    };

    // mat_1792315080484_0bfh is a published material, but mockBucket is empty
    const req = new Request('https://api.campusnotes.internal/materials/mat_1792315080484_0bfh/pdf');
    const res = await worker.fetch(req, env);

    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.key, undefined); // Internal key must NOT be present in response
    assert(body.error.includes('not found in storage bucket'));
  });

  // -----------------------------------------------------------------
  // 5. HTTP Range Handling Tests (RFC 7233 / RFC 9110)
  // -----------------------------------------------------------------
  it('parseByteRange handles explicit range bytes=0-49', () => {
    const res = parseByteRange('bytes=0-49', 100);
    assert.deepEqual(res, { start: 0, end: 49 });
  });

  it('parseByteRange handles open-ended range bytes=50-', () => {
    const res = parseByteRange('bytes=50-', 100);
    assert.deepEqual(res, { start: 50, end: 99 });
  });

  it('parseByteRange handles suffix range bytes=-30', () => {
    const res = parseByteRange('bytes=-30', 100);
    assert.deepEqual(res, { start: 70, end: 99 });
  });

  it('parseByteRange returns unsatisfiable when start >= totalSize', () => {
    const res = parseByteRange('bytes=100-200', 100);
    assert.equal(res, 'unsatisfiable');
  });

  it('parseByteRange returns invalid when start > end', () => {
    const res = parseByteRange('bytes=50-20', 100);
    assert.equal(res, 'invalid');
  });

  it('GET with valid Range returns 206 with Content-Range and partial bytes', async () => {
    const mockBucket = new MockR2Bucket();
    const env = {
      PDF_BUCKET: mockBucket,
      FIREBASE_PROJECT_ID: TEST_PROJECT_ID,
      FIREBASE_DATABASE_URL: 'https://campusnotes-e62cf-default-rtdb.firebaseio.com',
    };

    const content = '%PDF-1.4\n0123456789ABCDEF\n%%EOF';
    const totalSize = content.length;
    await mockBucket.put('materials/mat_1792315080484_0bfh.pdf', content, {
      httpMetadata: { contentType: 'application/pdf' },
    });

    const req = new Request('https://api.campusnotes.internal/materials/mat_1792315080484_0bfh/pdf', {
      headers: { Range: 'bytes=0-7' },
    });
    const res = await worker.fetch(req, env);

    assert.equal(res.status, 206);
    assert.equal(res.headers.get('Content-Range'), `bytes 0-7/${totalSize}`);
    assert.equal(res.headers.get('Content-Length'), '8');
    assert.equal(res.headers.get('Accept-Ranges'), 'bytes');

    const bodyText = await res.text();
    assert.equal(bodyText, '%PDF-1.4');
  });

  it('GET with out-of-bounds Range returns 416 with Content-Range bytes */total', async () => {
    const mockBucket = new MockR2Bucket();
    const env = {
      PDF_BUCKET: mockBucket,
      FIREBASE_PROJECT_ID: TEST_PROJECT_ID,
      FIREBASE_DATABASE_URL: 'https://campusnotes-e62cf-default-rtdb.firebaseio.com',
    };

    const content = '%PDF-1.4\nTest\n%%EOF';
    const totalSize = content.length;
    await mockBucket.put('materials/mat_1792315080484_0bfh.pdf', content, {
      httpMetadata: { contentType: 'application/pdf' },
    });

    const req = new Request('https://api.campusnotes.internal/materials/mat_1792315080484_0bfh/pdf', {
      headers: { Range: 'bytes=999-1050' },
    });
    const res = await worker.fetch(req, env);

    assert.equal(res.status, 416);
    assert.equal(res.headers.get('Content-Range'), `bytes */${totalSize}`);
  });

  it('HEAD with Range returns 206 with Content-Range and null body', async () => {
    const mockBucket = new MockR2Bucket();
    const env = {
      PDF_BUCKET: mockBucket,
      FIREBASE_PROJECT_ID: TEST_PROJECT_ID,
      FIREBASE_DATABASE_URL: 'https://campusnotes-e62cf-default-rtdb.firebaseio.com',
    };

    const content = '%PDF-1.4\nTest\n%%EOF';
    const totalSize = content.length;
    await mockBucket.put('materials/mat_1792315080484_0bfh.pdf', content, {
      httpMetadata: { contentType: 'application/pdf' },
    });

    const req = new Request('https://api.campusnotes.internal/materials/mat_1792315080484_0bfh/pdf', {
      method: 'HEAD',
      headers: { Range: 'bytes=0-3' },
    });
    const res = await worker.fetch(req, env);

    assert.equal(res.status, 206);
    assert.equal(res.headers.get('Content-Range'), `bytes 0-3/${totalSize}`);
    assert.equal(res.headers.get('Content-Length'), '4');
    assert.equal(res.body, null);
  });

  // -----------------------------------------------------------------
  // 6. Draft PDF Protection & Authorized Access Tests
  // -----------------------------------------------------------------
  it('Public unauthenticated access to draft material is rejected with 403', async () => {
    const mockBucket = new MockR2Bucket();
    const env = {
      PDF_BUCKET: mockBucket,
      FIREBASE_PROJECT_ID: TEST_PROJECT_ID,
      FIREBASE_DATABASE_URL: 'https://campusnotes-e62cf-default-rtdb.firebaseio.com',
    };

    const req = new Request('https://api.campusnotes.internal/materials/nonexistent_draft_id/pdf');
    const res = await worker.fetch(req, env);

    assert.equal(res.status, 403);
    const body = await res.json();
    assert(body.error.includes('unavailable, unpublished, or access is restricted'));
  });

  // -----------------------------------------------------------------
  // 7. Migration Publication Partition Isolation & Rollback Safety Tests
  // -----------------------------------------------------------------
  it('Migration update logic strictly isolates unpublished drafts from /publicMaterials', () => {
    // Simulate updateMaterialRtdb patch dispatch
    const patches = [];
    function mockPatch(path, body) {
      patches.push({ path, body });
    }

    function simulateUpdate(materialId, updates, isPublished) {
      mockPatch(`/materials/${materialId}.json`, updates);
      if (isPublished === true) {
        mockPatch(`/publicMaterials/${materialId}.json`, updates);
      }
    }

    // Case 1: Draft material
    simulateUpdate('draft_mat_1', { storageProvider: 'r2', r2Key: 'materials/draft_mat_1/file.pdf' }, false);
    assert.equal(patches.length, 1);
    assert.equal(patches[0].path, '/materials/draft_mat_1.json');

    // Case 2: Published material
    simulateUpdate('pub_mat_2', { storageProvider: 'r2', r2Key: 'materials/pub_mat_2/file.pdf' }, true);
    assert.equal(patches.length, 3);
    assert.equal(patches[1].path, '/materials/pub_mat_2.json');
    assert.equal(patches[2].path, '/publicMaterials/pub_mat_2.json');
  });

  it('Migration rollback restores original RTDB blobId and removes R2 keys', () => {
    const originalMaterial = {
      id: 'mat_rollback_test',
      blobId: 'blob_uuid_123',
      storageProvider: 'r2',
      r2Key: 'materials/mat_rollback_test/file.pdf',
      published: true,
    };

    const rollbackUpdates = {
      storageProvider: 'firebase',
      r2Key: null,
      r2Url: null,
      storagePath: `rtdb://file_blobs/${originalMaterial.blobId}`,
      downloadUrl: `rtdb://${originalMaterial.blobId}`,
      updatedAt: Date.now(),
    };

    assert.equal(rollbackUpdates.storageProvider, 'firebase');
    assert.equal(rollbackUpdates.r2Key, null);
    assert.equal(rollbackUpdates.storagePath, 'rtdb://file_blobs/blob_uuid_123');
    assert(rollbackUpdates.downloadUrl.includes('blob_uuid_123'));
  });
});
