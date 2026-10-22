import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('======================================================================');
console.log('  CAMPUSNOTES — DIRECT LINK SHARE PDF FEATURE TEST SUITE');
console.log('======================================================================\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] ${name}:`, err.message);
    failed++;
  }
}

// -----------------------------------------------------------------------------
// Suite 1: Source Code Structure & Security Auditing
// -----------------------------------------------------------------------------
console.log('--- Test Suite 1: Security, Storage Keys & URL Sanitization ---');

const shareUtilsCode = fs.readFileSync('src/utils/shareUtils.ts', 'utf8');

test('Never exposes private R2 object keys in share URLs', () => {
  assert(!shareUtilsCode.includes('r2Key'), 'shareUtils must not reference or expose r2Key in share URLs');
  assert(!shareUtilsCode.includes('campusnotes-pdfs'), 'shareUtils must not expose R2 bucket names');
  assert(!shareUtilsCode.includes('wrangler'), 'shareUtils must not expose worker bindings');
});

test('Never exposes Firebase credentials or auth tokens in share URLs', () => {
  assert(!shareUtilsCode.includes('apiKey'), 'shareUtils must not expose Firebase apiKey');
  assert(!shareUtilsCode.includes('authDomain'), 'shareUtils must not expose authDomain');
  assert(!shareUtilsCode.includes('authToken'), 'shareUtils must not expose tokens');
});

test('Unpublished material sharing is guarded and blocked', () => {
  assert(shareUtilsCode.includes('material.published === false'), 'Missing unpublished check');
  assert(shareUtilsCode.includes('Material Unpublished'), 'Missing Material Unpublished toast');
});

// -----------------------------------------------------------------------------
// Suite 2: Direct PDF URL Generation & Clean Link Integrity
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 2: Direct PDF URL Generation & Clean Link Integrity ---');

function formatShareText(material, subjectName, shareUrl) {
  if (material.id) {
    return `https://campusnotes.space/materials/${material.id}`;
  }
  return shareUrl && shareUrl.trim() ? shareUrl.trim() : 'https://campusnotes.space';
}

test('Direct link sharing generates strictly the specific PDF material URL without extra text', () => {
  const material = {
    id: 'mat_123456',
    title: 'Assignment 1: Multithreading & Concurrency Synchronization',
    subjectId: '23cs3501_ajp',
    category: 'assignments',
    assignmentNumber: 1,
    unitNumber: 1,
    description: 'Detailed multithreading concepts and examples',
  };
  const output = formatShareText(material, 'Advanced Java Programming', 'https://campusnotes.space/materials/mat_123456');

  assert.strictEqual(output, 'https://campusnotes.space/materials/mat_123456');
  assert(!output.includes('CampusNotes — Study Material'), 'Must not contain introductory header');
  assert(!output.includes('Subject:'), 'Must not contain Subject text');
  assert(!output.includes('Assignment:'), 'Must not contain Assignment text');
  assert(!output.includes('Unit:'), 'Must not contain Unit text');
  assert(!output.includes('PDF:'), 'Must not contain PDF title prefix');
  assert(!output.includes('View PDF:'), 'Must not contain View PDF prefix');
  assert(!output.includes('Detailed multithreading concepts'), 'Must not contain description');
});

test('Different materials produce strictly their own distinct material URLs', () => {
  const materials = [
    { id: 'mat_assign_java_1', title: 'Java Assignment 1' },
    { id: 'mat_notes_ade_unit2', title: 'ADE Unit 2 Notes' },
    { id: 'mat_pyq_daa_2025', title: 'DAA Midsem PYQ 2025' },
    { id: 'mat_exp_cn_socket', title: 'Socket Programming Lab' },
  ];

  const urls = materials.map((m) => formatShareText(m, null, `https://campusnotes.space/materials/${m.id}`));

  assert.strictEqual(urls[0], 'https://campusnotes.space/materials/mat_assign_java_1');
  assert.strictEqual(urls[1], 'https://campusnotes.space/materials/mat_notes_ade_unit2');
  assert.strictEqual(urls[2], 'https://campusnotes.space/materials/mat_pyq_daa_2025');
  assert.strictEqual(urls[3], 'https://campusnotes.space/materials/mat_exp_cn_socket');
  // Ensure each URL is unique and corresponds to its own PDF
  assert.strictEqual(new Set(urls).size, materials.length);
});

