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

import {
  database,
  isFirebaseConfigured,
  auth,
  R2_WORKER_URL,
  DEFAULT_R2_WORKER_URL,
} from '../config/firebase';
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
import { cacheService } from './cacheService';
import { compareMaterialsAscending } from '../utils/materialSorting';
import { healthMonitorService } from './healthMonitorService';

// Lazy load fallback demo materials on demand to avoid shipping ~60 kB JSON in initial entry bundle
async function loadDemoMaterials(): Promise<StudyMaterial[]> {
  try {
    const mod = await import('../constants/initialMaterials');
    return mod.INITIAL_DEMO_MATERIALS;
  } catch {
    return [];
  }
}

/**
 * Realtime Database limits a single node/leaf string to 10 MB.
 * Base64 encoding increases raw binary size by ~33.3% (4/3 ratio).
 * A 6 MB raw PDF produces approximately 8.0 MB of Base64, leaving ample headroom
 * under the 10 MB limit for JSON metadata and WebSocket frame overhead.
 */
export const MAX_RTDB_PDF_SIZE_BYTES = 6 * 1024 * 1024; // 6 MB max raw PDF size for RTDB Base64 storage
export const MAX_R2_PDF_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB max raw PDF size for Cloudflare R2
export const MAX_FILE_SIZE_BYTES = MAX_R2_PDF_SIZE_BYTES;

// In-memory cache for created object URLs to prevent duplicate memory allocation
const objectUrlMemoryCache = new Map<string, string>();

export interface CachedPdfBlob {
  blob: Blob;
  objectUrl: string;
  fileName?: string;
  mimeType?: string;
  sizeBytes: number;
}

// Unified in-memory session cache for downloaded PDF blobs to prevent duplicate RTDB bandwidth
const pdfBlobSessionCache = new Map<string, CachedPdfBlob>();

// In-flight request deduplication map to prevent simultaneous duplicate downloads of the same blob
const inFlightPdfRequests = new Map<string, Promise<CachedPdfBlob>>();

/**
 * Checks whether a PDF blob is already cached in memory for the current session.
 * Supports blobId, r2Key, or material ID.
 */
export function isPdfCached(key?: string | null): boolean {
  if (!key) return false;
  const trimmed = key.trim();
  return (
    pdfBlobSessionCache.has(trimmed) ||
    pdfBlobSessionCache.has(`r2_${trimmed}`)
  );
}

/**
 * Returns the cached object URL for a blob or r2Key if present in the current session.
 */
export function getCachedBlobUrl(key?: string | null): string | null {
  if (!key) return null;
  const trimmed = key.trim();
  const cached = pdfBlobSessionCache.get(trimmed) || pdfBlobSessionCache.get(`r2_${trimmed}`);
  return cached ? cached.objectUrl : null;
}

/**
 * Comprehensive check whether any material (R2, Firebase RTDB blob, or local demo) is cached in session memory.
 */
export function isMaterialPdfCached(material?: StudyMaterial | null): boolean {
  if (!material) return false;
  if (material.downloadUrl && material.downloadUrl.startsWith('/demo-pdfs/')) {
    return true;
  }
  const r2Key = material.r2Key || (isR2Material(material) ? `r2_${material.id}` : null);
  if (r2Key && pdfBlobSessionCache.has(r2Key)) return true;
  const blobId = extractBlobId(material);
  if (blobId && pdfBlobSessionCache.has(blobId)) return true;
  return false;
}

/**
 * Retrieves the instant object URL or direct path for a cached study material.
 */
export function getCachedPdfUrl(material?: StudyMaterial | null): string | null {
  if (!material) return null;
  if (material.downloadUrl && material.downloadUrl.startsWith('/demo-pdfs/')) {
    return material.downloadUrl;
  }
  const r2Key = material.r2Key || (isR2Material(material) ? `r2_${material.id}` : null);
  if (r2Key && pdfBlobSessionCache.has(r2Key)) {
    return pdfBlobSessionCache.get(r2Key)!.objectUrl;
  }
  const blobId = extractBlobId(material);
  if (blobId && pdfBlobSessionCache.has(blobId)) {
    return pdfBlobSessionCache.get(blobId)!.objectUrl;
  }
  return null;
}

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
 * Converts a Base64 string back into a standard binary Blob efficiently.
 */
export function base64ToBlob(base64Data: string, mimeType = 'application/pdf'): Blob {
  // Strip data URI prefix if present without creating duplicate string copies
  let cleanData = base64Data;
  const prefixIdx = cleanData.indexOf(';base64,');
  if (prefixIdx !== -1) {
    cleanData = cleanData.substring(prefixIdx + 8);
  }

  // Fast path: native Uint8Array.fromBase64 in modern browsers (Chrome 128+, Safari 18+, Firefox 133+)
  if (
    typeof (Uint8Array as unknown as { fromBase64?: (data: string) => Uint8Array }).fromBase64 === 'function'
  ) {
    try {
      const bytes = (Uint8Array as unknown as { fromBase64: (data: string) => Uint8Array }).fromBase64(cleanData);
      return new Blob([bytes as BlobPart], { type: mimeType });
    } catch {
      // Fallback if browser throws on padding
    }
  }

  const binaryString = atob(cleanData);
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
  const cached = pdfBlobSessionCache.get(blobId);
  if (cached) {
    try {
      URL.revokeObjectURL(cached.objectUrl);
    } catch {
      // Ignore revocation errors
    }
    pdfBlobSessionCache.delete(blobId);
  }

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
        materials = Object.keys(data)
          .map((id) => ({
            ...data[id],
            id,
          }))
          .filter((m) => m.published === true);
        materials.sort(compareMaterialsAscending);
      }
    } catch (err: unknown) {
      console.warn('Notice reading public materials from RTDB:', err);
    }
  }

  // Fallback to standard initial demo materials if database is empty
  if (materials.length === 0) {
    const demo = await loadDemoMaterials();
    materials = demo.filter((m) => m.published === true).slice(0, limit);
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
        const val = snapshot.val();
        if (val && val.published === true) {
          const material: StudyMaterial = {
            ...val,
            id,
          };
          cacheService.set(cacheKey, material, 120_000);
          return material;
        }
      }
    } catch (err: unknown) {
      console.warn(`Notice fetching material ${id} from RTDB:`, err);
    }
  }

  const demo = await loadDemoMaterials();
  const fallback = demo.find((m) => m.id === id && m.published === true) || null;
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
        materials = Object.keys(data)
          .map((id) => ({
            ...data[id],
            id,
          }))
          .filter((m) => m.published === true);
        materials.sort(compareMaterialsAscending);
      }
    } catch (err) {
      console.warn(`Notice fetching materials for subject ${subjectId} from RTDB:`, err);
    }
  }

  // Fallback to standard demo materials for subject
  if (materials.length === 0) {
    const demo = await loadDemoMaterials();
    materials = demo.filter((m) => m.subjectId === subjectId && m.published === true);
  }

  cacheService.set(cacheKey, materials, 60_000);
  return materials;
}

