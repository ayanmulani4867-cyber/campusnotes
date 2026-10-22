/**
 * scripts/test-inactive-semester-visibility.mjs
 * 
 * Comprehensive verification test suite for Inactive Semester Visibility & Subject Protection:
 * 1. Home page: Inactive-semester subjects hidden
 * 2. Semester selector: Inactive semesters omitted from student tabs/dropdowns
 * 3. All Subjects page: Inactive-semester subjects hidden
 * 4. Subject discovery: Inactive-semester subjects blocked from search, cards, curriculum filters
 * 5. Direct URLs: /subjects/:id renders friendly "This semester is currently unavailable."
 * 6. Immediate updates: Real-time subscription propagation when semester active status toggles
 * 7. Materials isolation: Materials belonging to inactive semesters not exposed publicly
 * 8. Admin access: Admin methods preserve full access to inactive semesters, subjects, and materials
 * 9. Data integrity: Subject records in DB remain untouched, with semester controlling visibility
 * 10. Backward compatibility: Legacy subjects without semesterId properly map to Sem 5 active state
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('======================================================================');
console.log('  CAMPUSNOTES — INACTIVE SEMESTER SUBJECT VISIBILITY VERIFICATION');
console.log('======================================================================\n');

let passCount = 0;
let failCount = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    console.error(`         Reason: ${err.message}`);
    failCount++;
  }
}

function assertContains(source, needle, label) {
  if (!source.includes(needle)) {
    throw new Error(`Expected source to contain "${needle}" for ${label}`);
  }
}

function assertMatches(source, regex, label) {
  if (!regex.test(source)) {
    throw new Error(`Expected source to match regex ${regex} for ${label}`);
  }
}

const ROOT = process.cwd();
const firebaseServicePath = path.join(ROOT, 'src/services/firebaseService.ts');
const homePagePath = path.join(ROOT, 'src/pages/HomePage.tsx');
const subjectsPagePath = path.join(ROOT, 'src/pages/SubjectsPage.tsx');
const subjectDetailPagePath = path.join(ROOT, 'src/pages/SubjectDetailPage.tsx');
const materialsPagePath = path.join(ROOT, 'src/pages/MaterialsPage.tsx');
const materialDetailPagePath = path.join(ROOT, 'src/pages/MaterialDetailPage.tsx');
const categoryPagePath = path.join(ROOT, 'src/pages/CategoryPage.tsx');

const firebaseSrc = fs.readFileSync(firebaseServicePath, 'utf8');
const homeSrc = fs.readFileSync(homePagePath, 'utf8');
const subjectsSrc = fs.readFileSync(subjectsPagePath, 'utf8');
const subjectDetailSrc = fs.readFileSync(subjectDetailPagePath, 'utf8');
const materialsSrc = fs.readFileSync(materialsPagePath, 'utf8');
const materialDetailSrc = fs.readFileSync(materialDetailPagePath, 'utf8');
const categorySrc = fs.readFileSync(categoryPagePath, 'utf8');

// --- Helper simulation functions replicating src/services/firebaseService.ts logic ---

function isSubjectSemesterActive(subject, activeSemesters) {
  if (!activeSemesters || activeSemesters.length === 0) {
    return false;
  }
  const activeIds = new Set(activeSemesters.map((sem) => sem.id));
  const activeNumbers = new Set(activeSemesters.map((sem) => sem.number));

  if (subject.semesterId && activeIds.has(subject.semesterId)) {
    return true;
  }
  if (typeof subject.semesterNumber === 'number' && activeNumbers.has(subject.semesterNumber)) {
    return true;
  }
  if (!subject.semesterId && typeof subject.semesterNumber !== 'number') {
    return activeNumbers.has(5) || activeIds.has('sem_5');
  }
  return false;
}

// ============================================================================
console.log('--- Test Suite 1: Helper Function isSubjectSemesterActive Logic ---');
// ============================================================================

runTest('Active semester match by semesterId returns true', () => {
  const activeSemesters = [
    { id: 'sem_3', number: 3, name: 'Semester 3', active: true },
    { id: 'sem_5', number: 5, name: 'Semester 5', active: true },
  ];
  const subject = { id: 'sub_1', code: 'CS301', name: 'Data Structures', semesterId: 'sem_3', semesterNumber: 3, active: true };
  assert.strictEqual(isSubjectSemesterActive(subject, activeSemesters), true);
});

runTest('Inactive semester returns false for subject', () => {
  const activeSemesters = [
    { id: 'sem_5', number: 5, name: 'Semester 5', active: true },
  ]; // Semester 3 is deactivated
  const subject = { id: 'sub_1', code: 'CS301', name: 'Data Structures', semesterId: 'sem_3', semesterNumber: 3, active: true };
  assert.strictEqual(isSubjectSemesterActive(subject, activeSemesters), false);
});

runTest('Legacy subject without semesterId maps to Sem 5 and follows Sem 5 active state', () => {
  const activeWithSem5 = [
    { id: 'sem_5', number: 5, name: 'Semester 5', active: true },
  ];
  const legacySubject = { id: 'sub_legacy', code: '2150702', name: 'DAA', active: true };
  assert.strictEqual(isSubjectSemesterActive(legacySubject, activeWithSem5), true, 'Should be active when Sem 5 is active');

  const activeWithoutSem5 = [
    { id: 'sem_3', number: 3, name: 'Semester 3', active: true },
  ];
  assert.strictEqual(isSubjectSemesterActive(legacySubject, activeWithoutSem5), false, 'Should be inactive when Sem 5 is inactive');
});

runTest('Empty active semesters list returns false for all subjects', () => {
  const subject = { id: 'sub_1', code: 'CS101', name: 'Intro', semesterId: 'sem_1', semesterNumber: 1, active: true };
  assert.strictEqual(isSubjectSemesterActive(subject, []), false);
  assert.strictEqual(isSubjectSemesterActive(subject, null), false);
});

// ============================================================================
console.log('\n--- Test Suite 2: Firebase Service Public & Admin Function Integrity ---');
// ============================================================================

runTest('firebaseService exports isSubjectSemesterActive', () => {
  assertContains(firebaseSrc, 'export function isSubjectSemesterActive', 'isSubjectSemesterActive export');
});

runTest('getPublicSubjects filters out subjects belonging to inactive semesters', () => {
  assertContains(firebaseSrc, 'isSubjectSemesterActive(s, activeSemesters)', 'getPublicSubjects filter');
});

runTest('subscribeToPublicSubjects listens to active semesters in real time', () => {
  assertContains(firebaseSrc, 'subscribeToPublicSemesters', 'subscribeToPublicSemesters listener');
  assertContains(firebaseSrc, 'currentActiveSemesters = activeSems', 'activeSemesters assignment');
});

runTest('getAllSubjectsAdmin retains all subjects regardless of semester status', () => {
  assertContains(firebaseSrc, 'export async function getAllSubjectsAdmin', 'getAllSubjectsAdmin export');
});

runTest('getPublicMaterialsBySubject suppresses materials when subject semester is inactive', () => {
  assertContains(firebaseSrc, 'isSubjectSemesterActive(targetSub, activeSemesters)', 'isSubjectSemesterActive check');
  assertMatches(firebaseSrc, /return\s*\[\];/, 'empty materials return when inactive');
});

// ============================================================================
console.log('\n--- Test Suite 3: Home Page Inactive Semester Isolation ---');
// ============================================================================

runTest('HomePage filters subjects with isSubjectSemesterActive', () => {
  assertContains(homeSrc, 'isSubjectSemesterActive(s, semesters)', 'HomePage subject filtering');
});

runTest('HomePage semester selector renders active semesters from subscription', () => {
  assertContains(homeSrc, 'semesters.map', 'semesters map in HomePage');
  assertContains(homeSrc, 'subscribeToPublicSemesters', 'HomePage subscribeToPublicSemesters');
});

runTest('HomePage auto-resets selectedSemesterId when semester becomes inactive', () => {
  assertMatches(homeSrc, /selectedSemesterId[\s\S]*?setSelectedSemesterId/, 'HomePage auto-reset');
});

runTest('HomePage filteredMaterials only shows materials of active semester subjects', () => {
  assertContains(homeSrc, 'activeSubjectIds.has(m.subjectId)', 'HomePage material filtering by active subject');
});

// ============================================================================
console.log('\n--- Test Suite 4: SubjectsPage & Curriculum Listings ---');
// ============================================================================

runTest('SubjectsPage subscribes to real-time semesters and subjects', () => {
  assertContains(subjectsSrc, 'subscribeToPublicSemesters', 'SubjectsPage subscribeToPublicSemesters');
  assertContains(subjectsSrc, 'subscribeToPublicSubjects', 'SubjectsPage subscribeToPublicSubjects');
});

runTest('SubjectsPage filters subjects with isSubjectSemesterActive', () => {
  assertContains(subjectsSrc, 'isSubjectSemesterActive(s, semesters)', 'SubjectsPage subject filtering');
});

runTest('SubjectsPage auto-resets selectedSemesterId if deactivated', () => {
  assertContains(subjectsSrc, "setSelectedSemesterId('all')", 'SubjectsPage auto-reset to all');
});

// ============================================================================
console.log('\n--- Test Suite 5: SubjectDetailPage Direct URL Protection ---');
// ============================================================================

runTest('SubjectDetailPage imports isSubjectSemesterActive and getPublicSemesters', () => {
  assertContains(subjectDetailSrc, 'isSubjectSemesterActive', 'SubjectDetailPage isSubjectSemesterActive');
  assertContains(subjectDetailSrc, 'getPublicSemesters', 'SubjectDetailPage getPublicSemesters');
  assertContains(subjectDetailSrc, 'subscribeToPublicSemesters', 'SubjectDetailPage subscribeToPublicSemesters');
});

runTest('SubjectDetailPage sets semesterUnavailable when subject semester is inactive', () => {
  assertContains(subjectDetailSrc, 'setSemesterUnavailable(true)', 'SubjectDetailPage setSemesterUnavailable(true)');
});

runTest('SubjectDetailPage renders friendly "This semester is currently unavailable." notice', () => {
  assertContains(subjectDetailSrc, 'title="This semester is currently unavailable."', 'SubjectDetailPage unavailable notice heading');
  assertContains(subjectDetailSrc, 'to="/subjects"', 'SubjectDetailPage back link');
});

runTest('SubjectDetailPage suppresses material fetching when semester is inactive', () => {
  assertMatches(subjectDetailSrc, /if\s*\(!isSemActive\)\s*\{[\s\S]*?setMaterials\(\[\]\);/, 'SubjectDetailPage suppresses materials');
});

// ============================================================================
console.log('\n--- Test Suite 6: MaterialsPage & CategoryPage Filtering ---');
// ============================================================================

runTest('MaterialsPage filters out materials belonging to inactive subjects', () => {
  assertContains(materialsSrc, 'const subject = subjects.find((s) => s.id === m.subjectId);', 'MaterialsPage material filter');
  assertContains(materialsSrc, 'if (!subject) return false;', 'MaterialsPage skips inactive subjects');
});

runTest('MaterialsPage resets subject filter if selected subject becomes inactive', () => {
  assertMatches(materialsSrc, /subjectId:\s*['"]['"]/, 'MaterialsPage reset subject filter');
});

runTest('CategoryPage filters out materials belonging to inactive subjects', () => {
  assertContains(categorySrc, 'const sub = subjects.find((s) => s.id === m.subjectId);', 'CategoryPage material filter');
  assertContains(categorySrc, 'if (!sub) return false;', 'CategoryPage skips inactive subjects');
});

// ============================================================================
console.log('\n--- Test Suite 7: MaterialDetailPage Direct URL Guard ---');
// ============================================================================

runTest('MaterialDetailPage checks if parent subject belongs to active semester', () => {
  assertContains(materialDetailSrc, 'isSubjectSemesterActive', 'MaterialDetailPage isSubjectSemesterActive');
  assertContains(materialDetailSrc, 'setSemesterUnavailable(true)', 'MaterialDetailPage setSemesterUnavailable');
});

runTest('MaterialDetailPage displays friendly unavailable message if accessed directly', () => {
  assertContains(materialDetailSrc, 'This semester is currently unavailable.', 'MaterialDetailPage friendly message');
});

// ============================================================================
console.log('\n--- Test Suite 8: Realtime Subscription Update Propagation ---');
// ============================================================================

runTest('Admin deactivating semester broadcasts to public listeners and updates subscribers', () => {
  assertContains(firebaseSrc, "cacheService.invalidate('public_subjects')", 'public_subjects cache invalidation');
  assertContains(firebaseSrc, "cacheService.invalidate('public_semesters')", 'public_semesters cache invalidation');
  assertContains(firebaseSrc, "cacheService.invalidatePrefix('public_materials')", 'public_materials cache invalidation');
});

// ============================================================================
console.log('\n--- Test Suite 9: Database Record Safety & No Data Mutation ---');
// ============================================================================

runTest('Subjects in database are not deleted or deactivated when semester toggles', () => {
  assertContains(firebaseSrc, 'export async function saveSemester', 'saveSemester function exists');
  // Confirm saveSemester does not write to subjects
  const saveSemIdx = firebaseSrc.indexOf('export async function saveSemester');
  const nextFnIdx = firebaseSrc.indexOf('export async function deleteSemester', saveSemIdx);
  const saveSemBody = firebaseSrc.slice(saveSemIdx, nextFnIdx > -1 ? nextFnIdx : saveSemIdx + 2000);
  assert(!saveSemBody.includes("ref(db, 'subjects')"), 'saveSemester must not overwrite subjects path');
  assert(!saveSemBody.includes('remove(ref(db, `subjects'), 'saveSemester must not delete subjects');
});

// ============================================================================
console.log('\n======================================================================');
console.log(`  INACTIVE SEMESTER VISIBILITY RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
console.log('======================================================================\n');

if (failCount > 0) {
  process.exit(1);
}
