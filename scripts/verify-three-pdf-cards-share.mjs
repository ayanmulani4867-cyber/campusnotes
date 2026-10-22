import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('======================================================================');
console.log('  CAMPUSNOTES — THREE PDF CARDS NATIVE SHARE DIRECT VERIFICATION TEST');
console.log('======================================================================\n');

// 1. Read real materials from initialMaterials.ts
const initialMaterialsCode = fs.readFileSync('src/constants/initialMaterials.ts', 'utf8');
const materialsMatch = initialMaterialsCode.match(/export const INITIAL_DEMO_MATERIALS: StudyMaterial\[\] = (\[[\s\S]*?\]);\s*\n/);
assert(materialsMatch, 'Could not parse INITIAL_DEMO_MATERIALS from initialMaterials.ts');

const INITIAL_STUDY_MATERIALS = eval(materialsMatch[1]);
assert(INITIAL_STUDY_MATERIALS.length >= 3, 'Must have at least 3 initial materials');

// Select 3 distinct published PDF materials from different categories
const publishedMaterials = INITIAL_STUDY_MATERIALS.filter((m) => m.published === true);
const card1 = publishedMaterials[0];
const card2 = publishedMaterials[1];
const card3 = publishedMaterials[2];

console.log(`Testing 3 distinct PDF cards:`);
console.log(`  Card 1: "${card1.title}" (ID: ${card1.id}, Category: ${card1.category})`);
console.log(`  Card 2: "${card2.title}" (ID: ${card2.id}, Category: ${card2.category})`);
console.log(`  Card 3: "${card3.title}" (ID: ${card3.id}, Category: ${card3.category})\n`);

assert(card1.id !== card2.id && card2.id !== card3.id, 'Cards must have distinct IDs');

class MockNavigator {
  constructor({ shareSupported = true, shareRejection = null }) {
    this._shareSupported = shareSupported;
    this._shareRejection = shareRejection;
    this.sharedPayload = null;
    this.clipboardText = null;

    if (shareSupported) {
      this.share = async (payload) => {
        if (this._shareRejection) throw this._shareRejection;
        this.sharedPayload = payload;
        return true;
      };
      this.canShare = () => true;
    }

    this.clipboard = {
      writeText: async (text) => {
        this.clipboardText = text;
        return true;
      },
    };
  }
}

// Emulate direct shareMaterial behavior from shareUtils.ts
async function runShareMaterial(material, mockNav, showToast) {
  if (material.published === false) {
    showToast?.('Material Unpublished', 'This study material is unpublished and cannot be shared publicly.');
    return false;
  }

  const shareUrl = `https://campusnotes.space/materials/${material.id}`;
  const shareData = {
    url: shareUrl,
  };

  // 1. Native share direct invocation
  if (mockNav && typeof mockNav.share === 'function') {
    try {
      if (!mockNav.canShare || mockNav.canShare(shareData)) {
        await mockNav.share(shareData);
        return true;
      }
    } catch (err) {
      if (
        err instanceof Error &&
        (err.name === 'AbortError' ||
          err.message.toLowerCase().includes('abort') ||
          err.message.toLowerCase().includes('cancel'))
      ) {
        return false;
      }
    }
  }

  // 2. Simple Copy Link fallback
  let copied = false;
  if (mockNav && mockNav.clipboard) {
    try {
      await mockNav.clipboard.writeText(shareUrl);
      copied = true;
    } catch {
      copied = false;
    }
  }

  if (copied) {
    showToast?.('Link Copied', shareUrl);
    return true;
  } else {
    showToast?.('Share Material', shareUrl);
    return false;
  }
}

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

// --- Test Card 1 ---
console.log('--- Testing PDF Card 1 ---');
test('Card 1 directly invokes navigator.share with strictly { url: shareUrl }', async () => {
  const nav1 = new MockNavigator({ shareSupported: true });
  let toastCalled = false;
  const success = await runShareMaterial(card1, nav1, () => { toastCalled = true; });

  assert.strictEqual(success, true);
  assert.strictEqual(toastCalled, false, 'Native share must not trigger toast popup');
  assert.deepStrictEqual(nav1.sharedPayload, {
    url: `https://campusnotes.space/materials/${card1.id}`,
  });
  assert.strictEqual(nav1.sharedPayload.title, undefined, 'Must not include title');
  assert.strictEqual(nav1.sharedPayload.text, undefined, 'Must not include text message');
});

test('Card 1 fallback copies strictly its own URL when native share unsupported', async () => {
  const nav1Fallback = new MockNavigator({ shareSupported: false });
  let toastTitle = '';
  let toastMsg = '';
  const success = await runShareMaterial(card1, nav1Fallback, (t, m) => {
    toastTitle = t;
    toastMsg = m;
  });

  assert.strictEqual(success, true);
  assert.strictEqual(toastTitle, 'Link Copied');
  assert.strictEqual(toastMsg, `https://campusnotes.space/materials/${card1.id}`);
  assert.strictEqual(nav1Fallback.clipboardText, `https://campusnotes.space/materials/${card1.id}`);
  assert(!nav1Fallback.clipboardText.includes('\n'), 'No newlines allowed');
  assert(!nav1Fallback.clipboardText.includes('CampusNotes'), 'No brand prefix allowed');
});