// ==========================================
// RTDB-ONLY PDF BLOB RETRIEVAL & STREAMING
// ==========================================

/**
 * Fetch PDF blob from the isolated /file_blobs partition by blob ID.
 * Tries fast native HTTPS streaming fetch first with progress telemetry,
 * falling back seamlessly to Firebase Realtime Database SDK get().
 */
export async function getMaterialPdfBlob(
  blobId: string,
  onProgress?: (status: string) => void
): Promise<FileBlobRecord | null> {
  if (!blobId) return null;

  // 1. Try fast HTTPS REST fetch (bypasses WebSocket message queue, native HTTP pipeline)
  try {
    const dbUrl = 'https://campusnotes-e62cf-default-rtdb.firebaseio.com';
    const restUrl = `${dbUrl}/file_blobs/${encodeURIComponent(blobId)}.json`;

    const response = await fetch(restUrl);
    if (response.ok) {
      const contentLength = response.headers.get('content-length');
      const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;

      if (response.body && totalBytes > 0 && typeof onProgress === 'function') {
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let receivedBytes = 0;
        let lastReportedPercent = -1;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            receivedBytes += value.length;
            const percent = Math.min(99, Math.round((receivedBytes / totalBytes) * 100));
            if (percent !== lastReportedPercent) {
              lastReportedPercent = percent;
              const mbReceived = (receivedBytes / (1024 * 1024)).toFixed(1);
              const mbTotal = (totalBytes / (1024 * 1024)).toFixed(1);
              onProgress(`Downloading PDF: ${percent}% (${mbReceived} MB / ${mbTotal} MB)...`);
            }
          }
        }

        const concatenated = new Uint8Array(receivedBytes);
        let offset = 0;
        for (const chunk of chunks) {
          concatenated.set(chunk, offset);
          offset += chunk.length;
        }

        const text = new TextDecoder('utf-8').decode(concatenated);
        const record = JSON.parse(text) as FileBlobRecord;
        if (record && record.data_base64) {
          return record;
        }
      } else {
        const record = (await response.json()) as FileBlobRecord;
        if (record && record.data_base64) {
          return record;
        }
      }
    }
  } catch (restErr) {
    console.warn(`REST fetch notice for blob ${blobId}, using SDK fallback:`, restErr);
  }

  // 2. Fallback to Firebase Realtime Database SDK get()
  if (database) {
    try {
      onProgress?.('Fetching PDF from database...');
      const blobRef = ref(database, `file_blobs/${blobId}`);
      const snapshot = await get(blobRef);
      if (snapshot.exists()) {
        return snapshot.val() as FileBlobRecord;
      }
    } catch (err) {
      console.error(`Error fetching PDF blob ${blobId} from RTDB:`, err);
      throw err;
    }
  }
  return null;
}

/**
 * Retrieves a PDF blob from session memory, joins an active in-flight request,
 * or initiates an optimized fetch with progress telemetry.
 */
export async function getOrFetchPdfBlob(
  blobId: string,
  onProgress?: (status: string) => void
): Promise<CachedPdfBlob> {
  const cleanId = blobId.trim();
  if (!cleanId) throw new Error('Missing PDF blob identifier.');

  // 1. Check in-memory session cache (0 ms instant response, 0 network)
  const cached = pdfBlobSessionCache.get(cleanId);
  if (cached) {
    onProgress?.('Ready from session cache');
    return cached;
  }

  // 2. Check in-flight requests (deduplicates concurrent preview + download, repeated clicks)
  const existingPromise = inFlightPdfRequests.get(cleanId);
  if (existingPromise) {
    onProgress?.('Connecting to active download...');
    return await existingPromise;
  }

  // 3. Initiate single optimized fetch and register in flight
  const fetchPromise = (async () => {
    try {
      onProgress?.('Connecting to database...');

      const blobRecord = await getMaterialPdfBlob(cleanId, onProgress);
      if (!blobRecord || !blobRecord.data_base64) {
        throw new Error(
          'The requested PDF document could not be retrieved from the database or access was denied.'
        );
      }

      onProgress?.('Preparing file...');

      // Fast Base64 decoding
      const mimeType = blobRecord.mime_type || 'application/pdf';
      const blob = base64ToBlob(blobRecord.data_base64, mimeType);
      const objectUrl = URL.createObjectURL(blob);

      const cachedEntry: CachedPdfBlob = {
        blob,
        objectUrl,
        fileName: blobRecord.file_name,
        mimeType,
        sizeBytes: blob.size,
      };

      // Store in session cache
      pdfBlobSessionCache.set(cleanId, cachedEntry);
      objectUrlMemoryCache.set(cleanId, objectUrl);

      return cachedEntry;
    } finally {
      inFlightPdfRequests.delete(cleanId);
    }
  })();

  inFlightPdfRequests.set(cleanId, fetchPromise);
  return await fetchPromise;
}

/**
 * Helper to determine if a material is stored in Cloudflare R2
 */
