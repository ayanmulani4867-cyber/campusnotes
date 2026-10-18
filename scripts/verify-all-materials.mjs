import fs from 'fs';
import path from 'path';

// Read and parse initialMaterials.ts
const content = fs.readFileSync('src/constants/initialMaterials.ts', 'utf8');

// Simple regex parser for INITIAL_DEMO_MATERIALS objects
const materialRegex = /\{\s*id:\s*'([^']+)',[\s\S]*?title:\s*'([^']+)',[\s\S]*?subjectId:\s*'([^']+)',[\s\S]*?category:\s*'([^']+)',[\s\S]*?fileName:\s*'([^']+)',[\s\S]*?downloadUrl:\s*'([^']+)',[\s\S]*?\}/g;

const materials = [];
let match;
while ((match = materialRegex.exec(content)) !== null) {
  materials.push({
    id: match[1],
    title: match[2],
    subjectId: match[3],
    category: match[4],
    fileName: match[5],
    downloadUrl: match[6],
  });
}

console.log('====================================================');
console.log('   CAMPUSNOTES MATERIAL DISTRIBUTION VERIFICATION   ');
console.log('====================================================');

console.log(`\nTotal Materials parsed from catalog: ${materials.length}`);

// Target subjects:
const expectedDistribution = {
  '23cs3501_ajp': { code: '23CS3501', name: 'Advanced Java Programming', assignments: 6, experiments: 0 },
  '23cs3502_daa': { code: '23CS3502', name: 'Design Analysis and Algorithms', assignments: 6, experiments: 0 },
  '23cs3503_ade': { code: '23CS3503', name: 'Advanced Database Engineering', assignments: 6, experiments: 0 },
  '23cs3504_ajp_lab': { code: '23CS3504', name: 'Advanced Java Programming Laboratory', assignments: 0, experiments: 12 },
  '23cs3505_daa_lab': { code: '23CS3505', name: 'Design Analysis and Algorithms Laboratory', assignments: 0, experiments: 10 },
  '23cs3506_ade_lab': { code: '23CS3506', name: 'Advanced Database Engineering Laboratory', assignments: 0, experiments: 10 },
  '23cs3507_pec1': { code: '23CS3507', name: 'Program Elective Course-I', assignments: 6, experiments: 0 },
  '23csmdxx_mm3': { code: '23CSMDXX', name: 'Multidisciplinary Minor-III', assignments: 6, experiments: 0 },
  '23oecs31_oe3': { code: '23OECS31', name: 'Open Elective III', assignments: 6, experiments: 0 },
};

let errors = 0;

let totalAssignments = 0;
let totalExperiments = 0;

console.log('\nSubject-by-Subject Breakdown:');
console.log('-------------------------------------------------------------------------------------------------');
console.log(
  'Course Code'.padEnd(12) +
  'Subject Name'.padEnd(46) +
  'Assignments'.padEnd(16) +
  'Experiments'.padEnd(16) +
  'Status'
);
console.log('-------------------------------------------------------------------------------------------------');

for (const [subId, spec] of Object.entries(expectedDistribution)) {
  const subMats = materials.filter((m) => m.subjectId === subId);
  const actualAssign = subMats.filter((m) => m.category === 'assignments').length;
  const actualExp = subMats.filter((m) => m.category === 'experiments').length;

  totalAssignments += actualAssign;
  totalExperiments += actualExp;

  const matchAssign = actualAssign === spec.assignments;
  const matchExp = actualExp === spec.experiments;

  let status = 'PASSED';
  if (!matchAssign || !matchExp) {
    status = 'FAILED';
    errors++;
  }

  console.log(
    spec.code.padEnd(12) +
    spec.name.padEnd(46) +
    `${actualAssign} (exp ${spec.assignments})`.padEnd(16) +
    `${actualExp} (exp ${spec.experiments})`.padEnd(16) +
    status
  );
}
console.log('-------------------------------------------------------------------------------------------------');
console.log(
  'TOTALS'.padEnd(12) +
  ''.padEnd(46) +
  `${totalAssignments} (exp 36)`.padEnd(16) +
  `${totalExperiments} (exp 32)`.padEnd(16) +
  (totalAssignments === 36 && totalExperiments === 32 ? 'PASSED' : 'FAILED')
);

if (totalAssignments !== 36) {
  console.error(`ERROR: Expected exactly 36 assignments, found ${totalAssignments}`);
  errors++;
}
if (totalExperiments !== 32) {
  console.error(`ERROR: Expected exactly 32 experiments, found ${totalExperiments}`);
  errors++;
}
if (materials.length !== 68) {
  console.error(`ERROR: Expected exactly 68 materials, found ${materials.length}`);
  errors++;
}

// Verify PDF files on disk and valid PDF header
console.log('\nVerifying PDF Files on Disk:');
let missingPdfs = 0;
let invalidHeaders = 0;

for (const m of materials) {
  const localRelPath = m.downloadUrl.replace(/^\//, '');
  const fullPath = path.resolve(process.cwd(), 'public', localRelPath.replace(/^demo-pdfs\//, 'demo-pdfs/'));

  if (!fs.existsSync(fullPath)) {
    console.error(`Missing PDF: ${fullPath} for ${m.id}`);
    missingPdfs++;
    errors++;
  } else {
    const buffer = fs.readFileSync(fullPath);
    const header = buffer.subarray(0, 8).toString('ascii');
    if (!header.startsWith('%PDF-1.')) {
      console.error(`Invalid PDF header for ${fullPath}: ${header}`);
      invalidHeaders++;
      errors++;
    }
  }

  // Verify NO DEMO label in title (per clean redesign master prompt)
  if (m.title.toUpperCase().includes('DEMO')) {
    console.error(`Title illegally contains DEMO tag: ${m.title}`);
    errors++;
  }
}

console.log(`- Checked ${materials.length} PDF files.`);
console.log(`- Missing files: ${missingPdfs}`);
console.log(`- Invalid PDF headers: ${invalidHeaders}`);

// Verify subjects catalog exclusions
console.log('\nVerifying Catalog Safety (No Excluded Subjects):');
const subjectsContent = fs.readFileSync('src/constants/subjects.ts', 'utf8');
const excluded = ['Aptitude Skills', 'Language Skills', 'Mini Project'];
let foundExcluded = false;
for (const ex of excluded) {
  if (subjectsContent.includes(`name: '${ex}`) || subjectsContent.includes(`name: "${ex}`)) {
    console.error(`Found excluded subject in catalog: ${ex}`);
    foundExcluded = true;
    errors++;
  }
}
if (!foundExcluded) {
  console.log('PASSED: All excluded subjects (Aptitude Skills-III, Language Skills-III, Mini Project-III) are completely excluded from catalog.');
}

console.log('\n====================================================');
if (errors === 0) {
  console.log('ALL VERIFICATIONS PASSED: 36 Assignments, 32 Experiments, 68 Valid PDFs, Exact Curriculum Alignment.');
} else {
  console.log(`VERIFICATION FAILED: Found ${errors} error(s).`);
  process.exit(1);
}
console.log('====================================================\n');
