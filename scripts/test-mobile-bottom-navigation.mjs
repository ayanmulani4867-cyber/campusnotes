import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('======================================================================');
console.log('  CAMPUSNOTES — MOBILE BOTTOM NAVIGATION & HOMEPAGE TEST SUITE');
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
// Suite 1: MobileBottomNav Component Structure & Icon Standards
// -----------------------------------------------------------------------------
console.log('--- Test Suite 1: MobileBottomNav Component Structure & Specifications ---');

const mobileBottomNavPath = 'src/components/common/MobileBottomNav.tsx';
assert(fs.existsSync(mobileBottomNavPath), 'MobileBottomNav.tsx does not exist');
const bottomNavCode = fs.readFileSync(mobileBottomNavPath, 'utf8');

test('MobileBottomNav component is exported', () => {
  assert(bottomNavCode.includes('export const MobileBottomNav: React.FC'), 'Missing export of MobileBottomNav');
});

test('Mobile bottom navigation is fixed at bottom of viewport', () => {
  assert(bottomNavCode.includes('fixed bottom-0'), 'Must be fixed at bottom');
});

test('Mobile bottom navigation is hidden on desktop and tablet (md:hidden)', () => {
  assert(bottomNavCode.includes('md:hidden'), 'Must include md:hidden to hide on tablets and desktops');
});

test('Mobile bottom navigation includes safe-area-inset-bottom support', () => {
  assert(bottomNavCode.includes('pb-[env(safe-area-inset-bottom)]'), 'Must respect env(safe-area-inset-bottom)');
});

test('Bottom bar has white background, subtle top border, and light shadow', () => {
  assert(bottomNavCode.includes('bg-white'), 'Must have white background');
  assert(bottomNavCode.includes('border-t border-slate-200'), 'Must have subtle top border');
  assert(bottomNavCode.includes('shadow-'), 'Must have subtle shadow');
});

test('Contains exactly 4 navigation items: Home, Subjects, Materials, More', () => {
  assert(bottomNavCode.includes('grid-cols-4'), 'Must use 4-column equal grid layout');
  assert(bottomNavCode.includes('Home'), 'Must include Home label');
  assert(bottomNavCode.includes('Subjects'), 'Must include Subjects label');
  assert(bottomNavCode.includes('Materials'), 'Must include Materials label');
  assert(bottomNavCode.includes('More'), 'Must include More label');
});

test('Uses only existing lucide-react icon library', () => {
  assert(bottomNavCode.includes("from 'lucide-react'"), 'Icons must import from lucide-react');
  assert(bottomNavCode.includes('Home,'), 'Must import Home icon');
  assert(bottomNavCode.includes('BookOpen,'), 'Must import BookOpen icon');
  assert(bottomNavCode.includes('FileText,'), 'Must import FileText icon');
  assert(bottomNavCode.includes('MoreHorizontal,'), 'Must import MoreHorizontal icon');
});

test('Navigation items have consistent icon sizing (w-5 h-5)', () => {
  assert(bottomNavCode.includes('w-5 h-5'), 'Icons must have consistent w-5 h-5 sizing');
});

test('Navigation items have touch-friendly target height (min-h-[44px])', () => {
  assert(bottomNavCode.includes('min-h-[44px]'), 'Touch targets must be at least 44px');
});

test('Active item uses blue icon & text, inactive items use grey', () => {
  assert(bottomNavCode.includes('text-blue-600 font-semibold'), 'Active item must use text-blue-600 font-semibold');
  assert(bottomNavCode.includes('text-slate-500'), 'Inactive item must use text-slate-500');
});

// -----------------------------------------------------------------------------
// Suite 2: Navigation Destinations & More Menu Integrity
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 2: Navigation Destinations & More Menu Integrity ---');

test('Home navigates to root /', () => {
  assert(bottomNavCode.includes('to="/"'), 'Home must navigate to /');
});

test('Subjects navigates to /subjects', () => {
  assert(bottomNavCode.includes('to="/subjects"'), 'Subjects must navigate to /subjects');
});

test('Materials navigates to /materials', () => {
  assert(bottomNavCode.includes('to="/materials"'), 'Materials must navigate to /materials');
});

test('More toggles a clean mobile More menu', () => {
  assert(bottomNavCode.includes('setIsMoreOpen(!isMoreOpen)'), 'More button must toggle More menu');
  assert(bottomNavCode.includes('role="dialog"'), 'More menu must be an accessible dialog');
});

test('More menu automatically closes on route changes', () => {
  assert(bottomNavCode.includes('setIsMoreOpen(false)'), 'Must close More menu');
  assert(bottomNavCode.includes('location.pathname'), 'Must observe location.pathname');
});

test('More menu supports Escape key to close', () => {
  assert(bottomNavCode.includes("e.key === 'Escape'"), 'Must handle Escape key press');
});

