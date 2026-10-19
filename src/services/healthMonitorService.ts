import { ref, get, onValue } from 'firebase/database';
import { database, isFirebaseConfigured } from '../config/firebase';
import {
  WebsiteHealthStatus,
  ApplicationErrorRecord,
  PdfOperationHealth,
  PdfFailureRecord,
  AvailabilityStatus,
} from '../types';

type RtdbSnapshot = {
  exists(): boolean;
  val(): any;
};

const HEALTH_STORAGE_KEY = 'campusnotes_health_monitor_v1';
const ERRORS_STORAGE_KEY = 'campusnotes_application_errors_v1';
const PDF_HEALTH_STORAGE_KEY = 'campusnotes_pdf_health_v1';

class HealthMonitorService {
  private isFirebaseConnected = false;
  private lastLatencyMs: number | null = null;
  private lastCheckTimestamp = 0;
  private listenerInitialized = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initGlobalListeners();
    }
  }

  /**
   * Initializes Firebase connection monitoring and browser error listeners.
   */
  private initGlobalListeners(): void {
    if (this.listenerInitialized) return;
    this.listenerInitialized = true;

    // 1. Firebase RTDB Connection state listener
    try {
      if (database) {
        const connectedRef = ref(database, '.info/connected');
        onValue(connectedRef, (snap: RtdbSnapshot) => {
          this.isFirebaseConnected = Boolean(snap.val());
        });
      }
    } catch (err) {
      console.warn('Firebase connection listener notice:', err);
    }

    // 2. Global uncaught error listener
    window.addEventListener('error', (event: ErrorEvent) => {
      // Ignore extension noise or cross-origin script errors
      if (!event.message || event.message.includes('ResizeObserver') || event.message.includes('Script error')) {
        return;
      }
      this.recordApplicationError({
        message: event.message || 'Unknown runtime script error',
        source: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        type: 'RUNTIME_ERROR',
      });
    });

    // 3. Global unhandled promise rejection listener
    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      let msg = 'Unhandled Promise Rejection';
      if (reason instanceof Error) {
        msg = reason.message;
      } else if (typeof reason === 'string') {
        msg = reason;
      }
      // Ignore canceled network fetches
      if (msg.includes('aborted') || msg.includes('AbortError')) return;

      this.recordApplicationError({
        message: msg,
        type: msg.toLowerCase().includes('firebase') || msg.toLowerCase().includes('permission')
          ? 'FIREBASE_ERROR'
          : 'PROMISE_REJECTION',
      });
    });
  }

  /**
   * Retrieves logged application errors from storage.
   */
  public getApplicationErrors(): ApplicationErrorRecord[] {
    try {
      const raw = localStorage.getItem(ERRORS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Ignore
    }
    return [];
  }

  /**
   * Records an application error with deduplication.
   */
  public recordApplicationError(params: {
    message: string;
    source?: string;
    lineno?: number;
    colno?: number;
    type: 'RUNTIME_ERROR' | 'PROMISE_REJECTION' | 'FIREBASE_ERROR' | 'PDF_ERROR';
  }): void {
    try {
      const errors = this.getApplicationErrors();
      const now = Date.now();
      const existing = errors.find((e) => e.message === params.message);

      if (existing) {
        existing.count += 1;
        existing.lastSeen = now;
      } else {
        const newRecord: ApplicationErrorRecord = {
          id: `err_${now}_${Math.random().toString(36).substring(2, 6)}`,
          message: params.message,
          source: params.source,
          lineno: params.lineno,
          colno: params.colno,
          timestamp: now,
          type: params.type,
          count: 1,
          lastSeen: now,
        };
        errors.unshift(newRecord);
      }

      // Limit to 40 error records
      const trimmed = errors.slice(0, 40);
      localStorage.setItem(ERRORS_STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      // Ignore quota errors
    }
  }

  /**
   * Clears application errors.
   */
  public clearErrors(): void {
    try {
      localStorage.removeItem(ERRORS_STORAGE_KEY);
    } catch {
      // Ignore
    }
  }

  /**
   * Retrieves PDF operation health metrics.
   */
  public getPdfHealth(): PdfOperationHealth {
    try {
      const raw = localStorage.getItem(PDF_HEALTH_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.totalUploadAttempts === 'number') {
          return parsed as PdfOperationHealth;
        }
      }
    } catch {
      // Ignore
    }

    return {
      totalUploadAttempts: 0,
      uploadSuccesses: 0,
      uploadFailures: 0,
      totalDownloadAttempts: 0,
      downloadSuccesses: 0,
      downloadFailures: 0,
      recentFailures: [],
    };
  }

  /**
   * Records a PDF operation (upload, download, or preview attempt).
   */
  public recordPdfOperation(
    type: 'UPLOAD' | 'DOWNLOAD' | 'PREVIEW',
    success: boolean,
    info: { materialId?: string; fileName?: string; error?: string } = {}
  ): void {
    try {
      const health = this.getPdfHealth();

      if (type === 'UPLOAD') {
        health.totalUploadAttempts += 1;
        if (success) {
          health.uploadSuccesses += 1;
        } else {
          health.uploadFailures += 1;
        }
      } else {
        health.totalDownloadAttempts += 1;
        if (success) {
          health.downloadSuccesses += 1;
        } else {
          health.downloadFailures += 1;
        }
      }

      if (!success && info.error) {
        const failure: PdfFailureRecord = {
          id: `pdf_fail_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          type,
          materialId: info.materialId,
          fileName: info.fileName,
          error: info.error,
          timestamp: Date.now(),
        };
        health.recentFailures = [failure, ...health.recentFailures].slice(0, 30);

        // Also record as application error
        this.recordApplicationError({
          message: `PDF ${type} failure: ${info.error}`,
          type: 'PDF_ERROR',
        });
      }

      localStorage.setItem(PDF_HEALTH_STORAGE_KEY, JSON.stringify(health));
    } catch {
      // Ignore
    }
  }

  /**
   * Runs a lightweight health check measuring ping latency and connectivity.
   * Does NOT download full PDF blobs or query expensive nodes.
   */
  public async runHealthCheck(): Promise<WebsiteHealthStatus> {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    let rtdbLatencyMs: number | null = null;
    let isConnected = this.isFirebaseConnected;
    let isMaintenance = false;

    if (isOnline && database) {
      try {
        const start = performance.now();
        // Lightweight ping: reads tiny maintenanceMode flag or server time offset
        const snap = await get(ref(database, 'settings/maintenanceMode'));
        const end = performance.now();
        rtdbLatencyMs = Math.round(end - start);
        this.lastLatencyMs = rtdbLatencyMs;
        isConnected = true;
        this.isFirebaseConnected = true;
        if (snap.exists() && snap.val() === true) {
          isMaintenance = true;
        }
      } catch (err: unknown) {
        console.warn('Health check ping notice:', err);
        isConnected = false;
        rtdbLatencyMs = null;
      }
    }

    this.lastCheckTimestamp = Date.now();

    // Determine overall availability status
    let availability: AvailabilityStatus = 'OPERATIONAL';
    if (!isOnline) {
      availability = 'OFFLINE';
    } else if (isMaintenance) {
      availability = 'MAINTENANCE';
    } else if (!isConnected || (rtdbLatencyMs !== null && rtdbLatencyMs > 2500)) {
      availability = 'DEGRADED';
    }

    const errors = this.getApplicationErrors();
    const pdfHealth = this.getPdfHealth();

    const status: WebsiteHealthStatus = {
      availability,
      lastCheckTimestamp: this.lastCheckTimestamp,
      isOnline,
      firebaseConnected: isConnected,
      rtdbLatencyMs,
      authConfigured: isFirebaseConfigured,
      maintenanceMode: isMaintenance,
      totalErrorsLogged: errors.reduce((acc, curr) => acc + curr.count, 0),
      recentErrors: errors,
      pdfHealth,
    };

    try {
      localStorage.setItem(HEALTH_STORAGE_KEY, JSON.stringify(status));
    } catch {
      // Ignore
    }

    return status;
  }

  /**
   * Retrieves the last computed health status from storage.
   */
  public getLastHealthStatus(): WebsiteHealthStatus | null {
    try {
      const raw = localStorage.getItem(HEALTH_STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw) as WebsiteHealthStatus;
      }
    } catch {
      // Ignore
    }
    return null;
  }
}

export const healthMonitorService = new HealthMonitorService();
