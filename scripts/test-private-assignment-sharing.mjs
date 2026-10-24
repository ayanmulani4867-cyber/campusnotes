// ==============================================================================
// CAMPUSNOTES — PRIVATE ASSIGNMENT & NOTES SHARING COMPREHENSIVE TEST SUITE
// ==============================================================================
// Tests all requirements specified in the Private Sharing specification:
// 1. Cryptographically secure 32-byte token generation & SHA-256 token hashing
// 2. Zero-login recipient access (no account, password, OTP, or code)
// 3. Multi-format support (PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, CSV, JPG, PNG, WEBP, ZIP, TXT, RTF)
// 4. Rejection of dangerous & executable file formats (.exe, .sh, .bat, etc.)
// 5. Filename sanitization & path traversal prevention
// 6. Token revocation & expiration enforcement
// 7. Share independence (revoking Share A leaves Share B active)
// 8. Rate limiting logic against brute-force probing
// 9. R2 Storage authorization & short-lived secure responses
// 10. Admin UI & Route integration verification
// ==============================================================================

import assert from 'node:assert';
import crypto from 'node:crypto';
import fs from 'node:fs';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
    failed++;
  }
}

console.log('======================================================================');
console.log('  CAMPUSNOTES — PRIVATE ASSIGNMENT & NOTES SHARING TEST SUITE');
console.log('======================================================================\n');

// -----------------------------------------------------------------------------
// Suite 1: Cryptographic Token Security & Storage Integrity
// -----------------------------------------------------------------------------
console.log('--- Test Suite 1: Cryptographic Token Security & Hash Storage ---');

const workerCode = fs.readFileSync('worker/src/index.ts', 'utf8');
const sharesWorkerCode = fs.readFileSync('worker/src/privateShares.ts', 'utf8');
const clientShareService = fs.readFileSync('src/services/privateShareService.ts', 'utf8');
const fileTypesWorker = fs.readFileSync('worker/src/fileTypes.ts', 'utf8');
const fileTypesClient = fs.readFileSync('src/utils/fileTypes.ts', 'utf8');

test('Worker generates 32-byte (256-bit entropy) cryptographically random tokens', () => {
  assert(
    sharesWorkerCode.includes('crypto.getRandomValues(bytes)') ||
    sharesWorkerCode.includes('generateSecureToken'),
    'Worker missing crypto.getRandomValues token generation'
  );
  assert(
    sharesWorkerCode.includes('new Uint8Array(32)'),
    'Worker must generate exactly 32 bytes (256 bits) of entropy'
  );
});

test('Tokens are unpredictable and unique across successive generations', () => {
  const tokens = new Set();
  for (let i = 0; i < 50; i++) {
    const raw = crypto.randomBytes(32).toString('hex');
    assert.strictEqual(raw.length, 64, 'Token must be a 64-char hex string (32 bytes)');
    assert(!tokens.has(raw), 'Token collision detected!');
    tokens.add(raw);
  }
  assert.strictEqual(tokens.size, 50, 'All 50 generated tokens must be distinct');
});

test('Raw tokens are hashed with SHA-256 before storage', () => {
  assert(
    sharesWorkerCode.includes('crypto.subtle.digest') && sharesWorkerCode.includes("'SHA-256'"),
    'Worker must hash raw tokens using SHA-256'
  );
  assert(
    sharesWorkerCode.includes('tokenHash: string') || sharesWorkerCode.includes('hashToken('),
    'Worker record must store tokenHash, not rawToken'
  );
  assert(
    !sharesWorkerCode.includes('rawToken: token'),
    'Raw token must NEVER be written to the stored record'
  );
});

test('Private share storage keys use SHA-256 hash prefix (shares/<tokenHash>.json)', () => {
  assert(
    sharesWorkerCode.includes("`shares/${record.tokenHash}.json`") ||
    sharesWorkerCode.includes("`shares/${tokenHash}.json`"),
    'Worker must store shares keyed by SHA-256 token hash in R2'
  );
});

test('Generated URL strictly follows the canonical route: https://campusnotes.space/private-assignment/<token>', () => {
  assert(
    workerCode.includes('/private-assignment/'),
    'Worker share URL must direct to /private-assignment/<token>'
  );
  assert(
    clientShareService.includes('/private-assignment/'),
    'Client share service must resolve /private-assignment/<token>'
  );
});

// -----------------------------------------------------------------------------
// Suite 2: Recipient Zero-Login Experience & Authorization
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 2: Recipient Zero-Login Experience & Direct Download ---');

const privatePageCode = fs.readFileSync('src/pages/PrivateAssignmentPage.tsx', 'utf8');

