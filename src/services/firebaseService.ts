import {
  ref,
  get,
  set,
  update,
  remove,
  query,
  orderByChild,
  equalTo,
  limitToLast,
  onValue,
} from 'firebase/database';

type RtdbSnapshot = {
  exists(): boolean;
  val(): any;
};

import { database, isFirebaseConfigured } from '../config/firebase';
import {
  Subject,
  StudyMaterial,
  DashboardStats,
  AcademicCategory,
  FileBlobRecord,
} from '../types';
import {
  OFFICIAL_CSE_SEM_5_SUBJECTS,
  EXCLUDED_SUBJECT_NAMES,
  sanitizeSubjects,
} from '../constants/subjects';
import { INITIAL_DEMO_MATERIALS } from '../constants/initialMaterials';
import { cacheService } from './cacheService';

/**
 * Realtime Database limits a single node/leaf string to 10 MB.
 * Base64 encoding increases raw binary size by ~33.3% (4/3 ratio).
 * A 6 MB raw PDF produces approximately 8.0 MB of Base64, leaving ample headroom
 * under the 10 MB limit for JSON metadata and WebSocket frame overhead.
 */
export const MAX_RTDB_PDF_SIZE_BYTES = 6 * 1024 * 1024; // 6 MB max raw PDF size
export const MAX_FILE_SIZE_BYTES = MAX_RTDB_PDF_SIZE_BYTES;

// In-memory cache for created object URLs to prevent duplicate memory allocation
const objectUrlMemoryCache = new Map<string, string>();

/**
 * Validates that the file has a genuine PDF magic byte header (%PDF-).
 * ASCII codes: 0x25 (%), 0x50 (P), 0x44 (D), 0x46 (F), 0x2D (-)
 */
export async function validatePdfSignature(file: File): Promise<boolean> {
  if (!file || file.size < 5) return false;
  try {
    const slice = file.slice(0, 5);
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    return (
      bytes[0] === 0x25 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x44 &&
      bytes[3] === 0x46 &&
      bytes[4] === 0x2D
    );
  } catch (err) {
    console.warn('PDF signature check notice:', err);
    return false;
  }
}

/**
 * Asynchronously converts a File to a Base64 string without blocking the main browser thread.
 * Native FileReader processes the read in a browser background thread.
 */
