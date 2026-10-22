/**
 * CAMPUSNOTES — Dynamic Semester & Subject Management Verification Test Suite
 *
 * Tests:
 * 1. Semester & Subject Data Models & Types
 * 2. Admin Semester Creation, Duplicate Prevention & Validation
 * 3. Subject Association, Duplicate Code Prevention & Reassignment Safety
 * 4. Safe Deletion Protocol (Blocking deletion when subjects/materials exist)
 * 5. Public Visibility Rules (Active vs Inactive semesters & subjects)
 * 6. Backward Compatibility for existing Semester 5 subjects and materials
 * 7. Firebase Security Rules for /semesters and /subjects
 * 8. Material Upload & Filter Select grouping (<optgroup>)
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

console.log('======================================================================');
console.log('  CAMPUSNOTES — DYNAMIC SEMESTER & SUBJECT MANAGEMENT TEST SUITE');
console.log('======================================================================\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    console.error(`         ${err.message.split('\n')[0]}`);
  }
}

// ----------------------------------------------------------------------------
// SUITE 1: Type Definitions & Data Model
// ----------------------------------------------------------------------------
console.log('--- Test Suite 1: Types & Data Model ---');

runTest('Semester interface is defined with id, number, name, active, timestamps', () => {
  const typesContent = fs.readFileSync(path.join(rootDir, 'src/types/index.ts'), 'utf8');
  assert.match(typesContent, /export interface Semester\s*\{/);
  assert.match(typesContent, /number:\s*number/);
  assert.match(typesContent, /name:\s*string/);
  assert.match(typesContent, /active:\s*boolean/);
});

runTest('Subject interface is extended with optional semesterId and semesterNumber', () => {
  const typesContent = fs.readFileSync(path.join(rootDir, 'src/types/index.ts'), 'utf8');
  assert.match(typesContent, /export interface Subject\s*\{/);
  assert.match(typesContent, /semesterId\?: string/);
  assert.match(typesContent, /semesterNumber\?: number/);
});

runTest('AdminActionType includes SEMESTER_CREATE, SEMESTER_UPDATE, SEMESTER_DELETE', () => {
  const adminTypes = fs.readFileSync(path.join(rootDir, 'src/types/adminFeatures.ts'), 'utf8');
  assert.match(adminTypes, /'SEMESTER_CREATE'/);
  assert.match(adminTypes, /'SEMESTER_UPDATE'/);
  assert.match(adminTypes, /'SEMESTER_DELETE'/);
});

// ----------------------------------------------------------------------------
// SUITE 2: Firebase Database Security Rules
// ----------------------------------------------------------------------------
console.log('\n--- Test Suite 2: Firebase Security Rules ---');

runTest('database.rules.json protects /semesters with admin write and public read', () => {
  const rulesContent = fs.readFileSync(path.join(rootDir, 'database.rules.json'), 'utf8');
  const rules = JSON.parse(rulesContent);
  assert.ok(rules.rules.semesters, 'semesters rule must exist in database.rules.json');
  assert.match(rules.rules.semesters['.read'], /settings.*maintenanceMode/);
  assert.match(rules.rules.semesters['.write'], /admin@campusnotes\.internal/);
  assert.deepEqual(rules.rules.semesters['.indexOn'], ['number', 'active']);
});

runTest('database.rules.json indexes /subjects on code, active, semesterId, semesterNumber', () => {
  const rulesContent = fs.readFileSync(path.join(rootDir, 'database.rules.json'), 'utf8');
  const rules = JSON.parse(rulesContent);
  assert.ok(rules.rules.subjects['.indexOn'].includes('semesterId'));
  assert.ok(rules.rules.subjects['.indexOn'].includes('semesterNumber'));
});

// ----------------------------------------------------------------------------
// SUITE 3: Firebase Service Implementation Logic
// ----------------------------------------------------------------------------
console.log('\n--- Test Suite 3: Firebase Service Semester & Subject Logic ---');

const fbServiceContent = fs.readFileSync(path.join(rootDir, 'src/services/firebaseService.ts'), 'utf8');

runTest('DEFAULT_SEMESTER_5 fallback exists with number 5 and name "Semester 5"', () => {
  assert.match(fbServiceContent, /export const DEFAULT_SEMESTER_5:\s*Semester\s*=\s*\{/);
  assert.match(fbServiceContent, /number:\s*5/);
  assert.match(fbServiceContent, /name:\s*['"]Semester 5['"]/);
});

runTest('saveSemester enforces positive number and non-empty name', () => {
  assert.match(fbServiceContent, /export async function saveSemester\(/);
  assert.match(fbServiceContent, /Semester number must be a valid positive number/);
  assert.match(fbServiceContent, /Semester display name is required/);
});

runTest('saveSemester detects duplicate semester numbers', () => {
  assert.match(fbServiceContent, /Duplicate semester numbers are not permitted/);
});

runTest('deleteSemester prevents deleting a semester if subjects are associated', () => {
  assert.match(fbServiceContent, /export async function deleteSemester\(/);
  assert.match(fbServiceContent, /Cannot delete semester: \$\{associatedSubjects\.length\} subject\(s\) are assigned to it/);
  assert.match(fbServiceContent, /Please reassign or delete these subjects first/);
});

runTest('saveSubject accepts and stores semesterId and semesterNumber', () => {
  assert.match(fbServiceContent, /export async function saveSubject\(/);
  assert.match(fbServiceContent, /const semesterId = subject\.semesterId \|\| 'sem_5'/);
  assert.match(fbServiceContent, /semesterId,/);
  assert.match(fbServiceContent, /semesterNumber,/);
});

runTest('getAllSubjectsAdmin and getPublicSubjects gracefully default unmigrated records to Semester 5', () => {
  assert.match(fbServiceContent, /semesterId: data\[id\]\.semesterId \|\| 'sem_5'/);
  assert.match(fbServiceContent, /semesterNumber: typeof data\[id\]\.semesterNumber === 'number' \? data\[id\]\.semesterNumber : 5/);
});

runTest('seedStandardCseSem5Subjects no longer purges subjects from other semesters', () => {
  assert.match(fbServiceContent, /export async function seedStandardCseSem5Subjects\(\): Promise<void>/);
  // Ensure the old purge loop with remove(ref(database, `subjects/${id}`)) is gone
  assert.doesNotMatch(fbServiceContent, /for\s*\(const\s*\[id,\s*sub\]\s*of\s*Object\.entries\(existingData.*\)\)\s*\{\s*const\s*isExcluded/);
});

// ----------------------------------------------------------------------------
// SUITE 4: Admin SubjectManager Component Integration
// ----------------------------------------------------------------------------
console.log('\n--- Test Suite 4: Admin SubjectManager Component Integration ---');

const subjectManagerContent = fs.readFileSync(path.join(rootDir, 'src/components/admin/SubjectManager.tsx'), 'utf8');

runTest('SubjectManager provides Semester Management controls (Add, Edit, Toggle, Delete)', () => {
  assert.match(subjectManagerContent, /handleOpenAddSemester/);
  assert.match(subjectManagerContent, /handleOpenEditSemester/);
  assert.match(subjectManagerContent, /handleToggleSemesterActive/);
  assert.match(subjectManagerContent, /handleDeleteSemester/);
});

runTest('SubjectManager provides semester filter chips/pills for easy switching', () => {
  assert.match(subjectManagerContent, /selectedSemesterId === 'all'/);
  assert.match(subjectManagerContent, /setSelectedSemesterId\(sem\.id\)/);
  assert.match(subjectManagerContent, /subjectCountsBySemester/);
});

runTest('SubjectManager provides subject creation with semester dropdown selector', () => {
  assert.match(subjectManagerContent, /handleOpenAddSubject/);
  assert.match(subjectManagerContent, /Semester Assignment \*/);
  assert.match(subjectManagerContent, /activeSemestersList\.map/);
});

