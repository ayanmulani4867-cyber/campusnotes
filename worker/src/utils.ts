// worker/src/utils.ts
// Shared utility functions for campusnotes-pdf-api Worker.
// These are intentionally NOT re-exported from index.ts to avoid Cloudflare Workers
// mistaking non-handler exports for entrypoint handlers.

// Exact 50 MB limit: 50 * 1024 * 1024 = 52,428,800 bytes
export const MAX_FILE_SIZE_BYTES = 52428800;
export const MAX_FILE_SIZE_ERROR = 'Maximum file size allowed is 50 MB.';

export interface ParsedByteRange {
  start: number;
  end: number;
}

/**
 * Parses HTTP Range header according to RFC 7233 / RFC 9110.
 * Returns a range object, 'unsatisfiable', 'invalid', or null (no range).
 */
export function parseByteRange(
  rangeHeader: string,
  totalSize: number
): ParsedByteRange | 'unsatisfiable' | 'invalid' | null {
  if (!rangeHeader.startsWith('bytes=')) {
    return null;
  }

  const spec = rangeHeader.slice('bytes='.length).trim();
  if (spec.includes(',')) {
    return 'invalid';
  }

  const parts = spec.split('-');
  if (parts.length !== 2) {
    return 'invalid';
  }

  const [startStr, endStr] = parts;
  if (!startStr && !endStr) {
    return 'invalid';
  }

  // Suffix range: bytes=-500
  if (!startStr) {
    const suffix = parseInt(endStr, 10);
    if (isNaN(suffix) || suffix <= 0) return 'invalid';
    if (totalSize === 0) return 'unsatisfiable';
    const start = Math.max(0, totalSize - suffix);
    const end = totalSize - 1;
    return { start, end };
  }

  // Open-ended range: bytes=500-
  if (!endStr) {
    const start = parseInt(startStr, 10);
    if (isNaN(start) || start < 0) return 'invalid';
    if (start >= totalSize) return 'unsatisfiable';
    return { start, end: totalSize - 1 };
  }

  // Explicit range: bytes=500-999
  const start = parseInt(startStr, 10);
  const end = parseInt(endStr, 10);
  if (isNaN(start) || isNaN(end) || start < 0 || start > end) {
    return 'invalid';
  }
  if (start >= totalSize) {
    return 'unsatisfiable';
  }

  return { start, end: Math.min(end, totalSize - 1) };
}

/**
 * Sanitizes a filename for legacy PDF-only upload paths.
 * Guarantees a .pdf extension is always present.
 */
export function sanitizeFilename(name: string): string {
  const clean = name
    .replace(/[^\w\s.-]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^\.+/, '')
    .trim();
  if (clean.length === 0) return 'material.pdf';
  return clean.toLowerCase().endsWith('.pdf') ? clean : `${clean}.pdf`;
}

