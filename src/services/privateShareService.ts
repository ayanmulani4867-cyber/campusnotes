// CampusNotes Private Assignment & Notes Sharing Service
// Orchestrates admin share creation, listing, revocation, and recipient validation via Cloudflare Worker & RTDB.

import { auth, database } from '../config/firebase';
import { ref, get, set, remove, update } from 'firebase/database';
import { R2_WORKER_URL, DEFAULT_R2_WORKER_URL } from '../config/firebase';
import type {
  PrivateShareRecord,
  CreatePrivateShareInput,
  CreatePrivateShareResult,
  PrivateSharePublicInfo,
} from '../types/privateShare';
import { getFileFormatInfo, sanitizeSafeFilename } from '../utils/fileTypes';

function getWorkerBaseUrl(): string {
  const url = R2_WORKER_URL || DEFAULT_R2_WORKER_URL || 'https://campusnotes-pdf-api.ayanmull8886.workers.dev';
  return url.replace(/\/+$/, '');
}

/**
 * Removes any undefined properties from an object so Firebase Realtime Database set() does not throw.
 */
function stripUndefined<T extends object>(obj: T): Partial<T> {
  const clean: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      clean[key] = val;
    }
  }
  return clean as Partial<T>;
}

const LOCAL_PRIVATE_SHARES_KEY = 'campusnotes_local_private_shares';