export function isR2Material(material?: Partial<StudyMaterial> | null): boolean {
  if (!material) return false;
  if (material.storageProvider === 'r2') return true;
  if (material.r2Key && typeof material.r2Key === 'string' && material.r2Key.trim().length > 0) return true;
  if (material.storagePath && typeof material.storagePath === 'string' && material.storagePath.startsWith('r2://')) return true;
  if (material.downloadUrl && typeof material.downloadUrl === 'string') {
    if (material.downloadUrl.startsWith('r2://') || material.downloadUrl.includes('workers.dev')) {
      return true;
    }
  }
  return false;
}

/**
 * Construct the canonical R2 Worker URL for a given material
 */
export function getR2PdfUrl(materialId: string, options?: { download?: boolean }): string {
  const baseUrl = (R2_WORKER_URL || DEFAULT_R2_WORKER_URL).replace(/\/+$/, '');
  const downloadParam = options?.download ? '?download=1' : '';
  return `${baseUrl}/materials/${encodeURIComponent(materialId)}/pdf${downloadParam}`;
}

/**
 * Retrieves a PDF blob stored in Cloudflare R2:
 * Uses fast native HTTP streaming fetch with progress telemetry and memory caching.
 * Attaches admin authorization header when available to allow previewing unpublished drafts.
 */
export async function getOrFetchR2PdfBlob(
  material: StudyMaterial,
  onProgress?: (status: string) => void
): Promise<CachedPdfBlob> {
  const cacheKey = material.r2Key || `r2_${material.id}`;

  // 1. Check in-memory session cache (0 ms instant response, 0 network)
  const cached = pdfBlobSessionCache.get(cacheKey);
  if (cached) {
    onProgress?.('Ready from session cache');
    return cached;
  }

  // 2. Check in-flight requests (deduplicates concurrent preview + download)
  const existingPromise = inFlightPdfRequests.get(cacheKey);
  if (existingPromise) {
    onProgress?.('Connecting to active download...');
    return await existingPromise;
  }

  // 3. Initiate single optimized fetch and register in flight
  const fetchPromise = (async () => {
    try {
      onProgress?.('Connecting to Cloudflare R2 storage...');
      const targetUrl = material.r2Url || getR2PdfUrl(material.id);

      const headers: Record<string, string> = {};
      if (auth?.currentUser) {
        try {
          const token = await auth.currentUser.getIdToken();
          if (token) headers['Authorization'] = `Bearer ${token}`;
        } catch {
          // Public view
        }
      }

      const response = await fetch(targetUrl, { headers });
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Access denied: This study material is unpublished or restricted.');
        }
        if (response.status === 404) {
          throw new Error('The requested PDF document was not found in Cloudflare R2 storage.');
        }
        throw new Error(`Failed to download PDF document from storage (HTTP ${response.status}).`);
      }

      const contentLength = response.headers.get('content-length');
      const totalBytes = contentLength ? parseInt(contentLength, 10) : (material.fileSize || 0);

      let blob: Blob;

      if (response.body && totalBytes > 0 && typeof onProgress === 'function') {
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let receivedBytes = 0;
        let lastReportedPercent = -1;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            receivedBytes += value.length;
            const percent = Math.min(99, Math.round((receivedBytes / totalBytes) * 100));
            if (percent !== lastReportedPercent) {
              lastReportedPercent = percent;
              const mbReceived = (receivedBytes / (1024 * 1024)).toFixed(1);
              const mbTotal = (totalBytes / (1024 * 1024)).toFixed(1);
              onProgress(`Downloading PDF: ${percent}% (${mbReceived} MB / ${mbTotal} MB)...`);
            }
          }
        }

        blob = new Blob(chunks as BlobPart[], { type: 'application/pdf' });
      } else {
        blob = await response.blob();
      }

      onProgress?.('Preparing file...');
      const objectUrl = URL.createObjectURL(blob);
      const safeFilename = material.fileName || `${sanitizeFilename(material.title || 'study_material')}.pdf`;

      const cachedEntry: CachedPdfBlob = {
        blob,
        objectUrl,
        fileName: safeFilename,
        mimeType: 'application/pdf',
        sizeBytes: blob.size,
      };

      // Store in session cache
      pdfBlobSessionCache.set(cacheKey, cachedEntry);
      objectUrlMemoryCache.set(cacheKey, objectUrl);

      return cachedEntry;
    } finally {
      inFlightPdfRequests.delete(cacheKey);
    }
  })();

  inFlightPdfRequests.set(cacheKey, fetchPromise);
  return await fetchPromise;
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
 * - If stored in Cloudflare R2: streams from R2 Worker directly.
 * - If stored as Base64 in RTDB (/file_blobs/): fetches on demand, decodes to Blob, creates a blob: URL.
 * - If legacy URL (/demo-pdfs/ or external HTTP): returns the URL directly.
 */
