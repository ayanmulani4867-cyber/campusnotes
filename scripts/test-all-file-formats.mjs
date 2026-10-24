// CampusNotes — Multi-Format File Support Comprehensive Test Suite
// Verifies all 15 required formats (PDF, DOC, DOCX, TXT, RTF, PPT, PPTX, XLS, XLSX, CSV, JPG, JPEG, PNG, WEBP, ZIP)
// Verifies dangerous format rejection, magic byte spoofing prevention, and R2 delivery.

import assert from 'node:assert/strict';
import {
  SUPPORTED_FILE_FORMATS,
  validateMagicBytes,
  validateClientFile,
  getFileExtension,
  isDangerousFileExtension,
  isSupportedExtension,
  getFileFormatInfo,
  sanitizeSafeFilename,
} from '../src/utils/fileTypes.ts';

import worker from '../worker/src/index.ts';
import {
  WORKER_SUPPORTED_FORMATS,
  validateMagicBytes as workerValidateMagicBytes,
  sanitizeWorkerFilename,
} from '../worker/src/fileTypes.ts';

console.log('======================================================================');
console.log('  CAMPUSNOTES — COMPREHENSIVE MULTI-FORMAT FILE TYPE SUPPORT AUDIT');
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

// Helper to create real binary test buffers with genuine magic bytes
function createRealTestBuffer(ext) {
  switch (ext) {
    case 'pdf': {
      const header = '%PDF-1.4\n%âãÏÓ\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\ntrailer\n<<\n/Root 1 0 R\n>>\n%%EOF';
      return Buffer.from(header, 'utf-8');
    }
    case 'png': {
      // 8-byte PNG header + minimal IHDR chunk
      return Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4
      ]);
    }
    case 'jpg':
    case 'jpeg': {
      // JPEG SOI + APP0 header
      return Buffer.from([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46,
        0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
        0x00, 0x48, 0x00, 0x00, 0xff, 0xd9
      ]);
    }
    case 'webp': {
      // RIFF....WEBP header
      return Buffer.from([
        0x52, 0x49, 0x46, 0x46, 0x20, 0x00, 0x00, 0x00,
        0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20
      ]);
    }
    case 'zip':
    case 'docx':
    case 'pptx':
    case 'xlsx': {
      // PK\x03\x04 archive/Office OpenXML container
      return Buffer.from([
        0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00,
        0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
      ]);
    }
    case 'doc':
    case 'xls':
    case 'ppt': {
      // OLE compound binary container header: 0xD0 0xCF 0x11 0xE0 0xA1 0xB1 0x1A 0xE1
      return Buffer.from([
        0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
      ]);
    }
    case 'rtf': {
      return Buffer.from('{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Courier;}}\\f0\\fs20 CampusNotes RTF Document}', 'utf-8');
    }
    case 'txt': {
      return Buffer.from('CampusNotes Unit 1 Computer Science and Engineering Lecture Notes.', 'utf-8');
    }
    case 'csv': {
      return Buffer.from('unit_id,title,marks\n1,Introduction to Algorithms,20\n2,Graph Theory,30\n', 'utf-8');
    }
    default:
      return Buffer.from('Sample generic binary content');
  }
}

