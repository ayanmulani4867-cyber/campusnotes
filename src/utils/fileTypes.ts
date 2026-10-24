// CampusNotes Multi-Format File Support & Safe MIME Type Utilities

export interface FileFormatInfo {
  extension: string;
  mimeType: string;
  category: 'document' | 'presentation' | 'spreadsheet' | 'image' | 'archive' | 'other';
  label: string;
  previewable: boolean;
}

export const SUPPORTED_FILE_FORMATS: Record<string, FileFormatInfo> = {
  // Documents
  pdf: {
    extension: 'pdf',
    mimeType: 'application/pdf',
    category: 'document',
    label: 'PDF Document',
    previewable: true,
  },
  doc: {
    extension: 'doc',
    mimeType: 'application/msword',
    category: 'document',
    label: 'Word Document (Legacy)',
    previewable: false,
  },
  docx: {
    extension: 'docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    category: 'document',
    label: 'Word Document',
    previewable: false,
  },
  txt: {
    extension: 'txt',
    mimeType: 'text/plain; charset=utf-8',
    category: 'document',
    label: 'Plain Text',
    previewable: true,
  },
  rtf: {
    extension: 'rtf',
    mimeType: 'application/rtf',
    category: 'document',
    label: 'Rich Text Format',
    previewable: false,
  },

  // Presentations
  ppt: {
    extension: 'ppt',
    mimeType: 'application/vnd.ms-powerpoint',
    category: 'presentation',
    label: 'PowerPoint (Legacy)',
    previewable: false,
  },
  pptx: {
    extension: 'pptx',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    category: 'presentation',
    label: 'PowerPoint Presentation',
    previewable: false,
  },

  // Spreadsheets
  xls: {
    extension: 'xls',
    mimeType: 'application/vnd.ms-excel',
    category: 'spreadsheet',
    label: 'Excel Spreadsheet (Legacy)',
    previewable: false,
  },
  xlsx: {
    extension: 'xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    category: 'spreadsheet',
    label: 'Excel Spreadsheet',
    previewable: false,
  },
  csv: {
    extension: 'csv',
    mimeType: 'text/csv; charset=utf-8',
    category: 'spreadsheet',
    label: 'CSV Spreadsheet',
    previewable: true,
  },

  // Images
  jpg: {
    extension: 'jpg',
    mimeType: 'image/jpeg',
    category: 'image',
    label: 'JPEG Image',
    previewable: true,
  },
  jpeg: {
    extension: 'jpeg',
    mimeType: 'image/jpeg',
    category: 'image',
    label: 'JPEG Image',
    previewable: true,
  },
  png: {
    extension: 'png',
    mimeType: 'image/png',
    category: 'image',
    label: 'PNG Image',
    previewable: true,
  },
  webp: {
    extension: 'webp',
    mimeType: 'image/webp',
    category: 'image',
    label: 'WebP Image',
    previewable: true,
  },

  // Archives
  zip: {
    extension: 'zip',
    mimeType: 'application/zip',
    category: 'archive',
    label: 'ZIP Archive',
    previewable: false,
  },
};

const DANGEROUS_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'sh', 'ps1', 'msi', 'dll', 'vbs', 'js', 'mjs', 'cjs',
  'jar', 'scr', 'com', 'pif', 'hta', 'cpl', 'py', 'php', 'asp', 'jsp', 'bin', 'wsf'
]);

export const ACCEPTED_FILE_EXTENSIONS =
  '.pdf,.doc,.docx,.txt,.rtf,.ppt,.pptx,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.webp,.zip';

export const ACCEPTED_FILE_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'application/rtf',
  'text/rtf',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/zip',
  'application/x-zip-compressed',
].join(',');

/**
 * Extracts and normalizes the lowercase extension without leading dot.
 */
export function getFileExtension(filename?: string | null): string {
  if (!filename) return '';
  const clean = filename.trim().split('?')[0].split('#')[0];
  const lastDot = clean.lastIndexOf('.');
  if (lastDot === -1 || lastDot === clean.length - 1) return '';
  return clean.slice(lastDot + 1).toLowerCase();
}

/**
 * Checks whether an extension is supported by CampusNotes.
 */
export function isSupportedExtension(extension?: string | null): boolean {
  if (!extension) return false;
  const ext = extension.replace(/^\./, '').toLowerCase().trim();
  return Boolean(SUPPORTED_FILE_FORMATS[ext]);
}

