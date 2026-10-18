import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('====================================================');
console.log('   CampusNotes RTDB-Only Storage & Workflows Test   ');
console.log('====================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failedTests++;
  }
}

// ----------------------------------------------------
// TEST 1: PDF Magic Bytes & Signature Validation
// ----------------------------------------------------
console.log('--- Test Suite 1: PDF Signature & File Validation ---');

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

const validPdfHeader = Buffer.from('%PDF-1.4\n%âãÏÓ\n');
const invalidExeHeader = Buffer.from('MZ\x90\x00\x03\x00\x00\x00');
const invalidPngHeader = Buffer.from('\x89PNG\r\n\x1a\n');
const textHeader = Buffer.from('Hello world this is not a pdf');

assert(validatePdfSignature(validPdfHeader) === true, 'Valid PDF header (%PDF-) accepted');
assert(validatePdfSignature(invalidExeHeader) === false, 'Windows executable header (MZ) rejected');
assert(validatePdfSignature(invalidPngHeader) === false, 'PNG image header rejected');
assert(validatePdfSignature(textHeader) === false, 'Plain text header rejected');

// ----------------------------------------------------
// TEST 2: Real Physical PDF Inspection & Integrity
// ----------------------------------------------------
console.log('\n--- Test Suite 2: Real PDF Files on Disk ---');

const publicPdfDir = path.join(rootDir, 'public', 'demo-pdfs');
let samplePdfPath = null;

if (fs.existsSync(publicPdfDir)) {
  const assignDir = path.join(publicPdfDir, 'assignments');
  if (fs.existsSync(assignDir)) {
    const files = fs.readdirSync(assignDir).filter((f) => f.endsWith('.pdf'));
    if (files.length > 0) {
      samplePdfPath = path.join(assignDir, files[0]);
    }
  }
}

assert(samplePdfPath !== null, 'Found real physical sample PDF on disk');

if (samplePdfPath) {
  const originalBytes = fs.readFileSync(samplePdfPath);
  assert(originalBytes.length > 0, `Sample PDF read successfully (${originalBytes.length} bytes)`);
  assert(validatePdfSignature(originalBytes) === true, 'Sample PDF contains genuine %PDF- signature');

  // Test Base64 Encoding
  const base64Encoded = originalBytes.toString('base64');
  const expectedExpansion = Math.ceil((originalBytes.length * 4) / 3);
  assert(
    Math.abs(base64Encoded.length - expectedExpansion) < 4,
    `Base64 expansion ratio is ~1.33x (${originalBytes.length} bytes -> ${base64Encoded.length} chars)`
  );

  // Test Base64 Decoding
  const decodedBuffer = Buffer.from(base64Encoded, 'base64');
  assert(
    decodedBuffer.length === originalBytes.length,
    `Decoded buffer size matches original exactly (${decodedBuffer.length} === ${originalBytes.length})`
  );

  const bytesMatch = Buffer.compare(originalBytes, decodedBuffer) === 0;
  assert(bytesMatch === true, 'Decoded PDF is 100% bit-for-bit identical to original PDF');
  assert(validatePdfSignature(decodedBuffer) === true, 'Decoded PDF retains valid %PDF- magic signature');
}

// ----------------------------------------------------
// TEST 3: Size Limits & RTDB 10 MB Constraint
// ----------------------------------------------------
console.log('\n--- Test Suite 3: RTDB Size Constraints ---');

const MAX_RTDB_PDF_SIZE_BYTES = 6 * 1024 * 1024; // 6 MB
const rtdbNodeLimitBytes = 10 * 1024 * 1024; // 10 MB

const maxRawBuffer = Buffer.alloc(MAX_RTDB_PDF_SIZE_BYTES);
const maxBase64String = maxRawBuffer.toString('base64');

assert(
  Buffer.byteLength(maxBase64String, 'utf8') < rtdbNodeLimitBytes,
  `Max 6 MB PDF Base64 string (${(Buffer.byteLength(maxBase64String) / 1024 / 1024).toFixed(2)} MB) fits under RTDB 10 MB limit`
);

const safetyMarginMB = (rtdbNodeLimitBytes - Buffer.byteLength(maxBase64String, 'utf8')) / (1024 * 1024);
assert(safetyMarginMB > 1.5, `Generous safety margin of ${safetyMarginMB.toFixed(2)} MB exists for JSON metadata`);

