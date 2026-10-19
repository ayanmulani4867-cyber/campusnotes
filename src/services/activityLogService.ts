import { ref, get, set } from 'firebase/database';
import { database } from '../config/firebase';
import { AdminActivityRecord, AdminActionType } from '../types';

const ACTIVITY_LOG_STORAGE_KEY = 'campusnotes_admin_activity_log_v1';
const MAX_LOCAL_LOGS = 200;

class ActivityLogService {
  /**
   * Sanitizes metadata to guarantee that no passwords, authentication tokens,
   * or binary PDF contents are ever logged.
   */
  private sanitizeMetadata(
    metadata?: Record<string, unknown>
  ): Record<string, unknown> | undefined {
    if (!metadata) return undefined;
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(metadata)) {
      const lowerKey = key.toLowerCase();
      // Strictly filter out sensitive credentials or blob payloads
      if (
        lowerKey.includes('password') ||
        lowerKey.includes('token') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('base64') ||
        lowerKey.includes('data_base64') ||
        lowerKey.includes('blob') ||
        lowerKey.includes('buffer')
      ) {
        continue;
      }
      sanitized[key] = value;
    }

    return sanitized;
  }

  /**
   * Retrieves locally cached activity logs.
   */
  public getLocalLogs(): AdminActivityRecord[] {
    try {
      const raw = localStorage.getItem(ACTIVITY_LOG_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch {
      // Ignore parse errors
    }
    return [];
  }

  /**
   * Saves activity logs to local cache.
   */
  private saveLocalLogs(logs: AdminActivityRecord[]): void {
    try {
      const trimmed = logs.slice(0, MAX_LOCAL_LOGS);
      localStorage.setItem(ACTIVITY_LOG_STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      // Ignore quota errors
    }
  }

  /**
   * Records an administrative action.
   * Never invents historical records or logs passwords/tokens/PDF contents.
   */
  public async logActivity(params: {
    adminEmail?: string | null;
    adminUid?: string | null;
    action: AdminActionType;
    resourceId: string;
    resourceName?: string;
    result: 'SUCCESS' | 'FAILURE';
    errorMessage?: string;
    metadata?: Record<string, unknown>;
  }): Promise<AdminActivityRecord> {
    const now = Date.now();
    const id = `act_${now}_${Math.random().toString(36).substring(2, 6)}`;

    const record: AdminActivityRecord = {
      id,
      adminEmail: params.adminEmail || 'admin@campusnotes.internal',
      adminUid: params.adminUid || 'admin',
      action: params.action,
      resourceId: params.resourceId,
      resourceName: params.resourceName,
      timestamp: now,
      result: params.result,
      errorMessage: params.errorMessage,
      metadata: this.sanitizeMetadata(params.metadata),
    };

    // 1. Immediately update local storage
    const localLogs = this.getLocalLogs();
    const updated = [record, ...localLogs];
    this.saveLocalLogs(updated);

    // 2. Dispatch browser event for live UI reactivity
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('campusnotes:activity_logged', { detail: record }));
    }

    // 3. Persist to Firebase RTDB under /admins/activity_logs/{id}
    try {
      if (database) {
        const logRef = ref(database, `admins/activity_logs/${record.id}`);
        await set(logRef, record);
      }
    } catch (err) {
      // If offline or write denied, local record is preserved
      console.warn('Activity log RTDB persistence notice:', err);
    }

    return record;
  }

  /**
   * Fetches all activity logs, combining remote Firebase records with local cache.
   */
  public async getActivityLogs(): Promise<AdminActivityRecord[]> {
    const localLogs = this.getLocalLogs();
    const logMap = new Map<string, AdminActivityRecord>();

    // Seed with local records
    localLogs.forEach((item) => logMap.set(item.id, item));

    // Try fetching from Firebase RTDB
    try {
      if (database) {
        const logsRef = ref(database, 'admins/activity_logs');
        const snap = await get(logsRef);
        if (snap.exists()) {
          const val = snap.val();
          if (typeof val === 'object' && val !== null) {
            Object.values(val).forEach((rawItem: unknown) => {
              const item = rawItem as AdminActivityRecord;
              if (item && item.id && item.timestamp) {
                logMap.set(item.id, item);
              }
            });
          }
        }
      }
    } catch {
      // If Firebase read fails (e.g. offline), local cache remains available
    }

    const merged = Array.from(logMap.values()).sort((a, b) => b.timestamp - a.timestamp);
    this.saveLocalLogs(merged);
    return merged;
  }

  /**
   * Clears local activity logs.
   */
  public clearLocalLogs(): void {
    try {
      localStorage.removeItem(ACTIVITY_LOG_STORAGE_KEY);
    } catch {
      // Ignore
    }
  }
}

export const activityLogService = new ActivityLogService();