/**
 * Checks whether an extension is strictly prohibited/dangerous.
 */
export function isDangerousFileExtension(filename?: string | null): boolean {
  const ext = getFileExtension(filename);
  return DANGEROUS_EXTENSIONS.has(ext);
}

/**
 * Retrieves full format specification for a filename. Defaults to generic binary if unknown.
 */
export function getFileFormatInfo(filename?: string | null): FileFormatInfo {
  const ext = getFileExtension(filename);
  if (ext && SUPPORTED_FILE_FORMATS[ext]) {
    return SUPPORTED_FILE_FORMATS[ext];
  }
  return {
    extension: ext || 'bin',
    mimeType: 'application/octet-stream',
    category: 'other',
    label: ext ? ext.toUpperCase() : 'Binary File',
    previewable: false,
  };
}

/**
 * Resolves the MIME type for a given filename.
 */
export function resolveMimeType(filename?: string | null): string {
  return getFileFormatInfo(filename).mimeType;
}

/**
 * Returns true if the file format can be safely previewed in browser.
 */
export function isPreviewableFormat(filename?: string | null): boolean {
  return getFileFormatInfo(filename).previewable;
}

/**
 * Sanitizes a filename, preventing directory traversal and removing control chars.
 * Preserves the original safe extension.
 */
export function sanitizeSafeFilename(rawName: string, defaultName = 'download'): string {
  if (!rawName || typeof rawName !== 'string') return `${defaultName}.bin`;

  // Remove directory traversal characters
  let clean = rawName.replace(/[\0\r\n\t]/g, '').trim();
  clean = clean.replace(/\\/g, '/');
  const segments = clean.split('/');
  clean = segments[segments.length - 1] || defaultName;

  // Replace disallowed characters with underscore
  clean = clean.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');

  const ext = getFileExtension(clean);
  if (isDangerousFileExtension(clean)) {
    // Neutralize dangerous extension
    clean = `${clean}.txt`;
  } else if (!ext) {
    clean = `${clean}.bin`;
  }

  return clean;
}

/**
 * Validates known binary header magic bytes for supported formats.
 * Prevents disguised executable / malicious file uploads.
 */
