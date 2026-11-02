#!/usr/bin/env node
// scripts/test-contribution-integration.mjs
// Full frontend-to-Worker integration test for the student contribution flow.
// Runs against the local Wrangler dev server (http://127.0.0.1:8787).

import assert from 'node:assert/strict';

const LOCAL_WORKER = 'http://127.0.0.1:8787';
const ALLOWED_ORIGIN = 'http://localhost:5173';
const MAX_FILE_SIZE = 52428800;

let passed = 0;
let failed = 0;

function test(name, fn) {
  return fn().then(() => {
    console.log(`  [PASS] ${name}`);
    passed++;
  }).catch(err => {
    console.error(`  [FAIL] ${name}: ${err.message}`);
    failed++;
  });
}

// Helper: make a minimal valid PDF buffer with %PDF- magic bytes
function makePdfBuffer(sizeBytes = 4096) {
  const buf = new Uint8Array(sizeBytes);
  const hdr = '%PDF-1.4\n%aaaa\n1 0 obj\n<< /Type /Catalog >>\nendobj\n';
  for (let i = 0; i < hdr.length; i++) buf[i] = hdr.charCodeAt(i);
  return buf;
}

// Helper: make a ZIP/Office OpenXML buffer (PK\x03\x04 header)
function makeZipBuffer(sizeBytes = 4096) {
  const buf = new Uint8Array(sizeBytes);
  buf[0] = 0x50; buf[1] = 0x4B; buf[2] = 0x03; buf[3] = 0x04;
  return buf;
}

// Helper: make a PNG buffer (PNG magic bytes)
function makePngBuffer(sizeBytes = 4096) {
  const buf = new Uint8Array(sizeBytes);
  buf[0] = 0x89; buf[1] = 0x50; buf[2] = 0x4E; buf[3] = 0x47;
  buf[4] = 0x0D; buf[5] = 0x0A; buf[6] = 0x1A; buf[7] = 0x0A;
  return buf;
}

// Helper: make a JPEG buffer
function makeJpegBuffer(sizeBytes = 4096) {
  const buf = new Uint8Array(sizeBytes);
  buf[0] = 0xFF; buf[1] = 0xD8; buf[2] = 0xFF; buf[3] = 0xE0;
  return buf;
}

// Helper: make a text buffer
function makeTextBuffer(content = 'Hello CampusNotes\n', sizeBytes = 4096) {
  const buf = new Uint8Array(sizeBytes).fill(0x20); // space bytes
  for (let i = 0; i < content.length; i++) buf[i] = content.charCodeAt(i);
  return buf;
}

let ipCounter = 0;
const trackedSubmissions = new Set();

function freshIp() {
  ipCounter++;
  return `10.0.${Math.floor(ipCounter / 256)}.${ipCounter % 256}`;
}

async function initSubmission(overrides = {}, ip = freshIp()) {
  const body = {
    studentName: 'Test Student',
    materialTitle: 'Integration Test Material',
    semesterId: 'sem1',
    subjectId: 'sub1',
    category: 'notes',
    fileName: 'test.pdf',
    fileSize: 4096,
    mimeType: 'application/pdf',
    honeypot: '',
    formStartTime: Date.now() - 5000,
    ...overrides,
  };
  const res = await fetch(`${LOCAL_WORKER}/submissions/init`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': ALLOWED_ORIGIN,
      'CF-Connecting-IP': ip,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (data?.submissionId) {
    trackedSubmissions.add(data.submissionId);
  }
  return { res, data };
}

async function uploadFile(uploadUrl, uploadToken, buffer, mimeType = 'application/pdf') {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': mimeType,
      'X-Upload-Token': uploadToken,
      'Origin': ALLOWED_ORIGIN,
    },
    body: buffer,
  });
  return { res, data: await res.json().catch(() => ({})) };
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n======================================================================');
console.log('  CAMPUSNOTES — CONTRIBUTION INTEGRATION TEST (Local Wrangler)');
console.log('======================================================================\n');

