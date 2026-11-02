// scripts/test-browser-submission-flow.mjs
// Simulates the exact browser contribution flow on localhost:5173 / 127.0.0.1:8787

import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const WORKER_URL = 'http://127.0.0.1:8787';

function cleanupSubmission(submissionId) {
  try {
    const dbPath = 'C:/Users/ayanm/.gemini/antigravity-ide/scratch/campusnotes/worker/.wrangler/state/v3/r2/miniflare-R2BucketObject/7a69e15903f156a72c06fc5f043906de0244c3b367436a815d87ce0317b93836.sqlite';
    const blobsDir = 'C:/Users/ayanm/.gemini/antigravity-ide/scratch/campusnotes/worker/.wrangler/state/v3/r2/campusnotes-pdfs/blobs';
    if (!fs.existsSync(dbPath)) return;
    const db = new DatabaseSync(dbPath, { open: true });
    const rows = db.prepare(`SELECT blob_id FROM _mf_objects WHERE key LIKE 'pending_submissions/' || ? || '/%'`).all(submissionId);
    for (const row of rows) {
      const bp = path.join(blobsDir, row.blob_id);
      if (fs.existsSync(bp)) fs.unlinkSync(bp);
    }
    db.prepare(`DELETE FROM _mf_objects WHERE key LIKE 'pending_submissions/' || ? || '/%'`).run(submissionId);
    console.log(`\n5. [CLEANUP] Safely cleaned test submission ${submissionId} from local storage.`);
  } catch (e) {
    console.warn('Notice cleaning up test submission:', e.message);
  }
}

async function runBrowserFlowSimulation() {
  console.log('=== Simulating Exact Browser Contribution Flow ===\n');

  let createdSubId = null;
  try {
    // Step 1: User fills out the form and submits
    console.log('1. User submits contribution form at /contribute...');
    const initPayload = {
      studentName: 'Ayan Mulani',
      email: 'ayan@campusnotes.space',
      college: 'Computer Science Department',
      materialTitle: 'Cloud Computing Architecture Notes',
      description: 'Complete unit notes for distributed cloud infrastructure',
      semesterId: 'sem5',
      subjectId: 'sub_cc',
      category: 'notes',
      fileName: 'Cloud_Computing_Unit1.pdf',
      fileSize: 2048,
      mimeType: 'application/pdf',
      honeypot: '',
      formStartTime: Date.now() - 6000,
    };

    const initRes = await fetch(`${WORKER_URL}/submissions/init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:5173',
        'CF-Connecting-IP': '127.0.0.1',
      },
      body: JSON.stringify(initPayload),
    });

    console.log('   POST /submissions/init status:', initRes.status);
    assert.equal(initRes.status, 200, 'Init must return 200 OK');
    const initData = await initRes.json();
    createdSubId = initData.submissionId;
    console.log('   Received uploadUrl:', initData.uploadUrl);
    console.log('   Received submissionId:', initData.submissionId);
    console.log('   Received uploadToken:', initData.uploadToken.substring(0, 16) + '...');
    assert.ok(initData.ok);
    assert.ok(initData.uploadUrl);
    assert.ok(initData.submissionId);

    // Step 2: Browser uploads binary PDF
    console.log('\n2. Browser uploads binary PDF file to uploadUrl...');
    const samplePdf = new Uint8Array(2048);
    const pdfHeader = '%PDF-1.4\n%CampusNotes Test\n1 0 obj\n<< /Title (Cloud Computing) >>\nendobj\n';
    for (let i = 0; i < pdfHeader.length; i++) samplePdf[i] = pdfHeader.charCodeAt(i);

    const uploadRes = await fetch(initData.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/pdf',
        'X-Upload-Token': initData.uploadToken,
        'Origin': 'http://localhost:5173',
      },
      body: samplePdf,
    });

    console.log('   PUT upload status:', uploadRes.status);
    assert.equal(uploadRes.status, 201, 'Upload must return 201 Created');
    const uploadResult = await uploadRes.json();
    console.log('   Upload confirmation:', uploadResult.message);
    assert.ok(uploadResult.ok);
    assert.ok(uploadResult.message.includes('Thank you for contributing to CampusNotes!'));

    // Step 3: Verify isolation - unauthenticated public request to the pending file MUST fail
    console.log('\n3. Verifying pending file isolation from public access...');
    const publicAccessRes = await fetch(`${WORKER_URL}/submissions/${initData.submissionId}/file`, {
      headers: { 'Origin': 'http://localhost:5173' },
    });
    console.log('   Public unauthenticated access status:', publicAccessRes.status);
    assert.equal(publicAccessRes.status, 401, 'Pending files must return 401 without admin credentials');

    // Step 4: Verify diagnostic error message on missing endpoint
    console.log('\n4. Verifying clear error message when endpoint is missing...');
    const badEndpointRes = await fetch(`${WORKER_URL}/nonexistent-api`, {
      headers: { 'Origin': 'http://localhost:5173' },
    });
    console.log('   Bad endpoint status:', badEndpointRes.status);
    const badData = await badEndpointRes.json();
    console.log('   Bad endpoint response:', badData);
    assert.equal(badEndpointRes.status, 404);

    console.log('\n=== ALL BROWSER FLOW SIMULATION CHECKS PASSED ===');
  } finally {
    if (createdSubId) {
      cleanupSubmission(createdSubId);
    }
  }
}

runBrowserFlowSimulation().catch((err) => {
  console.error('\nSIMULATION FAILED:', err);
  process.exit(1);
});

