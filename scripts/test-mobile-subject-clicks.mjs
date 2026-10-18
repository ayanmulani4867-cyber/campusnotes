import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('======================================================================');
console.log('  CAMPUSNOTES — MOBILE SUBJECT CLICK & NAVIGATION TEST SUITE');
console.log('======================================================================\n');

let passCount = 0;
let failCount = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  [PASS] ${desc}`);
    passCount++;
  } catch (err) {
    console.error(`  [FAIL] ${desc}: ${err.message}`);
    failCount++;
  }
}

// 1. ScrollToTop verification
console.log('--- Test Suite 1: ScrollToTop Route Reset on Mobile ---');
const scrollToTopPath = path.resolve('src/components/common/ScrollToTop.tsx');
assert(fs.existsSync(scrollToTopPath), 'ScrollToTop.tsx does not exist');
const scrollToTopContent = fs.readFileSync(scrollToTopPath, 'utf8');

it('ScrollToTop uses useLocation and window.scrollTo(0, 0)', () => {
  assert(scrollToTopContent.includes('useLocation'), 'Must use useLocation');
  assert(scrollToTopContent.includes('window.scrollTo'), 'Must call window.scrollTo');
  assert(scrollToTopContent.includes('top: 0'), 'Must reset top to 0');
});

const appPath = path.resolve('src/App.tsx');
const appContent = fs.readFileSync(appPath, 'utf8');

it('App.tsx registers ScrollToTop inside router context', () => {
  assert(appContent.includes('<ScrollToTop />'), 'App.tsx must render <ScrollToTop />');
  assert(appContent.includes("from './components/common/ScrollToTop'"), 'App.tsx must import ScrollToTop');
});

// 2. SubjectDetailPage robust resolution
console.log('\n--- Test Suite 2: SubjectDetailPage Robust Resolution & Skeletons ---');
const subjectDetailPath = path.resolve('src/pages/SubjectDetailPage.tsx');
const subjectDetailContent = fs.readFileSync(subjectDetailPath, 'utf8');

it('SubjectDetailPage imports OFFICIAL_CSE_SEM_5_SUBJECTS for instant matching', () => {
  assert(subjectDetailContent.includes('OFFICIAL_CSE_SEM_5_SUBJECTS'), 'Must import official subjects');
});

it('SubjectDetailPage has separate subjectLoading and materialsLoading states', () => {
  assert(subjectDetailContent.includes('subjectLoading'), 'Must track subjectLoading');
  assert(subjectDetailContent.includes('materialsLoading'), 'Must track materialsLoading');
});

it('SubjectDetailPage supports case-insensitive and code matching', () => {
  assert(subjectDetailContent.includes('toLowerCase()'), 'Must normalize to lower case');
  assert(subjectDetailContent.includes('s.code.toLowerCase()'), 'Must match by subject code');
});

it('SubjectDetailPage renders instantMatch to eliminate mobile load latency', () => {
  assert(subjectDetailContent.includes('instantMatch'), 'Must use instantMatch');
  assert(subjectDetailContent.includes('canonicalId'), 'Must resolve canonical subject ID');
});

it('SubjectDetailPage shows header skeleton during unknown subject load', () => {
  assert(subjectDetailContent.includes('subjectLoading && !subject'), 'Must check loading state for skeleton');
  assert(subjectDetailContent.includes('animate-pulse'), 'Must render pulse skeleton');
});

it('SubjectDetailPage has mobile-optimized Category dropdown for small screens', () => {
  assert(subjectDetailContent.includes('id="mobile-cat-select"'), 'Must have mobile category select');
  assert(subjectDetailContent.includes('sm:hidden'), 'Must be visible on mobile screens');
});

it('SubjectDetailPage category chip bar supports edge-to-edge touch scrolling', () => {
  assert(subjectDetailContent.includes('touch-pan-x'), 'Must support touch-pan-x');
  assert(subjectDetailContent.includes('overflow-x-auto'), 'Must support overflow-x-auto');
});

it('SubjectDetailPage back button has touch-friendly min-h-[44px]', () => {
  assert(subjectDetailContent.includes('min-h-[44px] inline-flex items-center gap-2'), 'Back button must have min-h-[44px]');
});

// 3. Navbar Mobile Drawer Subjects List
console.log('\n--- Test Suite 3: Navbar Mobile Drawer Subjects Section ---');
const navbarPath = path.resolve('src/components/common/Navbar.tsx');
const navbarContent = fs.readFileSync(navbarPath, 'utf8');

it('Navbar mobile menu includes Semester 5 Subjects section', () => {
  assert(navbarContent.includes('Semester 5 Subjects'), 'Mobile menu must have Semester 5 Subjects section');
  assert(navbarContent.includes('OFFICIAL_CSE_SEM_5_SUBJECTS.map'), 'Must map over all 9 subjects in mobile menu');
});

it('Navbar mobile subject links auto-close the drawer on tap', () => {
  assert(navbarContent.includes('to={`/subjects/${sub.id}`}'), 'Must link to /subjects/:id');
  assert(navbarContent.includes('onClick={() => setMobileMenuOpen(false)}'), 'Must close mobile drawer');
});

// 4. MaterialCard Clickable Subject Link
console.log('\n--- Test Suite 4: MaterialCard Clickable Subject Link ---');
const cardPath = path.resolve('src/components/materials/MaterialCard.tsx');
const cardContent = fs.readFileSync(cardPath, 'utf8');

it('MaterialCard subject tag links directly to /subjects/:subjectId', () => {
  assert(cardContent.includes('to={`/subjects/${subject.id}`}'), 'Subject must link to /subjects/:id');
  assert(cardContent.includes('e.stopPropagation()'), 'Click must not bubble up to card container');
});

// 5. Touch Feedback & Mobile Usability
console.log('\n--- Test Suite 5: Touch Feedback on Subject Cards ---');
const homePath = path.resolve('src/pages/HomePage.tsx');
const homeContent = fs.readFileSync(homePath, 'utf8');
const subjectsPagePath = path.resolve('src/pages/SubjectsPage.tsx');
const subjectsPageContent = fs.readFileSync(subjectsPagePath, 'utf8');

it('HomePage subject cards have touch-manipulation and active state styling', () => {
  assert(homeContent.includes('touch-manipulation'), 'HomePage cards must have touch-manipulation');
  assert(homeContent.includes('active:scale-[0.99]'), 'HomePage cards must have active scale');
});

it('SubjectsPage cards have touch-manipulation and active state styling', () => {
  assert(subjectsPageContent.includes('touch-manipulation'), 'SubjectsPage cards must have touch-manipulation');
  assert(subjectsPageContent.includes('active:scale-[0.99]'), 'SubjectsPage cards must have active scale');
});

it('SubjectsPage falls back to official subjects if database returns empty', () => {
  assert(subjectsPageContent.includes('OFFICIAL_CSE_SEM_5_SUBJECTS'), 'Must have official subjects fallback');
});

console.log('\n======================================================================');
console.log(`  RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
console.log('======================================================================\n');

if (failCount > 0) {
  process.exit(1);
}