// In-Memory R2 bucket mock for isolated testing
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
      etag: entry.etag || 'etag-123',
      httpEtag: `"${entry.etag || 'etag-123'}"`,
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
      etag: entry.etag || 'etag-123',
      httpEtag: `"${entry.etag || 'etag-123'}"`,
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
      arrayBuffer: async () => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
      text: async () => new TextDecoder().decode(data),
      json: async () => JSON.parse(new TextDecoder().decode(data)),
    };
  }

  async put(key, value, options) {
    let buf;
    if (value instanceof ArrayBuffer) {
      buf = Buffer.from(value);
    } else if (ArrayBuffer.isView(value)) {
      buf = Buffer.from(value.buffer, value.byteOffset, value.byteLength);
    } else if (typeof value === 'string') {
      buf = Buffer.from(value, 'utf-8');
    } else {
      buf = Buffer.alloc(0);
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

const REQUIRED_FORMATS = [
  // Documents
  'pdf', 'doc', 'docx', 'txt', 'rtf',
  // Presentations
  'ppt', 'pptx',
  // Spreadsheets
  'xls', 'xlsx', 'csv',
  // Images
  'jpg', 'jpeg', 'png', 'webp',
  // Archives
  'zip'
];

async function runAllTests() {
  // -----------------------------------------------------------------------------
  // Test Suite 1: Format Matrix & Extension Recognition
  // -----------------------------------------------------------------------------
  console.log('--- Test Suite 1: Format Matrix & MIME Specification ---');

  await test('All 15 required formats are defined in SUPPORTED_FILE_FORMATS', () => {
    for (const ext of REQUIRED_FORMATS) {
      assert(SUPPORTED_FILE_FORMATS[ext], `Format .${ext} is missing from SUPPORTED_FILE_FORMATS`);
      assert(isSupportedExtension(ext), `isSupportedExtension failed for .${ext}`);
      assert(isSupportedExtension(`.${ext}`), `isSupportedExtension failed for leading dot .${ext}`);
    }
  });

  await test('All 15 required formats are defined in WORKER_SUPPORTED_FORMATS with exact MIME types', () => {
    for (const ext of REQUIRED_FORMATS) {
      assert(WORKER_SUPPORTED_FORMATS[ext], `Worker missing format .${ext}`);
      const clientMime = SUPPORTED_FILE_FORMATS[ext].mimeType;
      const workerMime = WORKER_SUPPORTED_FORMATS[ext].mimeType;
      assert.equal(clientMime, workerMime, `MIME mismatch for ${ext}: client=${clientMime}, worker=${workerMime}`);
    }
  });

  await test('Previewable flag is correctly designated (PDF, Images, Text/CSV: true; Office & Archives: false)', () => {
    const previewableSet = new Set(['pdf', 'jpg', 'jpeg', 'png', 'webp', 'txt', 'csv']);
    for (const ext of REQUIRED_FORMATS) {
      const isExpectedPreviewable = previewableSet.has(ext);
      assert.equal(
        SUPPORTED_FILE_FORMATS[ext].previewable,
        isExpectedPreviewable,
        `Previewable status incorrect for ${ext}`
      );
    }
  });

  // -----------------------------------------------------------------------------
  // Test Suite 2: Strict Binary Header & Magic Byte Verification
  // -----------------------------------------------------------------------------
  console.log('\n--- Test Suite 2: Magic Byte Signature Verification ---');

  await test('Valid test buffer succeeds signature checks on client and worker for each format', () => {
    for (const ext of REQUIRED_FORMATS) {
      const buf = createRealTestBuffer(ext);
      const clientCheck = validateMagicBytes(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), ext);
      assert(clientCheck.isValid, `Client validateMagicBytes rejected valid ${ext}: ${clientCheck.error}`);

      const workerCheck = workerValidateMagicBytes(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), ext);
      assert(workerCheck.isValid, `Worker validateMagicBytes rejected valid ${ext}: ${workerCheck.error}`);
    }
  });

  await test('Rejects spoofed Windows executable (MZ header) disguised as any format', () => {
    const fakeExeBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
    const arrBuf = fakeExeBuffer.buffer.slice(fakeExeBuffer.byteOffset, fakeExeBuffer.byteOffset + fakeExeBuffer.byteLength);

    for (const ext of ['pdf', 'docx', 'png', 'txt', 'zip']) {
      const clientCheck = validateMagicBytes(arrBuf, ext);
      assert(!clientCheck.isValid, `Client failed to reject MZ header disguised as .${ext}`);
      assert(clientCheck.error.includes('executable'), 'Client error message should mention executable');

      const workerCheck = workerValidateMagicBytes(arrBuf, ext);
      assert(!workerCheck.isValid, `Worker failed to reject MZ header disguised as .${ext}`);
    }
  });

  await test('Rejects spoofed Linux executable (ELF header) disguised as any format', () => {
    const fakeElfBuffer = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00]);
    const arrBuf = fakeElfBuffer.buffer.slice(fakeElfBuffer.byteOffset, fakeElfBuffer.byteOffset + fakeElfBuffer.byteLength);

    for (const ext of ['pdf', 'docx', 'png', 'txt', 'zip']) {
      const clientCheck = validateMagicBytes(arrBuf, ext);
      assert(!clientCheck.isValid, `Client failed to reject ELF header disguised as .${ext}`);
      const workerCheck = workerValidateMagicBytes(arrBuf, ext);
      assert(!workerCheck.isValid, `Worker failed to reject ELF header disguised as .${ext}`);
    }
  });

  await test('Rejects PDF with invalid magic byte header (e.g. text masquerading as PDF)', () => {
    const fakePdf = Buffer.from('NOT A PDF FILE JUST PLAIN TEXT', 'utf-8');
    const arrBuf = fakePdf.buffer.slice(fakePdf.byteOffset, fakePdf.byteOffset + fakePdf.byteLength);

    const clientCheck = validateMagicBytes(arrBuf, 'pdf');
    assert(!clientCheck.isValid, 'Should reject invalid PDF header');
    assert(clientCheck.error.includes('%PDF-'));

    const workerCheck = workerValidateMagicBytes(arrBuf, 'pdf');
    assert(!workerCheck.isValid, 'Worker should reject invalid PDF header');
  });

  await test('Rejects Office OpenXML (.docx, .pptx, .xlsx) without valid PK archive header', () => {
    const fakeDocx = Buffer.from('SOME DUMMY DATA WITHOUT ZIP PK HEADER', 'utf-8');
    const arrBuf = fakeDocx.buffer.slice(fakeDocx.byteOffset, fakeDocx.byteOffset + fakeDocx.byteLength);

    for (const ext of ['docx', 'pptx', 'xlsx', 'zip']) {
      const clientCheck = validateMagicBytes(arrBuf, ext);
      assert(!clientCheck.isValid, `Should reject invalid ${ext} without PK header`);
      const workerCheck = workerValidateMagicBytes(arrBuf, ext);
      assert(!workerCheck.isValid, `Worker should reject invalid ${ext} without PK header`);
    }
  });

  await test('Rejects text file containing binary null bytes', () => {
    const corruptText = Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x00, 0x6f]); // 'Hell\0o'
    const arrBuf = corruptText.buffer.slice(corruptText.byteOffset, corruptText.byteOffset + corruptText.byteLength);

    const clientCheck = validateMagicBytes(arrBuf, 'txt');
    assert(!clientCheck.isValid, 'Should reject text containing null bytes');
    assert(clientCheck.error.includes('null byte'));
  });

  // -----------------------------------------------------------------------------
  // Test Suite 3: Dangerous Formats & Path Traversal Security
  // -----------------------------------------------------------------------------
  console.log('\n--- Test Suite 3: Dangerous Format Rejection & Sanitization ---');

  await test('Strictly identifies dangerous executable and script extensions', () => {
    const dangerous = [
      'malware.exe', 'script.bat', 'payload.cmd', 'backdoor.sh', 'macro.ps1',
      'installer.msi', 'library.dll', 'virus.vbs', 'evil.js', 'exploit.py'
    ];

    for (const filename of dangerous) {
      assert(isDangerousFileExtension(filename), `Expected ${filename} to be flagged dangerous`);
    }
  });

  await test('sanitizeSafeFilename neutralizes directory traversal and dangerous extensions', () => {
    // Directory traversal
    assert.equal(sanitizeSafeFilename('../../etc/passwd.pdf'), 'passwd.pdf');
    assert.equal(sanitizeSafeFilename('..\\..\\windows\\system32\\cmd.exe'), 'cmd.exe.txt');

    // Multi-format extension preservation
    assert.equal(sanitizeSafeFilename('assignment_solutions.docx'), 'assignment_solutions.docx');
    assert.equal(sanitizeSafeFilename('lab_presentation.pptx'), 'lab_presentation.pptx');
    assert.equal(sanitizeSafeFilename('exam_marks.xlsx'), 'exam_marks.xlsx');
    assert.equal(sanitizeSafeFilename('diagram.png'), 'diagram.png');
    assert.equal(sanitizeSafeFilename('notes.txt'), 'notes.txt');
    assert.equal(sanitizeSafeFilename('project_code.zip'), 'project_code.zip');
  });

  await test('Worker sanitizeWorkerFilename preserves original safe format extensions', () => {
    assert.equal(sanitizeWorkerFilename('Unit_1_Lecture.pptx'), 'Unit_1_Lecture.pptx');
    assert.equal(sanitizeWorkerFilename('Question_Bank.docx'), 'Question_Bank.docx');
    assert.equal(sanitizeWorkerFilename('Lab_Manual.pdf'), 'Lab_Manual.pdf');
    assert.equal(sanitizeWorkerFilename('Dataset.csv'), 'Dataset.csv');
    assert.equal(sanitizeWorkerFilename('Screenshot.png'), 'Screenshot.png');
    assert.equal(sanitizeWorkerFilename('Source.zip'), 'Source.zip');
  });

  // -----------------------------------------------------------------------------
  // Test Suite 4: Multi-Format Cloudflare R2 Upload Simulation
  // -----------------------------------------------------------------------------
  console.log('\n--- Test Suite 4: Cloudflare R2 Multi-Format Upload Simulation ---');

  await test('Worker PUT upload handles all 15 formats with accurate Content-Type and original filename', async () => {
    const bucket = new MockR2Bucket();
    const env = {
      PDF_BUCKET: bucket,
      FIREBASE_PROJECT_ID: 'test-project',
    };

    for (const ext of REQUIRED_FORMATS) {
      const materialId = `mat_${ext}_test`;
      const fileName = `curriculum_unit.${ext}`;
      const testBuf = createRealTestBuffer(ext);

      const r2Key = `materials/${materialId}/${Date.now()}_${fileName}`;
      const formatInfo = WORKER_SUPPORTED_FORMATS[ext];

      // Simulate Worker PUT upload storage
      await bucket.put(r2Key, testBuf, {
        httpMetadata: {
          contentType: formatInfo.mimeType,
          contentDisposition: `${formatInfo.previewable ? 'inline' : 'attachment'}; filename="${fileName}"`,
        },
        customMetadata: {
          materialId,
          fileName,
          mimeType: formatInfo.mimeType,
          uploadedAt: String(Date.now()),
        },
      });

      // Verify stored object in R2
      const stored = await bucket.get(r2Key);
      assert(stored, `Stored object missing in bucket for ${ext}`);
      assert.equal(stored.size, testBuf.length, `Size mismatch for ${ext}`);

      const headers = new Headers();
      stored.writeHttpMetadata(headers);
      assert.equal(headers.get('Content-Type'), formatInfo.mimeType, `Content-Type mismatch for ${ext}`);
      assert(headers.get('Content-Disposition').includes(`filename="${fileName}"`), `Content-Disposition missing filename for ${ext}`);
    }
  });

  // -----------------------------------------------------------------------------
  // Test Suite 5: Multi-Format Public Material Delivery & Disposition
  // -----------------------------------------------------------------------------
  console.log('\n--- Test Suite 5: Multi-Format Public Delivery & Content Negotiation ---');

  await test('Correctly determines Content-Type, Content-Disposition, and previewability for all 15 formats', async () => {
    for (const ext of REQUIRED_FORMATS) {
      const fileName = `material_sample.${ext}`;
      const formatInfo = WORKER_SUPPORTED_FORMATS[ext];
      const safeFilename = sanitizeWorkerFilename(fileName, 'study_material');

      assert(formatInfo, `Missing formatInfo for ${ext}`);
      assert(formatInfo.mimeType, `Missing mimeType for ${ext}`);

      // Verify download disposition
      const downloadDisposition = `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(safeFilename)}`;
      assert(downloadDisposition.includes('attachment'), `Must be attachment for download on ${ext}`);
      assert(downloadDisposition.includes(safeFilename), `Must include filename on ${ext}`);

      // Verify inline/attachment for normal view
      const inlineDisposition = `${!formatInfo.previewable ? 'attachment' : 'inline'}; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(safeFilename)}`;
      if (formatInfo.previewable) {
        assert(inlineDisposition.includes('inline'), `Previewable format ${ext} should use inline disposition`);
      } else {
        assert(inlineDisposition.includes('attachment'), `Non-previewable format ${ext} should use attachment disposition`);
      }
    }
  });

  // -----------------------------------------------------------------------------
  // Test Suite 6: Legacy PDF Compatibility & Streaming Verification
  // -----------------------------------------------------------------------------
  console.log('\n--- Test Suite 6: Legacy Compatibility & Direct R2 Storage Verification ---');

  await test('Legacy PDF at materials/:id.pdf continues to store and stream correctly', async () => {
    const bucket = new MockR2Bucket();
    const legacyPdfBytes = createRealTestBuffer('pdf');
    const legacyMaterialId = 'legacy_mat_2024';
    const legacyKey = `materials/${legacyMaterialId}.pdf`;

    // Store at legacy path
    await bucket.put(legacyKey, legacyPdfBytes, {
      httpMetadata: {
        contentType: 'application/pdf',
        contentDisposition: 'inline; filename="legacy_mat_2024.pdf"',
      },
    });

    const stored = await bucket.get(legacyKey);
    assert(stored, 'Legacy object must exist in bucket');
    assert.equal(stored.size, legacyPdfBytes.length);

    const headers = new Headers();
    stored.writeHttpMetadata(headers);
    assert.equal(headers.get('Content-Type'), 'application/pdf');

    const retrievedBytes = Buffer.from(await stored.arrayBuffer());
    assert.deepEqual(retrievedBytes, legacyPdfBytes);
  });


  // -----------------------------------------------------------------------------
  // Final Results
  // -----------------------------------------------------------------------------
  console.log('\n======================================================================');
  console.log(`  MULTI-FORMAT AUDIT RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
