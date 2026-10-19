// Cloudflare Worker Environment and API Types for CampusNotes PDF Storage

export interface R2HttpMetadata {
  contentType?: string;
  contentLanguage?: string;
  contentDisposition?: string;
  contentEncoding?: string;
  cacheControl?: string;
  cacheExpiry?: Date;
}

export interface R2ObjectMetadata {
  key: string;
  version: string;
  size: number;
  etag: string;
  httpEtag: string;
  uploaded: Date;
  httpMetadata?: R2HttpMetadata;
  customMetadata?: Record<string, string>;
  writeHttpMetadata(headers: Headers): void;
}

export interface R2ObjectBody extends R2ObjectMetadata {
  body: ReadableStream;
  bodyUsed: boolean;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
  json<T>(): Promise<T>;
  blob(): Promise<Blob>;
}

export interface R2Range {
  offset?: number;
  length?: number;
  suffix?: number;
}

export interface R2Bucket {
  get(key: string, options?: { range?: R2Range | Headers; onlyIf?: Headers }): Promise<R2ObjectBody | null>;
  head(key: string): Promise<R2ObjectMetadata | null>;
  put(
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob | null,
    options?: {
      httpMetadata?: R2HttpMetadata;
      customMetadata?: Record<string, string>;
      md5?: ArrayBuffer | string;
      sha1?: ArrayBuffer | string;
      sha256?: ArrayBuffer | string;
    }
  ): Promise<R2ObjectMetadata>;
  delete(keys: string | string[]): Promise<void>;
  list(options?: {
    prefix?: string;
    cursor?: string;
    delimiter?: string;
    limit?: number;
  }): Promise<{
    objects: R2ObjectMetadata[];
    truncated: boolean;
    cursor?: string;
    delimitedPrefixes: string[];
  }>;
}

export interface Env {
  PDF_BUCKET: R2Bucket;
  FIREBASE_PROJECT_ID?: string;
  FIREBASE_DATABASE_URL?: string;
  ALLOWED_ORIGINS?: string;
}

export interface PublicMaterialRecord {
  id: string;
  title: string;
  fileName: string;
  subjectId: string;
  category: string;
  academicYear: string;
  blobId?: string;
  r2Key?: string;
  storagePath?: string;
  downloadUrl?: string;
  fileSize: number;
  published: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface AdminAuthResult {
  isAuthorized: boolean;
  uid?: string;
  email?: string;
  error?: string;
}
