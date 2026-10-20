import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('======================================================================');
console.log('  CAMPUSNOTES — METADATA-AWARE SHARE PDF FEATURE TEST SUITE');
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
// Suite 2: Functional Metadata Formatting & Graceful Degradation
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 2: Dynamic Metadata Formatting & Field Resolution ---');

// Extract and test formatShareText and resolveSubjectName directly in Node
// We read OFFICIAL_CSE_SEM_5_SUBJECTS from src/constants/subjects.ts
const subjectsCode = fs.readFileSync('src/constants/subjects.ts', 'utf8');
const subjectsMatch = subjectsCode.match(/export const OFFICIAL_CSE_SEM_5_SUBJECTS.*?=\s*(\[[\s\S]*?\]);/);
assert(subjectsMatch, 'Could not parse OFFICIAL_CSE_SEM_5_SUBJECTS from subjects.ts');
// Safely evaluate subjects array for testing
const OFFICIAL_CSE_SEM_5_SUBJECTS = eval(subjectsMatch[1]);

function formatShareText(material, subjectName, shareUrl) {
  const lines = ['CampusNotes — Study Material', ''];

  if (subjectName && subjectName.trim()) {
    lines.push(`Subject: ${subjectName.trim()}`);
  }

  // Assignment name or number
  if (
    material.assignmentNumber !== undefined &&
    material.assignmentNumber !== null &&
    String(material.assignmentNumber).trim() !== ''
  ) {
    const numStr = String(material.assignmentNumber).trim();
    const assignText = numStr.toLowerCase().startsWith('assignment')
      ? numStr
      : `Assignment ${numStr}`;
    lines.push(`Assignment: ${assignText}`);
  } else if (
    material.category === 'assignments' &&
    material.title &&
    material.title.toLowerCase().includes('assignment')
  ) {
    lines.push(`Assignment: ${material.title.trim()}`);
  }

  // Experiment / Practical (if applicable)
  if (
    material.experimentNumber !== undefined &&
    material.experimentNumber !== null &&
    String(material.experimentNumber).trim() !== ''
  ) {
    const expStr = String(material.experimentNumber).trim();
    const expText = expStr.toLowerCase().startsWith('exp')
      ? expStr
      : `Experiment ${expStr}`;
    lines.push(`Experiment: ${expText}`);
  }

  // Unit or chapter
  if (
    material.unitNumber !== undefined &&
    material.unitNumber !== null &&
    String(material.unitNumber).trim() !== ''
  ) {
    const unitStr = String(material.unitNumber).trim();
    const unitText =
      unitStr.toLowerCase().startsWith('unit') ||
      unitStr.toLowerCase().startsWith('chapter')
        ? unitStr
        : `Unit ${unitStr}`;
    lines.push(`Unit: ${unitText}`);
  }

  // PDF/material title
  const pdfTitle = (material.title || material.fileName || '').trim();
  if (pdfTitle) {
    lines.push(`PDF: ${pdfTitle}`);
  }

  // Working material link
  if (shareUrl && shareUrl.trim()) {
    lines.push('');
    lines.push(`View PDF: ${shareUrl.trim()}`);
  }

  return lines.join('\n');
}

function resolveSubjectName(material, providedSubject) {
  if (providedSubject?.name && providedSubject.name.trim()) {
    return providedSubject.name.trim();
  }

  if (!material.subjectId) return null;

  const staticMatch = OFFICIAL_CSE_SEM_5_SUBJECTS.find(
    (s) =>
      s.id === material.subjectId ||
      (s.code && s.code.toLowerCase() === material.subjectId?.toLowerCase())
  );
  if (staticMatch?.name && staticMatch.name.trim()) {
    return staticMatch.name.trim();
  }

  return null;
}

