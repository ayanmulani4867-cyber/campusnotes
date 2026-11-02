// scripts/test-pdf-and-zip-submissions.mjs
// Verifies both PDF and ZIP submissions succeed end-to-end against the local worker

import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const WORKER_URL = 'http://127.0.0.1:8787';

function cleanupSubmissions(submissionIds) {
  try {
    const dbPath = 'C:/Users/ayanm/.gemini/antigravity-ide/scratch/campusnotes/worker/.wrangler/state/v3/r2/miniflare-R2BucketObject/7a69e15903f156a72c06fc5f043906de0244c3b367436a815d87ce0317b93836.sqlite';
    const blobsDir = 'C:/Users/ayanm/.gemini/antigravity-ide/scratch/campusnotes/worker/.wrangler/state/v3/r2/campusnotes-pdfs/blobs';
    if (!fs.existsSync(dbPath)) return;
    const db = new DatabaseSync(dbPath, { open: true });
    for (const subId of submissionIds) {
      const rows = db.prepare(`SELECT blob_id FROM _mf_objects WHERE key LIKE 'pending_submissions/' || ? || '/%'`).all(subId);
      for (const row of rows) {
        const bp = path.join(blobsDir, row.blob_id);
        if (fs.existsSync(bp)) fs.unlinkSync(bp);
      }
      db.prepare(`DELETE FROM _mf_objects WHERE key LIKE 'pending_submissions/' || ? || '/%'`).run(subId);
    }
    console.log(`  [CLEANUP] Cleaned up ${submissionIds.length} test submissions.`);
  } catch (e) {
    console.warn('Notice cleaning up test submissions:', e.message);
  }
}

async function testSubmission(title, filename, mimeType, bufferGen) {
  console.log(`Testing submission for ${filename}...`);

  // 1. Init
  const initRes = await fetch(`${WORKER_URL}/submissions/init`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'http://localhost:5173',
      'CF-Connecting-IP': '127.0.0.1',
    },
    body: JSON.stringify({
      studentName: 'Verification Student',
      email: 'student@example.com',
      materialTitle: title,
      semesterId: 'sem5',
      subjectId: 'sub_cn',
      category: 'notes',
      fileName: filename,
      fileSize: 4096,
      mimeType,
      honeypot: '',
      formStartTime: Date.now() - 5000,
    }),
  });

  assert.equal(initRes.status, 200, `Init for ${filename} must return 200`);
  const initData = await initRes.json();
  assert.ok(initData.ok);
  assert.ok(initData.uploadUrl);

  // 2. Binary upload
  const fileBytes = bufferGen(4096);
  const uploadRes = await fetch(initData.uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': mimeType,
      'X-Upload-Token': initData.uploadToken,
      'Origin': 'http://localhost:5173',
    },
    body: fileBytes,
  });

  assert.equal(uploadRes.status, 201, `Upload for ${filename} must return 201`);
  const uploadData = await uploadRes.json();
  assert.ok(uploadData.ok);
  console.log(`  [PASS] ${filename} submitted successfully (submissionId: ${initData.submissionId})`);
  return initData.submissionId;
}

function makePdf(size = 4096) {
  const buf = new Uint8Array(size);
  const header = '%PDF-1.4\n%Polished UI Test\n1 0 obj\n<< /Title (Notes) >>\nendobj\n';
  for (let i = 0; i < header.length; i++) buf[i] = header.charCodeAt(i);
  return buf;
}

function makeZip(size = 4096) {
  const buf = new Uint8Array(size);
  // PK\x03\x04 standard ZIP header
  buf[0] = 0x50; buf[1] = 0x4b; buf[2] = 0x03; buf[3] = 0x04;
  return buf;
}

async function run() {
  console.log('=== Running PDF and ZIP Submission Tests ===\n');
  const createdIds = [];
  try {
    const pdfSubId = await testSubmission('Operating Systems Unit 4 PDF', 'Unit4_OS_Notes.pdf', 'application/pdf', makePdf);
    if (pdfSubId) createdIds.push(pdfSubId);

    const zipSubId = await testSubmission('Computer Networks Lab Codes ZIP', 'CN_Lab_Practicals.zip', 'application/zip', makeZip);
    if (zipSubId) createdIds.push(zipSubId);

    console.log('\n=== PDF and ZIP Submission Tests Passed! ===');
  } finally {
    if (createdIds.length > 0) {
      cleanupSubmissions(createdIds);
    }
  }
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});

