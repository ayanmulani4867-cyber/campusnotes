// Diagnostic script to check what is deployed at campusnotes.space
// and what the Cloudflare Worker responds to.

const SITE_URL = 'https://campusnotes.space';
const WORKER_URL = 'https://campusnotes-pdf-api.ayanmull8886.workers.dev';
const RTDB_URL = 'https://campusnotes-e62cf-default-rtdb.firebaseio.com';

async function diagnose() {
  console.log('=== CAMPUSNOTES PRODUCTION DEPLOYMENT DIAGNOSIS ===\n');

  // 1. Check frontend HTML and scripts
  try {
    const htmlRes = await fetch(SITE_URL);
    const html = await htmlRes.text();
    console.log(`[Frontend] GET ${SITE_URL} -> HTTP ${htmlRes.status}`);

    const scriptMatches = [...html.matchAll(/src="([^"]+\.js)"/g)];
    for (const match of scriptMatches) {
      const scriptUrl = new URL(match[1], SITE_URL).href;
      console.log(`[Frontend] Found script: ${scriptUrl}`);
      const jsRes = await fetch(scriptUrl);
      const js = await jsRes.text();
      console.log(`  - Length: ${js.length} chars`);
      console.log(`  - Has 'private-assignment': ${js.includes('private-assignment')}`);
      console.log(`  - Has 'privateShares': ${js.includes('privateShares')}`);
      console.log(`  - Has 'Link Unavailable': ${js.includes('Link Unavailable')}`);
      console.log(`  - Has 'validatePrivateShare': ${js.includes('validatePrivateShare')}`);
      console.log(`  - Has 'demo-java-assignment-2026': ${js.includes('demo-java-assignment-2026')}`);
    }
  } catch (err) {
    console.error('[Frontend] Error checking frontend:', err);
  }

  // 2. Check worker endpoints
  console.log('\n--- Checking Cloudflare Worker Endpoints ---');
  const testEndpoints = [
    { method: 'GET', path: '/health' },
    { method: 'GET', path: '/test-pdf' },
    { method: 'POST', path: '/private-shares' },
    { method: 'GET', path: '/private-shares' },
    { method: 'GET', path: '/private-shares/demo-token/info' },
    { method: 'GET', path: '/private-shares/test/file' },
    { method: 'GET', path: '/materials/test/pdf' },
  ];

  for (const ep of testEndpoints) {
    try {
      const res = await fetch(`${WORKER_URL}${ep.path}`, { method: ep.method });
      const text = await res.text();
      console.log(`[Worker] ${ep.method} ${ep.path} -> HTTP ${res.status}: ${text.slice(0, 120)}`);
    } catch (err) {
      console.error(`[Worker] ${ep.method} ${ep.path} failed:`, err.message);
    }
  }

  // 3. Check Firebase RTDB rules on /privateShares
  console.log('\n--- Checking Firebase RTDB /privateShares ---');
  try {
    const rtdbRes = await fetch(`${RTDB_URL}/privateShares.json`);
    const rtdbText = await rtdbRes.text();
    console.log(`[RTDB] GET ${RTDB_URL}/privateShares.json -> HTTP ${rtdbRes.status}: ${rtdbText.slice(0, 150)}`);
  } catch (err) {
    console.error('[RTDB] Failed to check RTDB:', err.message);
  }

  // 4. Test opening a private assignment link on the live site
  console.log('\n--- Checking /private-assignment route on live site ---');
  try {
    const routeRes = await fetch(`${SITE_URL}/private-assignment/demo-java-assignment-2026`);
    console.log(`[Frontend Route] GET /private-assignment/demo-java-assignment-2026 -> HTTP ${routeRes.status}`);
  } catch (err) {
    console.error('[Frontend Route] Failed:', err.message);
  }
}

diagnose();
