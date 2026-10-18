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
  serverTimestamp,
  onValue,
} from 'firebase/database';

type RtdbSnapshot = {
  exists(): boolean;
  val(): any;
};
import {
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  updateMetadata,
} from 'firebase/storage';
import { database, storage, isFirebaseConfigured } from '../config/firebase';
import { Subject, StudyMaterial, DashboardStats, AcademicCategory } from '../types';
import {
  OFFICIAL_CSE_SEM_5_SUBJECTS,
  EXCLUDED_SUBJECT_NAMES,
  sanitizeSubjects,
} from '../constants/subjects';
import { INITIAL_DEMO_MATERIALS } from '../constants/initialMaterials';
import { cacheService } from './cacheService';

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB strictly enforced

// ==========================================
// PUBLIC METHODS (Cached & Partitioned)
// ==========================================

/**
 * Fetch active subjects for CSE Semester 5
 * Enforces the exact 9 official subjects and filters out excluded subjects
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
 * Fetch published study materials from the /publicMaterials node
 * Bounded query protects against high concurrency bursts
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

  // Invalidate public and admin subject caches
  cacheService.invalidate('public_subjects');
}

/**
 * Delete a subject after confirming no active materials link to it
 */
export async function deleteSubject(subjectId: string): Promise<void> {
  if (!database) throw new Error('Database not initialized');

  // Verify whether materials reference this subject
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
 * Fetch all materials for administrator (both published and drafts)
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
 * Upload PDF to Firebase Cloud Storage with strict validation
 */
export function uploadPdfFile(
  file: File,
  subjectId: string,
  materialId: string,
  onProgress?: (percent: number, bytesTransferred: number, totalBytes: number) => void,
  isPublished: boolean = true
): Promise<{ storagePath: string; downloadUrl: string; fileName: string; fileSize: number }> {
  return new Promise((resolve, reject) => {
    if (!storage) {
      reject(new Error('Firebase Cloud Storage is not initialized. Check your credentials.'));
      return;
    }

    // 1. Validate file format
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      reject(new Error('Only valid PDF documents are allowed.'));
      return;
    }

    // 2. Validate file size (max 25MB)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      reject(new Error(`File size (${sizeMB} MB) exceeds maximum allowed limit of 25 MB.`));
      return;
    }

    // 3. Unique sanitised file name and storage path
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniqueFileName = `${Date.now()}_${sanitizedName}`;
    const storagePath = `materials/${subjectId}/${materialId}/${uniqueFileName}`;
    const fileRef = storageRef(storage, storagePath);

    const uploadTask = uploadBytesResumable(fileRef, file, {
      contentType: 'application/pdf',
      customMetadata: {
        academicDepartment: 'CSE',
        semester: '5',
        originalFileName: file.name,
        published: String(isPublished),
      },
    });

    uploadTask.on(
      'state_changed',
      (snapshot: { bytesTransferred: number; totalBytes: number }) => {
        const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        if (onProgress) {
          onProgress(percent, snapshot.bytesTransferred, snapshot.totalBytes);
        }
      },
      (error: unknown) => {
        reject(error);
      },
      async () => {
        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          resolve({
            storagePath,
            downloadUrl,
            fileName: file.name,
            fileSize: file.size,
          });
        } catch (urlErr) {
          reject(urlErr);
        }
      }
    );
  });
}

/**
 * Safely delete a file from Cloud Storage
 */
export async function deleteStorageFile(filePath: string): Promise<void> {
  if (!storage || !filePath) return;
  try {
    const fileRef = storageRef(storage, filePath);
    await deleteObject(fileRef);
  } catch (err: unknown) {
    // If file doesn't exist anymore, log and proceed
    console.warn(`Storage file deletion notice for ${filePath}:`, err);
  }
}

