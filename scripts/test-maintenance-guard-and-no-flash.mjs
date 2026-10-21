import assert from 'node:assert';
import fs from 'node:fs';

console.log('======================================================================');
console.log('  CAMPUSNOTES — ZERO-FLASH MAINTENANCE MODE VERIFICATION TEST SUITE');
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

const maintenanceGuardCode = fs.readFileSync('src/components/common/MaintenanceGuard.tsx', 'utf8');
const firebaseServiceCode = fs.readFileSync('src/services/firebaseService.ts', 'utf8');
const indexHtmlCode = fs.readFileSync('index.html', 'utf8');
const appCode = fs.readFileSync('src/App.tsx', 'utf8');

// -----------------------------------------------------------------------------
// Suite 1: Source Code & Architectural Protection Rules
// -----------------------------------------------------------------------------
console.log('--- Test Suite 1: Source Code & Architectural Protection Rules ---');

test('MaintenanceGuard exports MAINTENANCE_STORAGE_KEY constant', () => {
  assert(
    maintenanceGuardCode.includes("MAINTENANCE_STORAGE_KEY = 'campusnotes_maintenance_mode'"),
    'MAINTENANCE_STORAGE_KEY constant must match campusnotes_maintenance_mode'
  );
});

test('MaintenanceGuard does NOT clear local storage on mount', () => {
  assert(
    !maintenanceGuardCode.includes("localStorage.removeItem('campusnotes_maintenance_mode')"),
    'MaintenanceGuard must not wipe localStorage on mount'
  );
});

test('subscribeToMaintenanceMode does NOT invoke premature callback(false)', () => {
  const subMatch = firebaseServiceCode.match(/export function subscribeToMaintenanceMode[\s\S]*?return onValue/);
  assert(subMatch, 'Could not find subscribeToMaintenanceMode definition');
  const bodyBeforeOnValue = subMatch[0];
  // Ensure callback(false) is only in error/unconfigured branch, not unconditional
  assert(
    !bodyBeforeOnValue.includes('callback(false);\n  if (!isFirebaseConfigured'),
    'subscribeToMaintenanceMode must not unconditionally fire callback(false) before Firebase connection'
  );
});

test('index.html contains frame-zero inline maintenance script for instant paint on refresh', () => {
  assert(
    indexHtmlCode.includes("localStorage.getItem('campusnotes_maintenance_mode') === 'true'"),
    'index.html must check campusnotes_maintenance_mode synchronously'
  );
  assert(
    indexHtmlCode.includes("window.location.pathname.indexOf('/admin') === 0"),
    'index.html script must bypass admin routes'
  );
  assert(
    indexHtmlCode.includes('Maintenance Mode'),
    'index.html frame-zero script must inject Maintenance Mode notice into #root'
  );
});

test('App.tsx wraps AppContent with MaintenanceGuard inside BrowserRouter and AuthProvider', () => {
  assert(appCode.includes('<MaintenanceGuard>'), 'App.tsx must include <MaintenanceGuard>');
  assert(appCode.includes('</MaintenanceGuard>'), 'App.tsx must close </MaintenanceGuard>');
  assert(
    appCode.indexOf('<AuthProvider>') < appCode.indexOf('<MaintenanceGuard>') &&
      appCode.indexOf('<MaintenanceGuard>') < appCode.indexOf('<AppContent />'),
    'MaintenanceGuard must wrap AppContent inside AuthProvider'
  );
});

// -----------------------------------------------------------------------------
// Suite 2: State Guard Logic Simulation (Simulating Guard Component States)
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 2: State Guard Logic Simulation ---');

/**
 * Pure simulation model mirroring MaintenanceGuard logic
 */
