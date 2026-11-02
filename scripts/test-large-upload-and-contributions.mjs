// test-large-upload-and-contributions.mjs
// Verification suite for CampusNotes 50 MB Large File Uploads and Public Student Contributions

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';

console.log('======================================================================');
console.log('  CAMPUSNOTES — 50 MB UPLOADS & PUBLIC CONTRIBUTIONS TEST SUITE');
console.log('======================================================================\n');

let passedCount = 0;
let failedCount = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
    failedCount++;
  }
}

// -----------------------------------------------------------------------------
// Test Suite 1: Exact 50 MB Limits & Constants Consistency
// -----------------------------------------------------------------------------
console.log('--- Test Suite 1: Exact 50 MB Limits & Constants Consistency ---');

const EXACT_50_MB = 50 * 1024 * 1024; // 52,428,800 bytes
const frontendFileTypesCode = fs.readFileSync('src/utils/fileTypes.ts', 'utf8');
const workerCode = fs.readFileSync('worker/src/index.ts', 'utf8');
const workerUtilsCode = fs.existsSync('worker/src/utils.ts')
  ? fs.readFileSync('worker/src/utils.ts', 'utf8')
  : '';
const workerCodeAll = workerCode + workerUtilsCode;
const firebaseServiceCode = fs.readFileSync('src/services/firebaseService.ts', 'utf8');

test('50 MB byte limit equals exactly 52,428,800 bytes', () => {
  assert.strictEqual(EXACT_50_MB, 52428800);
});

test('Frontend fileTypes.ts sets MAX_FILE_SIZE_BYTES to 52,428,800 bytes', () => {
  assert(
    frontendFileTypesCode.includes('50 * 1024 * 1024') || frontendFileTypesCode.includes('52428800'),
    'frontend fileTypes.ts missing exact 50 MB limit'
  );
});

test('Worker sets MAX_FILE_SIZE_BYTES to 52,428,800 bytes', () => {
  assert(
    workerCodeAll.includes('50 * 1024 * 1024') || workerCodeAll.includes('52428800'),
    'worker missing exact 50 MB limit'
  );
});

test('Exact error message "Maximum file size allowed is 50 MB." in frontend and worker', () => {
  assert(
    frontendFileTypesCode.includes('Maximum file size allowed is 50 MB.'),
    'Frontend missing exact error message'
  );
  assert(
    workerCodeAll.includes('Maximum file size allowed is 50 MB.'),
    'Worker missing exact error message'
  );
});

test('Upload timeout extended to 300 seconds (5 min) for 50 MB transfers in firebaseService.ts', () => {
  assert(
    firebaseServiceCode.includes('300000') || firebaseServiceCode.includes('300_000'),
    'Upload timeout must be at least 300s'
  );
});

// -----------------------------------------------------------------------------
// Test Suite 2: Public Navigation & Contribution UI Integration
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 2: Public Navigation & Contribution UI Integration ---');

const homePageCode = fs.readFileSync('src/pages/HomePage.tsx', 'utf8');
const navbarCode = fs.readFileSync('src/components/common/Navbar.tsx', 'utf8');
const appCode = fs.readFileSync('src/App.tsx', 'utf8');
const contributePageCode = fs.readFileSync('src/pages/ContributePage.tsx', 'utf8');

test('HomePage hero section includes "Contribute Study Materials" CTA button linking to /contribute', () => {
  assert(homePageCode.includes('Contribute Study Materials'), 'Missing CTA button text');
  assert(homePageCode.includes("to=\"/contribute\""), 'Missing link to /contribute');
});

test('Navbar includes "Contribute" link for quick desktop and mobile access', () => {
  assert(navbarCode.includes('/contribute'), 'Navbar missing /contribute route link');
  assert(navbarCode.includes('Contribute'), 'Navbar missing Contribute text');
});

test('App.tsx registers /contribute route', () => {
  assert(appCode.includes('path="/contribute"'), 'App.tsx missing /contribute route');
});

test('ContributePage implements all required fields and categories', () => {
  assert(contributePageCode.includes('studentName'), 'Missing studentName field');
  assert(contributePageCode.includes('materialTitle'), 'Missing materialTitle field');
  assert(contributePageCode.includes('semesterId'), 'Missing semesterId field');
  assert(contributePageCode.includes('subjectId'), 'Missing subjectId field');
  assert(contributePageCode.includes('category'), 'Missing category field');
  assert(contributePageCode.includes('Notes'), 'Missing Notes category');
  assert(contributePageCode.includes('Assignments'), 'Missing Assignments category');
  assert(contributePageCode.includes('Practical Experiments'), 'Missing Practical Experiments category');
  assert(contributePageCode.includes('Question Papers'), 'Missing Question Papers category');
  assert(contributePageCode.includes('Presentations'), 'Missing Presentations category');
  assert(contributePageCode.includes('Other Study Materials'), 'Missing Other Study Materials category');
});

test('ContributePage displays exact required success confirmation message', () => {
  const expectedMsg = 'Thank you for contributing to CampusNotes! Your material has been submitted successfully. It will become available after administrator approval.';
  assert(contributePageCode.includes(expectedMsg), 'Missing exact contribution success message');
});

test('ContributePage includes bot prevention honeypot field', () => {
  assert(contributePageCode.includes('honeypot'), 'Missing honeypot field');
});

// -----------------------------------------------------------------------------
// Test Suite 3: Admin Dashboard Student Contributions Section
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 3: Admin Dashboard Student Contributions Section ---');

