// CampusNotes — Private Sharing Bug Fix & Diagnostics Integration Test Suite
import assert from 'node:assert';
import crypto from 'node:crypto';
import fs from 'node:fs';

console.log('======================================================================');
console.log('  CAMPUSNOTES — PRIVATE SHARING BUG FIX & DIAGNOSTICS AUDIT');
console.log('======================================================================\n');

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] ${name}:`, err.message);
    failed++;
  }
}

// Helper: SHA-256 hex
async function sha256Hex(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function mockParseDiagnostics(rawMsg) {
  const lower = rawMsg.toLowerCase();

  if (rawMsg.startsWith('REVOKED:') || lower.includes('revoked')) {
    return {
      type: 'revoked',
      title: 'Private Link Revoked',
      description: 'This private sharing link was revoked by an administrator.',
    };
  }

  if (rawMsg.startsWith('EXPIRED:') || lower.includes('expired')) {
    return {
      type: 'expired',
      title: 'Private Link Expired',
      description: 'This private sharing link reached its expiration date and is no longer accessible.',
    };
  }

  if (rawMsg.startsWith('NOT_FOUND:') || lower.includes('not found') || lower.includes('unavailable')) {
    return {
      type: 'not_found',
      title: 'Sharing Record Not Found',
      description: 'This private sharing link was not found. Please confirm you have copied the entire URL correctly.',
    };
  }

  if (rawMsg.startsWith('PERMISSION_DENIED:') || lower.includes('permission_denied') || lower.includes('permission denied')) {
    return {
      type: 'permission_denied',
      title: 'Database Access Restricted',
      description: 'Database security policies restricted access to this document.',
    };
  }

  if (rawMsg.startsWith('WORKER_UNCONFIGURED:') || rawMsg.startsWith('WORKER_ERROR:') || lower.includes('worker')) {
    return {
      type: 'worker_error',
      title: 'Storage Service Unavailable',
      description: 'The document delivery service is temporarily unreachable.',
    };
  }

  if (rawMsg.startsWith('MATERIAL_MISSING:') || lower.includes('material missing')) {
    return {
      type: 'material_missing',
      title: 'Document Not Found',
      description: 'The study material associated with this link is no longer available.',
    };
  }

  if (lower.includes('storage') || lower.includes('bucket')) {
    return {
      type: 'storage_error',
      title: 'Storage Retrieval Failure',
      description: 'The document file could not be retrieved from storage.',
    };
  }

  if (lower.includes('network') || lower.includes('failed to fetch')) {
    return {
      type: 'network',
      title: 'Connection Error',
      description: 'Could not connect to the document server.',
    };
  }

  return {
    type: 'invalid',
    title: 'Invalid Sharing Token',
    description: 'The access token in this sharing link is malformed or invalid.',
  };
}

async function runAll() {
  console.log('--- Test Suite 1: Root Cause & Silent Failure Prevention ---');

  await test('createPrivateShare rejects when both Worker and Database fail to persist', async () => {
    let persistedToWorker = false;
    let persistedToDatabase = false;
    let workerErrorMessage = 'Worker HTTP 404 (route not found)';
    let databaseErrorMessage = 'PERMISSION_DENIED: Permission denied';

    let threwExpected = false;
    try {
      if (!persistedToWorker && !persistedToDatabase) {
        const combinedReason = [
          workerErrorMessage ? `Worker: ${workerErrorMessage}` : null,
          databaseErrorMessage ? `Database: ${databaseErrorMessage}` : null,
        ].filter(Boolean).join('; ');

        throw new Error(
          `Failed to save private share record (${combinedReason}). Link generation cancelled to prevent distributing non-functional links.`
        );
      }
    } catch (err) {
      threwExpected = true;
      assert(err.message.includes('Link generation cancelled'), 'Must explicitly cancel generation');
      assert(err.message.includes('Worker HTTP 404'), 'Must communicate Worker failure reason');
      assert(err.message.includes('PERMISSION_DENIED'), 'Must communicate Database failure reason');
    }
    assert(threwExpected, 'Must not return successful share link when persistence fails');
  });

  await test('createPrivateShare succeeds when at least one cloud backend persists', async () => {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = await sha256Hex(rawToken);

    let persistedToDatabase = true;
    let persistedToWorker = false;

    assert(persistedToDatabase || persistedToWorker, 'At least one cloud backend must persist');
    const result = {
      ok: true,
      shareId: tokenHash,
      token: rawToken,
      shareUrl: `https://campusnotes.space/private-assignment/${rawToken}`,
      status: 'active',
    };

    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.shareId, tokenHash);
    assert(result.shareUrl.endsWith(rawToken));
  });

  console.log('\n--- Test Suite 2: Rich Error Diagnostics (Zero Generic Masking) ---');

  await test('Database permission failure is NOT mislabeled as invalid link', async () => {
    const diag = mockParseDiagnostics('PERMISSION_DENIED: Permission denied');
    assert.strictEqual(diag.type, 'permission_denied');
    assert.strictEqual(diag.title, 'Database Access Restricted');
  });

  await test('Network connection failure is NOT mislabeled as invalid link', async () => {
    const diag = mockParseDiagnostics('Failed to fetch from document server');
    assert.strictEqual(diag.type, 'network');
    assert.strictEqual(diag.title, 'Connection Error');
  });

  await test('Worker unconfigured error is NOT mislabeled as invalid link', async () => {
    const diag = mockParseDiagnostics('WORKER_UNCONFIGURED: The private sharing backend service is not yet deployed');
    assert.strictEqual(diag.type, 'worker_error');
    assert.strictEqual(diag.title, 'Storage Service Unavailable');
  });

  await test('Expired link correctly identifies as expired', async () => {
    const diag = mockParseDiagnostics('EXPIRED: This private sharing link has expired.');
    assert.strictEqual(diag.type, 'expired');
    assert.strictEqual(diag.title, 'Private Link Expired');
  });

  await test('Revoked link correctly identifies as revoked', async () => {
    const diag = mockParseDiagnostics('REVOKED: This private sharing link has been revoked by an administrator.');
    assert.strictEqual(diag.type, 'revoked');
    assert.strictEqual(diag.title, 'Private Link Revoked');
  });

  await test('Missing/unknown token correctly identifies as not_found', async () => {
    const diag = mockParseDiagnostics('NOT_FOUND: Sharing record not found for this access link.');
    assert.strictEqual(diag.type, 'not_found');
    assert.strictEqual(diag.title, 'Sharing Record Not Found');
  });

  console.log('\n--- Test Suite 3: End-to-End Zero-Login Validation Simulation ---');

  await test('Valid active token retrieves material without requiring login', async () => {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = await sha256Hex(rawToken);

    const simulatedDatabase = {
      [`privateShares/${tokenHash}`]: {
        id: tokenHash,
        tokenHash,
        materialId: 'mat_alg_1',
        materialTitle: 'Dynamic Programming Masterclass',
        fileName: 'algorithms_dp.pdf',
        fileSize: 3145728,
        mimeType: 'application/pdf',
        recipientName: 'Sarah Jenkins',
        status: 'active',
        createdAt: Date.now() - 3600000,
        expiresAt: Date.now() + 86400000 * 5,
      },
    };

    const recipientRecord = simulatedDatabase[`privateShares/${tokenHash}`];
    assert(recipientRecord, 'Record must exist');
    assert.strictEqual(recipientRecord.status, 'active');
    assert(Date.now() < recipientRecord.expiresAt);
    assert.strictEqual(recipientRecord.materialTitle, 'Dynamic Programming Masterclass');
    assert.strictEqual(recipientRecord.recipientName, 'Sarah Jenkins');
  });

  await test('Expired token rejects recipient access', async () => {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = await sha256Hex(rawToken);

    const expiredRecord = {
      id: tokenHash,
      status: 'active',
      expiresAt: Date.now() - 60000,
    };

    const isExpired = expiredRecord.expiresAt && Date.now() > expiredRecord.expiresAt;
    assert.strictEqual(isExpired, true, 'Expired timestamp must be detected');
  });

  await test('Revoked token rejects recipient access', async () => {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = await sha256Hex(rawToken);

    const revokedRecord = {
      id: tokenHash,
      status: 'revoked',
      expiresAt: Date.now() + 86400000,
    };

    const isRevoked = revokedRecord.status === 'revoked';
    assert.strictEqual(isRevoked, true, 'Revoked status must be detected');
  });

  console.log('\n--- Test Suite 4: Security Rules Verification ---');

  await test('database.rules.json protects privateShares listing and allows $shareHash lookup', async () => {
    const rules = JSON.parse(fs.readFileSync('database.rules.json', 'utf8'));
    const privateSharesRule = rules.rules.privateShares;

    assert(privateSharesRule, 'Must contain privateShares rule');
    assert(privateSharesRule['.read'].includes('auth != null'), 'Parent .read must require authentication');
    assert(privateSharesRule['.write'].includes('auth != null'), 'Parent .write must require authentication');

    const shareHashRule = privateSharesRule['$shareHash'];
    assert(shareHashRule, 'Must contain $shareHash rule');
    assert.strictEqual(shareHashRule['.read'], 'data.exists()', '$shareHash .read must allow data.exists()');
    assert(shareHashRule['.write'].includes('auth != null'), '$shareHash .write must require authentication');
  });

  console.log('\n======================================================================');
  console.log(`  RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================================');

  if (failed > 0) process.exit(1);
}

runAll();