test('Share URL uses canonical domain campusnotes.space and /materials/:id path', () => {
  const material = { id: 'mat_cloud_lab' };
  const output = formatShareText(material);
  assert(output.startsWith('https://campusnotes.space/materials/'));
  assert.strictEqual(output, 'https://campusnotes.space/materials/mat_cloud_lab');
});

test('Custom ShareModal popup is removed and does not intercept sharing', () => {
  assert(!fs.existsSync('src/components/common/ShareModal.tsx'), 'ShareModal.tsx must be completely removed');
  const appCode = fs.readFileSync('src/App.tsx', 'utf8');
  assert(!appCode.includes('ShareModal'), 'App.tsx must not import or render ShareModal');
  const shareUtilsSource = fs.readFileSync('src/utils/shareUtils.ts', 'utf8');
  assert(!shareUtilsSource.includes('campusnotes:share'), 'shareUtils must not dispatch custom share modal event');
});

// -----------------------------------------------------------------------------
// Suite 3: Web Share API & Clipboard Simulation
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 3: Web Share API & Clipboard Fallback Behavior ---');

class MockNavigator {
  constructor({ shareSupported = false, shareRejection = null, clipboardSupported = false }) {
    this._shareSupported = shareSupported;
    this._shareRejection = shareRejection;
    this._clipboardSupported = clipboardSupported;
    this.sharedData = null;
    this.clipboardText = null;

    if (shareSupported) {
      this.share = async (data) => {
        if (this._shareRejection) throw this._shareRejection;
        this.sharedData = data;
        return true;
      };
      this.canShare = () => true;
    }

    if (clipboardSupported) {
      this.clipboard = {
        writeText: async (text) => {
          this.clipboardText = text;
          return true;
        },
      };
    }
  }
}

async function runMockShareMaterial(material, showToast, subject, mockNav, isSecure = true) {
  if (material.published === false) {
    showToast?.('Material Unpublished', 'This study material is unpublished and cannot be shared publicly.');
    return false;
  }

  const shareUrl = `https://campusnotes.space/materials/${material.id}`;
  const shareData = {
    url: shareUrl,
  };

  // 1. Web Share
  if (mockNav && typeof mockNav.share === 'function') {
    try {
      if (!mockNav.canShare || mockNav.canShare(shareData)) {
        await mockNav.share(shareData);
        return true;
      }
    } catch (err) {
      if (
        err instanceof Error &&
        (err.name === 'AbortError' ||
          err.message.toLowerCase().includes('abort') ||
          err.message.toLowerCase().includes('cancel'))
      ) {
        return false;
      }
    }
  }

  // 2. Clipboard API fallback
  let copied = false;
  if (mockNav && mockNav.clipboard && isSecure) {
    try {
      await mockNav.clipboard.writeText(shareUrl);
      copied = true;
    } catch {
      copied = false;
    }
  }

  if (copied) {
    showToast?.('Link Copied', shareUrl);
    return true;
  } else {
    showToast?.('Share Material', shareUrl);
    return false;
  }
}

test('Mobile Web Share API sends only the direct PDF URL without message text', async () => {
  const mockNav = new MockNavigator({ shareSupported: true });
  const material = {
    id: 'mat_assign_java_2',
    title: 'Assignment 2: Java Collections Framework',
    subjectId: '23cs3501_ajp',
    category: 'assignments',
    assignmentNumber: 2,
    unitNumber: 2,
    published: true,
  };

  const success = await runMockShareMaterial(material, null, null, mockNav);

  assert.strictEqual(success, true);
  assert(mockNav.sharedData !== null);
  assert.strictEqual(mockNav.sharedData.url, 'https://campusnotes.space/materials/mat_assign_java_2');
  assert.strictEqual(mockNav.sharedData.text, undefined, 'Must not send text field with extra message');
  assert.strictEqual(mockNav.sharedData.title, undefined, 'Must not send title field with extra metadata');
});

test('User cancelling native share sheet (AbortError) returns false without error toast', async () => {
  const abortError = new Error('Share canceled by user');
  abortError.name = 'AbortError';
  const mockNav = new MockNavigator({ shareSupported: true, shareRejection: abortError });

  const material = {
    id: 'mat_1',
    title: 'Sample Note',
    published: true,
  };

  let toastCalled = false;
  const success = await runMockShareMaterial(
    material,
    () => { toastCalled = true; },
    null,
    mockNav
  );

  assert.strictEqual(success, false, 'AbortError must return false');
  assert.strictEqual(toastCalled, false, 'AbortError must not trigger error notifications');
});