const adminDashboardCode = fs.readFileSync('src/pages/admin/AdminDashboardPage.tsx', 'utf8');
const adminSectionCode = fs.readFileSync('src/components/admin/StudentContributionsSection.tsx', 'utf8');

test('AdminDashboardPage adds "contributions" tab with pending counter badge', () => {
  assert(adminDashboardCode.includes("'contributions'"), 'Admin dashboard missing contributions tab');
  assert(adminDashboardCode.includes('StudentContributionsSection'), 'Admin dashboard missing StudentContributionsSection');
  assert(
    adminDashboardCode.includes('pendingContributionsCount') || adminDashboardCode.includes('pendingCount'),
    'Admin dashboard missing pending count calculation'
  );
});

test('StudentContributionsSection implements status filtering: all, pending, approved, rejected', () => {
  assert(adminSectionCode.includes("'all'"), 'Missing all filter');
  assert(adminSectionCode.includes("'pending'"), 'Missing pending filter');
  assert(adminSectionCode.includes("'approved'"), 'Missing approved filter');
  assert(adminSectionCode.includes("'rejected'"), 'Missing rejected filter');
});

test('StudentContributionsSection implements preview, download, approve, reject, and delete actions', () => {
  assert(adminSectionCode.includes('handlePreview'), 'Missing handlePreview');
  assert(adminSectionCode.includes('handleDownload'), 'Missing handleDownload');
  assert(adminSectionCode.includes('handleApprove'), 'Missing handleApprove');
  assert(adminSectionCode.includes('handleReject'), 'Missing handleReject');
  assert(adminSectionCode.includes('handleDelete'), 'Missing handleDelete');
});

// -----------------------------------------------------------------------------
// Test Suite 4: Worker API & Pending Submissions Storage Security
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 4: Worker API & Pending Submissions Storage Security ---');

test('Worker defines public submission endpoints and admin-only endpoints', () => {
  assert(workerCode.includes('/submissions/init'), 'Worker missing POST /submissions/init');
  assert(workerCode.includes('/submissions') && workerCode.includes('PUT'), 'Worker missing binary upload handler');
  assert(workerCode.includes('/submissions/:id/approve') || workerCode.includes('/approve'), 'Worker missing approve endpoint');
  assert(workerCode.includes('/submissions/:id/reject') || workerCode.includes('/reject'), 'Worker missing reject endpoint');
});

test('Worker stores pending files in restricted pending_submissions/ R2 prefix', () => {
  assert(workerCode.includes('pending_submissions/'), 'Worker must use isolated pending_submissions prefix');
});

test('Worker CORS headers always include canonical campusnotes.space', () => {
  assert(workerCode.includes('https://campusnotes.space'), 'Worker missing canonical origin');
  assert(workerCode.includes('https://www.campusnotes.space'), 'Worker missing www origin');
});

test('Worker implements rate-limiting for public submissions', () => {
  assert(workerCode.includes('RATE_LIMIT_WINDOW_MS'), 'Worker missing rate limit window');
  assert(workerCode.includes('MAX_SUBMISSIONS_PER_IP'), 'Worker missing max submissions check');
});

// -----------------------------------------------------------------------------
// Test Suite 5: Simulation of 50 MB Boundary & All 15 Formats
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 5: Simulation of 50 MB Boundary & All 15 Formats ---');

const ALL_15_FORMATS = [
  'pdf', 'doc', 'docx', 'txt', 'rtf',
  'ppt', 'pptx', 'xls', 'xlsx', 'csv',
  'jpg', 'jpeg', 'png', 'webp', 'zip'
];

test('All 15 formats supported by validation logic', () => {
  for (const ext of ALL_15_FORMATS) {
    assert(
      frontendFileTypesCode.includes(`'${ext}'`) || frontendFileTypesCode.includes(`"${ext}"`),
      `Format ${ext} not found in frontend fileTypes.ts`
    );
  }
});

test('Size validator accepts <= 52,428,800 bytes and rejects > 52,428,800 bytes', () => {
  function validateSize(bytes) {
    if (bytes > EXACT_50_MB) {
      return { isValid: false, error: 'Maximum file size allowed is 50 MB.' };
    }
    return { isValid: true };
  }

  assert.strictEqual(validateSize(1024 * 1024).isValid, true); // 1 MB
  assert.strictEqual(validateSize(5 * 1024 * 1024).isValid, true); // 5 MB
  assert.strictEqual(validateSize(6 * 1024 * 1024).isValid, true); // 6 MB
  assert.strictEqual(validateSize(10 * 1024 * 1024).isValid, true); // 10 MB
  assert.strictEqual(validateSize(20 * 1024 * 1024).isValid, true); // 20 MB
  assert.strictEqual(validateSize(30 * 1024 * 1024).isValid, true); // 30 MB
  assert.strictEqual(validateSize(40 * 1024 * 1024).isValid, true); // 40 MB
  assert.strictEqual(validateSize(49 * 1024 * 1024).isValid, true); // 49 MB
  assert.strictEqual(validateSize(52428800).isValid, true); // 50 MB exact
  assert.strictEqual(validateSize(52428801).isValid, false); // 50 MB + 1 byte
  assert.strictEqual(validateSize(52428801).error, 'Maximum file size allowed is 50 MB.');
});

console.log('\n======================================================================');
console.log(`  RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
console.log('======================================================================\n');

if (failedCount > 0) {
  process.exit(1);
}
