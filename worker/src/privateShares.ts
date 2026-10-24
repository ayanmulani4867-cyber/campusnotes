// Cloudflare Worker: Private Assignment & Notes Sharing Engine
// Implements cryptographically secure token generation, SHA-256 hashing,
// R2-backed metadata storage, access tracking, expiration/revocation, and rate limiting.

import type { Env, PublicMaterialRecord } from './types.ts';
import { getWorkerFileFormatInfo, sanitizeWorkerFilename, getFileExtension } from './fileTypes.ts';
import { getAdminMaterialMetadata, getPublicMaterialMetadata } from './firebase.ts';

export interface PrivateShareRecord {
  id: string; // tokenHash
  tokenHash: string; // SHA-256 hash of access token
  materialId: string;
  materialTitle: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storageProvider: 'r2' | 'firebase';
  r2Key?: string;
  blobId?: string;
  recipientName?: string;
  recipientEmail?: string;
  instructions?: string;
  dueDate?: number | null;
  expiresAt?: number | null;
  status: 'active' | 'revoked' | 'expired';
  createdAt: number;
  createdBy: string;
  revokedAt?: number | null;
  revokedBy?: string | null;
  accessCount: number;
  lastAccessedAt?: number | null;
}

// In-memory rate limiting map for brute-force token attack protection (per Worker instance)
interface FailedAttemptInfo {
  count: number;
  resetTime: number;
}
const failedTokenAttempts = new Map<string, FailedAttemptInfo>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window
const MAX_FAILED_ATTEMPTS = 15; // Max 15 invalid token probes per minute per IP

export function checkRateLimit(clientIp: string): { isBlocked: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const entry = failedTokenAttempts.get(clientIp);
  if (!entry) return { isBlocked: false };

  if (now > entry.resetTime) {
    failedTokenAttempts.delete(clientIp);
    return { isBlocked: false };
  }

  if (entry.count >= MAX_FAILED_ATTEMPTS) {
    const retryAfterSec = Math.max(1, Math.ceil((entry.resetTime - now) / 1000));
    return { isBlocked: true, retryAfterSec };
  }

  return { isBlocked: false };
}

export function recordFailedTokenAttempt(clientIp: string): void {
  const now = Date.now();
  const entry = failedTokenAttempts.get(clientIp);
  if (!entry || now > entry.resetTime) {
    failedTokenAttempts.set(clientIp, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

export function resetRateLimitForTesting(): void {
  failedTokenAttempts.clear();
}

/**
 * Generates a cryptographically secure 32-byte (256-bit) random token encoded as hex.
 */
export function generateSecureToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Computes the SHA-256 hex digest of a token string.
 */
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Validates a token string format: must be safe URL characters, length 32..128.
 */
export function isValidTokenFormat(token?: string | null): boolean {
  if (!token || typeof token !== 'string') return false;
  return /^[a-zA-Z0-9_-]{32,128}$/.test(token);
}

/**
 * Retrieves a share record from R2 by its SHA-256 token hash.
 */
export async function getShareRecordByHash(
  tokenHash: string,
  env: Env
): Promise<PrivateShareRecord | null> {
  const key = `shares/${tokenHash}.json`;
  const obj = await env.PDF_BUCKET.get(key);
  if (!obj) return null;

  try {
    const data = (await obj.json()) as PrivateShareRecord;
    return data;
  } catch (err) {
    console.error(`Failed to parse share record ${key}:`, err);
    return null;
  }
}

/**
 * Persists a share record into R2.
 */
export async function saveShareRecord(
  record: PrivateShareRecord,
  env: Env
): Promise<void> {
  const key = `shares/${record.tokenHash}.json`;
  await env.PDF_BUCKET.put(key, JSON.stringify(record, null, 2), {
    httpMetadata: {
      contentType: 'application/json',
    },
    customMetadata: {
      materialId: record.materialId,
      status: record.status,
      createdAt: String(record.createdAt),
      expiresAt: String(record.expiresAt || 0),
    },
  });
}

/**
 * Deletes a share record from R2.
 */
export async function deleteShareRecordFromR2(
  tokenHash: string,
  env: Env
): Promise<boolean> {
  const key = `shares/${tokenHash}.json`;
  await env.PDF_BUCKET.delete(key);
  return true;
}

/**
 * Lists all private share records from R2 for administrators.
 */
export async function listAllShareRecords(
  env: Env,
  options?: { limit?: number; cursor?: string }
): Promise<PrivateShareRecord[]> {
  const listResult = await env.PDF_BUCKET.list({
    prefix: 'shares/',
    limit: options?.limit || 100,
    cursor: options?.cursor,
  });

  const records: PrivateShareRecord[] = [];
  const now = Date.now();

  for (const obj of listResult.objects) {
    try {
      const getObj = await env.PDF_BUCKET.get(obj.key);
      if (getObj) {
        const item = (await getObj.json()) as PrivateShareRecord;
        // Dynamically compute expiration status
        if (item.status === 'active' && item.expiresAt && now > item.expiresAt) {
          item.status = 'expired';
        }
        records.push(item);
      }
    } catch {
      // Continue on individual object read error
    }
  }

  // Sort descending by creation date
  records.sort((a, b) => b.createdAt - a.createdAt);
  return records;
}

/**
 * Resolves material metadata for a private share from either admin or public partition.
 */
export async function resolveMaterialForShare(
  materialId: string,
  adminToken: string,
  env: Env
): Promise<PublicMaterialRecord | null> {
  // Try admin partition first with token
  const adminMat = await getAdminMaterialMetadata(materialId, adminToken, env);
  if (adminMat) return adminMat;

  // Fallback to public partition
  return await getPublicMaterialMetadata(materialId, env);
}