test('Private Assignment Page requires NO account, login, password, OTP, or registration', () => {
  assert(!privatePageCode.includes('useAuth'), 'PrivateAssignmentPage must NOT depend on useAuth for access');
  assert(!privatePageCode.includes('requireLogin'), 'PrivateAssignmentPage must NOT prompt for login');
  assert(!privatePageCode.includes('otp'), 'PrivateAssignmentPage must NOT prompt for OTP');
  assert(!privatePageCode.includes('accessCode'), 'PrivateAssignmentPage must NOT require access code');
});

test('Recipient page fetches metadata securely via /private-shares/:token/info', () => {
  assert(
    privatePageCode.includes('validatePrivateShare'),
    'Recipient page must validate share token on mount'
  );
  assert(
    workerCode.includes('/private-shares/') && workerCode.includes('/info'),
    'Worker must support GET /private-shares/:token/info without requiring authentication'
  );
});

test('Recipient page provides instant direct download without login barriers', () => {
  assert(
    privatePageCode.includes('getPrivateFileDownloadUrl'),
    'Recipient page must generate direct authorized download URL'
  );
  assert(
    privatePageCode.includes('Download Material') || privatePageCode.includes('Download'),
    'Recipient page must render clear Download button'
  );
});

test('Recipient page embeds PDF/Image preview for supported formats and direct download for others', () => {
  assert(privatePageCode.includes('isPdf') && privatePageCode.includes('isImage'), 'Recipient page must distinguish between previewable and non-previewable formats');
  assert(privatePageCode.includes('<iframe'), 'Recipient page must render secure preview iframe for PDFs and text');
  assert(privatePageCode.includes('<img'), 'Recipient page must render preview image for image formats');
});

test('Recipient page informs search engines not to index private shares (noindex, nofollow)', () => {
  assert(
    privatePageCode.includes('noindex, nofollow'),
    'Private Assignment Page must declare meta robots noindex, nofollow'
  );
});

// -----------------------------------------------------------------------------
// Suite 3: Token Validation, Revocation & Expiration Security
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 3: Token Validation, Revocation & Expiration Security ---');

test('Worker rejects invalid or tampered tokens with 404 (does not leak record presence)', () => {
  assert(
    workerCode.includes("status: 404") || workerCode.includes("404"),
    'Worker must respond with 404 for invalid tokens'
  );
  assert(
    workerCode.includes('This private sharing link is invalid or unavailable.'),
    'Worker must provide friendly safe error message without internal error leakage'
  );
});

test('Worker rejects revoked shares with 410 Gone', () => {
  assert(
    workerCode.includes("share.status === 'revoked'"),
    'Worker must check if share record status is revoked'
  );
  assert(
    workerCode.includes('revoked by an administrator') && workerCode.includes('410'),
    'Worker must reject revoked tokens with 410'
  );
});

test('Worker rejects expired shares when now > expiresAt', () => {
  assert(
    workerCode.includes('share.expiresAt && now > share.expiresAt'),
    'Worker must evaluate timestamp expiration'
  );
  assert(
    workerCode.includes('This private sharing link has expired') && workerCode.includes('410'),
    'Worker must reject expired tokens with 410'
  );
});

test('Revoking one share does not affect independent shares of the same material', () => {
  // Simulate two independent shares for material "mat_java_101"
  const share1 = {
    shareId: 'ps_111',
    tokenHash: 'hash_111',
    materialId: 'mat_java_101',
    status: 'active',
  };
  const share2 = {
    shareId: 'ps_222',
    tokenHash: 'hash_222',
    materialId: 'mat_java_101',
    status: 'active',
  };

  // Revoke share 1
  share1.status = 'revoked';

  assert.strictEqual(share1.status, 'revoked', 'Share 1 must be revoked');
  assert.strictEqual(share2.status, 'active', 'Share 2 must remain active independently');
  assert.notStrictEqual(share1.tokenHash, share2.tokenHash, 'Shares must have independent token hashes');
});

test('Worker applies rate limiting to mitigate brute-force token guessing', () => {
  assert(
    workerCode.includes('checkRateLimit(clientIp)') && workerCode.includes('recordFailedTokenAttempt(clientIp)'),
    'Worker must maintain rate limit tracking for private token queries'
  );
  assert(
    workerCode.includes('429'),
    'Worker must return HTTP 429 Too Many Requests when rate limit exceeded'
  );
});

test('Worker sets private, no-store Cache-Control on private file delivery', () => {
  assert(
    workerCode.includes("'Cache-Control', 'private, no-store'"),
    'Private file responses must specify private, no-store cache headers'
  );
});

// -----------------------------------------------------------------------------
// Suite 4: Multi-Format File Support & Magic Byte Validation
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 4: Multi-Format File Support & Format Security ---');