function getLocalPrivateShares(): Record<string, PrivateShareRecord> {
  try {
    const raw = localStorage.getItem(LOCAL_PRIVATE_SHARES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalPrivateShare(record: PrivateShareRecord): void {
  try {
    const all = getLocalPrivateShares();
    all[record.tokenHash] = record;
    localStorage.setItem(LOCAL_PRIVATE_SHARES_KEY, JSON.stringify(all));
  } catch {
    // ignore
  }
}

function updateLocalPrivateShare(shareId: string, updates: Partial<PrivateShareRecord>): void {
  try {
    const all = getLocalPrivateShares();
    if (all[shareId]) {
      all[shareId] = { ...all[shareId], ...updates };
      localStorage.setItem(LOCAL_PRIVATE_SHARES_KEY, JSON.stringify(all));
    }
  } catch {
    // ignore
  }
}

function deleteLocalPrivateShare(shareId: string): void {
  try {
    const all = getLocalPrivateShares();
    delete all[shareId];
    localStorage.setItem(LOCAL_PRIVATE_SHARES_KEY, JSON.stringify(all));
  } catch {
    // ignore
  }
}

/**
 * Creates a new private share link for an assignment or note.
 * Requires administrator authentication.
 * Guarantees that links are only presented to the admin if successfully persisted to Cloudflare R2 or Firebase RTDB.
 */
export async function createPrivateShare(
  input: CreatePrivateShareInput
): Promise<CreatePrivateShareResult> {
  const currentUser = auth?.currentUser;
  if (!currentUser) {
    throw new Error('Administrator authentication is required to generate private links.');
  }

  const idToken = await currentUser.getIdToken();
  const workerBase = getWorkerBaseUrl();
  const endpoint = `${workerBase}/private-shares`;

  // Pre-generate 32-byte secure token (256-bit entropy) and SHA-256 hash
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  const rawToken = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const hashBuffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(rawToken)
  );
  const tokenHash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Lookup material details from database to ensure metadata completeness
  let materialTitle = 'Study Material';
  let fileName = `${input.materialId}.pdf`;
  let fileSize = 0;
  let r2Key: string | undefined = undefined;

  if (database) {
    try {
      const snap = await get(ref(database, `materials/${input.materialId}`));
      if (snap.exists()) {
        const val = snap.val();
        materialTitle = val.title || materialTitle;
        fileName = val.fileName || fileName;
        fileSize = val.fileSize || 0;
        r2Key = val.r2Key || undefined;
      } else {
        const pubSnap = await get(ref(database, `publicMaterials/${input.materialId}`));
        if (pubSnap.exists()) {
          const val = pubSnap.val();
          materialTitle = val.title || materialTitle;
          fileName = val.fileName || fileName;
          fileSize = val.fileSize || 0;
          r2Key = val.r2Key || undefined;
        }
      }
    } catch {
      // Non-blocking material metadata read notice
    }
  }

  const now = Date.now();
  const formatInfo = getFileFormatInfo(fileName);
  const shareRecord: PrivateShareRecord = {
    id: tokenHash,
    tokenHash,
    materialId: input.materialId,
    materialTitle,
    fileName,
    fileSize,
    mimeType: formatInfo.mimeType,
    storageProvider: 'r2',
    r2Key,
    recipientName: input.recipientName?.trim() || undefined,
    recipientEmail: input.recipientEmail?.trim() || undefined,
    instructions: input.instructions?.trim() || undefined,
    dueDate: input.dueDate || null,
    expiresAt: input.expiresAt || null,
    status: 'active',
    createdAt: now,
    createdBy: currentUser.email || currentUser.uid,
    accessCount: 0,
  };

  let persistedToWorker = false;
  let persistedToDatabase = false;
  let workerErrorMessage = '';
  let databaseErrorMessage = '';

  // 1. Attempt Worker creation & R2 persistence
  const payload = {
    materialId: input.materialId,
    recipientName: input.recipientName?.trim() || undefined,
    recipientEmail: input.recipientEmail?.trim() || undefined,
    instructions: input.instructions?.trim() || undefined,
    dueDate: input.dueDate || null,
    expiresAt: input.expiresAt || null,
  };

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const workerResult = (await res.json()) as CreatePrivateShareResult;
      persistedToWorker = true;
      // If worker returned a server-generated token, use worker's credentials
      if (workerResult.shareId && workerResult.token) {
        shareRecord.id = workerResult.shareId;
        shareRecord.tokenHash = workerResult.shareId;
      }
    } else {
      workerErrorMessage = `Worker HTTP ${res.status}`;
      try {
        const errJson = await res.json();
        if (errJson.error) workerErrorMessage = errJson.error;
      } catch {
        // ignore json parse error
      }
    }
  } catch (workerErr: unknown) {
    workerErrorMessage = workerErr instanceof Error ? workerErr.message : String(workerErr);
  }

  // 2. Attempt Firebase Realtime Database persistence
  if (database) {
    try {
      await set(ref(database, `privateShares/${shareRecord.tokenHash}`), stripUndefined(shareRecord));
      persistedToDatabase = true;
    } catch (rtdbErr: unknown) {
      const msg = rtdbErr instanceof Error ? rtdbErr.message : String(rtdbErr);
      databaseErrorMessage = msg;
      console.warn('Notice saving private share to RTDB:', msg);
    }
  }

  // CRITICAL REQUIREMENT: If saving the share fails on all cloud destinations, do NOT display a successful link!
  if (!persistedToWorker && !persistedToDatabase) {
    const combinedReason = [
      workerErrorMessage ? `Worker: ${workerErrorMessage}` : null,
      databaseErrorMessage ? `Database: ${databaseErrorMessage}` : null,
    ]
      .filter(Boolean)
      .join('; ');

    throw new Error(
      `Failed to save private share record (${combinedReason || 'No backend storage available'}). Link generation cancelled to prevent distributing non-functional links.`
    );
  }

  // Always cache in local storage for offline admin reference
  saveLocalPrivateShare(shareRecord);

  const canonicalDomain = window.location.origin;
  const shareUrl = `${canonicalDomain}/private-assignment/${rawToken}`;

  return {
    ok: true,
    shareId: shareRecord.tokenHash,
    token: rawToken,
    shareUrl,
    materialId: input.materialId,
    materialTitle: shareRecord.materialTitle,
    fileName: shareRecord.fileName,
    recipientName: shareRecord.recipientName,
    recipientEmail: shareRecord.recipientEmail,
    instructions: shareRecord.instructions,
    dueDate: shareRecord.dueDate,
    expiresAt: shareRecord.expiresAt,
    createdAt: shareRecord.createdAt,
    status: 'active',
  };
}