function validateFileSize(size) {
  return size <= MAX_RTDB_PDF_SIZE_BYTES;
}

assert(validateFileSize(500 * 1024) === true, '500 KB PDF allowed');
assert(validateFileSize(3 * 1024 * 1024) === true, '3 MB PDF allowed');
assert(validateFileSize(6 * 1024 * 1024) === true, '6 MB PDF allowed');
assert(validateFileSize(6.5 * 1024 * 1024) === false, '6.5 MB PDF rejected (> 6 MB limit)');
assert(validateFileSize(15 * 1024 * 1024) === false, '15 MB PDF rejected (> 6 MB limit)');

// ----------------------------------------------------
// TEST 4: RTDB Blob & Metadata Partition Architecture
// ----------------------------------------------------
console.log('\n--- Test Suite 4: Blob Isolation & Partition Separation ---');

// Mock RTDB store
const mockDatabase = {
  materials: {},
  publicMaterials: {},
  file_blobs: {},
};

function mockCreateMaterial(data, fileBuffer, fileName) {
  if (!validatePdfSignature(fileBuffer)) {
    throw new Error('Invalid PDF signature');
  }
  if (!validateFileSize(fileBuffer.length)) {
    throw new Error('File exceeds 6 MB');
  }

  const timestamp = Date.now();
  const blobId = `blob_${data.id}_${timestamp}`;
  const base64Data = fileBuffer.toString('base64');

  // 1. Write blob
  mockDatabase.file_blobs[blobId] = {
    blob_id: blobId,
    material_id: data.id,
    file_name: fileName,
    file_size_bytes: fileBuffer.length,
    mime_type: 'application/pdf',
    data_base64: base64Data,
    published: data.published,
    created_at: timestamp,
  };

  // 2. Write metadata (NO data_base64 in metadata!)
  const metadata = {
    ...data,
    blobId,
    fileName,
    storagePath: `rtdb://file_blobs/${blobId}`,
    downloadUrl: `rtdb://${blobId}`,
    fileSize: fileBuffer.length,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  mockDatabase.materials[data.id] = metadata;
  if (data.published) {
    mockDatabase.publicMaterials[data.id] = metadata;
  }

  return metadata;
}

const testMaterial = mockCreateMaterial(
  {
    id: 'mat_test_001',
    title: 'Relational Database Management Lecture 1',
    description: 'Unit 1 Introduction to Relational Model',
    subjectId: 'sub_23CS3503',
    category: 'notes',
    academicYear: '2026-27',
    published: true,
  },
  validPdfHeader,
  'lecture_1_intro.pdf'
);

assert(mockDatabase.materials['mat_test_001'] !== undefined, 'Metadata created in /materials');
assert(mockDatabase.publicMaterials['mat_test_001'] !== undefined, 'Metadata created in /publicMaterials');
assert(mockDatabase.file_blobs[testMaterial.blobId] !== undefined, 'Binary blob stored in /file_blobs');
assert(mockDatabase.materials['mat_test_001'].data_base64 === undefined, 'No data_base64 inside /materials');
assert(mockDatabase.publicMaterials['mat_test_001'].data_base64 === undefined, 'No data_base64 inside /publicMaterials');

// ----------------------------------------------------
// TEST 5: Safe PDF Replacement Workflow
// ----------------------------------------------------
console.log('\n--- Test Suite 5: Safe PDF Replacement Workflow ---');

function mockReplacePdf(existingMaterial, newFileBuffer, newFileName) {
  if (!validatePdfSignature(newFileBuffer)) throw new Error('Invalid signature');
  if (!validateFileSize(newFileBuffer.length)) throw new Error('File exceeds limit');

  const oldBlobId = existingMaterial.blobId;
  const newTimestamp = Date.now() + 100;
  const newBlobId = `blob_${existingMaterial.id}_${newTimestamp}`;

  // Step 1: Upload replacement blob first
  mockDatabase.file_blobs[newBlobId] = {
    blob_id: newBlobId,
    material_id: existingMaterial.id,
    file_name: newFileName,
    file_size_bytes: newFileBuffer.length,
    mime_type: 'application/pdf',
    data_base64: newFileBuffer.toString('base64'),
    published: existingMaterial.published,
    created_at: newTimestamp,
  };

  // Step 2: Verify replacement exists
  if (!mockDatabase.file_blobs[newBlobId]) {
    throw new Error('Replacement blob verification failed');
  }

  // Step 3: Update metadata
  const updatedMetadata = {
    ...existingMaterial,
    blobId: newBlobId,
    fileName: newFileName,
    fileSize: newFileBuffer.length,
    storagePath: `rtdb://file_blobs/${newBlobId}`,
    downloadUrl: `rtdb://${newBlobId}`,
    updatedAt: newTimestamp,
  };

  mockDatabase.materials[existingMaterial.id] = updatedMetadata;
  if (updatedMetadata.published) {
    mockDatabase.publicMaterials[existingMaterial.id] = updatedMetadata;
  }

  // Step 4: Delete old blob only after metadata succeeds
  if (oldBlobId && oldBlobId !== newBlobId) {
    delete mockDatabase.file_blobs[oldBlobId];
  }

  return updatedMetadata;
}

const originalBlobId = testMaterial.blobId;
const replacementHeader = Buffer.from('%PDF-1.7\n%Replacement Test Document\n');
const replacedMaterial = mockReplacePdf(testMaterial, replacementHeader, 'lecture_1_revised_v2.pdf');

assert(replacedMaterial.blobId !== originalBlobId, 'New versioned blobId assigned');
assert(mockDatabase.file_blobs[replacedMaterial.blobId] !== undefined, 'New replacement blob stored in /file_blobs');
assert(mockDatabase.file_blobs[originalBlobId] === undefined, 'Old retired blob deleted safely');
assert(mockDatabase.materials[testMaterial.id].fileName === 'lecture_1_revised_v2.pdf', 'Metadata updated to new file name');

// ----------------------------------------------------
// TEST 6: Safe Material Deletion & Shared Blobs
// ----------------------------------------------------
console.log('\n--- Test Suite 6: Material & Blob Deletion ---');

function mockDeleteMaterial(material) {
  delete mockDatabase.materials[material.id];
  delete mockDatabase.publicMaterials[material.id];

  // Check if blob is shared by another material
  let isShared = false;
  for (const m of Object.values(mockDatabase.materials)) {
    if (m.blobId === material.blobId) {
      isShared = true;
      break;
    }
  }

  if (!isShared && material.blobId) {
    delete mockDatabase.file_blobs[material.blobId];
  }
}

mockDeleteMaterial(replacedMaterial);

assert(mockDatabase.materials[replacedMaterial.id] === undefined, 'Material removed from /materials');
assert(mockDatabase.publicMaterials[replacedMaterial.id] === undefined, 'Material removed from /publicMaterials');
assert(mockDatabase.file_blobs[replacedMaterial.blobId] === undefined, 'Unshared blob removed from /file_blobs');

// ----------------------------------------------------
// TEST 7: Maintenance Mode Non-Lockout Default
// ----------------------------------------------------
console.log('\n--- Test Suite 7: Maintenance Mode Availability ---');

function getSafeMaintenanceMode(rtdbValue, isAuth) {
  // Always default to false if unconfigured or error
  const isMaint = typeof rtdbValue === 'boolean' ? rtdbValue : false;
  // If maintenance is false, public is never blocked
  const isBlocked = isMaint && !isAuth;
  return { isMaint, isBlocked };
}

assert(getSafeMaintenanceMode(null, false).isBlocked === false, 'Null RTDB value defaults to accessible (not blocked)');
assert(getSafeMaintenanceMode(undefined, false).isBlocked === false, 'Undefined RTDB value defaults to accessible');
assert(getSafeMaintenanceMode(false, false).isBlocked === false, 'False maintenance mode allows public access');
assert(getSafeMaintenanceMode(true, false).isBlocked === true, 'Confirmed true maintenance mode redirects public');
assert(getSafeMaintenanceMode(true, true).isBlocked === false, 'Confirmed true maintenance mode allows authenticated admin');

console.log('\n====================================================');
console.log(`Test Results: ${passedTests} passed, ${failedTests} failed (${totalTests} total)`);
console.log('====================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('All RTDB-only storage and workflow assertions passed successfully!\n');
}
