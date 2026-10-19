#!/usr/bin/env node
/**
 * CampusNotes — Safe PDF Migration Tool (RTDB Base64 -> Cloudflare R2)
 *
 * Capabilities:
 * - Safe individual or batch migration
 * - Non-destructive: preserves existing RTDB /file_blobs records for instant rollback
 * - Full SHA-256 cryptographic integrity verification before & after transfer
 * - Dry-run simulation mode (read-only, zero production mutations)
 * - Automatic retry with exponential backoff
 * - Rollback mechanism to revert metadata to RTDB
 *
 * Usage:
 *   node scripts/migrate-pdfs-to-r2.mjs --dry-run
 *   node scripts/migrate-pdfs-to-r2.mjs --verify-only
 *   node scripts/migrate-pdfs-to-r2.mjs --material-id <id> --dry-run
 *   node scripts/migrate-pdfs-to-r2.mjs --material-id <id> --admin-token <token>
 *   node scripts/migrate-pdfs-to-r2.mjs --all --admin-token <token>
 *   node scripts/migrate-pdfs-to-r2.mjs --rollback <id> --admin-token <token>
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_RTDB_URL = 'https://campusnotes-e62cf-default-rtdb.firebaseio.com';
const DEFAULT_WORKER_URL = 'https://campusnotes-pdf-api.ayanmull8886.workers.dev';
const AUDIT_LOG_FILE = path.join(__dirname, 'migration-audit.log');

// -------------------------------------------------------------
// CLI Argument Parsing
// -------------------------------------------------------------
const args = process.argv.slice(2);
function getArg(flag) {
  const idx = args.indexOf(flag);
  if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
  return null;
}
function hasFlag(flag) {
  return args.includes(flag);
}

const isDryRun = hasFlag('--dry-run') || (!hasFlag('--all') && !getArg('--material-id') && !getArg('--rollback') && !hasFlag('--verify-only'));
const isVerifyOnly = hasFlag('--verify-only');
const targetMaterialId = getArg('--material-id');
const rollbackMaterialId = getArg('--rollback');
const targetAll = hasFlag('--all');
const adminToken = getArg('--admin-token') || process.env.CAMPUSNOTES_ADMIN_TOKEN || '';
const rtdbUrl = (getArg('--rtdb-url') || process.env.VITE_FIREBASE_DATABASE_URL || DEFAULT_RTDB_URL).replace(/\/+$/, '');
const workerUrl = (getArg('--worker-url') || process.env.VITE_R2_WORKER_URL || DEFAULT_WORKER_URL).replace(/\/+$/, '');
const maxRetries = parseInt(getArg('--retries') || '3', 10);

function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}`;
  console.log(line);
  try {
    fs.appendFileSync(AUDIT_LOG_FILE, line + '\n', 'utf8');
  } catch {
    // Ignore logging error
  }
}

function computeSha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function sanitizeFilename(name) {
  return (name || 'document.pdf').replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// -------------------------------------------------------------
// Firebase RTDB Operations
// -------------------------------------------------------------
async function fetchAllMaterials(token) {
  const authQuery = token ? `?auth=${encodeURIComponent(token)}` : '';
  if (token) {
    try {
      const res = await fetch(`${rtdbUrl}/materials.json${authQuery}`);
      if (res.ok) {
        const data = await res.json();
        if (data) return Object.entries(data).map(([id, item]) => ({ ...item, id }));
      }
    } catch (err) {
      log(`Notice: Could not read /materials with token (${err.message}), trying /publicMaterials`);
    }
  }

  const res = await fetch(`${rtdbUrl}/publicMaterials.json`);
  if (!res.ok) {
    throw new Error(`Failed to read /publicMaterials from RTDB (HTTP ${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  if (!data) return [];
  return Object.entries(data).map(([id, item]) => ({ ...item, id }));
}

async function fetchBlobRecord(blobId) {
  const res = await fetch(`${rtdbUrl}/file_blobs/${encodeURIComponent(blobId)}.json`);
  if (!res.ok) {
    throw new Error(`Failed to fetch blob ${blobId} from RTDB (HTTP ${res.status})`);
  }
  return await res.json();
}

async function updateMaterialRtdb(materialId, updates, token, isPublished = false) {
  const authQuery = token ? `?auth=${encodeURIComponent(token)}` : '';
  const payload = JSON.stringify(updates);

  // Update in /materials
  const matRes = await fetch(`${rtdbUrl}/materials/${encodeURIComponent(materialId)}.json${authQuery}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
  });
  if (!matRes.ok) {
    throw new Error(`Failed to update /materials/${materialId} in RTDB (HTTP ${matRes.status}): ${await matRes.text()}`);
  }

  // Security: ONLY update in /publicMaterials if the material is genuinely published
  // Never expose draft or unpublished materials in the public catalog partition
  if (isPublished === true) {
    const pubRes = await fetch(`${rtdbUrl}/publicMaterials/${encodeURIComponent(materialId)}.json${authQuery}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    });
    if (!pubRes.ok) {
      log(`Warning: Failed to update /publicMaterials/${materialId} (HTTP ${pubRes.status})`);
    }
  }
}

// -------------------------------------------------------------
// R2 Worker Operations
// -------------------------------------------------------------
async function uploadToR2Worker(materialId, buffer, fileName, token) {
  const uploadUrl = `${workerUrl}/materials/${encodeURIComponent(materialId)}/pdf?filename=${encodeURIComponent(fileName)}`;
  const headers = {
    'Content-Type': 'application/pdf',
    'X-Filename': encodeURIComponent(fileName),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers,
    body: buffer,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Worker PUT /materials/${materialId}/pdf failed (HTTP ${res.status}): ${errorText}`);
  }

  return await res.json();
}

async function deleteR2Object(materialId, key, token) {
  const deleteUrl = `${workerUrl}/materials/${encodeURIComponent(materialId)}/pdf?key=${encodeURIComponent(key)}`;
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(deleteUrl, { method: 'DELETE', headers });
  if (!res.ok) {
    throw new Error(`Worker DELETE failed (HTTP ${res.status}): ${await res.text()}`);
  }
  return await res.json();
}

async function verifyR2Object(materialId, expectedSha256, expectedLength, token) {
  const getUrl = `${workerUrl}/materials/${encodeURIComponent(materialId)}/pdf`;
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(getUrl, { headers });
  if (!res.ok) {
    return { ok: false, error: `Worker GET returned HTTP ${res.status}` };
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const actualLength = buffer.length;
  const actualSha256 = computeSha256(buffer);

  if (expectedLength !== null && expectedLength !== undefined && actualLength !== expectedLength) {
    return { ok: false, error: `Length mismatch: expected ${expectedLength}, got ${actualLength}` };
  }

  if (expectedSha256 !== null && expectedSha256 !== undefined && actualSha256 !== expectedSha256) {
    return { ok: false, error: `SHA-256 mismatch: expected ${expectedSha256}, got ${actualSha256}` };
  }

  return { ok: true, sha256: actualSha256, sizeBytes: actualLength };
}

// -------------------------------------------------------------
// Single Material Migration
// -------------------------------------------------------------
async function migrateMaterial(material, dryRun = true) {
  const id = material.id;
  const title = material.title || id;
  const blobId = material.blobId || (material.storagePath?.startsWith('rtdb://file_blobs/') ? material.storagePath.replace('rtdb://file_blobs/', '') : null);

  log(`------------------------------------------------------------`);
  log(`Processing [${id}]: "${title}" (Published: ${material.published})`);

  if (material.storageProvider === 'r2' && material.r2Key) {
    log(`  -> Already marked as R2 (key: ${material.r2Key}). Verifying R2 availability...`);
    const check = await verifyR2Object(id, null, null, adminToken).catch((e) => ({ ok: false, error: e.message }));
    if (check.ok) {
      log(`  -> R2 object verified active (${check.sizeBytes} bytes).`);
      return { id, status: 'ALREADY_MIGRATED', sizeBytes: check.sizeBytes };
    } else {
      log(`  -> Notice: Marked R2 but object check failed (${check.error}). Will attempt re-migration from RTDB blob if available.`);
    }
  }

  if (!blobId) {
    log(`  -> SKIP: No RTDB blobId found for material ${id}. (Storage path: ${material.storagePath})`);
    return { id, status: 'SKIPPED_NO_BLOB' };
  }

  // 1. Fetch RTDB Blob record
  log(`  -> Fetching RTDB blob record /file_blobs/${blobId}...`);
  const blobRecord = await fetchBlobRecord(blobId);
  if (!blobRecord || !blobRecord.data_base64) {
    log(`  -> ERROR: RTDB blob ${blobId} is missing or has empty data_base64.`);
    return { id, status: 'ERROR_EMPTY_BLOB' };
  }

  // 2. Decode Base64 & validate PDF signature
  const base64Str = blobRecord.data_base64.replace(/^data:application\/pdf;base64,/, '').trim();
  const rawBytes = Buffer.from(base64Str, 'base64');
  const wireBytes = blobRecord.data_base64.length;
  const binarySizeBytes = rawBytes.length;
  const savingsBytes = wireBytes - binarySizeBytes;
  const savingsPercent = ((savingsBytes / wireBytes) * 100).toFixed(1);

  if (rawBytes.length < 5) {
    log(`  -> ERROR: Decoded binary data is truncated (${rawBytes.length} bytes).`);
    return { id, status: 'ERROR_TRUNCATED' };
  }

  const magicHeader = rawBytes.subarray(0, 5).toString('ascii');
  if (magicHeader !== '%PDF-') {
    log(`  -> ERROR: Decoded binary header does not match %PDF- (got: ${magicHeader}).`);
    return { id, status: 'ERROR_INVALID_PDF_HEADER' };
  }

  const sha256 = computeSha256(rawBytes);
  const fileName = sanitizeFilename(material.fileName || blobRecord.file_name || `${id}.pdf`);
  const targetKey = `materials/${id}/${Date.now()}_${fileName}`;
  const targetDownloadUrl = `${workerUrl}/materials/${encodeURIComponent(id)}/pdf`;

  log(`  -> Verified PDF: ${binarySizeBytes.toLocaleString()} bytes raw binary (RTDB Base64 wire size: ${wireBytes.toLocaleString()} bytes, -${savingsPercent}% reduction)`);
  log(`  -> SHA-256 Checksum: ${sha256}`);
  log(`  -> Target R2 Object Key: ${targetKey}`);

  if (dryRun) {
    log(`  -> [DRY-RUN]: Verification SUCCESS. Zero mutations applied.`);
    return {
      id,
      status: 'DRY_RUN_PASSED',
      fileName,
      binarySizeBytes,
      wireBytes,
      sha256,
      targetKey,
    };
  }

  // 3. Execution Phase (with Retries)
  if (!adminToken) {
    throw new Error('Migration execution requires an administrator token (--admin-token <token>). Run with --dry-run to simulate.');
  }

  let attempt = 0;
  let uploadSuccess = false;
  let uploadResult = null;

  while (attempt < maxRetries && !uploadSuccess) {
    attempt++;
    try {
      log(`  -> Uploading raw binary to R2 via Worker (Attempt ${attempt}/${maxRetries})...`);
      uploadResult = await uploadToR2Worker(id, rawBytes, fileName, adminToken);
      uploadSuccess = true;
    } catch (err) {
      log(`  -> Upload attempt ${attempt} failed: ${err.message}`);
      if (attempt < maxRetries) {
        const backoffMs = Math.pow(2, attempt) * 1000;
        log(`  -> Waiting ${backoffMs} ms before retry...`);
        await sleep(backoffMs);
      }
    }
  }

  if (!uploadSuccess || !uploadResult) {
    log(`  -> FAILED: Could not upload to R2 after ${maxRetries} attempts.`);
    return { id, status: 'FAILED_UPLOAD' };
  }

  // 4. Verify R2 object integrity (Read-back SHA-256 validation)
  log(`  -> Verifying R2 read-back integrity...`);
  const verify = await verifyR2Object(id, sha256, binarySizeBytes, adminToken);
  if (!verify.ok) {
    log(`  -> INTEGRITY VERIFICATION FAILED: ${verify.error}`);
    // Rollback: clean up corrupted or mismatched object from R2
    if (uploadResult && uploadResult.r2Key) {
      log(`  -> Cleaning up failed R2 object: ${uploadResult.r2Key}`);
      try {
        await deleteR2Object(id, uploadResult.r2Key, adminToken);
      } catch (delErr) {
        log(`  -> Warning: Could not clean up failed object from R2: ${delErr.message}`);
      }
    }
    return { id, status: 'FAILED_INTEGRITY_CHECK' };
  }
  log(`  -> Integrity verified: SHA-256 matched exactly!`);

  // 5. Update Firebase RTDB Metadata
  log(`  -> Updating Firebase RTDB metadata (non-destructively preserving original blobId: ${blobId})...`);
  const rtdbUpdates = {
    storageProvider: 'r2',
    r2Key: uploadResult.r2Key || targetKey,
    r2Url: targetDownloadUrl,
    storagePath: `r2://${uploadResult.r2Key || targetKey}`,
    downloadUrl: targetDownloadUrl,
    fileName,
    fileSize: binarySizeBytes,
    updatedAt: Date.now(),
  };

  await updateMaterialRtdb(id, rtdbUpdates, adminToken, material.published === true);
  log(`  -> SUCCESS: Material ${id} safely migrated to Cloudflare R2!`);

  return {
    id,
    status: 'MIGRATED',
    fileName,
    binarySizeBytes,
    sha256,
    r2Key: uploadResult.r2Key || targetKey,
  };
}

// -------------------------------------------------------------
// Rollback Material
// -------------------------------------------------------------
async function rollbackMaterial(materialId, token) {
  log(`------------------------------------------------------------`);
  log(`Rolling back material [${materialId}] from R2 to RTDB...`);

  if (!token) {
    throw new Error('Rollback requires --admin-token <token>.');
  }

  const res = await fetch(`${rtdbUrl}/materials/${encodeURIComponent(materialId)}.json`);
  if (!res.ok) throw new Error(`Could not fetch material ${materialId} from RTDB`);
  const mat = await res.json();
  if (!mat) throw new Error(`Material ${materialId} not found in RTDB`);

  if (!mat.blobId) {
    throw new Error(`Cannot rollback material ${materialId}: Original blobId is missing from metadata.`);
  }

  // Verify original blob still exists in RTDB
  const blobRecord = await fetchBlobRecord(mat.blobId);
  if (!blobRecord || !blobRecord.data_base64) {
    throw new Error(`Cannot rollback: RTDB blob ${mat.blobId} is not available in /file_blobs.`);
  }

  const rollbackUpdates = {
    storageProvider: 'firebase',
    r2Key: null,
    r2Url: null,
    storagePath: `rtdb://file_blobs/${mat.blobId}`,
    downloadUrl: `rtdb://${mat.blobId}`,
    updatedAt: Date.now(),
  };

  const isPublished = mat.published === true;
  await updateMaterialRtdb(materialId, rollbackUpdates, token, isPublished);
  log(`  -> ROLLBACK COMPLETE: Material ${materialId} successfully reverted to RTDB Base64 storage.`);
}

// -------------------------------------------------------------
// Main Execution
// -------------------------------------------------------------
async function main() {
  if (targetAll && !isDryRun && !isVerifyOnly && !hasFlag('--confirm')) {
    console.error('Error: Batch migration of all materials requires explicit --confirm flag to prevent accidental execution.');
    console.error('Usage: node scripts/migrate-pdfs-to-r2.mjs --all --admin-token <token> --confirm');
    process.exit(1);
  }

  console.log(`============================================================`);
  console.log(`  CampusNotes — PDF Storage Migration & Verification Tool  `);
  console.log(`============================================================`);
  console.log(`Mode:            ${isDryRun ? 'DRY-RUN (Read-Only Simulation)' : isVerifyOnly ? 'VERIFY-ONLY' : rollbackMaterialId ? 'ROLLBACK' : 'LIVE MIGRATION'}`);
  console.log(`RTDB URL:        ${rtdbUrl}`);
  console.log(`Worker URL:      ${workerUrl}`);
  console.log(`Admin Token:     ${adminToken ? '[PROVIDED]' : '[NONE - Read Only]'}`);
  console.log(`Audit Log:       ${AUDIT_LOG_FILE}`);
  console.log(`============================================================\n`);

  if (rollbackMaterialId) {
    await rollbackMaterial(rollbackMaterialId, adminToken);
    return;
  }

  log(`Connecting to Firebase RTDB to fetch current materials...`);
  const materials = await fetchAllMaterials(adminToken);
  log(`Found ${materials.length} total materials in RTDB.`);

  let targetMaterials = materials;
  if (targetMaterialId) {
    targetMaterials = materials.filter((m) => m.id === targetMaterialId);
    if (targetMaterials.length === 0) {
      log(`Material with ID "${targetMaterialId}" was not found in RTDB.`);
      process.exit(1);
    }
  }

  const results = [];
  let totalBinaryBytes = 0;
  let totalWireBytes = 0;

  for (const material of targetMaterials) {
    try {
      const res = await migrateMaterial(material, isDryRun || isVerifyOnly);
      results.push(res);
      if (res.binarySizeBytes) {
        totalBinaryBytes += res.binarySizeBytes;
        totalWireBytes += res.wireBytes || 0;
      }
    } catch (err) {
      log(`Error processing material ${material.id}: ${err.message}`);
      results.push({ id: material.id, status: 'ERROR', error: err.message });
    }
  }

  // Summary Table
  console.log(`\n============================================================`);
  console.log(`                     MIGRATION SUMMARY                     `);
  console.log(`============================================================`);
  console.log(`Total Materials Inspected:   ${targetMaterials.length}`);
  console.log(`Success / Verified:          ${results.filter((r) => r.status === 'DRY_RUN_PASSED' || r.status === 'MIGRATED' || r.status === 'ALREADY_MIGRATED').length}`);
  console.log(`Skipped / No Blob:           ${results.filter((r) => r.status === 'SKIPPED_NO_BLOB').length}`);
  console.log(`Errors:                      ${results.filter((r) => r.status.startsWith('ERROR') || r.status.startsWith('FAILED')).length}`);
  if (totalWireBytes > 0 && totalBinaryBytes > 0) {
    const totalSaved = totalWireBytes - totalBinaryBytes;
    console.log(`Total Base64 Wire Bandwidth: ${(totalWireBytes / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`Total R2 Raw Binary Size:    ${(totalBinaryBytes / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`Bandwidth Overhead Eliminated: ${(totalSaved / (1024 * 1024)).toFixed(2)} MB (-${((totalSaved / totalWireBytes) * 100).toFixed(1)}%)`);
  }
  console.log(`Audit Log Location:          ${AUDIT_LOG_FILE}`);
  console.log(`============================================================\n`);
}

main().catch((err) => {
  console.error('Fatal Migration Error:', err);
  process.exit(1);
});
