import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getDatabase, Database } from 'firebase/database';
import { getStorage, FirebaseStorage } from 'firebase/storage';

export const DEFAULT_DATABASE_URL = 'https://campusnotes-e62cf-default-rtdb.firebaseio.com/';
export const DEFAULT_PROJECT_ID = 'campusnotes-e62cf';
export const DEFAULT_STORAGE_BUCKET = 'campusnotes-e62cf.firebasestorage.app';

// Read environment variables
const apiKey = import.meta.env.VITE_FIREBASE_API_KEY || '';
const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${DEFAULT_PROJECT_ID}.firebaseapp.com`;
const databaseURL = import.meta.env.VITE_FIREBASE_DATABASE_URL || DEFAULT_DATABASE_URL;
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || DEFAULT_PROJECT_ID;
const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || DEFAULT_STORAGE_BUCKET;
const messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '';
const appId = import.meta.env.VITE_FIREBASE_APP_ID || '';

export const firebaseConfig = {
  apiKey,
  authDomain,
  databaseURL,
  projectId,
  storageBucket,
  messagingSenderId,
  appId,
};

export const isFirebaseConfigured = Boolean(
  apiKey &&
  apiKey.trim().length > 0 &&
  !apiKey.includes('YOUR_') &&
  databaseURL
);

let app: ReturnType<typeof initializeApp> | undefined;
let auth: ReturnType<typeof getAuth> | undefined;
let database: ReturnType<typeof getDatabase> | undefined;
let storage: ReturnType<typeof getStorage> | undefined;

try {
  if (isFirebaseConfigured) {
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApp();
    }
    auth = getAuth(app);
    database = getDatabase(app, databaseURL);
    storage = getStorage(app);
  } else if (databaseURL) {
    if (!getApps().length) {
      app = initializeApp({ projectId: DEFAULT_PROJECT_ID, databaseURL, storageBucket: DEFAULT_STORAGE_BUCKET });
    } else {
      app = getApp();
    }
    database = getDatabase(app, databaseURL);
  }
} catch (error) {
  console.warn('Firebase initialization notice: Waiting for full Web App credentials.', error);
}

export { app, auth, database, storage };

export function getFirebaseDiagnostics() {
  return {
    isConfigured: isFirebaseConfigured,
    projectId: projectId || 'Not set',
    databaseURL,
    storageBucket,
    hasApiKey: Boolean(apiKey),
    hasAuthDomain: Boolean(authDomain),
    hasAppId: Boolean(appId),
  };
}
