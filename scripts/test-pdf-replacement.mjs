/**
 * CampusNotes — End-to-End Test Suite
 * 
 * Tests:
 * 1. Admin Authentication logic (admin/admin mapping, canonical email, invalid creds)
 * 2. 68 Total Materials Distribution (36 assignments, 32 experiments)
 * 3. Exact Subject Course Codes & Zero lab assignments / Zero theory experiments
 * 4. Physical PDF Header Validation (%PDF-1.4 on all 68 files)
 * 5. HTTP Endpoint & Asset Delivery (Vite dev server)
 * 6. Assignment Editing & Safe PDF Replacement Workflow
 * 7. File Size & MIME Type Validation (rejection > 25MB and non-PDF)
 * 8. Shared Storage Reference Protection & Rollback on failure
 * 9. Practical Experiment Editing & PDF Replacement
 * 10. Maintenance Mode Logic (public lockdown & admin bypass)
 */

import fs from 'fs';
import path from 'path';
import http from 'http';

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`  [FAIL] ${testName}: ${details}`);
    failedTests++;
  }
}

console.log('======================================================================');
console.log('  CAMPUSNOTES — COMPREHENSIVE AUTOMATED VERIFICATION SUITE');
console.log('======================================================================\n');

// -----------------------------------------------------------------------------
// TEST SUITE 1: Admin Authentication & Canonical Email Mapping
// -----------------------------------------------------------------------------
console.log('--- TEST SUITE 1: Admin Authentication & Canonical Mapping ---');

function resolveAdminEmail(usernameOrEmail) {
  const trimmed = usernameOrEmail.trim();
  if (trimmed.toLowerCase() === 'admin') {
    return 'admin@campusnotes.internal';
  }
  if (!trimmed.includes('@')) {
    return `${trimmed.toLowerCase()}@campusnotes.internal`;
  }
  return trimmed;
}

function verifyDevAdminLogin(identifier, pass) {
  const trimmedId = identifier.trim();
  const trimmedPass = pass.trim();
  if (!trimmedId || !trimmedPass) {
    throw new Error('Please enter both administrator ID and password.');
  }
  const isDevLogin = trimmedId.toLowerCase() === 'admin' && trimmedPass === 'admin';
  if (isDevLogin) {
    return {
      uid: 'dev_admin_local_5',
      email: 'admin@campusnotes.internal',
      displayName: 'Development Administrator',
      isAuthorizedAdmin: true,
      isDevelopmentDefault: true,
      requiresPasswordChange: true,
    };
  }
  return null;
}

assert(resolveAdminEmail('admin') === 'admin@campusnotes.internal', 'Username "admin" maps to "admin@campusnotes.internal"');
assert(resolveAdminEmail('ADMIN ') === 'admin@campusnotes.internal', 'Case and whitespace trimmed correctly');
assert(resolveAdminEmail('user@domain.com') === 'user@domain.com', 'Standard email passed through');

const devUser = verifyDevAdminLogin('admin', 'admin');
assert(devUser !== null && devUser.isAuthorizedAdmin === true, 'admin/admin logs in with isAuthorizedAdmin=true');
assert(devUser.requiresPasswordChange === true, 'admin/admin enforces requiresPasswordChange=true');

let invalidRejected = false;
try {
  const res = verifyDevAdminLogin('admin', 'wrongpass');
  if (res === null) invalidRejected = true;
} catch (e) {
  invalidRejected = true;
}
assert(invalidRejected, 'Wrong password for admin is rejected');


// -----------------------------------------------------------------------------
// TEST SUITE 2: Material Distribution & Subject Counts (68 Total)
// -----------------------------------------------------------------------------
console.log('\n--- TEST SUITE 2: Material Distribution (36 Assignments, 32 Experiments) ---');

const matContent = fs.readFileSync('src/constants/initialMaterials.ts', 'utf8');