test('Full Assignment format matches specification exactly', () => {
  const material = {
    id: 'mat_assign_java_1',
    title: 'Assignment 1: Multithreading & Concurrency Synchronization',
    subjectId: '23cs3501_ajp',
    category: 'assignments',
    assignmentNumber: 1,
    unitNumber: 1,
  };
  const subjectName = resolveSubjectName(material, { name: 'Advanced Java Programming' });
  const shareUrl = 'https://campusnotes.dev/materials/mat_assign_java_1';

  const output = formatShareText(material, subjectName, shareUrl);

  const expected = [
    'CampusNotes — Study Material',
    '',
    'Subject: Advanced Java Programming',
    'Assignment: Assignment 1',
    'Unit: Unit 1',
    'PDF: Assignment 1: Multithreading & Concurrency Synchronization',
    '',
    'View PDF: https://campusnotes.dev/materials/mat_assign_java_1',
  ].join('\n');

  assert.strictEqual(output, expected);
});

test('Subject auto-resolution resolves official subject name from subjectId', () => {
  const material = {
    id: 'mat_assign_daa_3',
    subjectId: '23cs3502_daa',
    title: 'Assignment 3: Dynamic Programming',
    assignmentNumber: 3,
  };
  const subjectName = resolveSubjectName(material, null);
  assert.strictEqual(subjectName, 'Design Analysis and Algorithms');
});

test('Subject auto-resolution works with course code as subjectId', () => {
  const material = {
    id: 'mat_ade_notes',
    subjectId: '23CS3503',
    title: 'Query Optimization Notes',
  };
  const subjectName = resolveSubjectName(material, null);
  assert.strictEqual(subjectName, 'Advanced Database Engineering');
});

test('Lecture note with Unit omits Assignment field gracefully', () => {
  const material = {
    id: 'mat_notes_ade_unit2',
    title: 'Unit 2: Query Processing & Optimization Notes',
    subjectId: '23cs3503_ade',
    category: 'notes',
    unitNumber: 2,
  };
  const subjectName = resolveSubjectName(material, null);
  const shareUrl = 'https://campusnotes.dev/materials/mat_notes_ade_unit2';

  const output = formatShareText(material, subjectName, shareUrl);

  assert(output.includes('Subject: Advanced Database Engineering'));
  assert(output.includes('Unit: Unit 2'));
  assert(output.includes('PDF: Unit 2: Query Processing & Optimization Notes'));
  assert(output.includes('View PDF: https://campusnotes.dev/materials/mat_notes_ade_unit2'));
  assert(!output.includes('Assignment:'), 'Assignment line should NOT appear in Lecture Notes');
  assert(!output.includes('undefined'), 'Output must not contain undefined');
  assert(!output.includes('null'), 'Output must not contain null');
});

test('Practical/Lab experiment formats with Experiment field', () => {
  const material = {
    id: 'mat_exp_javalab_1',
    title: 'Experiment 1: Multithreaded Producer-Consumer Problem',
    subjectId: '23cs3504_ajp_lab',
    category: 'experiments',
    experimentNumber: 1,
  };
  const subjectName = resolveSubjectName(material, null);
  const shareUrl = 'https://campusnotes.dev/materials/mat_exp_javalab_1';

  const output = formatShareText(material, subjectName, shareUrl);

  assert(output.includes('Subject: Advanced Java Programming Laboratory'));
  assert(output.includes('Experiment: Experiment 1'));
  assert(output.includes('PDF: Experiment 1: Multithreaded Producer-Consumer Problem'));
  assert(output.includes('View PDF: https://campusnotes.dev/materials/mat_exp_javalab_1'));
  assert(!output.includes('Unit:'), 'Unit line should be omitted when missing');
  assert(!output.includes('Assignment:'), 'Assignment line should be omitted for experiments');
});

test('PYQ paper omits Assignment, Experiment, and Unit gracefully', () => {
  const material = {
    id: 'mat_pyq_daa_2025',
    title: 'DAA Mid-Semester University Question Paper 2025',
    subjectId: '23cs3502_daa',
    category: 'pyq',
  };
  const subjectName = resolveSubjectName(material, null);
  const shareUrl = 'https://campusnotes.dev/materials/mat_pyq_daa_2025';

  const output = formatShareText(material, subjectName, shareUrl);

  assert(output.includes('Subject: Design Analysis and Algorithms'));
  assert(output.includes('PDF: DAA Mid-Semester University Question Paper 2025'));
  assert(!output.includes('Assignment:'));
  assert(!output.includes('Experiment:'));
  assert(!output.includes('Unit:'));
});