export async function fetchPdfBlobUrl(
  material: StudyMaterial,
  onProgress?: (status: string) => void
): Promise<string> {
  // 0. Instant session memory cache check (0 ms, 0 network)
  const instantCachedUrl = getCachedPdfUrl(material);
  if (instantCachedUrl) {
    return instantCachedUrl;
  }

  // 1. Direct path for local demo PDFs
  if (material.downloadUrl && material.downloadUrl.startsWith('/demo-pdfs/')) {
    return material.downloadUrl;
  }

  // 2. Direct path for Cloudflare R2 materials
  if (isR2Material(material)) {
    try {
      const cachedEntry = await getOrFetchR2PdfBlob(material, onProgress);
      return cachedEntry.objectUrl;
    } catch (r2Err) {
      const fallbackBlobId = extractBlobId(material);
      if (fallbackBlobId) {
        console.warn('R2 preview fetch failed, falling back to Firebase RTDB storage:', r2Err);
        onProgress?.('Cloudflare R2 unavailable, falling back to Firebase storage...');
      } else {
        throw r2Err;
      }
    }
  }

  // 3. Resolve blobId from material metadata
  let blobId = extractBlobId(material);

  // If blobId wasn't found in current object, check the database for fresh metadata
  if (!blobId && database && material.id) {
    try {
      const pubSnap = await get(ref(database, `publicMaterials/${material.id}`));
      if (pubSnap.exists()) {
        const val = pubSnap.val();
        if (isR2Material(val)) {
          try {
            const cachedEntry = await getOrFetchR2PdfBlob({ ...material, ...val }, onProgress);
            return cachedEntry.objectUrl;
          } catch (r2Err) {
            console.warn('R2 preview fetch failed for fresh metadata, falling back to RTDB blob:', r2Err);
            blobId = extractBlobId(val);
          }
        } else {
          blobId = extractBlobId(val);
        }
      } else {
        const matSnap = await get(ref(database, `materials/${material.id}`)).catch(() => null);
        if (matSnap && matSnap.exists()) {
          const val = matSnap.val();
          if (isR2Material(val)) {
            try {
              const cachedEntry = await getOrFetchR2PdfBlob({ ...material, ...val }, onProgress);
              return cachedEntry.objectUrl;
            } catch (r2Err) {
              console.warn('R2 preview fetch failed for fresh private metadata, falling back to RTDB blob:', r2Err);
              blobId = extractBlobId(val);
            }
          } else {
            blobId = extractBlobId(val);
          }
        }
      }
    } catch {
      // Ignore network fallback error
    }
  }

  if (blobId) {
    const cachedEntry = await getOrFetchPdfBlob(blobId, onProgress);
    return cachedEntry.objectUrl;
  }

  // 4. Fallback to existing downloadUrl if valid HTTP URL
  if (material.downloadUrl && material.downloadUrl.startsWith('http')) {
    return material.downloadUrl;
  }

  const err = new Error('PDF document content could not be located in storage.');
  healthMonitorService.recordPdfOperation('PREVIEW', false, {
    materialId: material.id,
    fileName: material.fileName,
    error: err.message,
  });
  throw err;
}

/**
 * Safely downloads a study material for public or admin users:
 * 1. Checks if it's a local demo PDF or external HTTP URL.
 * 2. Checks if stored in Cloudflare R2 -> streams from R2 Worker directly.
 * 3. Extracts blobId directly from materialInput without extra database roundtrips.
 * 4. Reuses already downloaded blob from session cache (0 ms instant download) or joins in-flight request.
 * 5. Triggers programmatic browser download without popup blockers (no target=_blank).
 */