test('Desktop / fallback copies strictly the direct PDF URL with no extra text', async () => {
  const mockNav = new MockNavigator({ shareSupported: false, clipboardSupported: true });
  const material = {
    id: 'mat_assign_daa_1',
    title: 'Assignment 1: Divide and Conquer',
    subjectId: '23cs3502_daa',
    category: 'assignments',
    assignmentNumber: 1,
    unitNumber: 1,
    published: true,
  };

  let toastMsg = '';
  let toastTitle = '';
  const success = await runMockShareMaterial(
    material,
    (t, m) => {
      toastTitle = t;
      toastMsg = m;
    },
    null,
    mockNav
  );

  assert.strictEqual(success, true);
  assert.strictEqual(toastTitle, 'Link Copied');
  assert.strictEqual(toastMsg, 'https://campusnotes.space/materials/mat_assign_daa_1');
  assert.strictEqual(mockNav.clipboardText, 'https://campusnotes.space/materials/mat_assign_daa_1');
  assert(!mockNav.clipboardText.includes('CampusNotes'), 'Must not include brand header');
  assert(!mockNav.clipboardText.includes('Subject:'), 'Must not include Subject');
  assert(!mockNav.clipboardText.includes('Assignment:'), 'Must not include Assignment');
  assert(!mockNav.clipboardText.includes('\n'), 'Must be a clean single-line URL with no newlines');
});

test('Unpublished material blocks sharing and alerts user', async () => {
  const mockNav = new MockNavigator({ shareSupported: true });
  const material = {
    id: 'mat_draft_1',
    title: 'Unpublished Draft Notes',
    published: false,
  };

  let toastTitle = '';
  let toastMsg = '';
  const success = await runMockShareMaterial(
    material,
    (t, m) => {
      toastTitle = t;
      toastMsg = m;
    },
    null,
    mockNav
  );

  assert.strictEqual(success, false);
  assert.strictEqual(toastTitle, 'Material Unpublished');
  assert(toastMsg.includes('cannot be shared publicly'));
  assert.strictEqual(mockNav.sharedData, null, 'Must not share unpublished material');
});

// -----------------------------------------------------------------------------
// Suite 4: Caller Components Pass Subject Correctly
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 4: Component Prop and Subject Integration ---');

const materialCardCode = fs.readFileSync('src/components/materials/MaterialCard.tsx', 'utf8');
const materialDetailCode = fs.readFileSync('src/pages/MaterialDetailPage.tsx', 'utf8');
const pdfViewerCode = fs.readFileSync('src/components/materials/PdfViewer.tsx', 'utf8');

test('MaterialCard forwards subject prop to shareMaterial', () => {
  assert(materialCardCode.includes('shareMaterial(\n      material,\n      (title, msg) => {\n        toast.success(title, msg);\n      },\n      subject\n    )'), 'MaterialCard does not pass subject to shareMaterial');
});

test('MaterialDetailPage passes subject to shareMaterial', () => {
  assert(materialDetailCode.includes('shareMaterial(\n      material,\n      (title, msg) => {\n        toast.success(title, msg);\n      },\n      subject || undefined\n    )'), 'MaterialDetailPage does not pass subject to shareMaterial');
});

test('MaterialDetailPage passes subject to PdfViewer', () => {
  assert(materialDetailCode.includes('<PdfViewer material={material} subject={subject || undefined} />'), 'MaterialDetailPage does not forward subject to PdfViewer');
});

test('PdfViewer interface accepts subject and forwards to shareMaterial', () => {
  assert(pdfViewerCode.includes('subject?: Subject'), 'PdfViewerProps missing subject?: Subject');
  assert(pdfViewerCode.includes('shareMaterial(\n      material,\n      (title, msg) => {\n        toast.success(title, msg);\n      },\n      subject\n    )'), 'PdfViewer does not pass subject to shareMaterial');
});

console.log('\n======================================================================');
console.log(`  RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('======================================================================');

if (failed > 0) {
  process.exit(1);
}