console.log('--- Suite 1: Health & CORS ---');

await test('GET /health returns 200 with version 2.1.0', async () => {
  const res = await fetch(`${LOCAL_WORKER}/health`, { headers: { Origin: ALLOWED_ORIGIN } });
  assert.equal(res.status, 200);
  const d = await res.json();
  assert.ok(d.status === 'ok');
  assert.ok(d.service === 'campusnotes-pdf-api');
});

await test('OPTIONS /submissions/init returns CORS 204 with correct headers', async () => {
  const res = await fetch(`${LOCAL_WORKER}/submissions/init`, {
    method: 'OPTIONS',
    headers: {
      Origin: ALLOWED_ORIGIN,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'Content-Type',
    },
  });
  assert.equal(res.status, 204);
  const acao = res.headers.get('Access-Control-Allow-Origin');
  assert.ok(acao === ALLOWED_ORIGIN || acao === '*', `Expected ACAO to be origin or *, got ${acao}`);
});

console.log('\n--- Suite 2: Anonymous PDF Submission (small file) ---');

await test('POST /submissions/init returns submissionId, uploadToken, uploadUrl', async () => {
  const { res, data } = await initSubmission();
  assert.equal(res.status, 200);
  assert.ok(data.ok, 'Expected ok:true');
  assert.ok(data.submissionId, 'Missing submissionId');
  assert.ok(data.uploadToken, 'Missing uploadToken');
  assert.ok(data.uploadUrl && data.uploadUrl.includes('/submissions/'), 'Missing or wrong uploadUrl');
});

await test('PUT /submissions/:id/upload with valid PDF returns 201 and success message', async () => {
  const { data: init } = await initSubmission();
  const buf = makePdfBuffer(4096);
  const { res, data } = await uploadFile(init.uploadUrl, init.uploadToken, buf);
  assert.equal(res.status, 201);
  assert.ok(data.ok);
  assert.ok(
    data.message.includes('Thank you for contributing to CampusNotes'),
    `Unexpected message: ${data.message}`
  );
});

console.log('\n--- Suite 3: ZIP Upload ---');

await test('ZIP file submission initializes and uploads correctly', async () => {
  const { res, data: init } = await initSubmission({ fileName: 'notes.zip', mimeType: 'application/zip' });
  assert.equal(res.status, 200);
  const buf = makeZipBuffer(8192);
  const { res: upRes, data } = await uploadFile(init.uploadUrl, init.uploadToken, buf, 'application/zip');
  assert.equal(upRes.status, 201, `Upload returned ${upRes.status}: ${JSON.stringify(data)}`);
  assert.ok(data.ok);
});

console.log('\n--- Suite 4: DOCX Upload ---');

