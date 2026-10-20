// Firebase Auth and Admin Authorization for CampusNotes Worker
// Cryptographic RS256 JWT signature verification using Google/Firebase public JWKS certificates.
import type { AdminAuthResult, Env } from './types.ts';

export const ADMIN_CANONICAL_EMAIL = 'admin@campusnotes.internal';
const GOOGLE_JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

export interface GoogleJwk {
  kid: string;
  kty: string;
  alg: string;
  use: string;
  n: string;
  e: string;
}

export interface GoogleJwks {
  keys: GoogleJwk[];
}

// In-memory cache for Google's public JWKS certificates
let cachedJwks: GoogleJwks | null = null;
let jwksExpiryTime = 0;

// Test hook for hermetic offline testing with local cryptographic keys
let customJwksProvider: (() => Promise<GoogleJwks>) | null = null;

export function setCustomJwksProvider(provider: (() => Promise<GoogleJwks>) | null): void {
  customJwksProvider = provider;
}

export function resetJwksCache(): void {
  cachedJwks = null;
  jwksExpiryTime = 0;
  customJwksProvider = null;
}

export async function fetchGoogleJwks(forceRefresh = false): Promise<GoogleJwks> {
  if (customJwksProvider) {
    return await customJwksProvider();
  }

  const now = Date.now();
  if (!forceRefresh && cachedJwks && now < jwksExpiryTime) {
    return cachedJwks;
  }

  const res = await fetch(GOOGLE_JWKS_URL);
  if (!res.ok) {
    if (cachedJwks) return cachedJwks; // Stale fallback if Google is briefly unreachable
    throw new Error(`Failed to fetch Google JWKS certificates: HTTP ${res.status}`);
  }

  const data = (await res.json()) as GoogleJwks;
  cachedJwks = data;

  const cacheControl = res.headers.get('Cache-Control') || '';
  const match = cacheControl.match(/max-age=(\d+)/i);
  const maxAgeSec = match ? parseInt(match[1], 10) : 21600; // default 6 hours
  jwksExpiryTime = now + maxAgeSec * 1000;

  return data;
}

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (base64.length % 4)) % 4;
  const padded = base64 + '='.repeat(padLen);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function base64UrlToString(base64Url: string): string {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (base64.length % 4)) % 4;
  return atob(base64 + '='.repeat(padLen));
}

/**
 * Cryptographically verifies a Firebase ID token using Google's public JWKS certificates.
 * Enforces RS256 algorithm, signature validation, expiration, issuer, audience, and time claims.
 */