/**
 * Save new study material with atomic partition sync & orphan file rollback
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
  // Always write to master admin node
  updates[`materials/${data.id}`] = fullData;

  // If published, write simultaneously to public node
  if (data.published) {
    updates[`publicMaterials/${data.id}`] = fullData;
  }

  try {
    await update(ref(database), updates);
    cacheService.clearAll();
  } catch (dbError) {
    // Orphan cleanup: if database save failed, delete the uploaded storage file
    console.error('Metadata creation failed. Performing orphan cleanup on storage...', dbError);
    if (data.storagePath) {
      await deleteStorageFile(data.storagePath);
    }
    throw dbError;
  }
}

/**
 * Update material metadata and maintain public/private partition consistency
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
    // If unpublished, ensure removal from public index
    updates[`publicMaterials/${id}`] = null;
  }

  await update(ref(database), updates);

  // Sync published state to Cloud Storage metadata to enforce storage security rules
  if (storage && merged.storagePath) {
    try {
      const fileRef = storageRef(storage, merged.storagePath);
      await updateMetadata(fileRef, {
        customMetadata: {
          published: String(merged.published),
        },
      });
    } catch (metaErr) {
      console.warn('Storage metadata sync notice:', metaErr);
    }
  }

  cacheService.clearAll();
}

/**
 * Check if a storage path is referenced by any other material in RTDB
 */
export async function isStoragePathReferencedByOthers(
  storagePath: string,
  excludeMaterialId: string
): Promise<boolean> {
  if (!database || !storagePath) return false;
  try {
    const snapshot = await get(ref(database, 'materials'));
    if (snapshot.exists()) {
      const data = snapshot.val() as Record<string, StudyMaterial>;
      for (const [id, item] of Object.entries(data)) {
        if (id !== excludeMaterialId && item.storagePath === storagePath) {
          return true;
        }
      }
    }
  } catch (err) {
    console.warn('Notice checking storage path references:', err);
  }
  return false;
}

/**
 * Replace material PDF file safely:
 * 1. Uploads replacement first.
 * 2. Updates database metadata atomically with new file details and form updates.
 * 3. Deletes old file only after database write succeeds AND only if not shared by other records.
 * 4. Cleans up newly uploaded file if metadata update fails.
 */
export async function replaceMaterialPdf(
  material: StudyMaterial,
  newFile: File,
  additionalMetadataOrProgress?:
    | Partial<StudyMaterial>
    | ((percent: number, bytesTransferred: number, totalBytes: number) => void),
  onProgress?: (percent: number, bytesTransferred: number, totalBytes: number) => void
): Promise<{ fileName: string; downloadUrl: string }> {
  if (!database) throw new Error('Database not initialized');

  let additionalMetadataUpdates: Partial<StudyMaterial> | undefined;
  let progressCb = onProgress;

  if (typeof additionalMetadataOrProgress === 'function') {
    progressCb = additionalMetadataOrProgress;
    additionalMetadataUpdates = undefined;
  } else if (additionalMetadataOrProgress) {
    additionalMetadataUpdates = additionalMetadataOrProgress;
  }

  const oldStoragePath = material.storagePath;
  const isPublished =
    additionalMetadataUpdates?.published !== undefined
      ? additionalMetadataUpdates.published
      : material.published;

  // 1. Upload the replacement PDF (preserving or updating published state)
  const uploadResult = await uploadPdfFile(
    newFile,
    additionalMetadataUpdates?.subjectId || material.subjectId,
    material.id,
    progressCb,
    isPublished
  );

  try {
    // 2. Update database metadata with new file details and any form field updates
    const updates: Partial<StudyMaterial> = {
      ...additionalMetadataUpdates,
      fileName: uploadResult.fileName,
      storagePath: uploadResult.storagePath,
      downloadUrl: uploadResult.downloadUrl,
      fileSize: uploadResult.fileSize,
    };

    await updateMaterial(material.id, updates, material);

    // 3. Delete old file only after database write succeeds, and only if not shared
    if (oldStoragePath && oldStoragePath !== uploadResult.storagePath) {
      const isShared = await isStoragePathReferencedByOthers(oldStoragePath, material.id);
      if (!isShared && !oldStoragePath.startsWith('/demo-pdfs/')) {
        await deleteStorageFile(oldStoragePath);
      }
    }

    return {
      fileName: uploadResult.fileName,
      downloadUrl: uploadResult.downloadUrl,
    };
  } catch (err) {
    // If updating metadata failed, cleanup the newly uploaded file to avoid orphan
    await deleteStorageFile(uploadResult.storagePath);
    throw err;
  }
}