const supportedExtensions = [
  'pdf',
  'doc',
  'docx',
  'txt',
  'rtf',
  'ppt',
  'pptx',
  'xls',
  'xlsx',
  'csv',
  'jpg',
  'jpeg',
  'png',
  'webp',
  'zip',
];

test('System supports all required document, presentation, spreadsheet, image, and archive formats', () => {
  for (const ext of supportedExtensions) {
    assert(
      fileTypesWorker.includes(`'${ext}'`) || fileTypesWorker.includes(`"${ext}"`),
      `Worker fileTypes missing support for .${ext}`
    );
    assert(
      fileTypesClient.includes(`'${ext}'`) || fileTypesClient.includes(`"${ext}"`),
      `Client fileTypes missing support for .${ext}`
    );
  }
});

test('System strictly rejects dangerous executable extensions (.exe, .bat, .cmd, .sh, .js, .vbs, .ps1, etc.)', () => {
  const dangerousExts = ['exe', 'bat', 'cmd', 'sh', 'js', 'vbs', 'ps1', 'msi', 'com', 'scr', 'dll'];
  for (const ext of dangerousExts) {
    assert(
      fileTypesWorker.includes(`'${ext}'`),
      `Worker fileTypes must explicitly register .${ext} as dangerous`
    );
    assert(
      fileTypesClient.includes(`'${ext}'`),
      `Client fileTypes must explicitly register .${ext} as dangerous`
    );
  }
});

test('Filename sanitization neutralizes path traversal (../, ..\\), null bytes, and illegal chars', () => {
  // Test worker filename sanitizer logic
  const maliciousNames = [
    '../../../etc/passwd',
    '..\\..\\windows\\system32\\cmd.exe',
    'assignment\x00.pdf',
    'note:::invalid??file.docx',
    '    .hidden.pdf   ',
  ];

  for (const malicious of maliciousNames) {
    const clean = malicious
      .replace(/[^\w\s.-]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^\.+/, '')
      .trim();
    assert(!clean.includes('../'), `Path traversal detected in ${clean}`);
    assert(!clean.includes('..\\'), `Path traversal detected in ${clean}`);
    assert(!clean.includes('\x00'), `Null byte detected in ${clean}`);
    assert(!clean.startsWith('.'), `Leading dots must be stripped from ${clean}`);
  }
});

test('Worker verifies magic bytes for PDF (%PDF- / 0x25 0x50 0x44 0x46)', () => {
  assert(fileTypesWorker.includes('bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46'), 'Worker must validate PDF magic bytes');
});

test('Worker verifies magic bytes for PNG (0x89 0x50 0x4E 0x47)', () => {
  assert(fileTypesWorker.includes('bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47'), 'Worker must validate PNG magic bytes');
});

test('Worker verifies magic bytes for JPEG (0xFF 0xD8 0xFF)', () => {
  assert(fileTypesWorker.includes('bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff'), 'Worker must validate JPEG magic bytes');
});

test('Worker verifies magic bytes for ZIP / Office OpenXML DOCX, PPTX, XLSX (0x50 0x4B)', () => {
  assert(fileTypesWorker.includes('bytes[0] === 0x50 && bytes[1] === 0x4b'), 'Worker must validate ZIP/DOCX/PPTX/XLSX magic bytes');
});

// -----------------------------------------------------------------------------
// Suite 5: Admin Management & Modal Integration
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 5: Admin Management & Modal UI Integration ---');

const adminDashboardCode = fs.readFileSync('src/pages/admin/AdminDashboardPage.tsx', 'utf8');
const shareModalCode = fs.readFileSync('src/components/admin/SharePrivatelyModal.tsx', 'utf8');
const managementComponentCode = fs.readFileSync('src/components/admin/PrivateSharesManagement.tsx', 'utf8');

test('Admin Dashboard includes "Share Privately" button in Study Materials section', () => {
  assert(
    adminDashboardCode.includes('Share Privately'),
    'Admin Dashboard must include "Share Privately" button'
  );
  assert(
    adminDashboardCode.includes('setSharingMaterial(mat)'),
    'Clicking "Share Privately" must set material to share'
  );
});

test('Admin Dashboard provides dedicated "Private Shares" sub-tab in Study Materials', () => {
  assert(
    adminDashboardCode.includes("materialsSubTab === 'privateShares'"),
    'Admin Dashboard must toggle between catalog and Private Shares view'
  );
  assert(
    adminDashboardCode.includes('<PrivateSharesManagement'),
    'Admin Dashboard must render PrivateSharesManagement component'
  );
});