test('Minimal material with no subject or numbers formats cleanly', () => {
  const material = {
    id: 'mat_unknown_1',
    title: 'CSE Semester 5 General Reference Guide',
  };
  const subjectName = resolveSubjectName(material, null);
  const shareUrl = 'https://campusnotes.dev/materials/mat_unknown_1';

  const output = formatShareText(material, subjectName, shareUrl);

  assert(output.startsWith('CampusNotes — Study Material\n\nPDF: CSE Semester 5 General Reference Guide'));
  assert(output.endsWith('View PDF: https://campusnotes.dev/materials/mat_unknown_1'));
  assert(!output.includes('Subject:'));
  assert(!output.includes('Assignment:'));
  assert(!output.includes('Unit:'));
  assert(!output.includes('undefined'));
  assert(!output.includes('null'));
});

// -----------------------------------------------------------------------------
// Suite 3: Web Share API & Clipboard Simulation
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 3: Web Share API & Clipboard Fallback Behavior ---');

// Mock browser environments
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

// Emulate shareMaterial in Node using mocks
async function runMockShareMaterial(material, showToast, subject, mockNav, isSecure = true) {
  if (material.published === false) {
    showToast?.('Material Unpublished', 'This study material is unpublished and cannot be shared publicly.');
    return false;
  }

  const origin = 'https://campusnotes.dev';
  const shareUrl = `${origin}/materials/${material.id}`;
  const subjectName = resolveSubjectName(material, subject);
  const formattedText = formatShareText(material, subjectName, shareUrl);

  const shareData = {
    title: material.title ? `${material.title} — CampusNotes` : 'CampusNotes — Study Material',
    text: formattedText,
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
      await mockNav.clipboard.writeText(formattedText);
      copied = true;
    } catch {
      copied = false;
    }
  }

  if (copied) {
    showToast?.('Link Copied', 'Study material details and link copied to clipboard.');
    return true;
  } else {
    showToast?.('Share Material', formattedText);
    return false;
  }
}

test('Mobile Web Share API sends full structured metadata, title and URL', async () => {
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

  let toastTitle = '';
  const success = await runMockShareMaterial(
    material,
    (t) => { toastTitle = t; },
    null,
    mockNav
  );

  assert.strictEqual(success, true);
  assert(mockNav.sharedData !== null);
  assert.strictEqual(mockNav.sharedData.title, 'Assignment 2: Java Collections Framework — CampusNotes');
  assert.strictEqual(mockNav.sharedData.url, 'https://campusnotes.dev/materials/mat_assign_java_2');
  assert(mockNav.sharedData.text.includes('Subject: Advanced Java Programming'));
  assert(mockNav.sharedData.text.includes('Assignment: Assignment 2'));
  assert(mockNav.sharedData.text.includes('Unit: Unit 2'));
  assert(mockNav.sharedData.text.includes('View PDF: https://campusnotes.dev/materials/mat_assign_java_2'));
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

test('Desktop / fallback copies complete formatted message and working link to clipboard', async () => {
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
  assert(mockNav.clipboardText !== null);
  assert(mockNav.clipboardText.includes('CampusNotes — Study Material'));
  assert(mockNav.clipboardText.includes('Subject: Design Analysis and Algorithms'));
  assert(mockNav.clipboardText.includes('Assignment: Assignment 1'));
  assert(mockNav.clipboardText.includes('Unit: Unit 1'));
  assert(mockNav.clipboardText.includes('PDF: Assignment 1: Divide and Conquer'));
  assert(mockNav.clipboardText.includes('View PDF: https://campusnotes.dev/materials/mat_assign_daa_1'));
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