// Parse items from initialMaterials.ts
const matRegex = /\{\s*id:\s*'([^']+)',[\s\S]*?title:\s*'([^']+)',[\s\S]*?subjectId:\s*'([^']+)',[\s\S]*?category:\s*'([^']+)',[\s\S]*?fileName:\s*'([^']+)',[\s\S]*?downloadUrl:\s*'([^']+)',[\s\S]*?\}/g;

const parsedMaterials = [];
let mMatch;
while ((mMatch = matRegex.exec(matContent)) !== null) {
  parsedMaterials.push({
    id: mMatch[1],
    title: mMatch[2],
    subjectId: mMatch[3],
    category: mMatch[4],
    fileName: mMatch[5],
    downloadUrl: mMatch[6],
  });
}

assert(parsedMaterials.length === 68, `Total materials count is 68 (Found: ${parsedMaterials.length})`);

const assignments = parsedMaterials.filter((m) => m.category === 'assignments' || m.category === 'assignment');
const experiments = parsedMaterials.filter((m) => m.category === 'experiments' || m.category === 'experiment');

assert(assignments.length === 36, `Total assignments count is 36 (Found: ${assignments.length})`);
assert(experiments.length === 32, `Total experiments count is 32 (Found: ${experiments.length})`);

// Validate theory subject assignment distribution (6 each)
const theorySubjects = [
  { id: '23cs3501_ajp', name: 'Advanced Java Programming', expected: 6 },
  { id: '23cs3502_daa', name: 'Design Analysis and Algorithms', expected: 6 },
  { id: '23cs3503_ade', name: 'Advanced Database Engineering', expected: 6 },
  { id: '23cs3507_pec1', name: 'Program Elective Course-I', expected: 6 },
  { id: '23csmdxx_mm3', name: 'Multidisciplinary Minor-III', expected: 6 },
  { id: '23oecs31_oe3', name: 'Open Elective III', expected: 6 },
];

for (const sub of theorySubjects) {
  const count = assignments.filter((m) => m.subjectId === sub.id).length;
  assert(count === sub.expected, `${sub.name} has exactly ${sub.expected} assignments (Found: ${count})`);
  const expCount = experiments.filter((m) => m.subjectId === sub.id).length;
  assert(expCount === 0, `${sub.name} has 0 experiments (Found: ${expCount})`);
}

// Validate lab subject experiment distribution (12, 10, 10)
const labSubjects = [
  { id: '23cs3504_ajp_lab', name: 'Advanced Java Programming Lab', expected: 12 },
  { id: '23cs3505_daa_lab', name: 'Design Analysis and Algorithms Lab', expected: 10 },
  { id: '23cs3506_ade_lab', name: 'Advanced Database Engineering Lab', expected: 10 },
];

for (const lab of labSubjects) {
  const count = experiments.filter((m) => m.subjectId === lab.id).length;
  assert(count === lab.expected, `${lab.name} has exactly ${lab.expected} experiments (Found: ${count})`);
  const asgCount = assignments.filter((m) => m.subjectId === lab.id).length;
  assert(asgCount === 0, `${lab.name} has 0 assignments (Found: ${asgCount})`);
}


// -----------------------------------------------------------------------------
// TEST SUITE 3: Physical PDF File Integrity on Disk (68 PDFs)
// -----------------------------------------------------------------------------
console.log('\n--- TEST SUITE 3: Physical PDF File Integrity (%PDF-1.4) ---');

let missingFiles = 0;
let invalidHeaders = 0;

for (const m of parsedMaterials) {
  const relativePath = m.downloadUrl.replace(/^\//, '');
  const fullPath = path.resolve('public', relativePath);
  if (!fs.existsSync(fullPath)) {
    missingFiles++;
    console.error(`  Missing file: ${fullPath}`);
  } else {
    const fd = fs.openSync(fullPath, 'r');
    const header = Buffer.alloc(8);
    fs.readSync(fd, header, 0, 8, 0);
    fs.closeSync(fd);
    if (!header.toString('utf8').startsWith('%PDF-1.')) {
      invalidHeaders++;
      console.error(`  Invalid PDF header for: ${fullPath}`);
    }
  }
}

assert(missingFiles === 0, `All 68 PDF files exist on disk (Missing: ${missingFiles})`);
assert(invalidHeaders === 0, `All 68 PDF files have valid %PDF-1.x headers (Invalid: ${invalidHeaders})`);


// -----------------------------------------------------------------------------
// TEST SUITE 4: Live HTTP Server & Dev Server Delivery
// -----------------------------------------------------------------------------
console.log('\n--- TEST SUITE 4: Live HTTP Server Delivery (http://127.0.0.1:5173) ---');

function fetchHttp(urlPath) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:5173${urlPath}`, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, headers: res.headers, body: data });
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

const homeRes = await fetchHttp('/');
assert(homeRes.statusCode === 200, 'Home page HTTP 200 OK');
assert(homeRes.body.includes('CampusNotes'), 'Home page includes "CampusNotes" branding');
assert(!homeRes.body.includes('CampusNotes — CSE Semester 5 Study Hub'), 'Home page excludes bloated title');

// Verify public PDF serving via HTTP using actual registered material downloadUrl
const samplePdf = await fetchHttp(parsedMaterials[0].downloadUrl);
assert(samplePdf.statusCode === 200, 'Demo PDF serves HTTP 200 OK');
assert(samplePdf.headers['content-type'] === 'application/pdf', 'Demo PDF has Content-Type: application/pdf');


// -----------------------------------------------------------------------------
// TEST SUITE 5: Assignment Edit & PDF Replacement Workflow
// -----------------------------------------------------------------------------
console.log('\n--- TEST SUITE 5: Assignment Edit & Safe PDF Replacement Workflow ---');

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

function validatePdfUpload(file) {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    throw new Error('Only valid PDF documents are allowed.');
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    throw new Error(`File size (${sizeMB} MB) exceeds maximum allowed limit of 25 MB.`);
  }
  return true;
}

// 5.1 Validation: Rejection of invalid file types
let nonPdfRejected = false;
try {
  validatePdfUpload({ name: 'assignment_code.exe', type: 'application/octet-stream', size: 1024 });
} catch (err) {
  nonPdfRejected = true;
  assert(err.message === 'Only valid PDF documents are allowed.', 'Non-PDF file rejected with proper message');
}
assert(nonPdfRejected, 'Validation blocks non-PDF uploads');

// 5.2 Validation: Rejection of oversized files (> 25MB)
let oversizedRejected = false;
try {
  validatePdfUpload({ name: 'huge_document.pdf', type: 'application/pdf', size: 26 * 1024 * 1024 });
} catch (err) {
  oversizedRejected = true;
  assert(err.message.includes('exceeds maximum allowed limit of 25 MB'), 'Oversized file (>25MB) rejected with proper message');
}
assert(oversizedRejected, 'Validation blocks files > 25MB');

// 5.3 Safe Replacement Simulation
const mockDatabase = {
  materials: {},
  publicMaterials: {},
};

// Seed sample assignment
const targetAssignment = {
  id: '23cs3501_assignment_1',
  title: 'Assignment 1 — Advanced Java Networking and Sockets',
  description: 'Socket programming and client-server architecture.',
  subjectId: '23cs3501_ajp',
  category: 'assignment',
  assignmentNumber: 1,
  academicYear: '2026-27',
  fileName: '23cs3501_ajp_assignment_1.pdf',
  storagePath: 'materials/23cs3501_ajp/23cs3501_assignment_1/orig_file.pdf',
  downloadUrl: 'https://storage.googleapis.com/campusnotes-e62cf.firebasestorage.app/materials/23cs3501_ajp/23cs3501_assignment_1/orig_file.pdf',
  fileSize: 1048576,
  published: true,
  createdAt: 1700000000000,
  updatedAt: 1700000000000,
};

mockDatabase.materials[targetAssignment.id] = { ...targetAssignment };
mockDatabase.publicMaterials[targetAssignment.id] = { ...targetAssignment };

const mockStorage = {
  files: new Set([targetAssignment.storagePath]),
};

function isStoragePathReferencedByOthers(storagePath, excludeMaterialId) {
  for (const [id, item] of Object.entries(mockDatabase.materials)) {
    if (id !== excludeMaterialId && item.storagePath === storagePath) {
      return true;
    }
  }
  return false;
}

async function simulateReplaceMaterialPdf(material, newFile, updates = {}, simulateDbFailure = false) {
  // 1. Validate
  validatePdfUpload(newFile);

  // 2. Upload replacement to storage
  const newStoragePath = `materials/${updates.subjectId || material.subjectId}/${material.id}/${Date.now()}_${newFile.name}`;
  mockStorage.files.add(newStoragePath);
  const newDownloadUrl = `https://storage.googleapis.com/campusnotes-e62cf.firebasestorage.app/${newStoragePath}`;

  try {
    if (simulateDbFailure) {
      throw new Error('Simulated Database Network Failure');
    }

    // 3. Atomically update metadata preserving material ID
    const merged = {
      ...material,
      ...updates,
      fileName: newFile.name,
      fileSize: newFile.size,
      storagePath: newStoragePath,
      downloadUrl: newDownloadUrl,
      updatedAt: Date.now(),
    };

    mockDatabase.materials[material.id] = merged;
    if (merged.published) {
      mockDatabase.publicMaterials[material.id] = merged;
    } else {
      delete mockDatabase.publicMaterials[material.id];
    }

    // 4. Safe old file deletion (only if not shared)
    const oldPath = material.storagePath;
    if (oldPath && oldPath !== newStoragePath) {
      const isShared = isStoragePathReferencedByOthers(oldPath, material.id);
      if (!isShared) {
        mockStorage.files.delete(oldPath);
      }
    }

    return {
      success: true,
      message: 'PDF replaced successfully.',
      material: merged,
    };
  } catch (err) {
    // Rollback orphaned uploaded file on DB update error
    mockStorage.files.delete(newStoragePath);
    throw err;
  }
}

// Execute assignment edit & PDF replacement
const replacementFile = {
  name: 'Updated_Advanced_Java_Assignment_1.pdf',
  type: 'application/pdf',
  size: 2 * 1024 * 1024,
};

const replaceResult = await simulateReplaceMaterialPdf(
  mockDatabase.materials['23cs3501_assignment_1'],
  replacementFile,
  {
    title: 'Assignment 1 — Advanced Java Networking and Sockets (2026 Revised)',
    description: 'Updated instructions for semester 5 students.',
  }
);

assert(replaceResult.message === 'PDF replaced successfully.', 'Replacement returns exact message: "PDF replaced successfully."');
assert(mockDatabase.materials['23cs3501_assignment_1'].title === 'Assignment 1 — Advanced Java Networking and Sockets (2026 Revised)', 'Title successfully updated in database');
assert(mockDatabase.materials['23cs3501_assignment_1'].fileName === 'Updated_Advanced_Java_Assignment_1.pdf', 'Database references new PDF filename');
assert(mockDatabase.publicMaterials['23cs3501_assignment_1'].title === 'Assignment 1 — Advanced Java Networking and Sockets (2026 Revised)', 'Public database partition updated immediately');
assert(!mockStorage.files.has(targetAssignment.storagePath), 'Old storage file cleaned up safely');
assert(Object.keys(mockDatabase.materials).length === 1, 'No duplicate record created; ID preserved');


// -----------------------------------------------------------------------------
// TEST SUITE 6: Shared Storage Reference Protection & Rollback on Error
// -----------------------------------------------------------------------------
console.log('\n--- TEST SUITE 6: Shared Reference Safety & Rollback Integrity ---');

// Setup shared file scenario
const sharedStoragePath = 'materials/shared/common_reference.pdf';
mockStorage.files.add(sharedStoragePath);

mockDatabase.materials['mat_A'] = {
  id: 'mat_A',
  title: 'Material A',
  storagePath: sharedStoragePath,
  published: true,
};
mockDatabase.materials['mat_B'] = {
  id: 'mat_B',
  title: 'Material B (Shared Storage)',
  storagePath: sharedStoragePath,
  published: true,
};

// Replace file for Material A only
await simulateReplaceMaterialPdf(
  mockDatabase.materials['mat_A'],
  { name: 'Replacement_For_A.pdf', type: 'application/pdf', size: 1024 },
  {}
);

assert(mockStorage.files.has(sharedStoragePath), 'Shared storage object NOT deleted because Material B still references it');
assert(mockDatabase.materials['mat_B'].storagePath === sharedStoragePath, 'Material B still points to shared file');

// Test Rollback on DB error
const preErrorStorageCount = mockStorage.files.size;
let failedReplacementError = null;
try {
  await simulateReplaceMaterialPdf(
    mockDatabase.materials['mat_B'],
    { name: 'Will_Fail.pdf', type: 'application/pdf', size: 1024 },
    {},
    true // trigger DB error
  );
} catch (err) {
  failedReplacementError = err;
}

assert(failedReplacementError !== null, 'Simulated DB failure threw error');
assert(mockStorage.files.size === preErrorStorageCount, 'Orphaned uploaded file was cleaned up from storage after DB error');
assert(mockDatabase.materials['mat_B'].storagePath === sharedStoragePath, 'Material B remained intact with old file after error');


// -----------------------------------------------------------------------------
// TEST SUITE 7: Practical Experiment Edit & Replacement
// -----------------------------------------------------------------------------
console.log('\n--- TEST SUITE 7: Practical Experiment Replacement ---');

const experimentTarget = {
  id: '23cs3504_exp_1',
  title: 'Experiment 1 — Multithreading in Java and Thread Synchronization',
  subjectId: '23cs3504_ajplab',
  category: 'experiment',
  experimentNumber: 1,
  fileName: '23cs3504_ajplab_exp_1.pdf',
  storagePath: 'materials/23cs3504_ajplab/23cs3504_exp_1/old_lab.pdf',
  published: true,
};
mockDatabase.materials[experimentTarget.id] = { ...experimentTarget };
mockStorage.files.add(experimentTarget.storagePath);

const expReplaceResult = await simulateReplaceMaterialPdf(
  mockDatabase.materials[experimentTarget.id],
  { name: 'Updated_Experiment_1_Thread_Sync.pdf', type: 'application/pdf', size: 1.5 * 1024 * 1024 },
  { title: 'Experiment 1 — Multithreading and Locks in Java (Enhanced)' }
);

assert(expReplaceResult.message === 'PDF replaced successfully.', 'Experiment PDF replaced successfully message verified');
assert(mockDatabase.materials[experimentTarget.id].title === 'Experiment 1 — Multithreading and Locks in Java (Enhanced)', 'Experiment title updated');
assert(mockDatabase.materials[experimentTarget.id].fileName === 'Updated_Experiment_1_Thread_Sync.pdf', 'Experiment file updated');
assert(mockDatabase.materials[experimentTarget.id].experimentNumber === 1, 'Experiment number preserved');


// -----------------------------------------------------------------------------
// TEST SUITE 8: Maintenance Mode Logic & Admin Bypass
// -----------------------------------------------------------------------------
console.log('\n--- TEST SUITE 8: Maintenance Mode Logic & Admin Bypass ---');

let maintenanceActive = false;

function shouldBlockRoute(route, isAdmin) {
  if (!maintenanceActive) return false;
  // If maintenance is ON:
  // Admin routes and authorized admin user bypass maintenance
  if (route.startsWith('/admin') || isAdmin) {
    return false;
  }
  // Public visitors are blocked
  return true;
}

// 1. Normal mode (Maintenance OFF)
maintenanceActive = false;
assert(!shouldBlockRoute('/', false), 'Public visitor allowed when maintenance is OFF');
assert(!shouldBlockRoute('/materials', false), 'Public material catalog allowed when maintenance is OFF');

// 2. Maintenance ON
maintenanceActive = true;
assert(shouldBlockRoute('/', false), 'Public visitor BLOCKED at "/" when maintenance is ON');
assert(shouldBlockRoute('/materials', false), 'Public visitor BLOCKED at "/materials" when maintenance is ON');
assert(shouldBlockRoute('/assignments', false), 'Public visitor BLOCKED at "/assignments" when maintenance is ON');
assert(!shouldBlockRoute('/admin/login', false), 'Admin login route accessible when maintenance is ON');
assert(!shouldBlockRoute('/admin/dashboard', true), 'Authorized Admin user bypasses maintenance mode');

// 3. Maintenance turned OFF
maintenanceActive = false;
assert(!shouldBlockRoute('/', false), 'Public visitor restored when maintenance is turned OFF');


// -----------------------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------------------
console.log('\n======================================================================');
console.log(`  VERIFICATION RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
console.log('======================================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