export async function downloadStudyMaterial(
  materialInput: StudyMaterial,
  onProgress?: (status: string) => void
): Promise<void> {
  try {
    // Step 0: Instant session memory cache check (0 ms instant download without network)
    const instantCachedUrl = getCachedPdfUrl(materialInput);
    if (instantCachedUrl) {
      const safeFilename =
        materialInput.fileName ||
        `${sanitizeFilename(materialInput.title || 'study_material')}.pdf`;
      const link = document.createElement('a');
      link.href = instantCachedUrl;
      link.download = safeFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      healthMonitorService.recordPdfOperation('DOWNLOAD', true, {
        materialId: materialInput.id,
        fileName: safeFilename,
      });
      return;
    }

    // Step 1: Handle static demo PDFs (/demo-pdfs/...)
    if (materialInput.downloadUrl && materialInput.downloadUrl.startsWith('/demo-pdfs/')) {
      const link = document.createElement('a');
      link.href = materialInput.downloadUrl;
      const safeDemoName = materialInput.fileName || `${sanitizeFilename(materialInput.title)}.pdf`;
      link.download = safeDemoName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      healthMonitorService.recordPdfOperation('DOWNLOAD', true, {
        materialId: materialInput.id,
        fileName: safeDemoName,
      });
      return;
    }

    // Step 2: Handle external HTTP URLs (excluding R2 worker routes which are handled below)
    if (
      materialInput.downloadUrl &&
      materialInput.downloadUrl.startsWith('http') &&
      !materialInput.downloadUrl.includes('workers.dev')
    ) {
      const link = document.createElement('a');
      link.href = materialInput.downloadUrl;
      const safeHttpName = materialInput.fileName || `${sanitizeFilename(materialInput.title)}.pdf`;
      link.download = safeHttpName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      healthMonitorService.recordPdfOperation('DOWNLOAD', true, {
        materialId: materialInput.id,
        fileName: safeHttpName,
      });
      return;
    }

    // Step 2.5: Handle Cloudflare R2 Storage Provider
    if (isR2Material(materialInput)) {
      try {
        onProgress?.('Fetching PDF from Cloudflare R2...');
        const cachedEntry = await getOrFetchR2PdfBlob(materialInput, onProgress);

        onProgress?.('Starting download...');
        const safeFilename =
          materialInput.fileName ||
          cachedEntry.fileName ||
          `${sanitizeFilename(materialInput.title || 'study_material')}.pdf`;

        const link = document.createElement('a');
        link.href = cachedEntry.objectUrl;
        link.download = safeFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        healthMonitorService.recordPdfOperation('DOWNLOAD', true, {
          materialId: materialInput.id,
          fileName: safeFilename,
        });
        return;
      } catch (r2Err) {
        const fallbackBlobId = extractBlobId(materialInput);
        if (fallbackBlobId) {
          console.warn('R2 download failed, falling back to Firebase RTDB storage:', r2Err);
          onProgress?.('Cloudflare R2 unavailable, falling back to Firebase storage...');
          // Proceed to Step 3 below
        } else {
          throw r2Err;
        }
      }
    }

    // Step 3: Extract blobId without redundant database query if already present
    let blobId = extractBlobId(materialInput);
    let freshMaterial = materialInput;

    // Only if blobId is missing, query RTDB metadata
    if (!blobId && database && materialInput.id) {
      try {
        const pubSnap = await get(ref(database, `publicMaterials/${materialInput.id}`));
        if (pubSnap.exists()) {
          const val = pubSnap.val();
          if (isR2Material(val)) {
            try {
              return await downloadStudyMaterial({ ...materialInput, ...val }, onProgress);
            } catch (r2Err) {
              console.warn('R2 download failed for fresh metadata, falling back to RTDB blob:', r2Err);
              freshMaterial = { ...materialInput, ...val };
              blobId = extractBlobId(freshMaterial);
            }
          } else {
            freshMaterial = { ...materialInput, ...val };
            blobId = extractBlobId(freshMaterial);
          }
        } else {
          const privSnap = await get(ref(database, `materials/${materialInput.id}`)).catch(() => null);
          if (privSnap && privSnap.exists()) {
            const val = privSnap.val();
            if (isR2Material(val)) {
              try {
                return await downloadStudyMaterial({ ...materialInput, ...val }, onProgress);
              } catch (r2Err) {
                console.warn('R2 download failed for fresh private metadata, falling back to RTDB blob:', r2Err);
                freshMaterial = { ...materialInput, ...val };
                blobId = extractBlobId(freshMaterial);
              }
            } else {
              freshMaterial = { ...materialInput, ...val };
              blobId = extractBlobId(freshMaterial);
            }
          }
        }
      } catch {
        // Proceed with passed input
      }
    }

    if (!blobId) {
      throw new Error('This study material does not have an associated PDF document in storage.');
    }

    // Step 4: Fetch (or reuse from session cache / active in-flight download)
    const cachedEntry = await getOrFetchPdfBlob(blobId, onProgress);

    onProgress?.('Starting download...');

    // Step 5: Programmatic browser download
    const safeFilename =
      freshMaterial.fileName ||
      cachedEntry.fileName ||
      `${sanitizeFilename(freshMaterial.title || 'study_material')}.pdf`;

    const link = document.createElement('a');
    link.href = cachedEntry.objectUrl;
    link.download = safeFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Record successful download
    healthMonitorService.recordPdfOperation('DOWNLOAD', true, {
      materialId: freshMaterial.id,
      fileName: safeFilename,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    healthMonitorService.recordPdfOperation('DOWNLOAD', false, {
      materialId: materialInput.id,
      fileName: materialInput.fileName,
      error: errorMsg,
    });
    throw err;
  }
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
  if (!database) return await loadDemoMaterials();

  try {
    const materialsRef = ref(database, 'materials');
    const snapshot = await get(materialsRef);

    if (!snapshot.exists()) return await loadDemoMaterials();

    const data = snapshot.val();
    const list: StudyMaterial[] = Object.keys(data).map((id) => ({
      ...data[id],
      id,
    }));

    if (list.length === 0) return await loadDemoMaterials();

    list.sort(compareMaterialsAscending);
    return list;
  } catch (err: unknown) {
    console.warn('Notice reading admin materials from RTDB, using demo catalog:', err);
    return await loadDemoMaterials();
  }
}

/**
 * Upload PDF directly to Cloudflare R2 via the Cloudflare Worker API.
 * Uses native XMLHttpRequest to report accurate upload progress telemetry.
 */
export async function uploadPdfToR2(
  file: File,
  materialId: string,
  onProgress?: (percent: number, bytesTransferred: number, totalBytes: number) => void
): Promise<{
  storagePath: string;
  downloadUrl: string;
  fileName: string;
  fileSize: number;
  r2Key: string;
  storageProvider: 'r2';
}> {
  if (!auth?.currentUser) {
    throw new Error('Administrator authentication required for R2 PDF upload.');
  }

  const token = await auth.currentUser.getIdToken();
  const workerBase = (R2_WORKER_URL || DEFAULT_R2_WORKER_URL).replace(/\/+$/, '');
  const sanitizedName = sanitizeFilename(file.name);
  const uploadUrl = `${workerBase}/materials/${encodeURIComponent(materialId)}/pdf?filename=${encodeURIComponent(sanitizedName)}`;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl, true);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('Content-Type', 'application/pdf');
    xhr.setRequestHeader('X-Filename', encodeURIComponent(sanitizedName));

    if (xhr.upload && typeof onProgress === 'function') {
      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable) {
          const percent = Math.min(99, Math.round((evt.loaded / evt.total) * 100));
          onProgress(percent, evt.loaded, evt.total);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          onProgress?.(100, file.size, file.size);
          resolve({
            storagePath: res.storagePath || `r2://${res.r2Key}`,
            downloadUrl: res.downloadUrl,
            fileName: res.fileName || file.name,
            fileSize: res.fileSize || file.size,
            r2Key: res.r2Key,
            storageProvider: 'r2',
          });
        } catch (parseErr) {
          reject(new Error(`Failed to parse R2 upload response: ${parseErr}`));
        }
      } else {
        let errorMsg = `R2 upload failed with status ${xhr.status}`;
        try {
          const res = JSON.parse(xhr.responseText);
          if (res.error) errorMsg = res.error;
        } catch {
          // ignore
        }
        reject(new Error(errorMsg));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error occurred during R2 PDF upload.'));
    };

    xhr.ontimeout = () => {
      reject(new Error('R2 PDF upload timed out.'));
    };

    xhr.timeout = 60000;
    xhr.send(file);
  });
}

/**
 * Delete a PDF object from Cloudflare R2
 */
export async function deletePdfFromR2(materialId: string, r2Key?: string): Promise<boolean> {
  if (!auth?.currentUser) {
    console.warn('Cannot delete R2 PDF: No authenticated administrator.');
    return false;
  }
  try {
    const token = await auth.currentUser.getIdToken();
    const workerBase = (R2_WORKER_URL || DEFAULT_R2_WORKER_URL).replace(/\/+$/, '');
    const deleteUrl = `${workerBase}/materials/${encodeURIComponent(materialId)}/pdf${r2Key ? `?key=${encodeURIComponent(r2Key)}` : ''}`;
    const res = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return res.ok;
  } catch (err) {
    console.warn(`Notice deleting R2 PDF for material ${materialId}:`, err);
    return false;
  }
}

export interface UploadPdfResult {
  storagePath: string;
  downloadUrl: string;
  fileName: string;
  fileSize: number;
  blobId?: string;
  storageProvider?: 'firebase' | 'r2';
  r2Key?: string;
  r2Url?: string;
}