runTest('SubjectManager edit modal allows reassigning subject to another semester', () => {
  assert.match(subjectManagerContent, /handleOpenEditSubject/);
  assert.match(subjectManagerContent, /title=\{editingSubject \? `Edit Subject \(\$\{editingSubject\.code\}\)`/);
  assert.match(subjectManagerContent, /setSubjectFormData\(\{\s*\.\.\.subjectFormData,\s*semesterId:\s*e\.target\.value\s*\}\)/);
});

runTest('SubjectManager validates against duplicate course codes within the same semester', () => {
  assert.match(subjectManagerContent, /Duplicate Course Code/);
  assert.match(subjectManagerContent, /already exists in \$\{targetSem\?\.name/);
});

runTest('SubjectManager blocks deletion of semester if it contains subjects with helpful error message', () => {
  assert.match(subjectManagerContent, /Cannot Delete Semester/);
  assert.match(subjectManagerContent, /contains \$\{assignedCount\} subject\(s\)\. Please reassign or delete these subjects first\./);
});

// ----------------------------------------------------------------------------
// SUITE 5: Public Pages & Modal Dynamic Integration
// ----------------------------------------------------------------------------
console.log('\n--- Test Suite 5: Public Pages & Form Dropdowns ---');

const subjectsPageContent = fs.readFileSync(path.join(rootDir, 'src/pages/SubjectsPage.tsx'), 'utf8');
const homePageContent = fs.readFileSync(path.join(rootDir, 'src/pages/HomePage.tsx'), 'utf8');
const subjectDetailContent = fs.readFileSync(path.join(rootDir, 'src/pages/SubjectDetailPage.tsx'), 'utf8');
const materialFormModalContent = fs.readFileSync(path.join(rootDir, 'src/components/admin/MaterialFormModal.tsx'), 'utf8');
const materialFilterContent = fs.readFileSync(path.join(rootDir, 'src/components/materials/MaterialFilter.tsx'), 'utf8');

runTest('SubjectsPage dynamically displays semester tabs when multiple semesters exist', () => {
  assert.match(subjectsPageContent, /semesters\.length > 1/);
  assert.match(subjectsPageContent, /setSelectedSemesterId\(isSelected \? 'all' : sem\.id\)/);
  assert.match(subjectsPageContent, /getPublicSemesters/);
});

runTest('HomePage dynamically displays semester badge on subject cards', () => {
  assert.match(homePageContent, /Semester \{sub\.semesterNumber \?\? 5\}/);
});

runTest('SubjectDetailPage header dynamically displays current semester number', () => {
  assert.match(subjectDetailContent, /Semester \{subject\?\.semesterNumber \?\? 5\}/);
});

runTest('MaterialFormModal groups subjects by semester in <optgroup> dropdown', () => {
  assert.match(materialFormModalContent, /groupedSubjects/);
  assert.match(materialFormModalContent, /<optgroup key=\{group\.semesterName\} label=\{group\.semesterName\}>/);
});

runTest('MaterialFilter groups subjects by semester in <optgroup> dropdown', () => {
  assert.match(materialFilterContent, /groupedSubjects/);
  assert.match(materialFilterContent, /<optgroup key=\{group\.semesterName\} label=\{group\.semesterName\}>/);
});

// ----------------------------------------------------------------------------
// SUITE 6: Authorization & PERMISSION_DENIED Resilience
// ----------------------------------------------------------------------------
console.log('\n--- Test Suite 6: Admin Authorization & PERMISSION_DENIED Resilience ---');

const authServiceContent = fs.readFileSync(path.join(rootDir, 'src/services/authService.ts'), 'utf8');

runTest('authService defines AUTHORIZED_ADMIN_EMAILS including canonical and developer accounts', () => {
  assert.match(authServiceContent, /export const AUTHORIZED_ADMIN_EMAILS/);
  assert.match(authServiceContent, /'admin@campusnotes\.internal'/);
  assert.match(authServiceContent, /'ayanmulani4867@gmail\.com'/);
  assert.match(authServiceContent, /'ayanmull8886@gmail\.com'/);
});

runTest('verifyAdminAuthorization recognizes canonical and developer administrator accounts', () => {
  assert.match(authServiceContent, /AUTHORIZED_ADMIN_EMAILS\.includes\(user\.email\.toLowerCase\(\)\)/);
});

runTest('firebaseService implements isUserAuthorizedAdmin check before semester mutations', () => {
  assert.match(fbServiceContent, /export function isUserAuthorizedAdmin\(\): boolean/);
  assert.match(fbServiceContent, /if \(!isUserAuthorizedAdmin\(\)\) \{\s*throw new Error\(['"]Unauthorized: Administrator privilege required to modify semesters\./);
  assert.match(fbServiceContent, /if \(!isUserAuthorizedAdmin\(\)\) \{\s*throw new Error\(['"]Unauthorized: Administrator privilege required to delete semesters\./);
});

runTest('saveSemester gracefully handles cloud PERMISSION_DENIED by persisting locally', () => {
  assert.match(fbServiceContent, /msg\.includes\('PERMISSION_DENIED'\) \|\| msg\.includes\('Permission denied'\)/);
  assert.match(fbServiceContent, /saveLocalSemester\(savedSemester\)/);
  assert.match(fbServiceContent, /return \{ cloudSynced, localOnly: !cloudSynced \}/);
});

runTest('SubjectManager displays clear diagnostics when PERMISSION_DENIED occurs', () => {
  assert.match(subjectManagerContent, /Please ensure database\.rules\.json is published in Firebase Console -> Realtime Database -> Rules\./);
  assert.match(subjectManagerContent, /saved locally\. To enable multi-device cloud synchronization/);
});

runTest('database.rules.json protects /semesters and requires authenticated admin write', () => {
  const rules = JSON.parse(fs.readFileSync(path.join(rootDir, 'database.rules.json'), 'utf8'));
  assert.ok(rules.rules.semesters, 'semesters rule must exist');
  assert.match(rules.rules.semesters['.write'], /auth != null/);
  assert.match(rules.rules.semesters['.write'], /admin@campusnotes\.internal/);
  assert.match(rules.rules.semesters['.write'], /ayanmulani4867@gmail\.com/);
  assert.match(rules.rules.semesters['.write'], /xCyTNtjZdHPW7a51dlNGjBK3aAk1/);
});

// ----------------------------------------------------------------------------
// SUMMARY
// ----------------------------------------------------------------------------
console.log('\n======================================================================');
console.log(`  DYNAMIC SEMESTERS & SUBJECTS RESULTS: ${passedTests} PASSED, ${totalTests - passedTests} FAILED`);
console.log('======================================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
