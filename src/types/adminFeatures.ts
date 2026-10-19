/**
 * Type definitions for:
 * 1. Visitor Analytics Dashboard
 * 2. Admin Activity Log
 * 3. Website Health Monitor
 *
 * Strict Academic Scope: CSE Semester 5 Study Hub (CampusNotes)
 */

// ============================================================================
// 1. Visitor Analytics Types
// ============================================================================

export type DeviceType = 'Desktop' | 'Mobile' | 'Tablet';

export interface VisitorSession {
  id: string; // Anonymous random session ID (no fingerprinting)
  startedAt: number;
  lastActiveAt: number;
  ipAddress?: string;
  deviceType: DeviceType;
  browser: string;
  os: string;
  isAuthenticated: boolean;
  userRole?: 'administrator' | 'student_visitor';
  userEmail?: string;
  pagesVisited: number;
}

export interface PageViewEvent {
  id: string;
  path: string;
  title?: string;
  subjectId?: string;
  timestamp: number;
  sessionId: string;
  deviceType: DeviceType;
  browser: string;
  os: string;
  ipAddress?: string;
  isAuthenticated: boolean;
  userEmail?: string;
}

export interface DailyAnalytics {
  date: string; // YYYY-MM-DD
  pageViews: number;
  uniqueVisitors: number;
}

export interface VisitorAnalyticsSummary {
  totalPageViews: number;
  estimatedUniqueVisitors: number;
  todayVisitors: number;
  activeVisitors5Min: number;
  stats7Days: DailyAnalytics[];
  stats30Days: DailyAnalytics[];
  mostVisitedPages: { path: string; count: number }[];
  mostVisitedSubjects: { subjectId: string; subjectName: string; count: number }[];
  deviceTypes: { type: string; count: number; percentage: number }[];
  browsers: { name: string; count: number; percentage: number }[];
  operatingSystems: { name: string; count: number; percentage: number }[];
  recentSessions: VisitorSession[];
  recentPageViews: PageViewEvent[];
  lastUpdated: number;
}

// ============================================================================
// 2. Admin Activity Log Types
// ============================================================================

export type AdminActionType =
  | 'MATERIAL_UPLOAD'
  | 'MATERIAL_UPDATE'
  | 'MATERIAL_PUBLISH_TOGGLE'
  | 'MATERIAL_DELETE'
  | 'PDF_REPLACE'
  | 'MAINTENANCE_TOGGLE'
  | 'ADMIN_PASSWORD_CHANGE'
  | 'SUBJECT_CREATE'
  | 'SUBJECT_UPDATE'
  | 'SUBJECT_DELETE';

export interface AdminActivityRecord {
  id: string;
  adminEmail: string;
  adminUid: string;
  action: AdminActionType;
  resourceId: string; // e.g. material ID, subject code/ID
  resourceName?: string; // e.g. title or name of material/subject
  timestamp: number;
  result: 'SUCCESS' | 'FAILURE';
  errorMessage?: string;
  metadata?: {
    fileSize?: number;
    fileName?: string;
    category?: string;
    subjectCode?: string;
    published?: boolean;
    previousValue?: string;
    newValue?: string;
    [key: string]: unknown;
  };
}

// ============================================================================
// 3. Website Health Monitor Types
// ============================================================================

export type AvailabilityStatus = 'OPERATIONAL' | 'DEGRADED' | 'MAINTENANCE' | 'OFFLINE';

export interface ApplicationErrorRecord {
  id: string;
  message: string;
  source?: string;
  lineno?: number;
  colno?: number;
  timestamp: number;
  type: 'RUNTIME_ERROR' | 'PROMISE_REJECTION' | 'FIREBASE_ERROR' | 'PDF_ERROR';
  count: number;
  lastSeen: number;
}

export interface PdfFailureRecord {
  id: string;
  type: 'UPLOAD' | 'DOWNLOAD' | 'PREVIEW';
  materialId?: string;
  fileName?: string;
  error: string;
  timestamp: number;
}

export interface PdfOperationHealth {
  totalUploadAttempts: number;
  uploadSuccesses: number;
  uploadFailures: number;
  totalDownloadAttempts: number;
  downloadSuccesses: number;
  downloadFailures: number;
  recentFailures: PdfFailureRecord[];
}

export interface WebsiteHealthStatus {
  availability: AvailabilityStatus;
  lastCheckTimestamp: number;
  isOnline: boolean;
  firebaseConnected: boolean;
  rtdbLatencyMs: number | null;
  authConfigured: boolean;
  maintenanceMode: boolean;
  totalErrorsLogged: number;
  recentErrors: ApplicationErrorRecord[];
  pdfHealth: PdfOperationHealth;
}