/**
 * Upload PDF with Cloudflare R2 preference and Realtime Database fallback.
 * Authenticated admins upload directly to R2; unauthenticated or fallback uploads use RTDB Base64.
 */
export async function uploadPdfFile(
  file: File,
  _subjectId: string,
  materialId: string,
  onProgress?: (percent: number, bytesTransferred: number, totalBytes: number) => void,
  isPublished: boolean = true
): Promise<UploadPdfResult> {
  // 1. File type and extension validation
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    throw new Error('Only valid PDF documents (.pdf) are permitted.');
  }

  // 2. Binary header signature validation (%PDF-)
  const isSignatureValid = await validatePdfSignature(file);
  if (!isSignatureValid) {
    throw new Error('Invalid file format: File header does not match standard PDF signature (%PDF-).');
  }

  // 3. Try Cloudflare R2 Upload first if admin is authenticated
  if (auth?.currentUser && (R2_WORKER_URL || DEFAULT_R2_WORKER_URL)) {
    if (file.size <= MAX_R2_PDF_SIZE_BYTES) {
      try {
        const r2Result = await uploadPdfToR2(file, materialId, onProgress);
        healthMonitorService.recordPdfOperation('UPLOAD', true, {
          materialId,
          fileName: file.name,
        });
        return {
          storagePath: r2Result.storagePath,
          downloadUrl: r2Result.downloadUrl,
          fileName: r2Result.fileName,
          fileSize: r2Result.fileSize,
          storageProvider: 'r2',
          r2Key: r2Result.r2Key,
          r2Url: r2Result.downloadUrl,
        };
      } catch (r2Err) {
        console.warn('R2 upload notice: Falling back to Firebase RTDB storage.', r2Err);
      }
    } else {
      throw new Error(
        `File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds maximum allowed limit of 50 MB.`
      );
    }
  }

  // 4. Strict file size validation for Realtime Database storage (6 MB max)
  if (!database) {
    throw new Error('Firebase Realtime Database is not initialized.');
  }

  if (file.size > MAX_RTDB_PDF_SIZE_BYTES) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    throw new Error(
      `File size (${sizeMB} MB) exceeds maximum allowed limit of 6 MB for Realtime Database storage. (Base64 encoding expands file size by ~33%, requiring raw size <= 6 MB to fit safely within RTDB's 10 MB node threshold).`
    );
  }

  // 5. Asynchronous Base64 conversion off the main thread for RTDB fallback
  onProgress?.(10, Math.round(file.size * 0.1), file.size);
  const base64Data = await fileToBase64Async(file, onProgress);
  onProgress?.(50, Math.round(file.size * 0.5), file.size);

  const timestamp = Date.now();
  const sanitizedName = sanitizeFilename(file.name);
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

  // 6. Save blob to RTDB /file_blobs/{blobId} with a 45-second timeout guard
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

  try {
    await Promise.race([writePromise, timeoutPromise]);
    onProgress?.(100, file.size, file.size);

    healthMonitorService.recordPdfOperation('UPLOAD', true, {
      materialId,
      fileName: file.name,
    });

    return {
      storagePath,
      downloadUrl,
      fileName: file.name,
      fileSize: file.size,
      blobId,
      storageProvider: 'firebase',
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    healthMonitorService.recordPdfOperation('UPLOAD', false, {
      materialId,
      fileName: file.name,
      error: errorMsg,
    });
    throw err;
  }
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
 * If saving metadata fails, cleans up the uploaded blob or R2 object to avoid orphans.
 */
export async function createMaterial(
  data: Omit<StudyMaterial, 'createdAt' | 'updatedAt'>
): Promise<void> {
  if (!database) throw new Error('Database not initialized');

  const now = Date.now();
  const fullData: Record<string, unknown> = {
    ...data,
    createdAt: now,
    updatedAt: now,
  };

  // Strip undefined keys so Firebase RTDB set/update never throws
  const cleanData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fullData)) {
    if (value !== undefined) {
      cleanData[key] = value;
    }
  }

  const updates: Record<string, unknown> = {};
  updates[`materials/${data.id}`] = cleanData;

  if (data.published) {
    updates[`publicMaterials/${data.id}`] = cleanData;
  }

  try {
    await update(ref(database), updates);
    cacheService.clearAll();
  } catch (dbError) {
    console.error('Metadata creation failed. Performing orphan cleanup...', dbError);
    if (data.storageProvider === 'r2' && data.r2Key) {
      try {
        await deletePdfFromR2(data.id, data.r2Key);
      } catch {
        // Ignore
      }
    }
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
  const merged: Record<string, unknown> = {
    ...existingMaterial,
    ...updatedData,
    updatedAt: now,
  };

  // Strip undefined keys
  const cleanData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(merged)) {
    if (value !== undefined) {
      cleanData[key] = value;
    }
  }

  const updates: Record<string, unknown> = {};
  updates[`materials/${id}`] = cleanData;

  const isPublished = Boolean(cleanData.published);
  if (isPublished) {
    updates[`publicMaterials/${id}`] = cleanData;
  } else {
    updates[`publicMaterials/${id}`] = null;
  }

  // Synchronize published state to the file blob record if present so security rules stay consistent
  const blobId = (cleanData.blobId as string) || existingMaterial.blobId;
  if (blobId && isPublished !== existingMaterial.published) {
    updates[`file_blobs/${blobId}/published`] = isPublished;
  }

  await update(ref(database), updates);
  cacheService.clearAll();
  if (blobId && !isPublished) {
    revokeBlobUrl(blobId);
  }
  if (existingMaterial.r2Key && !isPublished) {
    revokeBlobUrl(existingMaterial.r2Key);
  }
}