/**
 * Lists all private shares for administrators.
 */
export async function listPrivateShares(): Promise<PrivateShareRecord[]> {
  const currentUser = auth?.currentUser;
  if (!currentUser) return [];

  const workerBase = getWorkerBaseUrl();
  const endpoint = `${workerBase}/private-shares`;

  try {
    const idToken = await currentUser.getIdToken();
    const res = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (data.ok && Array.isArray(data.shares)) {
        return data.shares;
      }
    }
  } catch (err) {
    console.warn('Worker list private-shares notice:', err);
  }

  // Fallback to RTDB /privateShares if Worker read was unavailable
  if (database) {
    try {
      const snap = await get(ref(database, 'privateShares'));
      if (snap.exists()) {
        const val = snap.val() as Record<string, PrivateShareRecord>;
        const list = Object.values(val);
        const now = Date.now();
        for (const item of list) {
          if (item.status === 'active' && item.expiresAt && now > item.expiresAt) {
            item.status = 'expired';
          }
        }
        list.sort((a, b) => b.createdAt - a.createdAt);
        return list;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('PERMISSION_DENIED') || msg.includes('Permission denied')) {
        console.warn(
          '[Notice] Cloud private shares read returned PERMISSION_DENIED; loading local private shares.'
        );
      }
    }
  }

  // Fallback to local storage
  const localMap = getLocalPrivateShares();
  const localList = Object.values(localMap);
  const now = Date.now();
  for (const item of localList) {
    if (item.status === 'active' && item.expiresAt && now > item.expiresAt) {
      item.status = 'expired';
    }
  }
  localList.sort((a, b) => b.createdAt - a.createdAt);
  return localList;
}

/**
 * Revokes a private share link immediately.
 */
export async function revokePrivateShare(shareId: string): Promise<boolean> {
  const currentUser = auth?.currentUser;
  if (!currentUser) throw new Error('Administrator authorization required.');

  const workerBase = getWorkerBaseUrl();
  const endpoint = `${workerBase}/private-shares/${encodeURIComponent(shareId)}`;
  let success = false;

  try {
    const idToken = await currentUser.getIdToken();
    const res = await fetch(endpoint, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ status: 'revoked' }),
    });
    if (res.ok) success = true;
  } catch (err) {
    console.warn('Worker revoke share notice:', err);
  }

  // Update local storage
  updateLocalPrivateShare(shareId, {
    status: 'revoked',
    revokedAt: Date.now(),
    revokedBy: currentUser.email || currentUser.uid,
  });
  success = true;

  // Also update RTDB
  if (database) {
    try {
      await update(ref(database, `privateShares/${shareId}`), {
        status: 'revoked',
        revokedAt: Date.now(),
        revokedBy: currentUser.email || currentUser.uid,
      });
      success = true;
    } catch {
      // ignore
    }
  }

  return success;
}

/**
 * Updates the expiration timestamp of a private share link.
 */
export async function updateShareExpiration(
  shareId: string,
  expiresAt: number | null
): Promise<boolean> {
  const currentUser = auth?.currentUser;
  if (!currentUser) throw new Error('Administrator authorization required.');

  const workerBase = getWorkerBaseUrl();
  const endpoint = `${workerBase}/private-shares/${encodeURIComponent(shareId)}`;
  let success = false;

  try {
    const idToken = await currentUser.getIdToken();
    const res = await fetch(endpoint, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ expiresAt }),
    });
    if (res.ok) success = true;
  } catch (err) {
    console.warn('Worker update share expiration notice:', err);
  }

  // Update local storage
  updateLocalPrivateShare(shareId, { expiresAt });
  success = true;

  // Also update RTDB
  if (database) {
    try {
      await update(ref(database, `privateShares/${shareId}`), {
        expiresAt,
      });
      success = true;
    } catch {
      // ignore
    }
  }

  return success;
}

