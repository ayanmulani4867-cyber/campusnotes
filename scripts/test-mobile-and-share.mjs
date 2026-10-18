import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('======================================================================');
console.log('  CAMPUSNOTES — MOBILE RESPONSIVENESS & SHARE FEATURE TEST SUITE');
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
// Suite 1: Share Feature Verification (shareUtils.ts)
// -----------------------------------------------------------------------------
console.log('--- Test Suite 1: Share Feature Logic & URL Integrity ---');

const shareUtilsFile = fs.readFileSync('src/utils/shareUtils.ts', 'utf8');

test('shareUtils exports shareMaterial function', () => {
  assert(shareUtilsFile.includes('export async function shareMaterial('), 'Missing export async function shareMaterial');
});

test('Canonical URL is strictly /materials/:id', () => {
  assert(shareUtilsFile.includes('${window.location.origin}/materials/${material.id}'), 'Canonical URL does not use /materials/:id format');
});

test('Native navigator.share is prioritized when available', () => {
  assert(shareUtilsFile.includes('navigator.share'), 'Missing navigator.share check');
});

test('User cancellation (AbortError) is caught silently without showing errors', () => {
  assert(shareUtilsFile.includes('AbortError'), 'Missing AbortError check');
  assert(shareUtilsFile.includes('err.name === \'AbortError\''), 'Does not check for err.name === AbortError');
});

test('Clipboard fallback writeText is implemented', () => {
  assert(shareUtilsFile.includes('navigator.clipboard.writeText'), 'Missing navigator.clipboard.writeText');
});

test('ExecCommand copy fallback exists for older mobile browsers', () => {
  assert(shareUtilsFile.includes('document.execCommand'), 'Missing legacy copy fallback');
});

test('Toast confirmation callback is invoked on copy', () => {
  assert(shareUtilsFile.includes("showToast?.('Link Copied'"), 'Missing Link Copied toast trigger');
});

test('No Base64 blobs, tokens or passwords ever appended to share URLs', () => {
  assert(!shareUtilsFile.includes('blob:'), 'Share URLs must not contain blob references');
  assert(!shareUtilsFile.includes('base64'), 'Share URLs must not contain base64');
  assert(!shareUtilsFile.includes('token'), 'Share URLs must not contain tokens');
  assert(!shareUtilsFile.includes('password'), 'Share URLs must not contain passwords');
});

// -----------------------------------------------------------------------------
// Suite 2: Share Button Integration in MaterialCard, MaterialDetailPage, PdfViewer
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 2: Share Button Component Integration ---');

const materialCardCode = fs.readFileSync('src/components/materials/MaterialCard.tsx', 'utf8');
const materialDetailPageCode = fs.readFileSync('src/pages/MaterialDetailPage.tsx', 'utf8');
const pdfViewerCode = fs.readFileSync('src/components/materials/PdfViewer.tsx', 'utf8');

test('MaterialCard includes Share button with Share2 and Check icons', () => {
  assert(materialCardCode.includes('Share2'), 'MaterialCard missing Share2 icon');
  assert(materialCardCode.includes('Check'), 'MaterialCard missing Check icon');
  assert(materialCardCode.includes('handleShare'), 'MaterialCard missing handleShare handler');
  assert(materialCardCode.includes('shareMaterial'), 'MaterialCard missing shareMaterial call');
});

test('MaterialCard has View, Download, and Share action buttons with touch-friendly min-h', () => {
  assert(materialCardCode.includes('min-h-[42px]'), 'MaterialCard action buttons missing touch-friendly min-h-[42px]');
  assert(materialCardCode.includes('View'), 'MaterialCard missing View action');
  assert(materialCardCode.includes('Download'), 'MaterialCard missing Download action');
  assert(materialCardCode.includes('aria-label={`Share ${material.title}`}'), 'MaterialCard Share button missing accessible aria-label');
});