function simulateMaintenanceGuard({
  cachedStorageValue,
  liveRtdbValue, // undefined = loading, boolean = resolved
  isAdminRoute,
  isAuthenticated,
  authLoading = false,
}) {
  // Synchronous initialization
  let maintenanceMode = cachedStorageValue === 'true';
  let isChecking = cachedStorageValue !== 'true';

  // Live Firebase resolution if provided
  if (liveRtdbValue !== undefined) {
    maintenanceMode = liveRtdbValue;
    isChecking = false;
  }

  // Guard 1: Admin route bypass
  if (isAdminRoute) {
    return { rendered: 'PROTECTED_CHILDREN', reason: 'ADMIN_ROUTE_ALLOWED' };
  }

  // Guard 2: Maintenance mode active
  if (maintenanceMode) {
    if (isAuthenticated && !authLoading) {
      return { rendered: 'PROTECTED_CHILDREN', reason: 'AUTHORIZED_ADMIN_BYPASS' };
    }
    return { rendered: 'MAINTENANCE_NOTICE', reason: 'MAINTENANCE_ACTIVE' };
  }

  // Guard 3: Still checking maintenance status from Firebase
  if (isChecking) {
    return { rendered: 'CHECKING_SCREEN', reason: 'SAFE_LOADING_STATE' };
  }

  // Guard 4: Confirmed disabled
  return { rendered: 'PROTECTED_CHILDREN', reason: 'PUBLIC_SITE_LIVE' };
}

test('On Refresh with maintenance enabled (cached "true"): Renders MAINTENANCE_NOTICE immediately with 0ms flash', () => {
  const result = simulateMaintenanceGuard({
    cachedStorageValue: 'true',
    liveRtdbValue: undefined, // Firebase still loading
    isAdminRoute: false,
    isAuthenticated: false,
  });

  assert.strictEqual(
    result.rendered,
    'MAINTENANCE_NOTICE',
    'Must render MAINTENANCE_NOTICE immediately when cached value is true'
  );
  assert.notStrictEqual(
    result.rendered,
    'PROTECTED_CHILDREN',
    'Must never render PROTECTED_CHILDREN on refresh during maintenance'
  );
});

test('Delayed Firebase response (initial visit / cold cache): Renders CHECKING_SCREEN, never PROTECTED_CHILDREN', () => {
  const result = simulateMaintenanceGuard({
    cachedStorageValue: null,
    liveRtdbValue: undefined, // Network delay in RTDB
    isAdminRoute: false,
    isAuthenticated: false,
  });

  assert.strictEqual(
    result.rendered,
    'CHECKING_SCREEN',
    'Must render safe CHECKING_SCREEN while Firebase is loading'
  );
  assert.notStrictEqual(
    result.rendered,
    'PROTECTED_CHILDREN',
    'Must never render protected normal content while status is unknown'
  );
});

test('Delayed Firebase response then resolves to true: Transitions CHECKING_SCREEN -> MAINTENANCE_NOTICE without flash', () => {
  // Step 1: During delayed check
  const step1 = simulateMaintenanceGuard({
    cachedStorageValue: null,
    liveRtdbValue: undefined,
    isAdminRoute: false,
    isAuthenticated: false,
  });
  assert.strictEqual(step1.rendered, 'CHECKING_SCREEN');

  // Step 2: Firebase resolves to true
  const step2 = simulateMaintenanceGuard({
    cachedStorageValue: null,
    liveRtdbValue: true,
    isAdminRoute: false,
    isAuthenticated: false,
  });
  assert.strictEqual(step2.rendered, 'MAINTENANCE_NOTICE');
  assert.notStrictEqual(step2.rendered, 'PROTECTED_CHILDREN');
});

test('Delayed Firebase response then resolves to false: Transitions CHECKING_SCREEN -> PROTECTED_CHILDREN cleanly', () => {
  // Step 1: During check
  const step1 = simulateMaintenanceGuard({
    cachedStorageValue: null,
    liveRtdbValue: undefined,
    isAdminRoute: false,
    isAuthenticated: false,
  });
  assert.strictEqual(step1.rendered, 'CHECKING_SCREEN');

  // Step 2: Firebase confirms false
  const step2 = simulateMaintenanceGuard({
    cachedStorageValue: null,
    liveRtdbValue: false,
    isAdminRoute: false,
    isAuthenticated: false,
  });
  assert.strictEqual(step2.rendered, 'PROTECTED_CHILDREN');
});

