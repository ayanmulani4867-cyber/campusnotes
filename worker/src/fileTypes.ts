// Cloudflare Worker: Multi-Format MIME Type Detection & Magic Byte Security Validation

export interface FileFormatMetadata {
  extension: string;
  mimeType: string;
  category: 'document' | 'presentation' | 'spreadsheet' | 'image' | 'archive' | 'other';
  label: string;
  previewable: boolean;
}

export const WORKER_SUPPORTED_FORMATS: Record<string, FileFormatMetadata> = {
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

export function getFileExtension(filename?: string | null): string {
  if (!filename) return '';
  const clean = filename.trim().split('?')[0].split('#')[0];
  const lastDot = clean.lastIndexOf('.');
  if (lastDot === -1 || lastDot === clean.length - 1) return '';
  return clean.slice(lastDot + 1).toLowerCase();
}

export function isDangerousExtension(filename?: string | null): boolean {
  const ext = getFileExtension(filename);
  return DANGEROUS_EXTENSIONS.has(ext);
}

export function getWorkerFileFormatInfo(filename?: string | null): FileFormatMetadata {
  const ext = getFileExtension(filename);
  if (ext && WORKER_SUPPORTED_FORMATS[ext]) {
    return WORKER_SUPPORTED_FORMATS[ext];
  }
  return {
    extension: ext || 'bin',
    mimeType: 'application/octet-stream',
    category: 'other',
    label: ext ? ext.toUpperCase() : 'Binary File',
    previewable: false,
  };
}

export function sanitizeWorkerFilename(rawName: string, fallbackDefault = 'material'): string {
  if (!rawName || typeof rawName !== 'string') return `${fallbackDefault}.pdf`;

  // Strip null bytes and control chars
  let clean = rawName.replace(/[\0\r\n\t]/g, '').trim();
  clean = clean.replace(/\\/g, '/');
  const segments = clean.split('/');
  clean = segments[segments.length - 1] || fallbackDefault;

  // Replace disallowed characters with underscore
  clean = clean.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');

  const ext = getFileExtension(clean);
  if (isDangerousExtension(clean)) {
    clean = `${clean}.txt`;
  } else if (!ext) {
    clean = `${clean}.pdf`;
  }

  return clean;
}

/**
 * Validates known binary header magic bytes for common formats.
 * Returns true if valid or if format does not have a strict signature check.
 */
export function validateMagicBytes(buffer: ArrayBuffer | ArrayBufferLike, extension: string): { isValid: boolean; detectedMime?: string; error?: string } {
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
    if (!isPdf) return { isValid: false, error: 'File header does not match PDF signature (%PDF-).' };
    return { isValid: true, detectedMime: 'application/pdf' };
  }

  // 2. PNG: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
  if (ext === 'png') {
    const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    if (!isPng) return { isValid: false, error: 'File header does not match PNG signature.' };
    return { isValid: true, detectedMime: 'image/png' };
  }

  // 3. JPEG: 0xFF 0xD8 0xFF
  if (ext === 'jpg' || ext === 'jpeg') {
    const isJpg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    if (!isJpg) return { isValid: false, error: 'File header does not match JPEG signature.' };
    return { isValid: true, detectedMime: 'image/jpeg' };
  }

  // 4. ZIP / DOCX / XLSX / PPTX: PK\x03\x04 or PK\x05\x06 or PK\x07\x08
  if (ext === 'zip' || ext === 'docx' || ext === 'xlsx' || ext === 'pptx') {
    const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07);
    if (!isZip) return { isValid: false, error: `File header does not match valid archive/office container signature (${ext.toUpperCase()}).` };
    return { isValid: true, detectedMime: WORKER_SUPPORTED_FORMATS[ext]?.mimeType };
  }

  // 5. WEBP: RIFF....WEBP
  if (ext === 'webp') {
    const isRiff = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
    const isWebp = bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
    if (!isRiff || !isWebp) return { isValid: false, error: 'File header does not match WebP signature.' };
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
    return { isValid: true, detectedMime: WORKER_SUPPORTED_FORMATS[ext]?.mimeType };
  }

  // 8. Plain Text / CSV: Check for null bytes in initial chunk
  if (ext === 'txt' || ext === 'csv') {
    for (let i = 0; i < Math.min(bytes.length, 16); i++) {
      if (bytes[i] === 0x00) {
        return { isValid: false, error: `Invalid text file: Binary null byte detected in text content.` };
      }
    }
    return { isValid: true, detectedMime: WORKER_SUPPORTED_FORMATS[ext]?.mimeType || 'text/plain' };
  }

  // Other safe formats accept default
  return { isValid: true, detectedMime: WORKER_SUPPORTED_FORMATS[ext]?.mimeType || 'application/octet-stream' };
}