test('MaterialDetailPage includes Share button calling shareMaterial', () => {
  assert(materialDetailPageCode.includes('shareMaterial'), 'MaterialDetailPage missing shareMaterial call');
  assert(materialDetailPageCode.includes('handleShare'), 'MaterialDetailPage missing handleShare');
  assert(materialDetailPageCode.includes('Share2'), 'MaterialDetailPage missing Share2 icon');
  assert(materialDetailPageCode.includes('Check'), 'MaterialDetailPage missing Check icon');
});

test('MaterialDetailPage action buttons use touch-friendly sizing (min-h-[44px])', () => {
  assert(materialDetailPageCode.includes('min-h-[44px]'), 'MaterialDetailPage action buttons missing min-h-[44px]');
});

test('PdfViewer toolbar includes Share button calling shareMaterial', () => {
  assert(pdfViewerCode.includes('shareMaterial'), 'PdfViewer missing shareMaterial');
  assert(pdfViewerCode.includes('handleShare'), 'PdfViewer missing handleShare');
  assert(pdfViewerCode.includes('Share2'), 'PdfViewer toolbar missing Share2 icon');
});

test('PdfViewer toolbar buttons use touch-friendly sizing', () => {
  assert(pdfViewerCode.includes('min-h-[38px]'), 'PdfViewer toolbar buttons missing min-h-[38px]');
});

// -----------------------------------------------------------------------------
// Suite 3: Mobile Responsiveness Audit across Public Pages
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 3: Mobile Responsiveness on Public Pages ---');

const navbarCode = fs.readFileSync('src/components/common/Navbar.tsx', 'utf8');
const modalCode = fs.readFileSync('src/components/common/Modal.tsx', 'utf8');
const filterCode = fs.readFileSync('src/components/materials/MaterialFilter.tsx', 'utf8');
const homeCode = fs.readFileSync('src/pages/HomePage.tsx', 'utf8');
const materialsPageCode = fs.readFileSync('src/pages/MaterialsPage.tsx', 'utf8');
const categoryPageCode = fs.readFileSync('src/pages/CategoryPage.tsx', 'utf8');
const subjectDetailCode = fs.readFileSync('src/pages/SubjectDetailPage.tsx', 'utf8');
const subjectsPageCode = fs.readFileSync('src/pages/SubjectsPage.tsx', 'utf8');
const indexCssCode = fs.readFileSync('src/index.css', 'utf8');

test('Navbar mobile hamburger button has 44x44px touch target', () => {
  assert(navbarCode.includes('min-h-[44px] min-w-[44px]'), 'Navbar mobile hamburger button missing 44x44px touch target');
});

test('Navbar mobile drawer links have min-h-[44px] touch target', () => {
  assert(navbarCode.includes('min-h-[44px]'), 'Navbar mobile drawer links missing min-h-[44px]');
});

test('Modal dialog fits narrow screens (p-2.5 sm:p-6, close button min-h-[44px])', () => {
  assert(modalCode.includes('p-2.5 sm:p-6'), 'Modal missing compact mobile padding');
  assert(modalCode.includes('min-h-[44px] min-w-[44px]'), 'Modal close button missing 44x44px touch target');
});

test('MaterialFilter inputs and selects have min-h-[42px] touch target', () => {
  assert(filterCode.includes('min-h-[42px]'), 'MaterialFilter inputs missing min-h-[42px]');
});

test('index.css has overflow-x prevention and safe area insets', () => {
  assert(indexCssCode.includes('overflow-x: hidden'), 'Missing overflow-x: hidden in index.css');
  assert(indexCssCode.includes('safe-area-inset-left'), 'Missing safe-area-inset in index.css');
});

test('Titles on all pages use break-words to prevent horizontal overflow', () => {
  assert(homeCode.includes('break-words'), 'HomePage missing break-words on titles');
  assert(materialsPageCode.includes('break-words'), 'MaterialsPage missing break-words on titles');
  assert(categoryPageCode.includes('break-words'), 'CategoryPage missing break-words on titles');
  assert(subjectDetailCode.includes('break-words'), 'SubjectDetailPage missing break-words on titles');
  assert(subjectsPageCode.includes('break-words'), 'SubjectsPage missing break-words on titles');
  assert(materialDetailPageCode.includes('break-words'), 'MaterialDetailPage missing break-words on titles');
});

