import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword,
  User,
} from 'firebase/auth';
import { ref, get, set } from 'firebase/database';
import { auth, database, isFirebaseConfigured } from '../config/firebase';
import { AdminUser } from '../types';

export const ADMIN_CANONICAL_EMAIL = 'admin@campusnotes.internal';
export const AUTHORIZED_ADMIN_EMAILS: readonly string[] = [
  'admin@campusnotes.internal',
  'ayanmulani4867@gmail.com',
  'ayanmull8886@gmail.com',
];
const DEV_SESSION_STORAGE_KEY = 'cn_dev_admin_session';

/**
 * Maps a username (e.g. 'admin') to a canonical email address for Firebase Authentication.
 * If already an email, returns it trimmed.
 */
export function resolveAdminEmail(usernameOrEmail: string): string {
  const trimmed = usernameOrEmail.trim();
  if (trimmed.toLowerCase() === 'admin') {
    return ADMIN_CANONICAL_EMAIL;
  }
  if (!trimmed.includes('@')) {
    return `${trimmed.toLowerCase()}@campusnotes.internal`;
  }
  return trimmed;
}

/**
 * Verify if an authenticated Firebase user is an authorized administrator.
 * Checks canonical admin email, Firebase ID token custom claims (token.admin === true),
 * AND database administrator registry (/admins/{uid}).
 */
export async function verifyAdminAuthorization(user: User): Promise<boolean> {
  try {
    // 0. Canonical administrator accounts are always authorized
    if (user.email && AUTHORIZED_ADMIN_EMAILS.includes(user.email.toLowerCase())) {
      return true;
    }

    // 1. Check ID token custom claims
    const idTokenResult = await user.getIdTokenResult(true);
    if (idTokenResult.claims.admin === true || idTokenResult.claims.role === 'admin') {
      return true;
    }

    // 2. Check RTDB /admins/{uid} registry
    if (database) {
      const adminRef = ref(database, `admins/${user.uid}`);
      const snapshot = await get(adminRef);
      if (snapshot.exists() && snapshot.val() === true) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('Authorization verification error:', error);
    if (user.email && AUTHORIZED_ADMIN_EMAILS.includes(user.email.toLowerCase())) {
      return true;
    }
    return false;
  }
}

/**
 * Retrieve active development administrator session if present in sessionStorage
 */
function getActiveDevSession(): AdminUser | null {
  try {
    const raw = sessionStorage.getItem(DEV_SESSION_STORAGE_KEY) || localStorage.getItem(DEV_SESSION_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.isAuthorizedAdmin) {
        return parsed as AdminUser;
      }
    }
  } catch {
    // Ignore storage parse errors
  }
  return null;
}

/**
 * Store development administrator session in sessionStorage and localStorage
 */
