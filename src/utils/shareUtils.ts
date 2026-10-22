import { cacheService } from '../services/cacheService';
import { OFFICIAL_CSE_SEM_5_SUBJECTS } from '../constants/subjects';
import { Subject } from '../types';

export interface ShareMaterialMetadata {
  id: string;
  title?: string;
  fileName?: string;
  subjectId?: string;
  category?: string;
  unitNumber?: number | string | null;
  assignmentNumber?: number | string | null;
  experimentNumber?: number | string | null;
  published?: boolean;
}

/**
 * Resolves the clean, official subject name dynamically using:
 * 1. An explicitly provided Subject object or { name: string }
 * 2. Active subjects cached from Firebase RTDB in cacheService ('public_subjects')
 * 3. Static OFFICIAL_CSE_SEM_5_SUBJECTS catalog
 * Returns null if subject is unavailable so the field can be omitted cleanly.
 */
export function resolveSubjectName(
  material: { subjectId?: string },
  providedSubject?: Subject | { name?: string; code?: string } | null
): string | null {
  if (providedSubject?.name && providedSubject.name.trim()) {
    return providedSubject.name.trim();
  }

  if (!material.subjectId) return null;

  try {
    const cachedSubjects = cacheService.get<Subject[]>('public_subjects');
    if (cachedSubjects && Array.isArray(cachedSubjects)) {
      const match = cachedSubjects.find(
        (s) =>
          s.id === material.subjectId ||
          (s.code && s.code.toLowerCase() === material.subjectId?.toLowerCase())
      );
      if (match?.name && match.name.trim()) {
        return match.name.trim();
      }
    }
  } catch {
    // Non-browser or test runner environment
  }

  const staticMatch = OFFICIAL_CSE_SEM_5_SUBJECTS.find(
    (s) =>
      s.id === material.subjectId ||
      (s.code && s.code.toLowerCase() === material.subjectId?.toLowerCase())
  );
  if (staticMatch?.name && staticMatch.name.trim()) {
    return staticMatch.name.trim();
  }

  return null;
}

/**
 * Generates the clean direct PDF link for sharing:
 * Shares only the direct link to that specific PDF with no extra text, message, or metadata.
 * Example: https://campusnotes.space/materials/mat_123456
 */
export const OFFICIAL_SHARE_LINK = 'https://campusnotes.space';

export function formatShareText(
  material: ShareMaterialMetadata,
  _subjectName?: string | null,
  shareUrl: string = OFFICIAL_SHARE_LINK
): string {
  if (material.id) {
    return `https://campusnotes.space/materials/${material.id}`;
  }
  return shareUrl && shareUrl.trim() ? shareUrl.trim() : OFFICIAL_SHARE_LINK;
}

/**
 * Shared utility for sharing CampusNotes study materials:
 * 1. Generates a canonical, stable URL: https://campusnotes.space/materials/${material.id}
 *    // Canonical URL reference: ${window.location.origin}/materials/${material.id}
 * 2. Shares ONLY the direct link to that specific PDF (no message, title, subject, assignment number, or description).
 * 3. Uses the native Web Share API (navigator.share) on supported platforms (Android, iOS, modern desktop).
 * 4. Gracefully handles user cancellation (AbortError) without false error notifications.
 * 5. Provides a robust fallback to clipboard copying (via navigator.clipboard or textarea execCommand).
 * 6. Does NOT fetch or transfer PDF blob data just to share.
 * 7. Never exposes private R2 object keys, Firebase credentials, or unauthorized unpublished PDFs in shared URLs.
 */
export async function shareMaterial(
  material: ShareMaterialMetadata,
  showToast?: (title: string, message: string) => void,
  subject?: Subject | { name?: string; code?: string } | null
): Promise<boolean> {
  // Guard against sharing unpublished/restricted drafts
  if (material.published === false) {
    showToast?.(
      'Material Unpublished',
      'This study material is unpublished and cannot be shared publicly.'
    );
    return false;
  }

  // Canonical URL reference: ${window.location.origin}/materials/${material.id}
  const shareUrl = `https://campusnotes.space/materials/${material.id}`;

  const _subjectName = resolveSubjectName(material, subject);

  // Avoid extra text: share only the direct PDF link URL
  const shareData = {
    url: shareUrl,
  };

  // 1. Immediately call the browser's native navigator.share() API to open device system share menu
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      if (!navigator.canShare || navigator.canShare(shareData)) {
        await navigator.share(shareData);
        return true;
      }
    } catch (err: unknown) {
      // AbortError indicates user cancelled or dismissed the native share sheet
      if (
        err instanceof Error &&
        (err.name === 'AbortError' ||
          err.message.toLowerCase().includes('abort') ||
          err.message.toLowerCase().includes('cancel'))
      ) {
        return false;
      }
      // If native sharing failed for an unexpected reason, fallback to clipboard copy
    }
  }

  // 2. Simple Copy Link fallback if native sharing is unsupported
  let copied = false;
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(shareUrl);
      copied = true;
    } catch {
      copied = false;
    }
  }

  // 3. Fallback for insecure context or older mobile web views
  if (!copied && typeof document !== 'undefined') {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = shareUrl;
      textarea.style.position = 'fixed';
      textarea.style.left = '-999999px';
      textarea.style.top = '-999999px';
      textarea.setAttribute('readonly', '');
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      copied = document.execCommand('copy');
      document.body.removeChild(textarea);
    } catch {
      copied = false;
    }
  }

  if (copied) {
    showToast?.('Link Copied', shareUrl);
    return true;
  } else {
    showToast?.('Share Material', shareUrl);
    return false;
  }
}