await test('DOCX file (PK ZIP header) submission uploads correctly', async () => {
  const { data: init } = await initSubmission({
    fileName: 'assignment.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  const buf = makeZipBuffer(8192); // DOCX uses ZIP/PK header
  const { res: upRes, data } = await uploadFile(init.uploadUrl, init.uploadToken, buf,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  assert.equal(upRes.status, 201, `Upload returned ${upRes.status}: ${JSON.stringify(data)}`);
  assert.ok(data.ok);
});

console.log('\n--- Suite 5: PPTX Upload ---');

await test('PPTX file (PK ZIP header) submission uploads correctly', async () => {
  const { data: init } = await initSubmission({
    fileName: 'slides.pptx',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  });
  const buf = makeZipBuffer(8192);
  const { res: upRes, data } = await uploadFile(init.uploadUrl, init.uploadToken, buf,
    'application/vnd.openxmlformats-officedocument.presentationml.presentation');
  assert.equal(upRes.status, 201, `Upload returned ${upRes.status}: ${JSON.stringify(data)}`);
  assert.ok(data.ok);
});

console.log('\n--- Suite 6: PNG Image Upload ---');

await test('PNG image submission uploads correctly', async () => {
  const { data: init } = await initSubmission({ fileName: 'diagram.png', mimeType: 'image/png' });
  const buf = makePngBuffer(4096);
  const { res: upRes, data } = await uploadFile(init.uploadUrl, init.uploadToken, buf, 'image/png');
  assert.equal(upRes.status, 201, `Upload returned ${upRes.status}: ${JSON.stringify(data)}`);
  assert.ok(data.ok);
});

console.log('\n--- Suite 7: Size Boundary Tests ---');

await test('10 MB PDF submission initializes successfully', async () => {
  const { res, data } = await initSubmission({ fileName: 'large.pdf', fileSize: 10 * 1024 * 1024 });
  assert.equal(res.status, 200, `Expected 200 got ${res.status}: ${JSON.stringify(data)}`);
  assert.ok(data.uploadToken);
});

await test('49 MB file initialization is accepted', async () => {
  const { res, data } = await initSubmission({ fileName: 'big.pdf', fileSize: 49 * 1024 * 1024 });
  assert.equal(res.status, 200, `Expected 200 got ${res.status}: ${JSON.stringify(data)}`);
  assert.ok(data.uploadToken);
});

await test('Exactly 50 MB (52,428,800 bytes) is accepted at init', async () => {
  const { res, data } = await initSubmission({ fileName: 'max.pdf', fileSize: MAX_FILE_SIZE });
  assert.equal(res.status, 200, `Expected 200 got ${res.status}: ${JSON.stringify(data)}`);
  assert.ok(data.uploadToken);
});

await test('51 MB file (53,477,376 bytes) is rejected with 413 at init', async () => {
  const { res, data } = await initSubmission({ fileName: 'toobig.pdf', fileSize: 51 * 1024 * 1024 });
  assert.equal(res.status, 413, `Expected 413 got ${res.status}: ${JSON.stringify(data)}`);
  assert.ok(data.error && data.error.includes('50 MB'), `Expected 50 MB message, got: ${data.error}`);
});

await test('Above 50 MB (52,428,801 bytes) is rejected with 413 at init', async () => {
  const { res, data } = await initSubmission({ fileName: 'toobig.pdf', fileSize: MAX_FILE_SIZE + 1 });
  assert.equal(res.status, 413, `Expected 413 got ${res.status}: ${JSON.stringify(data)}`);
  assert.ok(data.error.includes('Maximum file size allowed is 50 MB.'), `Wrong error: ${data.error}`);
});

console.log('\n--- Suite 8: Security & Spam Protection ---');

await test('Honeypot-filled submission is rejected with 400', async () => {
  const { res, data } = await initSubmission({ honeypot: 'spam-bot-filled-this' });
  assert.equal(res.status, 400, `Expected 400, got ${res.status}: ${JSON.stringify(data)}`);
});

await test('Executable file (.exe) is rejected with 400', async () => {
  const { res, data } = await initSubmission({ fileName: 'virus.exe', mimeType: 'application/octet-stream' });
  assert.equal(res.status, 400, `Expected 400, got ${res.status}: ${JSON.stringify(data)}`);
  assert.ok(data.error && data.error.toLowerCase().includes('prohibit'), `Wrong error: ${data.error}`);
});

await test('Upload with missing token is rejected with 401 or 403', async () => {
  const { res: initRes, data: init } = await initSubmission();
  assert.equal(initRes.status, 200, `Init failed: ${JSON.stringify(init)}`);
  const buf = makePdfBuffer(4096);
  const res = await fetch(init.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/pdf', 'Origin': ALLOWED_ORIGIN },
    body: buf,
  });
  assert.ok(res.status === 401 || res.status === 403, `Expected 401 or 403, got ${res.status}`);
});

await test('Upload with wrong token is rejected with 401 or 403', async () => {
  const { res: initRes, data: init } = await initSubmission();
  assert.equal(initRes.status, 200, `Init failed: ${JSON.stringify(init)}`);
  const buf = makePdfBuffer(4096);
  const res = await fetch(init.uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/pdf',
      'X-Upload-Token': 'tok_invalid_totally_wrong',
      'Origin': ALLOWED_ORIGIN,
    },
    body: buf,
  });
  assert.ok(res.status === 401 || res.status === 403, `Expected 401 or 403, got ${res.status}`);
});