function setDevSession(user: AdminUser): void {
  try {
    sessionStorage.setItem(DEV_SESSION_STORAGE_KEY, JSON.stringify(user));
    localStorage.setItem(DEV_SESSION_STORAGE_KEY, JSON.stringify(user));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Clear development administrator session from sessionStorage and localStorage
 */
function clearDevSession(): void {
  try {
    sessionStorage.removeItem(DEV_SESSION_STORAGE_KEY);
    localStorage.removeItem(DEV_SESSION_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

/**
 * Sign in administrator with username or email and password.
 * Supports canonical mapping ('admin' -> 'admin@campusnotes.internal')
 * and authenticates directly against Firebase Authentication to ensure valid auth context.
 */
export async function loginAdmin(identifier: string, pass: string): Promise<AdminUser> {
  const trimmedId = identifier.trim();
  const trimmedPass = pass.trim();

  if (!trimmedId || !trimmedPass) {
    throw new Error('Please enter both administrator ID and password.');
  }

  const isDevLogin =
    trimmedId.toLowerCase() === 'admin' &&
    trimmedPass === 'admin';

  let targetEmail = resolveAdminEmail(trimmedId);
  let targetPassword = pass;

  // Initial administrator setup: map default admin/admin to the provisioned administrator account
  if (isDevLogin) {
    targetEmail = ADMIN_CANONICAL_EMAIL;
    targetPassword = 'CampusAdmin@2026';
  }

  // 1. Authenticate against Firebase Authentication
  if (auth) {
    try {
      const credential = await signInWithEmailAndPassword(auth, targetEmail, targetPassword);
      const user = credential.user;

      // Strict authorization verification (canonical email, custom claims, or /admins/{uid})
      const isAuthorized = await verifyAdminAuthorization(user);
      if (!isAuthorized) {
        await signOut(auth);
        throw new Error(
          'Access Denied: This account is authenticated, but does not possess administrator privileges for CampusNotes CSE Semester 5.'
        );
      }

      // Ensure /admins/{uid}: true exists in the database
      if (database && user.uid) {
        try {
          await set(ref(database, `admins/${user.uid}`), true);
        } catch {
          // Non-fatal if security rules also check auth.token.email
        }
      }

      clearDevSession();

      return {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || 'Administrator',
        isAuthorizedAdmin: true,
        isDevelopmentDefault: isDevLogin,
        requiresPasswordChange: isDevLogin,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);

      // If user changed password and attempts old default credentials
      if (isDevLogin && (msg.includes('invalid-credential') || msg.includes('wrong-password'))) {
        throw new Error(
          'Default initial password has expired or was changed. Please log in with your updated administrator password.'
        );
      }

      // If network is completely offline during local offline development, fallback to local dev session
      if (isDevLogin && (msg.includes('network-request-failed') || !navigator.onLine)) {
        console.warn('Network offline during admin login. Using offline dev session fallback.');
        const devAdminUser: AdminUser = {
          uid: 'dev_admin_local_5',
          email: ADMIN_CANONICAL_EMAIL,
          displayName: 'Development Administrator',
          isAuthorizedAdmin: true,
          isDevelopmentDefault: true,
          requiresPasswordChange: true,
        };
        setDevSession(devAdminUser);
        return devAdminUser;
      }

      if (msg.includes('user-not-found') || msg.includes('wrong-password') || msg.includes('invalid-credential')) {
        throw new Error('Invalid administrator credentials. Please check your username/email and password.');
      }
      throw err;
    }
  }

  // Fallback if Firebase auth is uninitialized in offline environments
  if (isDevLogin) {
    const devAdminUser: AdminUser = {
      uid: 'dev_admin_local_5',
      email: ADMIN_CANONICAL_EMAIL,
      displayName: 'Development Administrator',
      isAuthorizedAdmin: true,
      isDevelopmentDefault: true,
      requiresPasswordChange: true,
    };
    setDevSession(devAdminUser);
    return devAdminUser;
  }

  throw new Error('Firebase Authentication is not available.');
}

/**
 * Update administrator password
 */
export async function updateAdminPassword(newPassword: string): Promise<void> {
  if (newPassword.trim().length < 6) {
    throw new Error('New password must be at least 6 characters long.');
  }

  // If logged in through Firebase Auth
  if (auth && auth.currentUser) {
    await updatePassword(auth.currentUser, newPassword);
    return;
  }

  // If in dev session, clear the password change requirement
  const currentDev = getActiveDevSession();
  if (currentDev) {
    const updatedDev: AdminUser = {
      ...currentDev,
      isDevelopmentDefault: false,
      requiresPasswordChange: false,
    };
    setDevSession(updatedDev);
  }
}

/**
 * Sign out administrator
 */
export async function logoutAdmin(): Promise<void> {
  clearDevSession();
  if (auth) {
    await signOut(auth);
  }
}

/**
 * Subscribe to admin auth state changes
 */
export function subscribeToAdminAuth(
  callback: (admin: AdminUser | null, loading: boolean) => void
): () => void {
  // Check development session first
  const devSession = getActiveDevSession();
  if (devSession) {
    callback(devSession, false);
    return () => {};
  }

  const currentAuth = auth;
  if (!currentAuth) {
    callback(null, false);
    return () => {};
  }

  return onAuthStateChanged(currentAuth, async (user) => {
    // Re-check dev session in case it was set
    const dev = getActiveDevSession();
    if (dev) {
      callback(dev, false);
      return;
    }

    if (!user) {
      callback(null, false);
      return;
    }

    try {
      const isAuthorized = await verifyAdminAuthorization(user);
      if (isAuthorized) {
        callback(
          {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            isAuthorizedAdmin: true,
            isDevelopmentDefault: false,
            requiresPasswordChange: false,
          },
          false
        );
      } else {
        await signOut(currentAuth);
        callback(null, false);
      }
    } catch {
      callback(null, false);
    }
  });
}