export function validateMagicBytes(
  buffer: ArrayBuffer | ArrayBufferLike,
  extension: string
): { isValid: boolean; detectedMime?: string; error?: string } {
  if (buffer.byteLength < 4) {
    return { isValid: false, error: 'File is too small or truncated.' };
  }

  const bytes = new Uint8Array(buffer.slice(0, 16));
  const ext = extension.toLowerCase();

  // Strict rejection of executable headers (Windows PE "MZ" and Linux ELF "\x7fELF")
  if (bytes[0] === 0x4d && bytes[1] === 0x5a) {
    return { isValid: false, error: 'Security rejection: Windows executable binary header (MZ) detected.' };
  }
  if (bytes[0] === 0x7f && bytes[1] === 0x45 && bytes[2] === 0x4c && bytes[3] === 0x46) {
    return { isValid: false, error: 'Security rejection: Linux executable binary header (ELF) detected.' };
  }

  // 1. PDF: %PDF- (0x25 0x50 0x44 0x46 0x2D)
  if (ext === 'pdf') {
    const isPdf = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
    if (!isPdf) return { isValid: false, error: 'File header does not match valid PDF signature (%PDF-).' };
    return { isValid: true, detectedMime: 'application/pdf' };
  }

  // 2. PNG: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
  if (ext === 'png') {
    const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    if (!isPng) return { isValid: false, error: 'File header does not match valid PNG signature.' };
    return { isValid: true, detectedMime: 'image/png' };
  }

  // 3. JPEG: 0xFF 0xD8 0xFF
  if (ext === 'jpg' || ext === 'jpeg') {
    const isJpg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    if (!isJpg) return { isValid: false, error: 'File header does not match valid JPEG signature.' };
    return { isValid: true, detectedMime: 'image/jpeg' };
  }

  // 4. ZIP / DOCX / XLSX / PPTX: PK\x03\x04 or PK\x05\x06 or PK\x07\x08
  if (ext === 'zip' || ext === 'docx' || ext === 'xlsx' || ext === 'pptx') {
    const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07);
    if (!isZip) {
      return {
        isValid: false,
        error: `File header does not match valid archive/office container signature (${ext.toUpperCase()}).`,
      };
    }
    return { isValid: true, detectedMime: SUPPORTED_FILE_FORMATS[ext]?.mimeType };
  }

  // 5. WEBP: RIFF....WEBP
  if (ext === 'webp') {
    const isRiff = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
    const isWebp = bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
    if (!isRiff || !isWebp) return { isValid: false, error: 'File header does not match valid WebP signature.' };
    return { isValid: true, detectedMime: 'image/webp' };
  }

  // 6. RTF: {\rtf (0x7B 0x5C 0x72 0x74 0x66)
  if (ext === 'rtf') {
    const isRtf = bytes[0] === 0x7b && bytes[1] === 0x5c && bytes[2] === 0x72 && bytes[3] === 0x74 && bytes[4] === 0x66;
    if (!isRtf) return { isValid: false, error: 'File header does not match valid RTF signature ({\\rtf).' };
    return { isValid: true, detectedMime: 'application/rtf' };
  }

  // 7. Legacy Office (.doc, .xls, .ppt): OLE compound file header 0xD0 0xCF 0x11 0xE0 0xA1 0xB1 0x1A 0xE1
  if (ext === 'doc' || ext === 'xls' || ext === 'ppt') {
    const isOle = bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;
    if (!isOle) {
      return { isValid: false, error: `File header does not match valid legacy Microsoft Office signature (${ext.toUpperCase()}).` };
    }
    return { isValid: true, detectedMime: SUPPORTED_FILE_FORMATS[ext]?.mimeType };
  }

  // 8. Plain Text / CSV: Check for null bytes in initial chunk
  if (ext === 'txt' || ext === 'csv') {
    for (let i = 0; i < Math.min(bytes.length, 16); i++) {
      if (bytes[i] === 0x00) {
        return { isValid: false, error: `Invalid text file: Binary null byte detected in text content.` };
      }
    }
    return { isValid: true, detectedMime: SUPPORTED_FILE_FORMATS[ext]?.mimeType || 'text/plain' };
  }

  return { isValid: true, detectedMime: SUPPORTED_FILE_FORMATS[ext]?.mimeType || 'application/octet-stream' };
}

/**
 * Validates a client-side File before upload:
 * - Checks filename and extension against supported formats
 * - Prohibits dangerous executable formats
 * - Enforces file size limit
 * - Validates binary magic byte signature
 */
export async function validateClientFile(
  file: File,
  maxSizeBytes: number = 50 * 1024 * 1024
): Promise<{ valid: boolean; error?: string; formatInfo?: FileFormatInfo }> {
  if (!file) {
    return { valid: false, error: 'No file selected.' };
  }

  if (file.size <= 0) {
    return { valid: false, error: 'The selected file is empty (0 bytes).' };
  }

  if (file.size > maxSizeBytes) {
    const limitMB = (maxSizeBytes / (1024 * 1024)).toFixed(0);
    const fileMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File size (${fileMB} MB) exceeds maximum allowed limit of ${limitMB} MB.`,
    };
  }

  const ext = getFileExtension(file.name);
  if (!ext) {
    return {
      valid: false,
      error: 'File does not have a recognizable extension. Please select a valid document or archive file.',
    };
  }

  if (isDangerousFileExtension(file.name)) {
    return {
      valid: false,
      error: `Prohibited format: .${ext} files are executable or script files and cannot be uploaded.`,
    };
  }

  if (!isSupportedExtension(ext)) {
    return {
      valid: false,
      error: `Unsupported format: .${ext} is not supported. Supported formats: PDF, DOC, DOCX, TXT, RTF, PPT, PPTX, XLS, XLSX, CSV, JPG, PNG, WEBP, ZIP.`,
    };
  }

  const formatInfo = getFileFormatInfo(file.name);

  // Magic byte inspection for binary signatures
  try {
    const slice = file.slice(0, 16);
    const buffer = await slice.arrayBuffer();
    const signatureCheck = validateMagicBytes(buffer, ext);
    if (!signatureCheck.isValid) {
      return {
        valid: false,
        error: signatureCheck.error || `Invalid file contents: Header does not match .${ext} format.`,
        formatInfo,
      };
    }
  } catch {
    // If browser cannot read slice, proceed with extension check
  }

  return { valid: true, formatInfo };
}