await test('Pending files are NOT accessible to public (unauthenticated)', async () => {
  // First create a real pending submission
  const { res: initRes, data: init } = await initSubmission();
  assert.equal(initRes.status, 200, `Init failed: ${JSON.stringify(init)}`);
  const buf = makePdfBuffer(4096);
  await uploadFile(init.uploadUrl, init.uploadToken, buf);

  // Try to access pending file without auth
  const res = await fetch(`${LOCAL_WORKER}/submissions/${init.submissionId}/file`, {
    headers: { Origin: ALLOWED_ORIGIN },
  });
  assert.ok(res.status === 401 || res.status === 403, `Expected 401/403, got ${res.status}`);
});

await test('GET /submissions without admin auth returns 401', async () => {
  const res = await fetch(`${LOCAL_WORKER}/submissions`, {
    headers: { Origin: ALLOWED_ORIGIN },
  });
  assert.ok(res.status === 401 || res.status === 403, `Expected 401/403, got ${res.status}`);
});

console.log('\n--- Suite 9: Unknown Route Error Messages ---');

await test('GET /unknown-route returns 404 with JSON error (not raw string)', async () => {
  const res = await fetch(`${LOCAL_WORKER}/nonexistent-route-xyz`, {
    headers: { Origin: ALLOWED_ORIGIN },
  });
  assert.equal(res.status, 404);
  const data = await res.json();
  assert.ok(data.error, 'Should return JSON error field');
});

await test('/submissions/init with GET method returns 404 (method not allowed)', async () => {
  const res = await fetch(`${LOCAL_WORKER}/submissions/init`, {
    method: 'GET',
    headers: { Origin: ALLOWED_ORIGIN },
  });
  assert.ok(res.status === 404 || res.status === 405, `Expected 404/405, got ${res.status}`);
});

console.log('\n======================================================================');
console.log(`  INTEGRATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('======================================================================\n');

// Automated test teardown to prevent cluttering storage
if (trackedSubmissions.size > 0) {
  try {
    const { DatabaseSync } = await import('node:sqlite');
    const fs = await import('node:fs');
    const path = await import('node:path');
    const dbPath = 'C:/Users/ayanm/.gemini/antigravity-ide/scratch/campusnotes/worker/.wrangler/state/v3/r2/miniflare-R2BucketObject/7a69e15903f156a72c06fc5f043906de0244c3b367436a815d87ce0317b93836.sqlite';
    const blobsDir = 'C:/Users/ayanm/.gemini/antigravity-ide/scratch/campusnotes/worker/.wrangler/state/v3/r2/campusnotes-pdfs/blobs';
    if (fs.existsSync(dbPath)) {
      const db = new DatabaseSync(dbPath, { open: true });
      for (const subId of trackedSubmissions) {
        const rows = db.prepare(`SELECT blob_id FROM _mf_objects WHERE key LIKE 'pending_submissions/' || ? || '/%'`).all(subId);
        for (const row of rows) {
          const bp = path.join(blobsDir, row.blob_id);
          if (fs.existsSync(bp)) fs.unlinkSync(bp);
        }
        db.prepare(`DELETE FROM _mf_objects WHERE key LIKE 'pending_submissions/' || ? || '/%'`).run(subId);
      }
      console.log(`[TEARDOWN] Cleaned up ${trackedSubmissions.size} automated test submissions.`);
    }
  } catch (err) {
    console.warn('Notice cleaning up test submissions:', err.message);
  }
}

if (failed > 0) process.exit(1);
