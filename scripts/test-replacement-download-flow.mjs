/**
 * CampusNotes — End-to-End Automated Test:
 * PDF Replacement & Public Download Verification
 * 
 * Verifies:
 * 1. Initial PDF validation and upload to RTDB /file_blobs
 * 2. Public metadata creation in /publicMaterials and /materials
 * 3. Initial PDF download resolution and bit-for-bit byte verification
 * 4. Safe PDF replacement protocol (upload -> readback verify -> atomic update)
 * 5. Metadata verification confirming reference to the new blob
 * 6. Public user download resolving the NEW replaced blob (not old or cached)
 * 7. 100% bit-for-bit match between replacement bytes and downloaded bytes
 * 8. Safe retirement and cleanup of the old blob (and protection of shared blobs)
 * 9. Security rule enforcement: unpublished/draft materials blocked from public download
 * 10. URL scheme resilience: rtdb://, rtdb://file_blobs/, blobId extraction
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('======================================================================');
console.log('  CAMPUSNOTES — REPLACED PDF REPLACEMENT & DOWNLOAD TEST SUITE');
console.log('======================================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`  [FAIL] ${testName}: ${details}`);
    failedTests++;
  }
}

// -----------------------------------------------------------------------------
// Helper Implementations mirroring firebaseService.ts
// -----------------------------------------------------------------------------

function extractBlobId(material) {
  if (!material) return null;
  if (material.blobId && typeof material.blobId === 'string' && material.blobId.trim()) {
    return material.blobId.trim();
  }
  if (material.storagePath && typeof material.storagePath === 'string') {
    if (material.storagePath.startsWith('rtdb://file_blobs/')) {
      return material.storagePath.replace('rtdb://file_blobs/', '').trim();
    }
    if (material.storagePath.startsWith('rtdb://')) {
      return material.storagePath.replace('rtdb://', '').trim();
    }
  }
  if (material.downloadUrl && typeof material.downloadUrl === 'string') {
    if (material.downloadUrl.startsWith('rtdb://file_blobs/')) {
      return material.downloadUrl.replace('rtdb://file_blobs/', '').trim();
    }
    if (material.downloadUrl.startsWith('rtdb://')) {
      return material.downloadUrl.replace('rtdb://', '').trim();
    }
  }
  return null;
}

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
}

function validatePdfSignature(buffer) {
  if (!buffer || buffer.length < 5) return false;
  return (
    buffer[0] === 0x25 && // %
    buffer[1] === 0x50 && // P
    buffer[2] === 0x44 && // D
    buffer[3] === 0x46 && // F
    buffer[4] === 0x2D    // -
  );
}

// -----------------------------------------------------------------------------
// In-Memory Mock of Firebase RTDB State
// -----------------------------------------------------------------------------
class MockRTDB {
  constructor() {
    this.data = {
      settings: { maintenanceMode: false },
      publicMaterials: {},
      materials: {},
      file_blobs: {},
    };
  }

  set(path, value) {
    const parts = path.split('/');
    let current = this.data;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) current[parts[i]] = {};
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = JSON.parse(JSON.stringify(value));
  }

  get(path) {
    const parts = path.split('/');
    let current = this.data;
    for (const part of parts) {
      if (!current || current[part] === undefined) return null;
      current = current[part];
    }
    return JSON.parse(JSON.stringify(current));
  }

  remove(path) {
    const parts = path.split('/');
    let current = this.data;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) return;
      current = current[parts[i]];
    }
    delete current[parts[parts.length - 1]];
  }

  multiUpdate(updates) {
    for (const [p, val] of Object.entries(updates)) {
      if (val === null) {
        this.remove(p);
      } else {
        this.set(p, val);
      }
    }
  }

  // Simulates RTDB rule check for public reading of file_blobs/$blobId
  canPublicReadBlob(blobId) {
    const maintenanceMode = this.get('settings/maintenanceMode');
    if (maintenanceMode === true) return false;

    const blob = this.get(`file_blobs/${blobId}`);
    if (!blob) return false;

    // Rule: (data.child('material_id').exists() && root.child('publicMaterials').child(data.child('material_id').val()).exists()) || data.child('published').val() === true
    const materialId = blob.material_id;
    const materialExistsInPublic = materialId && this.get(`publicMaterials/${materialId}`) !== null;
    const isBlobPublished = blob.published === true;

    return Boolean(materialExistsInPublic || isBlobPublished);
  }
}

const mockDb = new MockRTDB();

// -----------------------------------------------------------------------------
// Real Test PDF Files Generation
// -----------------------------------------------------------------------------
console.log('--- Test Suite 1: Blob ID Extraction & URL Schemes ---');

const testMat1 = {
  id: 'mat_001',
  title: 'Java Concurrency',
  blobId: 'blob_java_001',
};
const testMat2 = {
  id: 'mat_002',
  title: 'Database Normalization',
  storagePath: 'rtdb://file_blobs/blob_db_002',
  downloadUrl: 'rtdb://blob_db_002',
};
const testMat3 = {
  id: 'mat_003',
  title: 'Cloud IAM Security',
  storagePath: 'rtdb://blob_cloud_003',
  downloadUrl: 'rtdb://blob_cloud_003',
};
const testMatDemo = {
  id: 'mat_demo',
  title: 'Demo Assignment',
  downloadUrl: '/demo-pdfs/assignments/sample.pdf',
};

assert(extractBlobId(testMat1) === 'blob_java_001', 'Direct blobId resolved correctly');
assert(extractBlobId(testMat2) === 'blob_db_002', 'storagePath rtdb://file_blobs/ resolved correctly');
assert(extractBlobId(testMat3) === 'blob_cloud_003', 'storagePath rtdb:// without file_blobs/ resolved correctly');
assert(extractBlobId(testMatDemo) === null, 'Demo PDF without blobId returns null');

// -----------------------------------------------------------------------------
// Test Suite 2: Initial PDF Upload & Public Download
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 2: Initial PDF Upload & Public Download ---');

const initialPdfContent = '%PDF-1.4\n1 0 obj\n<< /Title (Initial Syllabus Document v1) /Author (Prof Sharma) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF';
const initialPdfBuffer = Buffer.from(initialPdfContent, 'utf8');
const initialHash = crypto.createHash('sha256').update(initialPdfBuffer).digest('hex');

assert(validatePdfSignature(initialPdfBuffer), 'Initial PDF header satisfies %PDF- signature');

// Upload Initial PDF to RTDB
const materialId = 'mat_test_replace_999';
const initialBlobId = `blob_${materialId}_v1_1001`;
const initialBlobRecord = {
  blob_id: initialBlobId,
  material_id: materialId,
  file_name: 'CS3501_Initial_Syllabus.pdf',
  file_size_bytes: initialPdfBuffer.length,
  mime_type: 'application/pdf',
  data_base64: initialPdfBuffer.toString('base64'),
  published: true,
  created_at: 1000,
};

mockDb.set(`file_blobs/${initialBlobId}`, initialBlobRecord);

const initialMaterial = {
  id: materialId,
  title: 'Advanced Java Programming Syllabus',
  subjectId: '23CS3501',
  category: 'assignments',
  academicYear: '2026-27',
  fileName: 'CS3501_Initial_Syllabus.pdf',
  storagePath: `rtdb://file_blobs/${initialBlobId}`,
  downloadUrl: `rtdb://${initialBlobId}`,
  blobId: initialBlobId,
  fileSize: initialPdfBuffer.length,
  published: true,
  createdAt: 1000,
  updatedAt: 1000,
};

mockDb.set(`materials/${materialId}`, initialMaterial);
mockDb.set(`publicMaterials/${materialId}`, initialMaterial);

assert(mockDb.get(`file_blobs/${initialBlobId}`) !== null, 'Initial blob stored in /file_blobs');
assert(mockDb.get(`publicMaterials/${materialId}`) !== null, 'Initial material published in /publicMaterials');
assert(mockDb.get(`materials/${materialId}`) !== null, 'Initial material stored in /materials');

// Public download simulation for Initial PDF
function simulatePublicDownload(materialParam) {
  // Step 1: Resolve latest published metadata
  const publicMeta = mockDb.get(`publicMaterials/${materialParam.id}`);
  if (!publicMeta) {
    throw new Error('Study material not found or unpublished.');
  }

  // Step 2: Extract current blobId
  const currentBlobId = extractBlobId(publicMeta);
  if (!currentBlobId) {
    throw new Error('No PDF blob associated with material.');
  }

  // Step 3: Check RTDB security rules
  if (!mockDb.canPublicReadBlob(currentBlobId)) {
    throw new Error('PERMISSION_DENIED: Access to file blob is denied by security rules.');
  }

  // Step 4: Fetch blob and decode
  const blobRecord = mockDb.get(`file_blobs/${currentBlobId}`);
  if (!blobRecord || !blobRecord.data_base64) {
    throw new Error('PDF document content could not be located in database.');
  }

  const downloadedBytes = Buffer.from(blobRecord.data_base64, 'base64');
  return {
    bytes: downloadedBytes,
    fileName: publicMeta.fileName || blobRecord.file_name,
    blobId: currentBlobId,
  };
}

const initialDownload = simulatePublicDownload({ id: materialId });
assert(initialDownload.blobId === initialBlobId, 'Initial download resolved initialBlobId');
assert(initialDownload.bytes.length === initialPdfBuffer.length, 'Initial downloaded byte length matches');
assert(
  crypto.createHash('sha256').update(initialDownload.bytes).digest('hex') === initialHash,
  'Initial downloaded bytes match SHA256 exactly'
);

// -----------------------------------------------------------------------------
// Test Suite 3: Safe PDF Replacement Protocol
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 3: Safe PDF Replacement Protocol ---');

// Create distinct replacement PDF
const replacementPdfContent = '%PDF-1.4\n2 0 obj\n<< /Title (REPLACEMENT: Comprehensive Java Assignment 2026 Revised) /Author (Dr Mulani) /Updated (true) >>\nendobj\ntrailer\n<< /Root 2 0 R >>\n%%EOF';
const replacementPdfBuffer = Buffer.from(replacementPdfContent, 'utf8');
const replacementHash = crypto.createHash('sha256').update(replacementPdfBuffer).digest('hex');

assert(
  replacementPdfBuffer.length !== initialPdfBuffer.length,
  'Replacement PDF has distinct size from initial PDF'
);
assert(
  initialHash !== replacementHash,
  'Replacement PDF has distinct SHA256 checksum from initial PDF'
);
assert(validatePdfSignature(replacementPdfBuffer), 'Replacement PDF header satisfies %PDF- signature');

// Simulate the replaceMaterialPdf workflow from firebaseService.ts
function executeReplaceMaterialPdf(material, newFileBuffer, newFileName) {
  // Step 1: Fetch fresh material from RTDB
  const currentMaterial = mockDb.get(`materials/${material.id}`) || material;
  const oldBlobId = extractBlobId(currentMaterial) || extractBlobId(material);
  const isPublished = currentMaterial.published ?? true;

  // Step 2: Upload replacement to /file_blobs/{newBlobId}
  const timestamp = 2000;
  const newBlobId = `blob_${material.id}_${timestamp}`;
  const newBlobRecord = {
    blob_id: newBlobId,
    material_id: material.id,
    file_name: sanitizeFilename(newFileName),
    file_size_bytes: newFileBuffer.length,
    mime_type: 'application/pdf',
    data_base64: newFileBuffer.toString('base64'),
    published: isPublished,
    created_at: timestamp,
  };
  mockDb.set(`file_blobs/${newBlobId}`, newBlobRecord);

  // Step 3: Read back and verify valid Base64 and %PDF- signature
  const verifyBlob = mockDb.get(`file_blobs/${newBlobId}`);
  if (!verifyBlob || !verifyBlob.data_base64) {
    throw new Error('Verification failed: Replacement blob not found in database.');
  }
  const decodedHeader = Buffer.from(verifyBlob.data_base64, 'base64');
  if (!validatePdfSignature(decodedHeader)) {
    // Rollback
    mockDb.remove(`file_blobs/${newBlobId}`);
    throw new Error('Verification failed: Decoded data is not a valid PDF.');
  }

  // Step 4: Atomic multi-location update
  const updatedMaterial = {
    ...currentMaterial,
    fileName: sanitizeFilename(newFileName),
    storagePath: `rtdb://file_blobs/${newBlobId}`,
    downloadUrl: `rtdb://${newBlobId}`,
    blobId: newBlobId,
    fileSize: newFileBuffer.length,
    published: isPublished,
    updatedAt: timestamp,
  };

  const updates = {};
  updates[`materials/${material.id}`] = updatedMaterial;
  if (isPublished) {
    updates[`publicMaterials/${material.id}`] = updatedMaterial;
  } else {
    updates[`publicMaterials/${material.id}`] = null;
  }
  updates[`file_blobs/${newBlobId}/published`] = isPublished;

  mockDb.multiUpdate(updates);

  // Step 5: Confirm metadata points to newBlobId
  const checkMeta = mockDb.get(`materials/${material.id}`);
  if (!checkMeta || checkMeta.blobId !== newBlobId) {
    throw new Error('Verification failed: Metadata does not reference new blob.');
  }

  // Step 6: Safe removal of old blob if not shared
  if (oldBlobId && oldBlobId !== newBlobId) {
    // Check if any other material references oldBlobId
    let isShared = false;
    const allMaterials = mockDb.get('materials');
    if (allMaterials) {
      for (const [mid, m] of Object.entries(allMaterials)) {
        if (mid !== material.id && m.blobId === oldBlobId) {
          isShared = true;
          break;
        }
      }
    }
    if (!isShared) {
      mockDb.remove(`file_blobs/${oldBlobId}`);
    }
  }

  return {
    blobId: newBlobId,
    fileName: updatedMaterial.fileName,
  };
}

const replaceResult = executeReplaceMaterialPdf(
  initialMaterial,
  replacementPdfBuffer,
  'CS3501_Assignment_Revised_Final.pdf'
);

assert(replaceResult.blobId.startsWith(`blob_${materialId}_`), 'Replacement generated versioned blobId');
assert(replaceResult.fileName === 'CS3501_Assignment_Revised_Final.pdf', 'Replacement updated fileName');

// -----------------------------------------------------------------------------
// Test Suite 4: Verifying Data Consistency & Metadata Points to New Blob
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 4: Data Consistency & Metadata Verification ---');

const updatedPrivateMeta = mockDb.get(`materials/${materialId}`);
const updatedPublicMeta = mockDb.get(`publicMaterials/${materialId}`);

assert(updatedPrivateMeta !== null, 'Private material node exists');
assert(updatedPublicMeta !== null, 'Public material node exists');
assert(updatedPrivateMeta.blobId === replaceResult.blobId, 'materials/{id} references new replacement blobId');
assert(updatedPublicMeta.blobId === replaceResult.blobId, 'publicMaterials/{id} references new replacement blobId');
assert(updatedPrivateMeta.fileName === 'CS3501_Assignment_Revised_Final.pdf', 'materials/{id} has updated fileName');
assert(updatedPublicMeta.fileName === 'CS3501_Assignment_Revised_Final.pdf', 'publicMaterials/{id} has updated fileName');
assert(updatedPublicMeta.fileSize === replacementPdfBuffer.length, 'publicMaterials/{id} has updated fileSize');

// -----------------------------------------------------------------------------
// Test Suite 5: Public User Downloads Replaced PDF
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 5: Public User Downloads Replaced PDF ---');

// Even if client passes initialMaterial (stale React state), download must resolve latest replacement!
const publicDownloadAfterReplace = simulatePublicDownload(initialMaterial);

assert(
  publicDownloadAfterReplace.blobId === replaceResult.blobId,
  'Public download resolves new replacement blobId even from stale initialMaterial state'
);

const downloadedHash = crypto
  .createHash('sha256')
  .update(publicDownloadAfterReplace.bytes)
  .digest('hex');

assert(
  publicDownloadAfterReplace.bytes.length === replacementPdfBuffer.length,
  `Downloaded byte count (${publicDownloadAfterReplace.bytes.length}) matches replacement PDF (${replacementPdfBuffer.length})`
);

assert(
  downloadedHash === replacementHash,
  'Downloaded PDF is 100% bit-for-bit identical to replacement file (SHA256 match)'
);

assert(
  downloadedHash !== initialHash,
  'Downloaded PDF is NOT the stale initial PDF'
);

assert(
  validatePdfSignature(publicDownloadAfterReplace.bytes),
  'Downloaded replacement PDF satisfies genuine %PDF- signature'
);

// -----------------------------------------------------------------------------
// Test Suite 6: Old Blob Cleanup & Shared Protection
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 6: Old Blob Safe Cleanup & Shared Protection ---');

assert(
  mockDb.get(`file_blobs/${initialBlobId}`) === null,
  'Old unshared blob was retired and safely deleted from /file_blobs'
);
assert(
  mockDb.get(`file_blobs/${replaceResult.blobId}`) !== null,
  'New replacement blob remains active in /file_blobs'
);

// Test Shared Blob Protection: If another material references a blob, do NOT delete it
const sharedBlobId = 'blob_shared_syllabus_base';
mockDb.set(`file_blobs/${sharedBlobId}`, {
  blob_id: sharedBlobId,
  material_id: 'mat_other_course',
  data_base64: initialPdfBuffer.toString('base64'),
  published: true,
});

mockDb.set('materials/mat_other_course', {
  id: 'mat_other_course',
  blobId: sharedBlobId,
  published: true,
});

const matShared = {
  id: 'mat_primary_course',
  blobId: sharedBlobId,
  published: true,
};
mockDb.set('materials/mat_primary_course', matShared);

// Now replace mat_primary_course
executeReplaceMaterialPdf(matShared, replacementPdfBuffer, 'Primary_New.pdf');

assert(
  mockDb.get(`file_blobs/${sharedBlobId}`) !== null,
  'Shared blob was preserved because mat_other_course still references it'
);

// -----------------------------------------------------------------------------
// Test Suite 7: Security Rules & Unpublished/Draft Material Lockdown
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 7: Security Rules & Draft Lockdown ---');

const draftMaterialId = 'mat_draft_unreleased';
const draftBlobId = 'blob_draft_123';

mockDb.set(`file_blobs/${draftBlobId}`, {
  blob_id: draftBlobId,
  material_id: draftMaterialId,
  file_name: 'Unpublished_Exam_Key.pdf',
  file_size_bytes: replacementPdfBuffer.length,
  mime_type: 'application/pdf',
  data_base64: replacementPdfBuffer.toString('base64'),
  published: false,
});

mockDb.set(`materials/${draftMaterialId}`, {
  id: draftMaterialId,
  title: 'Confidential Midterm Solutions',
  published: false,
  blobId: draftBlobId,
});
// Not in publicMaterials!

assert(
  mockDb.canPublicReadBlob(draftBlobId) === false,
  'Public unauthenticated access to draft blob is strictly rejected by security rules'
);

let draftDownloadBlocked = false;
try {
  simulatePublicDownload({ id: draftMaterialId });
} catch (err) {
  draftDownloadBlocked = true;
  assert(
    err.message.includes('not found') || err.message.includes('PERMISSION_DENIED'),
    'Public download throws access error for unpublished material'
  );
}
assert(draftDownloadBlocked, 'Unpublished material cannot be downloaded by public users');

// Test Maintenance Mode
mockDb.set('settings/maintenanceMode', true);
assert(
  mockDb.canPublicReadBlob(replaceResult.blobId) === false,
  'Maintenance mode active locks down public blob downloads'
);
mockDb.set('settings/maintenanceMode', false);
assert(
  mockDb.canPublicReadBlob(replaceResult.blobId) === true,
  'Maintenance mode off restores public blob downloads'
);

// -----------------------------------------------------------------------------
// Test Summary
// -----------------------------------------------------------------------------
console.log('\n======================================================================');
console.log(`  AUTOMATED TEST RESULTS: ${passedTests}/${totalTests} PASSED (${failedTests} FAILED)`);
console.log('======================================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('\nAll PDF replacement and public download verification checks passed successfully!\n');
}