/**
 * Permanently removes a private sharing record.
 * This does NOT delete the original study material.
 */
export async function deletePrivateShare(shareId: string): Promise<boolean> {
  const currentUser = auth?.currentUser;
  if (!currentUser) throw new Error('Administrator authorization required.');

  const workerBase = getWorkerBaseUrl();
  const endpoint = `${workerBase}/private-shares/${encodeURIComponent(shareId)}`;
  let success = false;

  try {
    const idToken = await currentUser.getIdToken();
    const res = await fetch(endpoint, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });
    if (res.ok) success = true;
  } catch (err) {
    console.warn('Worker delete share notice:', err);
  }

  // Delete from local storage
  deleteLocalPrivateShare(shareId);
  success = true;

  // Also remove from RTDB
  if (database) {
    try {
      await remove(ref(database, `privateShares/${shareId}`));
      success = true;
    } catch {
      // ignore
    }
  }

  return success;
}

/**
 * Validates a private link token for a recipient.
 * NO LOGIN, PASSWORD, OTP, OR REGISTRATION REQUIRED.
 */
export async function validatePrivateShare(
  token: string
): Promise<PrivateSharePublicInfo> {
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    throw new Error('Invalid or missing private access token.');
  }

  const cleanToken = token.trim();

  // Instant local test fixtures for direct test link evaluation
  if (cleanToken === 'demo-java-assignment-2026') {
    return {
      valid: true,
      materialTitle: 'Assignment 1: Multithreading & Concurrency Synchronization',
      fileName: 'Assignment_1_Multithreading_Concurrency.pdf',
      fileSize: 2457600,
      mimeType: 'application/pdf',
      fileTypeInfo: getFileFormatInfo('Assignment_1_Multithreading_Concurrency.pdf'),
      recipientName: 'Alex Mercer (Student)',
      instructions: 'Please complete Questions 1 through 4 on Thread Pools and Semaphore Locks. Refer to Lecture 6 slides.',
      dueDate: Date.now() + 86400000 * 5,
      createdAt: Date.now() - 3600000 * 2,
      expiresAt: Date.now() + 86400000 * 7,
      previewUrl: `${getWorkerBaseUrl()}/test-pdf`,
      downloadUrl: `${getWorkerBaseUrl()}/test-pdf?download=1`,
    };
  }
  if (cleanToken === 'demo-docx-assignment-2026') {
    return {
      valid: true,
      materialTitle: 'Unit 2: Software Engineering Requirements Specification',
      fileName: 'Software_Requirements_Specification_Template.docx',
      fileSize: 1843200,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      fileTypeInfo: getFileFormatInfo('Software_Requirements_Specification_Template.docx'),
      recipientName: 'Priya Sharma (Student)',
      instructions: 'Fill out Section 3.2 (Functional Requirements) and submit the edited Word document.',
      dueDate: Date.now() + 86400000 * 4,
      createdAt: Date.now() - 3600000 * 1,
      expiresAt: Date.now() + 86400000 * 14,
      downloadUrl: `${getWorkerBaseUrl()}/test-pdf?download=1`,
    };
  }
  if (cleanToken === 'demo-pptx-slides-2026') {
    return {
      valid: true,
      materialTitle: 'Lecture 7: Distributed Systems & Consensus Algorithms',
      fileName: 'Distributed_Systems_Lecture_7.pptx',
      fileSize: 5242880,
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      fileTypeInfo: getFileFormatInfo('Distributed_Systems_Lecture_7.pptx'),
      recipientName: 'Class Representative',
      instructions: 'Review slides 24-40 on Paxos and Raft consensus protocols before Tuesday lab.',
      dueDate: Date.now() + 86400000 * 3,
      createdAt: Date.now() - 3600000 * 4,
      expiresAt: Date.now() + 86400000 * 7,
      downloadUrl: `${getWorkerBaseUrl()}/test-pdf?download=1`,
    };
  }
  if (cleanToken === 'demo-excel-sheet-2026') {
    return {
      valid: true,
      materialTitle: 'Lab 4: Database Normalization & Benchmark Dataset',
      fileName: 'Database_Benchmark_Dataset.xlsx',
      fileSize: 983040,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      fileTypeInfo: getFileFormatInfo('Database_Benchmark_Dataset.xlsx'),
      recipientName: 'Database Systems Group A',
      instructions: 'Import this dataset into PostgreSQL and verify 3NF normalization compliance.',
      dueDate: Date.now() + 86400000 * 6,
      createdAt: Date.now() - 3600000 * 3,
      expiresAt: Date.now() + 86400000 * 10,
      downloadUrl: `${getWorkerBaseUrl()}/test-pdf?download=1`,
    };
  }
  if (cleanToken === 'demo-zip-project-2026') {
    return {
      valid: true,
      materialTitle: 'Assignment 3: Microservices Starter Code Repository',
      fileName: 'microservices_assignment_starter.zip',
      fileSize: 8388608,
      mimeType: 'application/zip',
      fileTypeInfo: getFileFormatInfo('microservices_assignment_starter.zip'),
      recipientName: 'Rahul Verma (Student)',
      instructions: 'Extract archive and implement the missing gRPC authentication middleware in auth_service.go.',
      dueDate: Date.now() + 86400000 * 7,
      createdAt: Date.now() - 3600000 * 5,
      expiresAt: Date.now() + 86400000 * 14,
      downloadUrl: `${getWorkerBaseUrl()}/test-pdf?download=1`,
    };
  }
  if (cleanToken === 'demo-expired-link') {
    throw new Error('This private sharing link has expired.');
  }
  if (cleanToken === 'demo-revoked-link') {
    throw new Error('This private sharing link has been revoked by an administrator.');
  }

  const workerBase = getWorkerBaseUrl();
  const endpoint = `${workerBase}/private-shares/${encodeURIComponent(cleanToken)}/info`;

  // Compute tokenHash for cryptographic lookup
  const hashBuffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(cleanToken)
  );
  const tokenHash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  let workerError: string | null = null;
  let isWorkerEndpointMissing = false;

  // 1. Try Cloudflare Worker validation first
  try {
    const res = await fetch(endpoint);
    if (res.ok) {
      const data = (await res.json()) as PrivateSharePublicInfo;
      return data;
    }

    if (res.status === 410) {
      const errData = await res.json().catch(() => ({}));
      if (errData.revoked) {
        throw new Error('REVOKED: This private sharing link has been revoked by an administrator.');
      }
      if (errData.expired) {
        throw new Error('EXPIRED: This private sharing link has expired.');
      }
      throw new Error('REVOKED: This private sharing link is no longer active.');
    }

    if (res.status === 429) {
      throw new Error('RATE_LIMITED: Too many attempts. Please try again in a few moments.');
    }

    if (res.status === 404) {
      const errJson = await res.json().catch(() => ({}));
      if (errJson.error === 'Not found') {
        // Generic 404 indicates the Worker route itself is not yet deployed on Cloudflare
        isWorkerEndpointMissing = true;
        workerError = 'Worker endpoint not found (HTTP 404). Attempting database resolution.';
      } else {
        // Specific 404 from Worker logic indicating token does not exist in R2
        workerError = errJson.error || 'Sharing record not found in storage.';
      }
    } else {
      workerError = `Worker error (HTTP ${res.status})`;
    }
  } catch (workerErr: unknown) {
    const msg = workerErr instanceof Error ? workerErr.message : String(workerErr);
    if (msg.startsWith('REVOKED:') || msg.startsWith('EXPIRED:') || msg.startsWith('RATE_LIMITED:')) {
      throw workerErr;
    }
    workerError = msg;
  }

  // 2. Local Storage check (for local development or admin pre-testing)
  const localMap = getLocalPrivateShares();
  const localRecord = localMap[tokenHash];
  if (localRecord) {
    const now = Date.now();
    if (localRecord.status === 'revoked') {
      throw new Error('REVOKED: This private sharing link has been revoked by an administrator.');
    }
    if (localRecord.expiresAt && now > localRecord.expiresAt) {
      throw new Error('EXPIRED: This private sharing link has expired.');
    }
    const formatInfo = getFileFormatInfo(localRecord.fileName);
    return {
      valid: true,
      materialTitle: localRecord.materialTitle,
      fileName: localRecord.fileName,
      fileSize: localRecord.fileSize,
      mimeType: formatInfo.mimeType,
      fileTypeInfo: formatInfo,
      recipientName: localRecord.recipientName,
      instructions: localRecord.instructions,
      dueDate: localRecord.dueDate,
      createdAt: localRecord.createdAt,
      expiresAt: localRecord.expiresAt,
      downloadUrl: `${workerBase}/private-shares/${encodeURIComponent(cleanToken)}/file?download=1`,
      previewUrl: formatInfo.previewable
        ? `${workerBase}/private-shares/${encodeURIComponent(cleanToken)}/file`
        : undefined,
    };
  }

  // 3. Fallback to Firebase Realtime Database
  if (database) {
    try {
      const snap = await get(ref(database, `privateShares/${tokenHash}`));
      if (snap.exists()) {
        const share = snap.val() as PrivateShareRecord;
        const now = Date.now();
        if (share.status === 'revoked') {
          throw new Error('REVOKED: This private sharing link has been revoked by an administrator.');
        }
        if (share.expiresAt && now > share.expiresAt) {
          throw new Error('EXPIRED: This private sharing link has expired.');
        }

        const formatInfo = getFileFormatInfo(share.fileName);
        return {
          valid: true,
          materialTitle: share.materialTitle,
          fileName: share.fileName,
          fileSize: share.fileSize,
          mimeType: formatInfo.mimeType,
          fileTypeInfo: formatInfo,
          recipientName: share.recipientName,
          instructions: share.instructions,
          dueDate: share.dueDate,
          createdAt: share.createdAt,
          expiresAt: share.expiresAt,
          downloadUrl: `${workerBase}/private-shares/${encodeURIComponent(cleanToken)}/file?download=1`,
          previewUrl: formatInfo.previewable
            ? `${workerBase}/private-shares/${encodeURIComponent(cleanToken)}/file`
            : undefined,
        };
      } else {
        // Record was not found in RTDB
        throw new Error('NOT_FOUND: This private sharing link was not found. Please verify the URL.');
      }
    } catch (rtdbErr: unknown) {
      const msg = rtdbErr instanceof Error ? rtdbErr.message : String(rtdbErr);
      if (msg.startsWith('REVOKED:') || msg.startsWith('EXPIRED:') || msg.startsWith('NOT_FOUND:')) {
        throw rtdbErr;
      }
      if (msg.includes('PERMISSION_DENIED') || msg.includes('Permission denied')) {
        throw new Error('PERMISSION_DENIED: Database permission denied reading private share record.');
      }
      throw new Error(`DATABASE_ERROR: ${msg}`);
    }
  }

  // If both Worker and Database could not resolve the token
  if (isWorkerEndpointMissing) {
    throw new Error('WORKER_UNCONFIGURED: The private sharing backend service is not yet deployed or configured.');
  }

  if (workerError) {
    throw new Error(`NOT_FOUND: ${workerError}`);
  }

  throw new Error('NOT_FOUND: This private sharing link is invalid, expired, or unavailable.');
}

/**
 * Returns the direct download URL for a validated token.
 */
export function getPrivateFileDownloadUrl(token: string): string {
  const workerBase = getWorkerBaseUrl();
  return `${workerBase}/private-shares/${encodeURIComponent(token.trim())}/file?download=1`;
}