export async function verifyFirebaseIdToken(
  token: string,
  projectId: string
): Promise<{ isValid: boolean; payload?: Record<string, unknown>; error?: string }> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return { isValid: false, error: 'Malformed JWT: must contain header, payload, and signature' };
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  // 1. Decode header
  let header: { alg?: string; kid?: string; typ?: string };
  try {
    header = JSON.parse(base64UrlToString(headerB64));
  } catch {
    return { isValid: false, error: 'Malformed JWT header: invalid JSON' };
  }

  // Enforce RS256 algorithm strictly (reject "none", HS256, etc.)
  if (header.alg !== 'RS256') {
    return { isValid: false, error: `Invalid JWT algorithm: expected RS256, got '${header.alg}'` };
  }

  if (!header.kid || typeof header.kid !== 'string') {
    return { isValid: false, error: 'Missing key identifier (kid) in token header' };
  }

  // 2. Locate public key in Google's JWKS
  let jwks = await fetchGoogleJwks();
  let matchingJwk = jwks.keys.find((k) => k.kid === header.kid);

  // If not found, force refresh in case Google rotated keys
  if (!matchingJwk) {
    jwks = await fetchGoogleJwks(true);
    matchingJwk = jwks.keys.find((k) => k.kid === header.kid);
  }

  if (!matchingJwk) {
    return { isValid: false, error: `Unknown key identifier (kid: '${header.kid}'). Key not found in Google JWKS.` };
  }

  // 3. Cryptographically verify signature using Web Crypto API
  let cryptoKey: CryptoKey;
  try {
    cryptoKey = await crypto.subtle.importKey(
      'jwk',
      matchingJwk,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256',
      },
      false,
      ['verify']
    );
  } catch (err) {
    return { isValid: false, error: `Failed to import Google public key: ${err}` };
  }

  const signedData = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  let signatureBytes: Uint8Array;
  try {
    signatureBytes = base64UrlToUint8Array(signatureB64);
  } catch {
    return { isValid: false, error: 'Malformed signature: invalid base64url' };
  }

  const isSignatureValid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    signatureBytes as unknown as BufferSource,
    signedData as unknown as BufferSource
  );

  if (!isSignatureValid) {
    return { isValid: false, error: 'Cryptographic token signature verification failed' };
  }

  // 4. Decode and validate payload claims
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(base64UrlToString(payloadB64));
  } catch {
    return { isValid: false, error: 'Malformed JWT payload: invalid JSON' };
  }

  const nowSec = Math.floor(Date.now() / 1000);

  // Check expiration (exp)
  const exp = typeof payload.exp === 'number' ? payload.exp : 0;
  if (exp <= nowSec) {
    return { isValid: false, error: `Token has expired (exp: ${exp}, now: ${nowSec})` };
  }

  // Check issued at (iat) with 5 min clock skew tolerance
  const iat = typeof payload.iat === 'number' ? payload.iat : 0;
  if (iat > nowSec + 300) {
    return { isValid: false, error: `Token issued in the future (iat: ${iat}, now: ${nowSec})` };
  }

  // Check audience (aud)
  if (payload.aud !== projectId) {
    return { isValid: false, error: `Invalid token audience: expected '${projectId}', got '${payload.aud}'` };
  }

  // Check issuer (iss)
  const expectedIssuer = `https://securetoken.google.com/${projectId}`;
  if (payload.iss !== expectedIssuer) {
    return { isValid: false, error: `Invalid token issuer: expected '${expectedIssuer}', got '${payload.iss}'` };
  }

  // Check subject (sub / user_id)
  const sub = typeof payload.sub === 'string' ? payload.sub : (typeof payload.user_id === 'string' ? payload.user_id : '');
  if (!sub || sub.trim().length === 0) {
    return { isValid: false, error: 'Missing subject (sub) claim in token payload' };
  }

  return { isValid: true, payload };
}

/**
 * Parses and verifies an administrator Bearer token from the Authorization header.
 * Performs cryptographic RS256 signature verification and checks admin authorization.
 */
export async function verifyAdminRequest(
  request: Request,
  env: Env
): Promise<AdminAuthResult> {
  let token = '';
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else {
    try {
      const url = new URL(request.url);
      const queryToken = url.searchParams.get('token') || url.searchParams.get('auth');
      if (queryToken) {
        token = queryToken.trim();
      }
    } catch {
      // Ignore URL parsing errors
    }
  }

  if (!token) {
    return { isAuthorized: false, error: 'Missing or malformed Authorization header' };
  }

  const projectId = env.FIREBASE_PROJECT_ID || 'campusnotes-e62cf';

  // 1. Cryptographically verify the token signature and standard claims
  const verification = await verifyFirebaseIdToken(token, projectId);
  if (!verification.isValid || !verification.payload) {
    return { isAuthorized: false, error: verification.error || 'Token verification failed' };
  }

  const payload = verification.payload;
  const uid = typeof payload.user_id === 'string' ? payload.user_id : (typeof payload.sub === 'string' ? payload.sub : '');
  const email = typeof payload.email === 'string' ? payload.email : '';

  // 2. Verified admin authorization checks
  // A. Canonical admin email (cryptographically verified)
  if (email.toLowerCase() === ADMIN_CANONICAL_EMAIL.toLowerCase()) {
    return { isAuthorized: true, uid, email };
  }

  // B. Firebase Auth custom claim (cryptographically verified)
  if (payload.admin === true || payload.role === 'admin') {
    return { isAuthorized: true, uid, email };
  }

  // C. Firebase Realtime Database /admins partition lookup
  const dbUrl = env.FIREBASE_DATABASE_URL || 'https://campusnotes-e62cf-default-rtdb.firebaseio.com';
  try {
    const checkUrl = `${dbUrl}/admins/${encodeURIComponent(uid)}.json?auth=${encodeURIComponent(token)}`;
    const res = await fetch(checkUrl);
    if (res.ok) {
      const data = await res.json();
      if (data === true) {
        return { isAuthorized: true, uid, email };
      }
    }
  } catch (err) {
    console.warn('Notice verifying admin token against RTDB:', err);
  }

  return { isAuthorized: false, error: 'User is not an authorized administrator' };
}