/**
 * Delete material: removes both database metadata and Cloud Storage PDF safely
 */
export async function deleteMaterial(material: StudyMaterial): Promise<void> {
  if (!database) throw new Error('Database not initialized');

  const updates: Record<string, unknown> = {};
  updates[`materials/${material.id}`] = null;
  updates[`publicMaterials/${material.id}`] = null;

  // 1. Remove database entries
  await update(ref(database), updates);
  cacheService.clearAll();

  // 2. Remove storage file if not shared by other records
  if (material.storagePath && !material.storagePath.startsWith('/demo-pdfs/')) {
    const isShared = await isStoragePathReferencedByOthers(material.storagePath, material.id);
    if (!isShared) {
      await deleteStorageFile(material.storagePath);
    }
  }
}

/**
 * Maintenance Mode Management
 */
export async function getMaintenanceMode(): Promise<boolean> {
  if (!database) {
    return localStorage.getItem('campusnotes_maintenance_mode') === 'true';
  }
  try {
    const snapshot = await get(ref(database, 'settings/maintenanceMode'));
    if (snapshot.exists()) {
      const isMaint = Boolean(snapshot.val());
      localStorage.setItem('campusnotes_maintenance_mode', String(isMaint));
      return isMaint;
    }
  } catch (err) {
    console.warn('Notice checking maintenance mode from RTDB:', err);
  }
  return localStorage.getItem('campusnotes_maintenance_mode') === 'true';
}

export async function setMaintenanceMode(enabled: boolean): Promise<void> {
  localStorage.setItem('campusnotes_maintenance_mode', String(enabled));
  if (database) {
    try {
      await set(ref(database, 'settings/maintenanceMode'), enabled);
    } catch (err) {
      console.warn('Notice setting maintenance mode in RTDB:', err);
    }
  }
  cacheService.clearAll();
}

export function subscribeToMaintenanceMode(callback: (isMaintenance: boolean) => void): Unsubscribe {
  callback(localStorage.getItem('campusnotes_maintenance_mode') === 'true');
  if (!isFirebaseConfigured || !database) {
    return () => {};
  }
  const settingRef = ref(database, 'settings/maintenanceMode');
  return onValue(
    settingRef,
    (snapshot: RtdbSnapshot) => {
      const isMaint = snapshot.exists() ? Boolean(snapshot.val()) : false;
      localStorage.setItem('campusnotes_maintenance_mode', String(isMaint));
      callback(isMaint);
    },
    (err: Error) => {
      console.warn('Maintenance mode listener notice:', err);
      callback(localStorage.getItem('campusnotes_maintenance_mode') === 'true');
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

  // 1. Fetch current subjects in RTDB to check for excluded or duplicate entries
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
          // Remove associated demo materials safely
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

          // Remove the excluded subject from database
          await remove(ref(database, `subjects/${id}`));
        }
      }
    }
  } catch (err) {
    console.warn('Notice checking existing subjects before seeding:', err);
  }

  // 2. Save/Upsert the exact nine official CSE Semester 5 subjects
  for (const s of OFFICIAL_CSE_SEM_5_SUBJECTS) {
    await saveSubject(s, false);
  }

  cacheService.clearAll();
}

// ==========================================
// REAL-TIME SUBSCRIPTIONS (Live WebSocket Listeners)
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
 * Fires immediately with cached/default data and updates when RTDB changes
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
 * Seed or sync all 62 standard materials (30 assignments + 32 experiments)
 * Safe to rerun without creating duplicates
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
 * Reflects admin uploads, publish/unpublish changes instantly
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