/**
 * Replace material PDF safely:
 * 1. Fetches current material from RTDB to ensure fresh metadata.
 * 2. Uploads replacement PDF (R2 or RTDB fallback).
 * 3. Verifies replacement accessibility and signature.
 * 4. Atomically updates database metadata in /materials, /publicMaterials, and published flags.
 * 5. Invalidates caches (sessionStorage and in-memory Blob URL cache).
 * 6. Deletes old R2 file or RTDB blob only after replacement is confirmed accessible.
 * 7. Rolls back new upload if metadata update fails.
 */
export async function replaceMaterialPdf(
  material: StudyMaterial,
  newFile: File,
  additionalMetadataOrProgress?:
    | Partial<StudyMaterial>
    | ((percent: number, bytesTransferred: number, totalBytes: number) => void),
  onProgress?: (percent: number, bytesTransferred: number, totalBytes: number) => void
): Promise<{
  fileName: string;
  downloadUrl: string;
  blobId?: string;
  storageProvider?: 'firebase' | 'r2';
  r2Key?: string;
}> {
  if (!database) throw new Error('Database not initialized');

  let additionalMetadataUpdates: Partial<StudyMaterial> | undefined;
  let progressCb = onProgress;

  if (typeof additionalMetadataOrProgress === 'function') {
    progressCb = additionalMetadataOrProgress;
    additionalMetadataUpdates = undefined;
  } else if (additionalMetadataOrProgress) {
    additionalMetadataUpdates = additionalMetadataOrProgress;
  }

  // 1. Fetch current material from RTDB to ensure fresh metadata
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
  const oldR2Key = currentMaterial.r2Key;
  const isPublished =
    additionalMetadataUpdates?.published !== undefined
      ? additionalMetadataUpdates.published
      : (currentMaterial.published ?? material.published ?? true);

  // 2. Upload replacement PDF
  const uploadResult = await uploadPdfFile(
    newFile,
    additionalMetadataUpdates?.subjectId || currentMaterial.subjectId || material.subjectId,
    material.id,
    progressCb,
    isPublished
  );

  try {
    // 3. Verify upload integrity
    if (uploadResult.storageProvider === 'r2') {
      if (!uploadResult.r2Key) {
        throw new Error('Verification failed: Replacement R2 upload did not return an object key.');
      }
    } else if (uploadResult.blobId) {
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
    }

    // 4. Atomically update material metadata in /materials, /publicMaterials, and blob published flag
    const now = Date.now();
    const merged: Record<string, unknown> = {
      ...currentMaterial,
      ...additionalMetadataUpdates,
      fileName: uploadResult.fileName,
      storagePath: uploadResult.storagePath,
      downloadUrl: uploadResult.downloadUrl,
      fileSize: uploadResult.fileSize,
      storageProvider: uploadResult.storageProvider || 'firebase',
      r2Key: uploadResult.r2Key,
      r2Url: uploadResult.r2Url,
      published: isPublished,
      updatedAt: now,
    };

    if (uploadResult.blobId) {
      merged.blobId = uploadResult.blobId;
    }

    // Strip undefined keys
    const cleanData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(merged)) {
      if (value !== undefined) {
        cleanData[key] = value;
      }
    }

    const updates: Record<string, unknown> = {};
    updates[`materials/${material.id}`] = cleanData;
    if (isPublished) {
      updates[`publicMaterials/${material.id}`] = cleanData;
    } else {
      updates[`publicMaterials/${material.id}`] = null;
    }
    if (uploadResult.blobId) {
      updates[`file_blobs/${uploadResult.blobId}/published`] = isPublished;
    }

    await update(ref(database), updates);

    // 5. Confirm the metadata in RTDB was updated
    const checkMetaSnap = await get(ref(database, `materials/${material.id}`));
    if (!checkMetaSnap.exists()) {
      throw new Error('Verification failed: Material metadata was not found after update.');
    }

    // 6. Invalidate caches (sessionStorage and in-memory Blob URL cache)
    cacheService.clearAll();
    if (oldBlobId) {
      revokeBlobUrl(oldBlobId);
    }
    if (oldR2Key) {
      revokeBlobUrl(oldR2Key);
    }
    if (uploadResult.blobId) {
      revokeBlobUrl(uploadResult.blobId);
    }
    if (uploadResult.r2Key) {
      revokeBlobUrl(uploadResult.r2Key);
    }

    // 7. Remove old file only after replacement is confirmed accessible
    if (oldR2Key && oldR2Key !== uploadResult.r2Key) {
      await deletePdfFromR2(material.id, oldR2Key).catch((delErr) =>
        console.warn(`Old R2 object removal notice for ${oldR2Key}:`, delErr)
      );
    }
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
      storageProvider: uploadResult.storageProvider,
      r2Key: uploadResult.r2Key,
    };
  } catch (err) {
    // Rollback: if updating metadata or verification failed, clean up the new uploaded file
    try {
      if (uploadResult.storageProvider === 'r2' && uploadResult.r2Key) {
        await deletePdfFromR2(material.id, uploadResult.r2Key);
      }
      if (uploadResult.blobId) {
        await remove(ref(database, `file_blobs/${uploadResult.blobId}`));
      }
    } catch {
      // Ignore rollback cleanup error
    }
    throw err;
  }
}