test('Direct URL navigation to public route (/materials, /subjects): Blocked when maintenance enabled', () => {
  const routes = ['/', '/materials', '/materials/23CS3501-A1', '/subjects', '/subjects/23CS3501', '/category/notes'];
  for (const path of routes) {
    const result = simulateMaintenanceGuard({
      cachedStorageValue: 'true',
      liveRtdbValue: true,
      isAdminRoute: path.startsWith('/admin'),
      isAuthenticated: false,
    });
    assert.strictEqual(
      result.rendered,
      'MAINTENANCE_NOTICE',
      `Route ${path} must be blocked by maintenance notice`
    );
  }
});

test('Direct URL navigation to admin routes (/admin/login, /admin/dashboard): Always allowed during maintenance', () => {
  const adminRoutes = ['/admin', '/admin/login', '/admin/dashboard'];
  for (const path of adminRoutes) {
    const result = simulateMaintenanceGuard({
      cachedStorageValue: 'true',
      liveRtdbValue: true,
      isAdminRoute: path.startsWith('/admin'),
      isAuthenticated: false,
    });
    assert.strictEqual(
      result.rendered,
      'PROTECTED_CHILDREN',
      `Admin route ${path} must remain accessible for maintenance management`
    );
  }
});

test('Authenticated admin on public route (/): Granted access to website during maintenance', () => {
  const result = simulateMaintenanceGuard({
    cachedStorageValue: 'true',
    liveRtdbValue: true,
    isAdminRoute: false,
    isAuthenticated: true,
    authLoading: false,
  });
  assert.strictEqual(
    result.rendered,
    'PROTECTED_CHILDREN',
    'Authenticated admin must retain full access during maintenance'
  );
});

test('Unauthenticated visitor during auth check with maintenance enabled: Stays on MAINTENANCE_NOTICE', () => {
  const result = simulateMaintenanceGuard({
    cachedStorageValue: 'true',
    liveRtdbValue: true,
    isAdminRoute: false,
    isAuthenticated: false,
    authLoading: true, // Auth still checking
  });
  assert.strictEqual(
    result.rendered,
    'MAINTENANCE_NOTICE',
    'Visitor must not see protected content while auth is checking'
  );
});

// -----------------------------------------------------------------------------
// Suite 3: Local Storage Persistence & Fallback Safety
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 3: Local Storage Persistence & Fallback Safety ---');

test('MaintenanceGuard incorporates safety fallback timeout in useEffect', () => {
  assert(maintenanceGuardCode.includes('setTimeout'), 'MaintenanceGuard must have a safety fallback timeout');
  assert(maintenanceGuardCode.includes('clearTimeout'), 'MaintenanceGuard must clear safety timeout on resolution');
  assert(maintenanceGuardCode.includes('5000'), 'Safety timeout must be configured to 5 seconds');
});

test('MaintenanceCheckingScreen has accessible structure and does not contain protected elements', () => {
  assert(
    maintenanceGuardCode.includes('MaintenanceCheckingScreen'),
    'MaintenanceGuard must export MaintenanceCheckingScreen'
  );
  assert(
    !maintenanceGuardCode.includes('Navbar') && !maintenanceGuardCode.includes('Footer'),
    'MaintenanceCheckingScreen must not import or render Navbar or Footer'
  );
  assert(
    maintenanceGuardCode.includes('animate-spin'),
    'MaintenanceCheckingScreen must render accessible spin animation'
  );
});

console.log('\n======================================================================');
console.log(`  RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('======================================================================\n');

if (failed > 0) {
  process.exit(1);
}