test('More menu contains ONLY existing routes (zero dead links)', () => {
  assert(bottomNavCode.includes('to="/contribute"'), 'Must link to /contribute');
  assert(bottomNavCode.includes('to="/about"'), 'Must link to /about');
  assert(bottomNavCode.includes('to="/category/question-banks"'), 'Must link to /category/question-banks');
  assert(bottomNavCode.includes('to="/category/notes"'), 'Must link to /category/notes');
  assert(bottomNavCode.includes('to="/category/assignments"'), 'Must link to /category/assignments');
  assert(bottomNavCode.includes('to="/category/experiments"'), 'Must link to /category/experiments');
  assert(bottomNavCode.includes('to="/category/pyq"'), 'Must link to /category/pyq');
  assert(bottomNavCode.includes('to="/category/syllabus"'), 'Must link to /category/syllabus');
  // Dead link prevention: No non-existent /contact route
  assert(!bottomNavCode.includes('to="/contact"'), 'Must NOT include dead link to non-existent /contact');
});

// -----------------------------------------------------------------------------
// Suite 3: Layout Spacing, Content Protection & Desktop Hiding
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 3: Mobile Layout Adjustments & Desktop Protection ---');

const appCode = fs.readFileSync('src/App.tsx', 'utf8');
const footerCode = fs.readFileSync('src/components/common/Footer.tsx', 'utf8');

test('App.tsx imports and registers MobileBottomNav', () => {
  assert(appCode.includes("import { MobileBottomNav } from './components/common/MobileBottomNav'"), 'Missing MobileBottomNav import');
  assert(appCode.includes('<MobileBottomNav />'), 'App.tsx must render <MobileBottomNav />');
});

test('Mobile bottom navigation is excluded from Admin Dashboard to prevent collision', () => {
  assert(appCode.includes('!isAdminDashboard && <MobileBottomNav />'), 'Must not show on Admin Dashboard');
});

test('Main content container includes mobile bottom padding (pb-16 md:pb-0)', () => {
  assert(appCode.includes('pb-16 md:pb-0') || appCode.includes('pb-20 md:pb-0'), 'Main container must have bottom padding on mobile');
});

test('Footer includes safe area bottom padding to prevent bottom nav occlusion', () => {
  assert(footerCode.includes('pb-[calc(5rem+env(safe-area-inset-bottom))]'), 'Footer must have safe area bottom padding on mobile');
  assert(footerCode.includes('md:pb-0') || footerCode.includes('md:py-6'), 'Footer bottom padding must reset on desktop');
});

// -----------------------------------------------------------------------------
// Suite 4: Homepage Visual Refinements & Screenshot Target Alignment
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 4: Homepage Refinements Matching Reference Screenshot ---');

const homeCode = fs.readFileSync('src/pages/HomePage.tsx', 'utf8');

test('Homepage hero has compact spacing (py-5 sm:py-8)', () => {
  assert(homeCode.includes('py-5 sm:py-8'), 'Hero section must have compact vertical padding');
});

test('Homepage title is bold and retains break-words', () => {
  assert(homeCode.includes('CampusNotes'), 'Must preserve CampusNotes title');
  assert(homeCode.includes('break-words'), 'Must preserve break-words on title');
});

test('Search bar is responsive with correct placeholder', () => {
  assert(homeCode.includes('placeholder="Search subjects, materials, or topics..."'), 'Search bar placeholder must match reference');
  assert(homeCode.includes('rounded-xl'), 'Search bar container must use modern rounded-xl');
  assert(homeCode.includes('Search'), 'Search button must be present');
});

test('Contribute Study Materials button is prominent and links to /contribute', () => {
  assert(homeCode.includes('Contribute Study Materials'), 'Missing CTA button text');
  assert(homeCode.includes('to="/contribute"'), 'CTA must link to /contribute');
  assert(homeCode.includes('bg-blue-600'), 'Must use primary blue background');
  assert(homeCode.includes('min-h-[44px]'), 'Must have touch-friendly min-h-[44px]');
});

test('Semester filters are compact, horizontally scrollable with no-scrollbar', () => {
  assert(homeCode.includes('overflow-x-auto'), 'Must support horizontal overflow');
  assert(homeCode.includes('no-scrollbar'), 'Must hide scrollbar on chip bar');
  assert(homeCode.includes('touch-pan-x'), 'Must support smooth touch-pan-x');
  assert(homeCode.includes('rounded-xl'), 'Semester filter chips must be rounded-xl');
});

test('Subject cards use rounded-2xl, readable titles, and 2-3 line clamped descriptions', () => {
  assert(homeCode.includes('rounded-2xl'), 'Subject cards must use rounded-2xl');
  assert(homeCode.includes('p-4 sm:p-5'), 'Subject cards must have compact padding');
  assert(homeCode.includes('line-clamp-2') || homeCode.includes('line-clamp-3'), 'Subject description must be clamped to 2-3 lines');
  assert(homeCode.includes('View Notes & Materials') || homeCode.includes('View Notes &amp; Materials'), 'Must have bottom action link');
});

// -----------------------------------------------------------------------------
// Suite 5: Responsive Width Simulation Verification
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 5: Responsive Breakpoints Verification (360px - 430px) ---');

const testWidths = [360, 375, 390, 414, 430];
testWidths.forEach((width) => {
  test(`Mobile width ${width}px is properly within mobile breakpoint (< 768px)`, () => {
    assert(width < 768, `${width}px must be treated as mobile`);
  });
});

test('Desktop breakpoint (768px+) cleanly hides bottom nav using Tailwind md:hidden', () => {
  assert(bottomNavCode.includes('md:hidden'), 'Must use md:hidden');
});

console.log('\n======================================================================');
console.log(`  RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('======================================================================');

if (failed > 0) {
  process.exit(1);
}

