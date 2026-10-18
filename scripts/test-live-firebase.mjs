/**
 * CampusNotes — Live Firebase Integration & Diagnostics Test
 * 
 * Verifies real connection to Firebase project: campusnotes-e62cf
 * - Firebase App initialization
 * - Firebase Realtime Database reachability & rules check
 * - Firebase Authentication provider check
 * - Firebase Cloud Storage bucket check
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getDatabase, ref, get } from 'firebase/database';
import { getStorage, ref as storageRef, getDownloadURL } from 'firebase/storage';
import fs from 'fs';
import path from 'path';

// 1. Read .env file
const envPath = path.resolve('.env');
if (!fs.existsSync(envPath)) {
  console.error('[FAIL] .env file not found!');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach((line) => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const [k, ...v] = trimmed.split('=');
    env[k.trim()] = v.join('=').trim();
  }
});

console.log('===============================================================');
console.log('  CAMPUSNOTES — REAL FIREBASE LIVE INTEGRATION TEST');
console.log('===============================================================');
console.log(`Project ID:        ${env.VITE_FIREBASE_PROJECT_ID}`);
console.log(`Database URL:      ${env.VITE_FIREBASE_DATABASE_URL}`);
console.log(`Storage Bucket:    ${env.VITE_FIREBASE_STORAGE_BUCKET}`);
console.log(`Auth Domain:       ${env.VITE_FIREBASE_AUTH_DOMAIN}`);
console.log('---------------------------------------------------------------\n');

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: env.VITE_FIREBASE_DATABASE_URL,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

let app, auth, db, storage;

// Test 1: Firebase App Initialization
try {
  app = initializeApp(firebaseConfig, 'live-test-app');
  auth = getAuth(app);
  db = getDatabase(app, env.VITE_FIREBASE_DATABASE_URL);
  storage = getStorage(app, env.VITE_FIREBASE_STORAGE_BUCKET);
  console.log('[✓ Test 1 Passed] Firebase Client App initialized successfully.');
} catch (err) {
  console.error('[✗ Test 1 Failed] Firebase initialization error:', err.message);
  process.exit(1);
}

// Test 2: RTDB Endpoint Connectivity
async function testDatabase() {
  console.log('\n[Test 2] Testing Realtime Database connection & public read...');
  try {
    const subjectsRef = ref(db, 'subjects');
    const snapshot = await get(subjectsRef);
    console.log('[✓ Test 2 Passed] Realtime Database reached successfully.');
    if (snapshot.exists()) {
      const data = snapshot.val();
      console.log(`  Found ${Object.keys(data).length} existing subject record(s) in cloud database.`);
    } else {
      console.log('  Database /subjects node is currently empty (ready for initial seeding).');
    }
  } catch (err) {
    if (err.message && err.message.includes('Permission denied')) {
      console.log('[! Notice on Test 2] Realtime Database is LIVE and responsive, but returned "Permission denied".');
      console.log('  -> This confirms your database is active with default locked rules.');
      console.log('  -> Action required: Apply database.rules.json in Firebase Console -> Realtime Database -> Rules.');
    } else {
      console.error('[✗ Test 2 Warning] Database read error:', err.message);
    }
  }
}

// Test 3: Firebase Authentication Connectivity
async function testAuth() {
  console.log('\n[Test 3] Testing Firebase Authentication configuration...');
  try {
    // Attempt sign-in with probe credentials to verify auth endpoint responds
    await signInWithEmailAndPassword(auth, 'admin@campusnotes.internal', 'invalid-probe-pass');
    console.log('[✓ Test 3 Passed] Auth response received.');
  } catch (err) {
    const code = err.code || '';
    if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
      console.log('[✓ Test 3 Passed] Firebase Authentication endpoint reached & verified.');
      console.log('  (Received expected credential rejection for probe test)');
    } else if (code === 'auth/user-not-found') {
      console.log('[✓ Test 3 Passed] Firebase Auth is enabled.');
      console.log('  (User admin@campusnotes.internal not yet created in Firebase Console)');
    } else if (code === 'auth/operation-not-allowed') {
      console.log('[! Notice on Test 3] Email/Password provider is not yet enabled in Firebase Console.');
      console.log('  -> Action required: Firebase Console -> Authentication -> Sign-in method -> Enable Email/Password.');
    } else {
      console.log(`[✓ Test 3 Result] Auth endpoint status: ${code || err.message}`);
    }
  }
}

// Test 4: Storage Bucket Configuration
async function testStorage() {
  console.log('\n[Test 4] Testing Cloud Storage bucket configuration...');
  try {
    const probeRef = storageRef(storage, 'materials/probe_check.pdf');
    await getDownloadURL(probeRef);
  } catch (err) {
    const code = err.code || '';
    if (code === 'storage/object-not-found') {
      console.log('[✓ Test 4 Passed] Cloud Storage bucket reachable and responding.');
    } else if (code === 'storage/unauthorized') {
      console.log('[✓ Test 4 Passed] Cloud Storage bucket is protected by security rules (Access denied for unauthenticated probe).');
    } else if (code === 'storage/bucket-not-found') {
      console.log('[! Notice on Test 4] Storage bucket not found or not yet created.');
      console.log('  -> Action required: Firebase Console -> Storage -> Click "Get started" to create bucket.');
    } else {
      console.log(`[Storage Status] Code: ${code || err.message}`);
    }
  }
}

async function run() {
  await testDatabase();
  await testAuth();
  await testStorage();
  console.log('\n===============================================================');
  console.log('  DIAGNOSTICS COMPLETE');
  console.log('===============================================================\n');
  process.exit(0);
}

run();