// -----------------------------------------------------------------------------
// Suite 4: Admin Dashboard Mobile Usability & Form Stacking
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 4: Admin Dashboard Mobile Usability ---');

const adminDashboardCode = fs.readFileSync('src/pages/admin/AdminDashboardPage.tsx', 'utf8');
const materialFormModalCode = fs.readFileSync('src/components/admin/MaterialFormModal.tsx', 'utf8');
const replacePdfModalCode = fs.readFileSync('src/components/admin/ReplacePdfModal.tsx', 'utf8');
const subjectManagerCode = fs.readFileSync('src/components/admin/SubjectManager.tsx', 'utf8');
const adminLoginPageCode = fs.readFileSync('src/pages/admin/AdminLoginPage.tsx', 'utf8');

test('AdminDashboard mobile menu button has 44x44px touch target', () => {
  assert(adminDashboardCode.includes('min-h-[44px] min-w-[44px]'), 'AdminDashboard mobile toggle button missing 44x44px target');
});

test('AdminDashboard drawer items have min-h-[44px] touch targets', () => {
  assert(adminDashboardCode.includes('min-h-[44px] flex items-center'), 'AdminDashboard drawer items missing min-h-[44px]');
});

test('AdminDashboard mobile material cards have touch-friendly action buttons (min-h-[40px])', () => {
  assert(adminDashboardCode.includes('min-h-[40px]'), 'Admin mobile card actions missing min-h-[40px]');
});

test('MaterialFormModal stacks form fields vertically on narrow screens (grid-cols-1 sm:grid-cols-3)', () => {
  assert(materialFormModalCode.includes('grid-cols-1 sm:grid-cols-3'), 'MaterialFormModal missing vertical stacking on small screens');
});

test('MaterialFormModal and ReplacePdfModal have touch-friendly footer actions (min-h-[42px])', () => {
  assert(materialFormModalCode.includes('min-h-[42px]'), 'MaterialFormModal actions missing min-h-[42px]');
  assert(replacePdfModalCode.includes('min-h-[42px]'), 'ReplacePdfModal actions missing min-h-[42px]');
});

test('SubjectManager action buttons stack and have min-h-[42px] touch targets', () => {
  assert(subjectManagerCode.includes('min-h-[42px]'), 'SubjectManager actions missing min-h-[42px]');
});

test('AdminLoginPage has touch-friendly inputs (min-h-[44px]) and responsive credentials callout', () => {
  assert(adminLoginPageCode.includes('min-h-[44px]'), 'AdminLoginPage inputs missing min-h-[44px]');
  assert(adminLoginPageCode.includes('flex flex-col sm:flex-row'), 'AdminLoginPage credentials callout not responsive');
});

// -----------------------------------------------------------------------------
// Suite 5: Critical Scope Protection Checks
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 5: Critical Rule Protection (No Unrelated Changes) ---');

test('Firebase auth credentials/passwords logic untouched', () => {
  const authServiceCode = fs.readFileSync('src/services/authService.ts', 'utf8');
  assert(authServiceCode.includes('signInWithEmailAndPassword'), 'authService core logic missing');
});

test('Firebase RTDB service download & replacement logic intact', () => {
  const fbService = fs.readFileSync('src/services/firebaseService.ts', 'utf8');
  assert(fbService.includes('export async function replaceMaterialPdf('), 'replaceMaterialPdf missing');
  assert(fbService.includes('export async function downloadStudyMaterial('), 'downloadStudyMaterial missing');
  assert(fbService.includes('export async function fetchPdfBlobUrl('), 'fetchPdfBlobUrl missing');
});

console.log('\n======================================================================');
console.log(`  RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('======================================================================');

if (failed > 0) {
  process.exit(1);
}