/**
 * Delete material: removes database metadata and associated R2 object or RTDB file blob safely
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
  if (material.r2Key) {
    revokeBlobUrl(material.r2Key);
  }

  // 3. Delete from Cloudflare R2 if applicable
  if (isR2Material(material)) {
    const r2Key =
      material.r2Key ||
      (material.storagePath?.startsWith('r2://')
        ? material.storagePath.replace('r2://', '')
        : undefined);
    try {
      await deletePdfFromR2(material.id, r2Key);
    } catch (r2DelErr) {
      console.warn(`R2 deletion notice for ${material.id}:`, r2DelErr);
    }
  }

  // 4. Remove blob from /file_blobs if present and not shared
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
  const cacheKey = 'public_subjects';
  let isSubscribed = true;

  // Stale-While-Revalidate: deliver valid cached subjects immediately (0 ms catalog paint)
  const cached = cacheService.get<Subject[]>(cacheKey);
  if (cached && cached.length > 0) {
    try {
      callback(cached);
    } catch (e) {
      console.warn('Error in public subjects cached callback:', e);
    }
  }

  if (!isFirebaseConfigured || !database) {
    if (!cached || cached.length === 0) {
      callback(getSanitizedDefaultSubjects());
    }
    return () => {
      isSubscribed = false;
    };
  }

  const subjectsRef = ref(database, 'subjects');
  const unsubscribe = onValue(
    subjectsRef,
    (snapshot: RtdbSnapshot) => {
      if (!isSubscribed) return;
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

      cacheService.set(cacheKey, sanitized, 180_000);
      callback(sanitized);
    },
    (error: Error) => {
      if (!isSubscribed) return;
      console.warn('Realtime public subjects listener warning:', error);
      if (onError) onError(error);
      if (!cached || cached.length === 0) {
        callback(getSanitizedDefaultSubjects());
      }
    }
  );

  return () => {
    isSubscribed = false;
    unsubscribe();
  };
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

  const demo = await loadDemoMaterials();
  for (const m of demo) {
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
  const cacheKey = `public_materials_limit_${limit}`;
  let isSubscribed = true;

  // Stale-While-Revalidate: deliver fresh or session-cached data immediately (0 ms catalog paint)
  const cached = cacheService.get<StudyMaterial[]>(cacheKey);
  if (cached && cached.length > 0) {
    try {
      callback(cached);
    } catch (e) {
      console.warn('Error in public materials cached callback:', e);
    }
  }

  if (!isFirebaseConfigured || !database) {
    if (!cached || cached.length === 0) {
      loadDemoMaterials().then((demo) => {
        if (isSubscribed) callback(demo.filter((m) => m.published === true).slice(0, limit));
      });
    }
    return () => {
      isSubscribed = false;
    };
  }

  const pubRef = ref(database, 'publicMaterials');
  const q = query(pubRef, orderByChild('createdAt'), limitToLast(limit));

  const unsubscribe = onValue(
    q,
    (snapshot: RtdbSnapshot) => {
      if (!isSubscribed) return;
      let materials: StudyMaterial[] = [];
      if (snapshot.exists()) {
        const data = snapshot.val();
        materials = Object.keys(data)
          .map((id) => ({
            ...data[id],
            id,
          }))
          .filter((m) => m.published === true); // Strictly require published === true
        materials.sort(compareMaterialsAscending);
      }
      if (materials.length === 0) {
        loadDemoMaterials().then((demo) => {
          if (isSubscribed) callback(demo.filter((m) => m.published === true).slice(0, limit));
        });
        return;
      }
      cacheService.set(cacheKey, materials, 60_000);
      callback(materials);
    },
    (error: Error) => {
      if (!isSubscribed) return;
      console.warn('Realtime public materials listener warning, using demo catalog:', error);
      if (onError) onError(error);
      if (!cached || cached.length === 0) {
        loadDemoMaterials().then((demo) => {
          if (isSubscribed) callback(demo.filter((m) => m.published === true).slice(0, limit));
        });
      }
    }
  );

  return () => {
    isSubscribed = false;
    unsubscribe();
  };
}

/**
 * Subscribe in real time to published materials for a specific subject
 */
export function subscribeToSubjectMaterials(
  subjectId: string,
  callback: (materials: StudyMaterial[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const cacheKey = `public_materials_subject_${subjectId}`;
  let isSubscribed = true;

  // Stale-While-Revalidate: deliver cached subject materials immediately
  const cached = cacheService.get<StudyMaterial[]>(cacheKey);
  if (cached && cached.length > 0) {
    try {
      callback(cached);
    } catch (e) {
      console.warn(`Error in subject materials cached callback (${subjectId}):`, e);
    }
  }

  if (!isFirebaseConfigured || !database) {
    if (!cached || cached.length === 0) {
      loadDemoMaterials().then((demo) => {
        if (isSubscribed) callback(demo.filter((m) => m.subjectId === subjectId && m.published === true));
      });
    }
    return () => {
      isSubscribed = false;
    };
  }

  const pubRef = ref(database, 'publicMaterials');
  const q = query(pubRef, orderByChild('subjectId'), equalTo(subjectId));

  const unsubscribe = onValue(
    q,
    (snapshot: RtdbSnapshot) => {
      if (!isSubscribed) return;
      let materials: StudyMaterial[] = [];
      if (snapshot.exists()) {
        const data = snapshot.val();
        materials = Object.keys(data)
          .map((id) => ({
            ...data[id],
            id,
          }))
          .filter((m) => m.published === true); // Strictly require published === true
        materials.sort(compareMaterialsAscending);
      }
      if (materials.length === 0) {
        loadDemoMaterials().then((demo) => {
          if (isSubscribed) callback(demo.filter((m) => m.subjectId === subjectId && m.published === true));
        });
        return;
      }
      cacheService.set(cacheKey, materials, 60_000);
      callback(materials);
    },
    (error: Error) => {
      if (!isSubscribed) return;
      console.warn(`Realtime subject materials warning (${subjectId}):`, error);
      if (onError) onError(error);
      if (!cached || cached.length === 0) {
        loadDemoMaterials().then((demo) => {
          if (isSubscribed) callback(demo.filter((m) => m.subjectId === subjectId && m.published === true));
        });
      }
    }
  );

  return () => {
    isSubscribed = false;
    unsubscribe();
  };
}

/**
 * Subscribe in real time to all materials for admin dashboard (drafts & published)
 */
export function subscribeToMaterialsAdmin(
  callback: (materials: StudyMaterial[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!database) {
    loadDemoMaterials().then((demo) => callback(demo));
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
        list.sort(compareMaterialsAscending);
      }
      if (list.length === 0) {
        loadDemoMaterials().then((demo) => callback(demo));
        return;
      }
      callback(list);
    },
    (error: Error) => {
      console.warn('Realtime admin materials listener warning:', error);
      if (onError) onError(error);
      loadDemoMaterials().then((demo) => callback(demo));
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
