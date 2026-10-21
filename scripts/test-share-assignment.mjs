import assert from 'node:assert';
import fs from 'node:fs';

console.log('======================================================================');
console.log('  CAMPUSNOTES — SHARE ASSIGNMENT FEATURE TEST SUITE');
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
// Suite 1: Exact Message Format and Single-Link Rules
// -----------------------------------------------------------------------------
console.log('--- Test Suite 1: Exact Message Format & Single-Link Integrity ---');

import {
  formatAssignmentShareMessage,
  normalizeAssignmentNumber,
  getWhatsAppShareUrl,
  ASSIGNMENT_SHARE_URL,
} from '../src/utils/assignmentShareUtils.ts';

test('Uses strictly https://campusnotes.space as the single website link', () => {
  assert.strictEqual(ASSIGNMENT_SHARE_URL, 'https://campusnotes.space');
  assert(!ASSIGNMENT_SHARE_URL.includes('www.'), 'Must not use www.campusnotes.space');
});

test('Generates short WhatsApp-ready message in exact 3-line format', () => {
  const subject = 'Design and Analysis of Algorithms';
  const assignmentNum = '1';

  const message = formatAssignmentShareMessage(subject, assignmentNum);
  const expected = `Subject: Design and Analysis of Algorithms\nAssignment No.: 1\nhttps://campusnotes.space`;

  assert.strictEqual(message, expected);

  const lines = message.split('\n');
  assert.strictEqual(lines.length, 3, 'Message must have exactly 3 lines');
  assert.strictEqual(lines[0], 'Subject: Design and Analysis of Algorithms');
  assert.strictEqual(lines[1], 'Assignment No.: 1');
  assert.strictEqual(lines[2], 'https://campusnotes.space');
});

test('Normalizes assignment numbers cleanly without repetitive prefixes', () => {
  assert.strictEqual(normalizeAssignmentNumber('1'), '1');
  assert.strictEqual(normalizeAssignmentNumber('Assignment 2'), '2');
  assert.strictEqual(normalizeAssignmentNumber('assignment 3'), '3');
  assert.strictEqual(normalizeAssignmentNumber('No. 4'), '4');
  assert.strictEqual(normalizeAssignmentNumber('Assignment No. 5'), '5');
});

test('Never contains extra links, www, or tracking parameters', () => {
  const message = formatAssignmentShareMessage('Core Java', '3');
  assert(!message.includes('www.campusnotes.space'), 'Must not contain www link');
  assert(!message.includes('utm_'), 'Must not contain marketing trackers');
  assert(!message.includes('render.com'), 'Must not contain staging render links');
  assert.strictEqual((message.match(/https?:\/\//g) || []).length, 1, 'Must contain exactly 1 URL');
});

// -----------------------------------------------------------------------------
// Suite 2: WhatsApp Share URL Generation
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 2: WhatsApp URL Encoding & Prefill ---');

test('Generates valid WhatsApp API URL with encoded message parameter', () => {
  const message = formatAssignmentShareMessage('Database Management Systems', '2');
  const url = getWhatsAppShareUrl(message);

  assert(url.startsWith('https://api.whatsapp.com/send?text='), 'Must target WhatsApp API');
  const encodedPart = url.replace('https://api.whatsapp.com/send?text=', '');
  const decoded = decodeURIComponent(encodedPart);

  assert.strictEqual(decoded, message);
  assert(decoded.includes('Subject: Database Management Systems'));
  assert(decoded.includes('Assignment No.: 2'));
  assert(decoded.includes('https://campusnotes.space'));
});

// -----------------------------------------------------------------------------
// Suite 3: UI Component Architecture & Verification
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 3: UI Components & Button Actions ---');

const cardCode = fs.readFileSync('src/components/materials/ShareAssignmentCard.tsx', 'utf8');

test('ShareAssignmentCard has Subject Name input with label', () => {
  assert(cardCode.includes('Subject Name'), 'Missing Subject Name label');
  assert(cardCode.includes('subjectName'), 'Missing subjectName state');
});

test('ShareAssignmentCard has Assignment Number input with label', () => {
  assert(cardCode.includes('Assignment Number'), 'Missing Assignment Number label');
  assert(cardCode.includes('assignmentNumber'), 'Missing assignmentNumber state');
});

test('ShareAssignmentCard includes Copy Message button with visual feedback', () => {
  assert(cardCode.includes('Copy Message') || cardCode.includes('Copied to Clipboard!'), 'Missing Copy Message button');
  assert(cardCode.includes('handleCopy'), 'Missing handleCopy implementation');
  assert(cardCode.includes('copyAssignmentMessage'), 'Must call copyAssignmentMessage utility');
});

test('ShareAssignmentCard includes Share on WhatsApp button', () => {
  assert(cardCode.includes('Share on WhatsApp'), 'Missing Share on WhatsApp button');
  assert(cardCode.includes('handleWhatsAppShare'), 'Missing handleWhatsAppShare implementation');
  assert(cardCode.includes('openWhatsAppShare'), 'Must call openWhatsAppShare utility');
});

test('ShareAssignmentCard has live Message Preview box', () => {
  assert(cardCode.includes('Message Preview'), 'Missing Message Preview heading');
  assert(cardCode.includes('formattedMessage'), 'Must render formatted message in preview');
});

// -----------------------------------------------------------------------------
// Suite 4: Route & Navigation Integration
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 4: Page & Route Integration ---');

const categoryPageCode = fs.readFileSync('src/pages/CategoryPage.tsx', 'utf8');
test('CategoryPage renders ShareAssignmentCard when categorySlug is assignments', () => {
  assert(categoryPageCode.includes("categorySlug === 'assignments'"), 'CategoryPage must conditionally render on assignments');
  assert(categoryPageCode.includes('<ShareAssignmentCard'), 'Missing ShareAssignmentCard in CategoryPage');
});

const appCode = fs.readFileSync('src/App.tsx', 'utf8');
test('App.tsx registers /share-assignment route', () => {
  assert(appCode.includes('path="/share-assignment"'), 'App.tsx must register /share-assignment route');
  assert(appCode.includes('ShareAssignmentPage'), 'App.tsx must import ShareAssignmentPage');
});

const navbarCode = fs.readFileSync('src/components/common/Navbar.tsx', 'utf8');
test('Navbar includes link to /share-assignment', () => {
  assert(navbarCode.includes('/share-assignment'), 'Navbar must link to /share-assignment');
});

console.log('\n======================================================================');
console.log(`  RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('======================================================================\n');

if (failed > 0) process.exit(1);