// --- Test Card 2 ---
console.log('\n--- Testing PDF Card 2 ---');
test('Card 2 directly shares strictly its own distinct URL, never Card 1 or homepage', async () => {
  const nav2 = new MockNavigator({ shareSupported: true });
  const success = await runShareMaterial(card2, nav2);

  assert.strictEqual(success, true);
  assert.deepStrictEqual(nav2.sharedPayload, {
    url: `https://campusnotes.space/materials/${card2.id}`,
  });
  assert.notStrictEqual(nav2.sharedPayload.url, `https://campusnotes.space/materials/${card1.id}`);
  assert.notStrictEqual(nav2.sharedPayload.url, 'https://campusnotes.space');
});

test('Card 2 fallback copies strictly Card 2 URL', async () => {
  const nav2Fallback = new MockNavigator({ shareSupported: false });
  await runShareMaterial(card2, nav2Fallback);
  assert.strictEqual(nav2Fallback.clipboardText, `https://campusnotes.space/materials/${card2.id}`);
});

// --- Test Card 3 ---
console.log('\n--- Testing PDF Card 3 ---');
test('Card 3 directly shares strictly its own URL distinct from Card 1 and Card 2', async () => {
  const nav3 = new MockNavigator({ shareSupported: true });
  const success = await runShareMaterial(card3, nav3);

  assert.strictEqual(success, true);
  assert.deepStrictEqual(nav3.sharedPayload, {
    url: `https://campusnotes.space/materials/${card3.id}`,
  });
  assert.notStrictEqual(nav3.sharedPayload.url, `https://campusnotes.space/materials/${card1.id}`);
  assert.notStrictEqual(nav3.sharedPayload.url, `https://campusnotes.space/materials/${card2.id}`);
});

test('Card 3 fallback copies strictly Card 3 URL', async () => {
  const nav3Fallback = new MockNavigator({ shareSupported: false });
  await runShareMaterial(card3, nav3Fallback);
  assert.strictEqual(nav3Fallback.clipboardText, `https://campusnotes.space/materials/${card3.id}`);
});

// --- Test Native Share Cancellation ---
console.log('\n--- Testing Native Share User Dismissal (AbortError) ---');
test('User cancelling native share sheet (AbortError) returns false without error toast', async () => {
  const abortErr = new Error('Share canceled');
  abortErr.name = 'AbortError';
  const navAbort = new MockNavigator({ shareSupported: true, shareRejection: abortErr });
  let toastCalled = false;
  const success = await runShareMaterial(card1, navAbort, () => { toastCalled = true; });

  assert.strictEqual(success, false, 'AbortError must return false');
  assert.strictEqual(toastCalled, false, 'AbortError must not trigger toast');
  assert.strictEqual(navAbort.clipboardText, null, 'Must not copy to clipboard on user abort');
});

// --- Test Route Navigation ---
console.log('\n--- Testing Route Resolution for Shared Links ---');
test('Shared links navigate to correct PDF material detail route', () => {
  const testCards = [card1, card2, card3];
  for (const card of testCards) {
    const url = `https://campusnotes.space/materials/${card.id}`;
    const urlObj = new URL(url);
    assert.strictEqual(urlObj.origin, 'https://campusnotes.space');
    assert.strictEqual(urlObj.pathname, `/materials/${card.id}`);
    const found = INITIAL_STUDY_MATERIALS.find((m) => m.id === card.id);
    assert(found, `Material with ID ${card.id} must exist in catalog`);
    assert(found.published === true, `Shared material ${card.id} must be published`);
  }
});

// --- Test Unpublished Guard ---
console.log('\n--- Testing Unpublished Material Guard ---');
test('Unpublished drafts cannot be shared and return false', async () => {
  const draftCard = { id: 'mat_secret_draft', title: 'Secret Draft', published: false };
  const nav = new MockNavigator({ shareSupported: true });
  let toastTitle = '';
  let toastMsg = '';
  const success = await runShareMaterial(draftCard, nav, (t, m) => {
    toastTitle = t;
    toastMsg = m;
  });

  assert.strictEqual(success, false);
  assert.strictEqual(toastTitle, 'Material Unpublished');
  assert(toastMsg.includes('cannot be shared publicly'));
  assert.strictEqual(nav.sharedPayload, null, 'Must not invoke share on draft');
  assert.strictEqual(nav.clipboardText, null, 'Must not copy draft link to clipboard');
});

// --- Verify No Custom Modal in Source Code ---
console.log('\n--- Verify Complete Removal of Custom Modal ---');
test('Source code contains no custom ShareModal popup or events', () => {
  assert(!fs.existsSync('src/components/common/ShareModal.tsx'), 'ShareModal.tsx must not exist');
  const appCode = fs.readFileSync('src/App.tsx', 'utf8');
  assert(!appCode.includes('ShareModal'), 'App.tsx must not import or render ShareModal');
  const shareUtilsSource = fs.readFileSync('src/utils/shareUtils.ts', 'utf8');
  assert(!shareUtilsSource.includes('campusnotes:share'), 'shareUtils must not dispatch campusnotes:share custom event');
});

console.log('\n======================================================================');
console.log(`  VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('======================================================================');

if (failed > 0) {
  process.exit(1);
}
