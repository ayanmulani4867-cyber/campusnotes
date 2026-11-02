// scripts/test-live-production-contribution.mjs
// Verifies an actual anonymous student contribution directly against the live production Worker
// using origin https://campusnotes.space

import assert from 'node:assert/strict';

const LIVE_WORKER_URL = 'https://campusnotes-pdf-api.ayanmull8886.workers.dev';
const LIVE_SITE_ORIGIN = 'https://campusnotes.space';

async function runLiveTest() {
  console.log('========================================================================');
  console.log('  CAMPUSNOTES — LIVE PRODUCTION CONTRIBUTION END-TO-END VERIFICATION');
  console.log('  Origin: ' + LIVE_SITE_ORIGIN);
  console.log('  Worker: ' + LIVE_WORKER_URL);
  console.log('========================================================================\n');

  // Step 1: Health Check
  console.log('1. Health check verification...');
  const healthRes = await fetch(`${LIVE_WORKER_URL}/health`, {
    headers: { Origin: LIVE_SITE_ORIGIN },
  });
  assert.equal(healthRes.status, 200, `Health check failed: HTTP ${healthRes.status}`);
  const healthData = await healthRes.json();
  console.log('   [PASS] Health check:', healthData);
  assert.equal(healthData.status, 'ok');
  assert.equal(healthData.version, '2.1.0');
  assert.equal(healthData.bucket, 'campusnotes-pdfs');

  // Step 2: CORS Preflight
  console.log('\n2. CORS Preflight verification for https://campusnotes.space...');
  const preflightRes = await fetch(`${LIVE_WORKER_URL}/submissions/init`, {
    method: 'OPTIONS',
    headers: {
      Origin: LIVE_SITE_ORIGIN,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'Content-Type',
    },
  });
  assert.equal(preflightRes.status, 204, `Preflight failed: HTTP ${preflightRes.status}`);
  assert.equal(preflightRes.headers.get('access-control-allow-origin'), LIVE_SITE_ORIGIN);
  const allowMethods = preflightRes.headers.get('access-control-allow-methods') || '';
  assert(allowMethods.includes('POST'), 'POST not in Access-Control-Allow-Methods');
  assert(allowMethods.includes('PUT'), 'PUT not in Access-Control-Allow-Methods');
  console.log('   [PASS] Preflight allowed:', {
    origin: preflightRes.headers.get('access-control-allow-origin'),
    methods: allowMethods,
  });

  // Step 3: Anonymous Student Contribution Initialization
  console.log('\n3. Initializing anonymous PDF contribution (Step 1 of 2)...');
  const submissionPayload = {
    studentName: 'Anonymous Live Tester',
    email: 'tester@campusnotes.space',
    college: 'CampusNotes Engineering Institute',
    materialTitle: 'Live Production Verification Notes — Unit 1',
    description: 'Autonomous student submission verification after production fix',
    semesterId: '1',
    subjectId: 'engineering-chemistry',
    category: 'notes',
    fileName: 'Live_Production_Notes_Unit1.pdf',
    fileSize: 4096,
    mimeType: 'application/pdf',
    honeypot: '',
    formStartTime: Date.now() - 7000,
  };

  const initRes = await fetch(`${LIVE_WORKER_URL}/submissions/init`, {
    method: 'POST',
    headers: {
      Origin: LIVE_SITE_ORIGIN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(submissionPayload),
  });

  assert.equal(initRes.status, 200, `Init failed: HTTP ${initRes.status}`);
  const initData = await initRes.json();
  console.log('   [PASS] Submission initialized:', initData);
  assert.equal(initData.ok, true);
  assert(initData.submissionId, 'Missing submissionId');
  assert(initData.uploadToken, 'Missing uploadToken');
  assert(initData.uploadUrl, 'Missing uploadUrl');

  // Step 4: Binary File Upload Direct-to-R2 (Step 2 of 2)
  console.log('\n4. Streaming original binary PDF directly to R2 upload endpoint...');
  const validPdfHeader = '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n164\n%%EOF\n';
  const pdfBuffer = Buffer.from(validPdfHeader);

  const uploadRes = await fetch(initData.uploadUrl, {
    method: 'PUT',
    headers: {
      Origin: LIVE_SITE_ORIGIN,
      'Content-Type': 'application/pdf',
      'X-Upload-Token': initData.uploadToken,
    },
    body: pdfBuffer,
  });

  assert.equal(uploadRes.status, 201, `Upload failed: HTTP ${uploadRes.status}`);
  const uploadData = await uploadRes.json();
  console.log('   [PASS] Upload completed:', uploadData);
  assert.equal(uploadData.ok, true);
  assert.equal(uploadData.submissionId, initData.submissionId);
  assert(uploadData.message.includes('successfully'), 'Missing success message');

  console.log('\n========================================================================');
  console.log('  ALL LIVE VERIFICATIONS PASSED SUCCESSFULLY!');
  console.log(`  Live Submission ID: ${initData.submissionId}`);
  console.log('  Status: Pending Admin Approval in Cloudflare R2 bucket');
  console.log('========================================================================\n');
}

runLiveTest().catch(err => {
  console.error('\n[FATAL ERROR IN LIVE TEST]:', err);
  process.exit(1);
});

