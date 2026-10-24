// CampusNotes Private Assignment & Notes Sharing Data Models

export type PrivateShareStatus = 'active' | 'revoked' | 'expired';

export interface FileFormatInfo {
  extension: string;
  mimeType: string;
  category: 'document' | 'presentation' | 'spreadsheet' | 'image' | 'archive' | 'other';
  label: string;
  previewable: boolean;
}

export interface PrivateShareRecord {
  id: string; // SHA-256 tokenHash or identifier
  tokenHash: string; // SHA-256 hex string of the raw token (raw token is never persisted)
  materialId: string;
  materialTitle: string;
  fileName: string;
  fileSize: number;
  mimeType?: string;
  storageProvider?: 'r2' | 'firebase';
  r2Key?: string;
  blobId?: string;
  recipientName?: string;
  recipientEmail?: string;
  instructions?: string;
  dueDate?: number | null;
  expiresAt?: number | null; // null or 0 indicates no expiration
  status: PrivateShareStatus;
  createdAt: number;
  createdBy: string;
  revokedAt?: number | null;
  revokedBy?: string | null;
  accessCount?: number;
  lastAccessedAt?: number | null;
}

export interface CreatePrivateShareInput {
  materialId: string;
  recipientName?: string;
  recipientEmail?: string;
  instructions?: string;
  dueDate?: number | null;
  expiresAt?: number | null;
}

export interface CreatePrivateShareResult {
  ok: boolean;
  shareId: string;
  token: string; // Only returned once at creation time to display in the admin modal
  shareUrl: string;
  materialId: string;
  materialTitle: string;
  fileName: string;
  recipientName?: string;
  recipientEmail?: string;
  instructions?: string;
  dueDate?: number | null;
  expiresAt?: number | null;
  createdAt: number;
  status: 'active';
}

export interface PrivateSharePublicInfo {
  valid: boolean;
  materialTitle: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  fileTypeInfo: FileFormatInfo;
  recipientName?: string;
  instructions?: string;
  dueDate?: number | null;
  createdAt: number;
  expiresAt?: number | null;
  downloadUrl: string;
  previewUrl?: string;
}
