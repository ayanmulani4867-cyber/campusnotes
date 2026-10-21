// Firebase Realtime Database Client for CampusNotes Worker
import type { Env, PublicMaterialRecord } from './types.ts';

interface CachedPublicRecord {
  record: PublicMaterialRecord | null;
  expires: number;
}

const publicMetadataCache = new Map<string, CachedPublicRecord>();
const PUBLIC_METADATA_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

export function invalidatePublicMaterialCache(materialId?: string): void {
  if (materialId) {
    publicMetadataCache.delete(materialId);
  } else {
    publicMetadataCache.clear();
  }
}

/**
 * Reads public material metadata from the public RTDB partition.
 * Subject to Firebase security rule: root.child('settings').child('maintenanceMode').val() !== true.
 * If maintenance mode is active or the material is unpublished/missing, this returns null.
 */
export async function getPublicMaterialMetadata(
  materialId: string,
  env: Env
): Promise<PublicMaterialRecord | null> {
  const now = Date.now();
  const cached = publicMetadataCache.get(materialId);
  if (cached && now < cached.expires) {
    return cached.record;
  }

  const dbUrl = env.FIREBASE_DATABASE_URL || 'https://campusnotes-e62cf-default-rtdb.firebaseio.com';
  const url = `${dbUrl}/publicMaterials/${encodeURIComponent(materialId)}.json`;

  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
      cf: {
        cacheTtl: 300,
        cacheEverything: true,
      },
    } as RequestInit);

    if (!res.ok) {
      publicMetadataCache.set(materialId, { record: null, expires: now + 60000 });
      return null;
    }

    const data = await res.json() as PublicMaterialRecord | null;
    if (!data || data.published !== true) {
      publicMetadataCache.set(materialId, { record: null, expires: now + 60000 });
      return null;
    }

    const record: PublicMaterialRecord = {
      ...data,
      id: materialId,
    };
    publicMetadataCache.set(materialId, { record, expires: now + PUBLIC_METADATA_TTL_MS });
    return record;
  } catch (err) {
    console.error(`Error querying public material ${materialId} from RTDB:`, err);
    return null;
  }
}

/**
 * Reads material metadata from the authenticated admin partition (/materials).
 * Requires a valid Firebase Auth token.
 */
export async function getAdminMaterialMetadata(
  materialId: string,
  token: string,
  env: Env
): Promise<PublicMaterialRecord | null> {
  const dbUrl = env.FIREBASE_DATABASE_URL || 'https://campusnotes-e62cf-default-rtdb.firebaseio.com';
  const url = `${dbUrl}/materials/${encodeURIComponent(materialId)}.json?auth=${encodeURIComponent(token)}`;

  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json() as PublicMaterialRecord | null;
    if (!data) return null;

    return {
      ...data,
      id: materialId,
    };
  } catch (err) {
    console.error(`Error querying admin material ${materialId} from RTDB:`, err);
    return null;
  }
}