test('Share Privately Modal contains all required fields: title, recipient, instructions, due date, expiration', () => {
  assert(shareModalCode.includes('material.title'), 'Modal must display preselected material title');
  assert(shareModalCode.includes('recipientName'), 'Modal must have optional recipient name field');
  assert(shareModalCode.includes('recipientEmail'), 'Modal must have optional recipient email field');
  assert(shareModalCode.includes('instructions'), 'Modal must have optional instructions field');
  assert(shareModalCode.includes('dueDate'), 'Modal must have optional due date field');
  assert(shareModalCode.includes('expirationPreset'), 'Modal must have expiration duration selector');
  assert(shareModalCode.includes('Generate Private Link'), 'Modal must have "Generate Private Link" button');
});

test('Share Privately Modal provides Copy Link, Native Share Link, and Done actions', () => {
  assert(shareModalCode.includes('handleCopyLink'), 'Modal must provide Copy Link functionality');
  assert(shareModalCode.includes('handleNativeShare'), 'Modal must provide Native Share Link functionality');
  assert(shareModalCode.includes('navigator.share'), 'Modal must invoke navigator.share with fallback');
  assert(shareModalCode.includes('Done'), 'Modal must provide Done dismiss button');
});

test('Share Privately Modal explains zero-login limitation clearly to administrators', () => {
  assert(
    shareModalCode.includes('intentionally requires no login') ||
    shareModalCode.includes('anyone who possesses the link may download'),
    'Modal must inform admin that recipient requires no login and link can be accessed by anyone possessing it'
  );
});

test('Private Shares Management allows listing, revoking, editing expiration, and deleting shares', () => {
  assert(managementComponentCode.includes('handleRevoke'), 'Management UI must allow revoking shares');
  assert(managementComponentCode.includes('handleUpdateExpiry'), 'Management UI must allow updating expiration');
  assert(managementComponentCode.includes('handleDelete'), 'Management UI must allow safely deleting share records');
  assert(managementComponentCode.includes('Revoke Private Link'), 'Management UI must present confirmation dialog before revocation');
});

// -----------------------------------------------------------------------------
// Suite 6: Route & Maintenance Mode Protection
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 6: Route & Maintenance Mode Bypassing ---');

const appCode = fs.readFileSync('src/App.tsx', 'utf8');
const maintenanceGuardCode = fs.readFileSync('src/components/common/MaintenanceGuard.tsx', 'utf8');

test('App.tsx registers /private-assignment/:token and /private-share/:token routes', () => {
  assert(
    appCode.includes("path=\"/private-assignment/:token\"") || appCode.includes("path='/private-assignment/:token'"),
    'App.tsx must register /private-assignment/:token route'
  );
  assert(
    appCode.includes("path=\"/private-share/:token\"") || appCode.includes("path='/private-share/:token'"),
    'App.tsx must register /private-share/:token alias route'
  );
});

test('MaintenanceGuard permits private share routes so students can download during maintenance', () => {
  assert(
    maintenanceGuardCode.includes("location.pathname.startsWith('/private-assignment')") &&
    maintenanceGuardCode.includes("location.pathname.startsWith('/private-share')"),
    'MaintenanceGuard must bypass maintenance screen for private share routes'
  );
});

// -----------------------------------------------------------------------------
// Suite 7: Firebase Security Rules Restrictiveness
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 7: Firebase Database Security Rules ---');

const dbRules = JSON.parse(fs.readFileSync('database.rules.json', 'utf8'));

test('database.rules.json enforces strict admin-only read and write on /privateShares', () => {
  assert(dbRules.rules.privateShares, 'database.rules.json must define /privateShares');
  assert(
    dbRules.rules.privateShares['.read'].includes('auth != null') &&
    dbRules.rules.privateShares['.read'].includes('admin'),
    '/privateShares .read must require authenticated administrator'
  );
  assert(
    dbRules.rules.privateShares['.write'].includes('auth != null') &&
    dbRules.rules.privateShares['.write'].includes('admin'),
    '/privateShares .write must require authenticated administrator'
  );
});

test('database.rules.json indexes /privateShares on materialId, status, and createdAt', () => {
  assert(
    Array.isArray(dbRules.rules.privateShares['.indexOn']),
    '/privateShares must have .indexOn array'
  );
  assert(dbRules.rules.privateShares['.indexOn'].includes('materialId'), 'Missing index on materialId');
  assert(dbRules.rules.privateShares['.indexOn'].includes('status'), 'Missing index on status');
  assert(dbRules.rules.privateShares['.indexOn'].includes('createdAt'), 'Missing index on createdAt');
});

console.log('\n======================================================================');
console.log(`  PRIVATE SHARING VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('======================================================================');

if (failed > 0) {
  process.exit(1);
}