export function fileToBase64Async(
  file: File,
  onProgress?: (percent: number, bytesRead: number, totalBytes: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onprogress = (evt) => {
      if (evt.lengthComputable && onProgress) {
        // First 40% of progress represents reading from disk
        const percent = Math.round((evt.loaded / evt.total) * 40);
        onProgress(percent, evt.loaded, evt.total);
      }
    };

    reader.onload = () => {
      try {
        const result = reader.result as string;
        // Data URL format: "data:application/pdf;base64,JVBERi0xLj..."
        const base64Index = result.indexOf(';base64,');
        if (base64Index === -1) {
          reject(new Error('Failed to encode PDF: Invalid Data URL format.'));
          return;
        }
        const base64String = result.substring(base64Index + 8);
        resolve(base64String);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read PDF file from disk.'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Converts a Base64 string back into a standard binary Blob.
 */
export function base64ToBlob(base64Data: string, mimeType = 'application/pdf'): Blob {
  const binaryString = atob(base64Data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

/**
 * Revokes a cached blob URL to free browser memory.
 */
export function revokeBlobUrl(blobId: string): void {
  const existing = objectUrlMemoryCache.get(blobId);
  if (existing) {
    try {
      URL.revokeObjectURL(existing);
    } catch {
      // Ignore revocation errors
    }
    objectUrlMemoryCache.delete(blobId);
  }
}

// ==========================================
// PUBLIC METHODS (Cached & Partitioned)
// ==========================================

/**
 * Fetch active subjects for CSE Semester 5
 */
export async function getPublicSubjects(): Promise<Subject[]> {
  const cacheKey = 'public_subjects';
  const cached = cacheService.get<Subject[]>(cacheKey);
  if (cached && cached.length > 0) return cached;

  let subjectsList: Subject[] = [];

  if (isFirebaseConfigured && database) {
    try {
      const subjectsRef = ref(database, 'subjects');
      const snapshot = await get(subjectsRef);

      if (snapshot.exists()) {
        const data = snapshot.val();
        subjectsList = Object.keys(data).map((id) => ({
          ...data[id],
          id,
        }));
      }
    } catch (err: unknown) {
      console.warn('Notice reading public subjects from RTDB:', err);
    }
  }

  // If database is empty or uninitialized, provide the 9 official subjects
  if (subjectsList.length === 0) {
    const now = Date.now();
    subjectsList = OFFICIAL_CSE_SEM_5_SUBJECTS.map((s) => ({
      ...s,
      createdAt: now,
      updatedAt: now,
    }));
  }

  // Filter out any excluded subjects and prevent duplicates
  const sanitized = sanitizeSubjects(subjectsList);
  const activeSubjects = sanitized
    .filter((s) => s.active !== false)
    .sort((a, b) => a.code.localeCompare(b.code));

  cacheService.set(cacheKey, activeSubjects, 180_000); // 3 minutes cache
  return activeSubjects;
}

/**
 * Fetch published study materials from the /publicMaterials node.
 * Binary Base64 content is NOT stored in this node, ensuring fast listing.
 */
export async function getPublicMaterials(limit = 100): Promise<StudyMaterial[]> {
  const cacheKey = `public_materials_limit_${limit}`;
  const cached = cacheService.get<StudyMaterial[]>(cacheKey);
  if (cached) return cached;

  let materials: StudyMaterial[] = [];

  if (isFirebaseConfigured && database) {
    try {
      const pubRef = ref(database, 'publicMaterials');
      const q = query(pubRef, orderByChild('createdAt'), limitToLast(limit));
      const snapshot = await get(q);

      if (snapshot.exists()) {
        const data = snapshot.val();
        materials = Object.keys(data).map((id) => ({
          ...data[id],
          id,
        }));
        materials.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      }
    } catch (err: unknown) {
      console.warn('Notice reading public materials from RTDB:', err);
    }
  }

  // Fallback to standard initial demo materials if database is empty
  if (materials.length === 0) {
    materials = INITIAL_DEMO_MATERIALS.slice(0, limit);
  }

  cacheService.set(cacheKey, materials, 60_000); // 1 minute cache
  return materials;
}

/**
 * Fetch a single published material by its unique ID
 */
export async function getPublicMaterialById(id: string): Promise<StudyMaterial | null> {
  const cacheKey = `material_${id}`;
  const cached = cacheService.get<StudyMaterial>(cacheKey);
  if (cached) return cached;

  if (isFirebaseConfigured && database) {
    try {
      const materialRef = ref(database, `publicMaterials/${id}`);
      const snapshot = await get(materialRef);

      if (snapshot.exists()) {
        const material: StudyMaterial = {
          ...snapshot.val(),
          id,
        };
        cacheService.set(cacheKey, material, 120_000);
        return material;
      }
    } catch (err: unknown) {
      console.warn(`Notice fetching material ${id} from RTDB:`, err);
    }
  }

  const fallback = INITIAL_DEMO_MATERIALS.find((m) => m.id === id) || null;
  if (fallback) cacheService.set(cacheKey, fallback, 120_000);
  return fallback;
}

/**
 * Fetch materials for a specific subject
 */
export async function getPublicMaterialsBySubject(subjectId: string): Promise<StudyMaterial[]> {
  const cacheKey = `subject_materials_${subjectId}`;
  const cached = cacheService.get<StudyMaterial[]>(cacheKey);
  if (cached) return cached;

  let materials: StudyMaterial[] = [];

  if (isFirebaseConfigured && database) {
    try {
      const pubRef = ref(database, 'publicMaterials');
      const q = query(pubRef, orderByChild('subjectId'), equalTo(subjectId));
      const snapshot = await get(q);

      if (snapshot.exists()) {
        const data = snapshot.val();
        materials = Object.keys(data).map((id) => ({
          ...data[id],
          id,
        }));
        materials.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      }
    } catch (err) {
      console.warn(`Notice fetching materials for subject ${subjectId} from RTDB:`, err);
    }
  }

  // Fallback to standard demo materials for subject
  if (materials.length === 0) {
    materials = INITIAL_DEMO_MATERIALS.filter((m) => m.subjectId === subjectId);
  }

  cacheService.set(cacheKey, materials, 60_000);
  return materials;
}

// ==========================================
// RTDB-ONLY PDF BLOB RETRIEVAL & STREAMING
// ==========================================

/**
 * Fetch PDF blob from the isolated /file_blobs partition by blob ID.
 * This is only retrieved when a user actually views or downloads a document.
 */
export async function getMaterialPdfBlob(blobId: string): Promise<FileBlobRecord | null> {
  if (!database || !blobId) return null;

  try {
    const blobRef = ref(database, `file_blobs/${blobId}`);
    const snapshot = await get(blobRef);
    if (snapshot.exists()) {
      return snapshot.val() as FileBlobRecord;
    }
  } catch (err) {
    console.error(`Error fetching PDF blob ${blobId} from RTDB:`, err);
    throw err;
  }
  return null;
}

/**
 * Helper to safely extract blob ID from any material object representation
 */
export function extractBlobId(
  material?: { blobId?: string; storagePath?: string; downloadUrl?: string } | null
): string | null {
  if (!material) return null;
  if (material.blobId && typeof material.blobId === 'string' && material.blobId.trim()) {
    return material.blobId.trim();
  }
  if (material.storagePath && typeof material.storagePath === 'string') {
    if (material.storagePath.startsWith('rtdb://file_blobs/')) {
      return material.storagePath.replace('rtdb://file_blobs/', '').trim();
    }
    if (material.storagePath.startsWith('rtdb://')) {
      return material.storagePath.replace('rtdb://', '').trim();
    }
  }
  if (material.downloadUrl && typeof material.downloadUrl === 'string') {
    if (material.downloadUrl.startsWith('rtdb://file_blobs/')) {
      return material.downloadUrl.replace('rtdb://file_blobs/', '').trim();
    }
    if (material.downloadUrl.startsWith('rtdb://')) {
      return material.downloadUrl.replace('rtdb://', '').trim();
    }
  }
  return null;
}

/**
 * Sanitizes a filename for cross-platform file saving
 */
export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
}

/**
 * Resolves a preview and download URL for any material.
 * - If stored as Base64 in RTDB (/file_blobs/): fetches on demand, decodes to Blob, creates a blob: URL.
 * - If legacy URL (/demo-pdfs/ or external HTTP): returns the URL directly.
 */
export async function fetchPdfBlobUrl(material: StudyMaterial): Promise<string> {
  // 1. Direct path for local demo PDFs
  if (material.downloadUrl && material.downloadUrl.startsWith('/demo-pdfs/')) {
    return material.downloadUrl;
  }

  // 2. Resolve blobId from material metadata
  let blobId = extractBlobId(material);

  // If blobId wasn't found in current object, check the database for fresh metadata
  if (!blobId && database && material.id) {
    try {
      const pubSnap = await get(ref(database, `publicMaterials/${material.id}`));
      if (pubSnap.exists()) {
        blobId = extractBlobId(pubSnap.val());
      } else {
        const matSnap = await get(ref(database, `materials/${material.id}`)).catch(() => null);
        if (matSnap && matSnap.exists()) {
          blobId = extractBlobId(matSnap.val());
        }
      }
    } catch {
      // Ignore network fallback error
    }
  }

  if (blobId) {
    // Return cached object URL if already created in this browser session
    if (objectUrlMemoryCache.has(blobId)) {
      return objectUrlMemoryCache.get(blobId)!;
    }

    const blobRecord = await getMaterialPdfBlob(blobId);
    if (blobRecord && blobRecord.data_base64) {
      const blob = base64ToBlob(blobRecord.data_base64, blobRecord.mime_type || 'application/pdf');
      const url = URL.createObjectURL(blob);
      objectUrlMemoryCache.set(blobId, url);
      return url;
    }
  }

  // 3. Fallback to existing downloadUrl if valid HTTP URL
  if (material.downloadUrl && material.downloadUrl.startsWith('http')) {
    return material.downloadUrl;
  }

  throw new Error('PDF document content could not be located in Realtime Database.');
}

/**
 * Safely downloads a study material for public or admin users:
 * 1. Fetches latest published material metadata directly from RTDB to guarantee fresh blobId (bypassing stale cache).
 * 2. If it's a local demo PDF (/demo-pdfs/...), downloads directly.
 * 3. Extracts current blobId (from blobId, storagePath, or downloadUrl).
 * 4. Fetches file blob record from /file_blobs/{blobId}.
 * 5. Decodes Base64 data into binary PDF bytes.
 * 6. Creates a temporary Blob URL (application/pdf).
 * 7. Triggers programmatic browser download without popup blockers (no target=_blank).
 * 8. Schedules cleanup of temporary Blob URL after download completes.
 */
export async function downloadStudyMaterial(
  materialInput: StudyMaterial,
  onProgress?: (status: string) => void
): Promise<void> {
  // Step 1: Ensure we have the freshest material metadata directly from RTDB
  let freshMaterial = materialInput;
  if (database && materialInput.id) {
    try {
      const pubSnap = await get(ref(database, `publicMaterials/${materialInput.id}`));
      if (pubSnap.exists()) {
        freshMaterial = { ...materialInput, ...pubSnap.val() };
      } else {
        const privSnap = await get(ref(database, `materials/${materialInput.id}`)).catch(() => null);
        if (privSnap && privSnap.exists()) {
          freshMaterial = { ...materialInput, ...privSnap.val() };
        }
      }
    } catch {
      // Proceed with passed materialInput if RTDB read fails
    }
  }

  // Step 2: Handle static demo PDFs (/demo-pdfs/...)
  if (freshMaterial.downloadUrl && freshMaterial.downloadUrl.startsWith('/demo-pdfs/')) {
    const link = document.createElement('a');
    link.href = freshMaterial.downloadUrl;
    link.download = freshMaterial.fileName || `${sanitizeFilename(freshMaterial.title)}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;
  }

  // Step 3: Handle external HTTP URLs
  if (freshMaterial.downloadUrl && freshMaterial.downloadUrl.startsWith('http')) {
    const link = document.createElement('a');
    link.href = freshMaterial.downloadUrl;
    link.download = freshMaterial.fileName || `${sanitizeFilename(freshMaterial.title)}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;
  }

  // Step 4: Resolve blob ID
  const blobId = extractBlobId(freshMaterial);
  if (!blobId) {
    throw new Error('This study material does not have an associated PDF document in the database.');
  }

  onProgress?.('Fetching PDF from database...');

  // Step 5: Fetch blob from RTDB /file_blobs/{blobId}
  const blobRecord = await getMaterialPdfBlob(blobId);
  if (!blobRecord || !blobRecord.data_base64) {
    throw new Error('The requested PDF document could not be retrieved from the database or access was denied.');
  }

  onProgress?.('Preparing file download...');

  // Step 6: Decode Base64 to binary PDF Blob
  const pdfBlob = base64ToBlob(blobRecord.data_base64, blobRecord.mime_type || 'application/pdf');

  // Step 7: Create object URL and trigger browser download
  const blobUrl = URL.createObjectURL(pdfBlob);
  const safeFilename = freshMaterial.fileName || blobRecord.file_name || `${sanitizeFilename(freshMaterial.title)}.pdf`;

  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = safeFilename;
  // NOTE: Do not use target="_blank" as it causes popup blocker violations after async operations
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Step 8: Revoke temporary Blob URL after generous timeout
  setTimeout(() => {
    try {
      URL.revokeObjectURL(blobUrl);
    } catch {
      // Ignore
    }
  }, 30000);
}

// ==========================================
// ADMIN METHODS (Strictly Authorized)
// ==========================================

/**
 * Fetch all subjects including inactive, sanitized for official 9 subjects
 */
export async function getAllSubjectsAdmin(): Promise<Subject[]> {
  let subjectsList: Subject[] = [];

  if (database) {
    try {
      const subjectsRef = ref(database, 'subjects');
      const snapshot = await get(subjectsRef);

      if (snapshot.exists()) {
        const data = snapshot.val();
        subjectsList = Object.keys(data).map((id) => ({
          ...data[id],
          id,
        }));
      }
    } catch (err) {
      console.warn('Notice reading admin subjects from RTDB:', err);
    }
  }

  // Fallback to official 9 subjects if database is empty
  if (subjectsList.length === 0) {
    const now = Date.now();
    subjectsList = OFFICIAL_CSE_SEM_5_SUBJECTS.map((s) => ({
      ...s,
      createdAt: now,
      updatedAt: now,
    }));
  }

  return sanitizeSubjects(subjectsList).sort((a, b) => a.code.localeCompare(b.code));
}

/**
 * Create or save a subject
 */
export async function saveSubject(
  subject: Omit<Subject, 'createdAt' | 'updatedAt'>,
  isEdit = false
): Promise<void> {
  if (!database) throw new Error('Database not initialized');

  const now = Date.now();
  const subjectRef = ref(database, `subjects/${subject.id}`);

  if (isEdit) {
    await update(subjectRef, {
      name: subject.name.trim(),
      code: subject.code.trim().toUpperCase(),
      description: subject.description?.trim() || '',
      active: subject.active,
      updatedAt: now,
    });
  } else {
    await set(subjectRef, {
      name: subject.name.trim(),
      code: subject.code.trim().toUpperCase(),
      description: subject.description?.trim() || '',
      active: subject.active,
      createdAt: now,
      updatedAt: now,
    });
  }

  cacheService.invalidate('public_subjects');
}

/**
 * Delete a subject after confirming no active materials link to it
 */
export async function deleteSubject(subjectId: string): Promise<void> {
  if (!database) throw new Error('Database not initialized');

  const materialsRef = ref(database, 'materials');
  const q = query(materialsRef, orderByChild('subjectId'), equalTo(subjectId));
  const snapshot = await get(q);

  if (snapshot.exists()) {
    const count = Object.keys(snapshot.val()).length;
    throw new Error(
      `Cannot delete subject: ${count} study material(s) are associated with this subject. Please delete or reassign them first.`
    );
  }

  await remove(ref(database, `subjects/${subjectId}`));
  cacheService.invalidate('public_subjects');
}

/**
 * Fetch all materials for administrator (both published and drafts).
 * Base64 content is isolated under /file_blobs and is NOT loaded here.
 */
export async function getAllMaterialsAdmin(): Promise<StudyMaterial[]> {
  if (!database) return INITIAL_DEMO_MATERIALS;

  try {
    const materialsRef = ref(database, 'materials');
    const snapshot = await get(materialsRef);

    if (!snapshot.exists()) return INITIAL_DEMO_MATERIALS;

    const data = snapshot.val();
    const list: StudyMaterial[] = Object.keys(data).map((id) => ({
      ...data[id],
      id,
    }));

    if (list.length === 0) return INITIAL_DEMO_MATERIALS;

    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return list;
  } catch (err: unknown) {
    console.warn('Notice reading admin materials from RTDB, using demo catalog:', err);
    return INITIAL_DEMO_MATERIALS;
  }
}

/**
 * Upload PDF directly to Firebase Realtime Database as Base64.
 * Validates format, %PDF- magic bytes, and enforces the 6 MB raw file limit.
 */
export async function uploadPdfFile(
  file: File,
  _subjectId: string,
  materialId: string,
  onProgress?: (percent: number, bytesTransferred: number, totalBytes: number) => void,
  isPublished: boolean = true
): Promise<{ storagePath: string; downloadUrl: string; fileName: string; fileSize: number; blobId: string }> {
  if (!database) {
    throw new Error('Firebase Realtime Database is not initialized.');
  }

  // 1. File type and extension validation
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    throw new Error('Only valid PDF documents (.pdf) are permitted.');
  }

  // 2. Strict file size validation (6 MB max for RTDB storage)
  if (file.size > MAX_RTDB_PDF_SIZE_BYTES) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    throw new Error(
      `File size (${sizeMB} MB) exceeds maximum allowed limit of 6 MB for Realtime Database storage. (Base64 encoding expands file size by ~33%, requiring raw size <= 6 MB to fit safely within RTDB's 10 MB node threshold).`
    );
  }

  // 3. Binary header signature validation (%PDF-)
  const isSignatureValid = await validatePdfSignature(file);
  if (!isSignatureValid) {
    throw new Error('Invalid file format: File header does not match standard PDF signature (%PDF-).');
  }

  // 4. Asynchronous Base64 conversion off the main thread
  onProgress?.(10, Math.round(file.size * 0.1), file.size);
  const base64Data = await fileToBase64Async(file, onProgress);
  onProgress?.(50, Math.round(file.size * 0.5), file.size);

  const timestamp = Date.now();
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const blobId = `blob_${materialId}_${timestamp}`;
  const storagePath = `rtdb://file_blobs/${blobId}`;
  const downloadUrl = `rtdb://${blobId}`;

  const blobRecord: FileBlobRecord = {
    blob_id: blobId,
    material_id: materialId,
    file_name: sanitizedName,
    file_size_bytes: file.size,
    mime_type: 'application/pdf',
    data_base64: base64Data,
    published: isPublished,
    created_at: timestamp,
  };

  onProgress?.(70, Math.round(file.size * 0.7), file.size);

  // 5. Save blob to RTDB /file_blobs/{blobId} with a 45-second timeout guard
  const writePromise = set(ref(database, `file_blobs/${blobId}`), blobRecord);
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () =>
        reject(
          new Error(
            'Upload timed out after 45 seconds. Please ensure database.rules.json is published in Firebase Console -> Realtime Database -> Rules.'
          )
        ),
      45000
    )
  );

  await Promise.race([writePromise, timeoutPromise]);
  onProgress?.(100, file.size, file.size);

  return {
    storagePath,
    downloadUrl,
    fileName: file.name,
    fileSize: file.size,
    blobId,
  };
}

/**
 * Check if a blob ID is referenced by any other material in RTDB
 */
export async function isBlobReferencedByOthers(
  blobId: string,
  excludeMaterialId: string
): Promise<boolean> {
  if (!database || !blobId) return false;
  try {
    const snapshot = await get(ref(database, 'materials'));
    if (snapshot.exists()) {
      const data = snapshot.val() as Record<string, StudyMaterial>;
      for (const [id, item] of Object.entries(data)) {
        if (
          id !== excludeMaterialId &&
          (item.blobId === blobId || item.storagePath === `rtdb://file_blobs/${blobId}`)
        ) {
          return true;
        }
      }
    }
  } catch (err) {
    console.warn('Notice checking blob references:', err);
  }
  return false;
}

/**
 * Save new study material with metadata in /materials and /publicMaterials.
 * If saving metadata fails, cleans up the uploaded blob to avoid orphans.
 */
export async function createMaterial(
  data: Omit<StudyMaterial, 'createdAt' | 'updatedAt'>
): Promise<void> {
  if (!database) throw new Error('Database not initialized');

  const now = Date.now();
  const fullData: StudyMaterial = {
    ...data,
    createdAt: now,
    updatedAt: now,
  };

  const updates: Record<string, unknown> = {};
  updates[`materials/${data.id}`] = fullData;

  if (data.published) {
    updates[`publicMaterials/${data.id}`] = fullData;
  }

  try {
    await update(ref(database), updates);
    cacheService.clearAll();
  } catch (dbError) {
    console.error('Metadata creation failed. Performing orphan cleanup on file_blobs...', dbError);
    if (data.blobId) {
      try {
        await remove(ref(database, `file_blobs/${data.blobId}`));
      } catch {
        // Ignore
      }
    }
    throw dbError;
  }
}

/**
 * Update material metadata and maintain public/private partition consistency.
 * Uses a single multi-path update so changes to /materials, /publicMaterials, and
 * the blob's published state are atomic.
 */
export async function updateMaterial(
  id: string,
  updatedData: Partial<StudyMaterial>,
  existingMaterial: StudyMaterial
): Promise<void> {
  if (!database) throw new Error('Database not initialized');

  const now = Date.now();
  const merged: StudyMaterial = {
    ...existingMaterial,
    ...updatedData,
    updatedAt: now,
  };

  const updates: Record<string, unknown> = {};
  updates[`materials/${id}`] = merged;

  if (merged.published) {
    updates[`publicMaterials/${id}`] = merged;
  } else {
    updates[`publicMaterials/${id}`] = null;
  }

  // Synchronize published state to the file blob record so security rules stay consistent
  if (merged.blobId && merged.published !== existingMaterial.published) {
    updates[`file_blobs/${merged.blobId}/published`] = merged.published;
  }

  await update(ref(database), updates);
  cacheService.clearAll();
}

/**
 * Replace material PDF safely:
 * 1. Fetches current material from RTDB to ensure fresh metadata and accurate old blob ID.
 * 2. Uploads replacement to RTDB under a new versioned blobId.
 * 3. Reads back the replacement blob and verifies Base64 and valid %PDF- header.
 * 4. Atomically updates database metadata in /materials, /publicMaterials, and blob published flag.
 * 5. Verifies metadata in RTDB now points to the new blobId.
 * 6. Invalidates caches (sessionStorage and in-memory Blob URL cache).
 * 7. Deletes the old blob only after metadata confirms AND only if not shared.
 * 8. Cleans up the new blob if metadata update or verification fails (rollback).
 */
export async function replaceMaterialPdf(
  material: StudyMaterial,
  newFile: File,
  additionalMetadataOrProgress?:
    | Partial<StudyMaterial>
    | ((percent: number, bytesTransferred: number, totalBytes: number) => void),
  onProgress?: (percent: number, bytesTransferred: number, totalBytes: number) => void
): Promise<{ fileName: string; downloadUrl: string; blobId: string }> {
  if (!database) throw new Error('Database not initialized');

  let additionalMetadataUpdates: Partial<StudyMaterial> | undefined;
  let progressCb = onProgress;

  if (typeof additionalMetadataOrProgress === 'function') {
    progressCb = additionalMetadataOrProgress;
    additionalMetadataUpdates = undefined;
  } else if (additionalMetadataOrProgress) {
    additionalMetadataUpdates = additionalMetadataOrProgress;
  }

  // 1. Fetch current material from RTDB to ensure we have fresh metadata and accurate old blob ID
  let currentMaterial = material;
  try {
    const currentSnap = await get(ref(database, `materials/${material.id}`));
    if (currentSnap.exists()) {
      currentMaterial = { ...currentMaterial, ...currentSnap.val() };
    }
  } catch (fetchErr) {
    console.warn('Could not read existing material record before replacement:', fetchErr);
  }

  const oldBlobId = extractBlobId(currentMaterial) || extractBlobId(material);
  const isPublished =
    additionalMetadataUpdates?.published !== undefined
      ? additionalMetadataUpdates.published
      : (currentMaterial.published ?? material.published ?? true);

  // 2. Upload replacement PDF to RTDB under new versioned blobId
  const uploadResult = await uploadPdfFile(
    newFile,
    additionalMetadataUpdates?.subjectId || currentMaterial.subjectId || material.subjectId,
    material.id,
    progressCb,
    isPublished
  );

  try {
    // 3. Read the blob back and verify it is valid Base64 and decodes to a valid PDF
    const verifyBlobSnap = await get(ref(database, `file_blobs/${uploadResult.blobId}`));
    if (!verifyBlobSnap.exists()) {
      throw new Error('Verification failed: Replacement PDF blob could not be confirmed in database.');
    }
    const verifiedBlob = verifyBlobSnap.val() as FileBlobRecord;
    if (!verifiedBlob || !verifiedBlob.data_base64 || verifiedBlob.data_base64.length < 10) {
      throw new Error('Verification failed: Replacement PDF blob has empty or corrupted data.');
    }
    try {
      const headerSample = atob(verifiedBlob.data_base64.slice(0, 64));
      if (!headerSample.startsWith('%PDF-')) {
        throw new Error('Verification failed: Decoded replacement data does not match PDF signature (%PDF-).');
      }
    } catch (decodeErr) {
      throw new Error(`Verification failed: Decoded replacement data is not valid Base64 PDF: ${decodeErr}`);
    }

    // 4. Atomically update material metadata in /materials, /publicMaterials, and blob published flag
    const now = Date.now();
    const merged: StudyMaterial = {
      ...currentMaterial,
      ...additionalMetadataUpdates,
      fileName: uploadResult.fileName,
      storagePath: uploadResult.storagePath,
      downloadUrl: uploadResult.downloadUrl,
      blobId: uploadResult.blobId,
      fileSize: uploadResult.fileSize,
      published: isPublished,
      updatedAt: now,
    };

    const updates: Record<string, unknown> = {};
    updates[`materials/${material.id}`] = merged;
    if (isPublished) {
      updates[`publicMaterials/${material.id}`] = merged;
    } else {
      updates[`publicMaterials/${material.id}`] = null;
    }
    updates[`file_blobs/${uploadResult.blobId}/published`] = isPublished;

    await update(ref(database), updates);

    // 5. Confirm the metadata in RTDB references the new blob
    const checkMetaSnap = await get(ref(database, `materials/${material.id}`));
    if (!checkMetaSnap.exists() || checkMetaSnap.val()?.blobId !== uploadResult.blobId) {
      throw new Error('Verification failed: Material metadata was not updated with new blob reference.');
    }
    if (isPublished) {
      const checkPubSnap = await get(ref(database, `publicMaterials/${material.id}`));
      if (!checkPubSnap.exists() || checkPubSnap.val()?.blobId !== uploadResult.blobId) {
        throw new Error('Verification failed: Public material metadata was not updated with new blob reference.');
      }
    }

    // 6. Invalidate caches (sessionStorage and in-memory Blob URL cache)
    cacheService.clearAll();
    if (oldBlobId) {
      revokeBlobUrl(oldBlobId);
    }
    revokeBlobUrl(uploadResult.blobId);

    // 7. Remove old blob only after replacement is confirmed accessible and if not shared
    if (oldBlobId && oldBlobId !== uploadResult.blobId) {
      const isShared = await isBlobReferencedByOthers(oldBlobId, material.id);
      if (!isShared) {
        await remove(ref(database, `file_blobs/${oldBlobId}`)).catch((delErr: unknown) =>
          console.warn(`Old blob removal notice for ${oldBlobId}:`, delErr)
        );
      }
    }

    return {
      fileName: uploadResult.fileName,
      downloadUrl: uploadResult.downloadUrl,
      blobId: uploadResult.blobId,
    };
  } catch (err) {
    // Rollback: if updating metadata or verification failed, clean up the new uploaded blob to avoid orphans
    try {
      await remove(ref(database, `file_blobs/${uploadResult.blobId}`));
    } catch {
      // Ignore rollback cleanup error
    }
    throw err;
  }
}

/**
 * Delete material: removes database metadata and associated RTDB file blob safely
 */
export async function deleteMaterial(material: StudyMaterial): Promise<void> {
  if (!database) throw new Error('Database not initialized');

  const updates: Record<string, unknown> = {};
  updates[`materials/${material.id}`] = null;
  updates[`publicMaterials/${material.id}`] = null;

  // 1. Remove database entries from materials & publicMaterials
  await update(ref(database), updates);
  cacheService.clearAll();

  // 2. Invalidate cached blob URL
  if (material.blobId) {
    revokeBlobUrl(material.blobId);
  }

  // 3. Remove blob from /file_blobs if present and not shared
  if (material.blobId) {
    const isShared = await isBlobReferencedByOthers(material.blobId, material.id);
    if (!isShared) {
      try {
        await remove(ref(database, `file_blobs/${material.blobId}`));
      } catch (blobDelErr) {
        console.warn(`Blob deletion notice for ${material.blobId}:`, blobDelErr);
      }
    }
  }
}

/**
 * Maintenance Mode Management
 * Always defaults to false for public availability.
 */
export async function getMaintenanceMode(): Promise<boolean> {
  if (!database) {
    return false;
  }
  try {
    const snapshot = await get(ref(database, 'settings/maintenanceMode'));
    if (snapshot.exists()) {
      return Boolean(snapshot.val());
    }
  } catch (err) {
    console.warn('Notice checking maintenance mode from RTDB:', err);
  }
  return false;
}

export async function setMaintenanceMode(enabled: boolean): Promise<void> {
  if (database) {
    await set(ref(database, 'settings/maintenanceMode'), enabled);
  }
  cacheService.clearAll();
}

export function subscribeToMaintenanceMode(callback: (isMaintenance: boolean) => void): () => void {
  // Always default to false for public availability unless explicitly confirmed by database
  callback(false);
  if (!isFirebaseConfigured || !database) {
    return () => {};
  }
  const settingRef = ref(database, 'settings/maintenanceMode');
  return onValue(
    settingRef,
    (snapshot: RtdbSnapshot) => {
      const isMaint = snapshot.exists() ? Boolean(snapshot.val()) : false;
      callback(isMaint);
    },
    (err: Error) => {
      console.warn('Maintenance mode listener notice:', err);
      callback(false);
    }
  );
}

/**
 * Toggle published state
 */
export async function togglePublishMaterial(material: StudyMaterial): Promise<boolean> {
  const newStatus = !material.published;
  await updateMaterial(material.id, { published: newStatus }, material);
  return newStatus;
}

/**
 * Calculate actual statistics from Realtime Database
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const materials = await getAllMaterialsAdmin();
  const subjects = await getAllSubjectsAdmin();

  const categoryCounts: Record<AcademicCategory, number> = {
    notes: 0,
    assignments: 0,
    experiments: 0,
    pyq: 0,
    'question-banks': 0,
    syllabus: 0,
    reference: 0,
  };

  let publishedCount = 0;
  let unpublishedCount = 0;

  materials.forEach((m) => {
    if (m.published) {
      publishedCount++;
    } else {
      unpublishedCount++;
    }

    if (m.category && categoryCounts[m.category] !== undefined) {
      categoryCounts[m.category]++;
    }
  });

  return {
    totalMaterials: materials.length,
    publishedCount,
    unpublishedCount,
    totalSubjects: subjects.length,
    categoryCounts,
  };
}

/**
 * Seed the exact nine official CSE Semester 5 subjects and purge excluded subjects
 */
export async function seedStandardCseSem5Subjects(): Promise<void> {
  if (!database) {
    cacheService.clearAll();
    return;
  }

  try {
    const subjectsRef = ref(database, 'subjects');
    const snapshot = await get(subjectsRef);

    if (snapshot.exists()) {
      const existingData = snapshot.val();
      const officialCodes = new Set(OFFICIAL_CSE_SEM_5_SUBJECTS.map((s) => s.code.toUpperCase()));

      for (const [id, sub] of Object.entries(existingData as Record<string, Subject>)) {
        const isExcluded =
          EXCLUDED_SUBJECT_NAMES.some((ex) =>
            (sub.name || '').toLowerCase().includes(ex.toLowerCase())
          ) || !officialCodes.has((sub.code || '').toUpperCase());

        if (isExcluded) {
          try {
            const materialsRef = ref(database, 'materials');
            const q = query(materialsRef, orderByChild('subjectId'), equalTo(id));
            const matSnap = await get(q);
            if (matSnap.exists()) {
              const mats = matSnap.val();
              const updates: Record<string, null> = {};
              for (const matId of Object.keys(mats)) {
                updates[`materials/${matId}`] = null;
                updates[`publicMaterials/${matId}`] = null;
              }
              await update(ref(database), updates);
            }
          } catch (cleanErr) {
            console.warn(`Cleaned materials for excluded subject ${id}:`, cleanErr);
          }

          await remove(ref(database, `subjects/${id}`));
        }
      }
    }
  } catch (err) {
    console.warn('Notice checking existing subjects before seeding:', err);
  }

  for (const s of OFFICIAL_CSE_SEM_5_SUBJECTS) {
    await saveSubject(s, false);
  }

  cacheService.clearAll();
}

// ==========================================
// REAL-TIME SUBSCRIPTIONS
// ==========================================

function getSanitizedDefaultSubjects(): Subject[] {
  const now = Date.now();
  return sanitizeSubjects(
    OFFICIAL_CSE_SEM_5_SUBJECTS.map((s) => ({
      ...s,
      createdAt: now,
      updatedAt: now,
    }))
  ).sort((a, b) => a.code.localeCompare(b.code));
}

export type Unsubscribe = () => void;

/**
 * Subscribe in real time to active public subjects
 */
export function subscribeToPublicSubjects(
  callback: (subjects: Subject[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!isFirebaseConfigured || !database) {
    callback(getSanitizedDefaultSubjects());
    return () => {};
  }

  const subjectsRef = ref(database, 'subjects');
  return onValue(
    subjectsRef,
    (snapshot: RtdbSnapshot) => {
      let list: Subject[] = [];
      if (snapshot.exists()) {
        const data = snapshot.val();
        list = Object.keys(data).map((id) => ({ ...data[id], id }));
      }
      if (list.length === 0) {
        list = getSanitizedDefaultSubjects();
      }
      const sanitized = sanitizeSubjects(list)
        .filter((s) => s.active !== false)
        .sort((a, b) => a.code.localeCompare(b.code));

      cacheService.set('public_subjects', sanitized, 180_000);
      callback(sanitized);
    },
    (error: Error) => {
      console.warn('Realtime public subjects listener warning:', error);
      if (onError) onError(error);
      callback(getSanitizedDefaultSubjects());
    }
  );
}

/**
 * Seed or sync all standard initial materials
 */
export async function seedInitialDemoMaterials(): Promise<{ added: number }> {
  if (!database) {
    cacheService.clearAll();
    return { added: 0 };
  }

  const updates: Record<string, unknown> = {};
  let count = 0;

  for (const m of INITIAL_DEMO_MATERIALS) {
    updates[`materials/${m.id}`] = m;
    if (m.published) {
      updates[`publicMaterials/${m.id}`] = m;
    }
    count++;
  }

  await update(ref(database), updates);
  cacheService.clearAll();
  return { added: count };
}

/**
 * Subscribe in real time to published public materials
 */
export function subscribeToPublicMaterials(
  callback: (materials: StudyMaterial[]) => void,
  limit = 100,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!isFirebaseConfigured || !database) {
    callback(INITIAL_DEMO_MATERIALS.slice(0, limit));
    return () => {};
  }

  const pubRef = ref(database, 'publicMaterials');
  const q = query(pubRef, orderByChild('createdAt'), limitToLast(limit));

  return onValue(
    q,
    (snapshot: RtdbSnapshot) => {
      let materials: StudyMaterial[] = [];
      if (snapshot.exists()) {
        const data = snapshot.val();
        materials = Object.keys(data).map((id) => ({
          ...data[id],
          id,
        }));
        materials.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      }
      if (materials.length === 0) {
        materials = INITIAL_DEMO_MATERIALS.slice(0, limit);
      }
      cacheService.set(`public_materials_limit_${limit}`, materials, 60_000);
      callback(materials);
    },
    (error: Error) => {
      console.warn('Realtime public materials listener warning, using demo catalog:', error);
      if (onError) onError(error);
      callback(INITIAL_DEMO_MATERIALS.slice(0, limit));
    }
  );
}

/**
 * Subscribe in real time to published materials for a specific subject
 */
export function subscribeToSubjectMaterials(
  subjectId: string,
  callback: (materials: StudyMaterial[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!isFirebaseConfigured || !database) {
    callback(INITIAL_DEMO_MATERIALS.filter((m) => m.subjectId === subjectId));
    return () => {};
  }

  const pubRef = ref(database, 'publicMaterials');
  const q = query(pubRef, orderByChild('subjectId'), equalTo(subjectId));

  return onValue(
    q,
    (snapshot: RtdbSnapshot) => {
      let materials: StudyMaterial[] = [];
      if (snapshot.exists()) {
        const data = snapshot.val();
        materials = Object.keys(data).map((id) => ({
          ...data[id],
          id,
        }));
        materials.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      }
      if (materials.length === 0) {
        materials = INITIAL_DEMO_MATERIALS.filter((m) => m.subjectId === subjectId);
      }
      callback(materials);
    },
    (error: Error) => {
      console.warn(`Realtime subject materials warning (${subjectId}):`, error);
      if (onError) onError(error);
      callback(INITIAL_DEMO_MATERIALS.filter((m) => m.subjectId === subjectId));
    }
  );
}

/**
 * Subscribe in real time to all materials for admin dashboard (drafts & published)
 */
export function subscribeToMaterialsAdmin(
  callback: (materials: StudyMaterial[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!database) {
    callback(INITIAL_DEMO_MATERIALS);
    return () => {};
  }

  const materialsRef = ref(database, 'materials');
  return onValue(
    materialsRef,
    (snapshot: RtdbSnapshot) => {
      let list: StudyMaterial[] = [];
      if (snapshot.exists()) {
        const data = snapshot.val();
        list = Object.keys(data).map((id) => ({
          ...data[id],
          id,
        }));
        list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      }
      if (list.length === 0) {
        list = INITIAL_DEMO_MATERIALS;
      }
      callback(list);
    },
    (error: Error) => {
      console.warn('Realtime admin materials listener warning:', error);
      if (onError) onError(error);
      callback(INITIAL_DEMO_MATERIALS);
    }
  );
}

/**
 * Subscribe in real time to all subjects for admin dashboard
 */
export function subscribeToSubjectsAdmin(
  callback: (subjects: Subject[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!database) {
    callback(getSanitizedDefaultSubjects());
    return () => {};
  }

  const subjectsRef = ref(database, 'subjects');
  return onValue(
    subjectsRef,
    (snapshot: RtdbSnapshot) => {
      let list: Subject[] = [];
      if (snapshot.exists()) {
        const data = snapshot.val();
        list = Object.keys(data).map((id) => ({ ...data[id], id }));
      }
      if (list.length === 0) {
        list = getSanitizedDefaultSubjects();
      }
      const sanitized = sanitizeSubjects(list).sort((a, b) => a.code.localeCompare(b.code));
      callback(sanitized);
    },
    (error: Error) => {
      console.warn('Realtime admin subjects listener warning:', error);
      if (onError) onError(error);
      callback(getSanitizedDefaultSubjects());
    }
  );
}
