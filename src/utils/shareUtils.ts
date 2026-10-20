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
 * Builds the structured share message according to CampusNotes specification:
 * CampusNotes — Study Material
 *
 * Subject: [actual subject name]
 * Assignment: [actual assignment name]
 * Unit: [actual unit, if available]
 * PDF: [actual PDF title]
 *
 * View PDF: [actual working material URL]
 *
 * Missing fields are omitted gracefully without printing undefined, null, or incorrect data.
 */
export function formatShareText(
  material: ShareMaterialMetadata,
  subjectName?: string | null,
  shareUrl?: string
): string {
  const lines: string[] = ['CampusNotes — Study Material', ''];

  if (subjectName && subjectName.trim()) {
    lines.push(`Subject: ${subjectName.trim()}`);
  }

  // Assignment name or number
  if (
    material.assignmentNumber !== undefined &&
    material.assignmentNumber !== null &&
    String(material.assignmentNumber).trim() !== ''
  ) {
    const numStr = String(material.assignmentNumber).trim();
    const assignText = numStr.toLowerCase().startsWith('assignment')
      ? numStr
      : `Assignment ${numStr}`;
    lines.push(`Assignment: ${assignText}`);
  } else if (
    material.category === 'assignments' &&
    material.title &&
    material.title.toLowerCase().includes('assignment')
  ) {
    lines.push(`Assignment: ${material.title.trim()}`);
  }

  // Experiment / Practical (if applicable)
  if (
    material.experimentNumber !== undefined &&
    material.experimentNumber !== null &&
    String(material.experimentNumber).trim() !== ''
  ) {
    const expStr = String(material.experimentNumber).trim();
    const expText = expStr.toLowerCase().startsWith('exp')
      ? expStr
      : `Experiment ${expStr}`;
    lines.push(`Experiment: ${expText}`);
  }

  // Unit or chapter
  if (
    material.unitNumber !== undefined &&
    material.unitNumber !== null &&
    String(material.unitNumber).trim() !== ''
  ) {
    const unitStr = String(material.unitNumber).trim();
    const unitText =
      unitStr.toLowerCase().startsWith('unit') ||
      unitStr.toLowerCase().startsWith('chapter')
        ? unitStr
        : `Unit ${unitStr}`;
    lines.push(`Unit: ${unitText}`);
  }

  // PDF/material title
  const pdfTitle = (material.title || material.fileName || '').trim();
  if (pdfTitle) {
    lines.push(`PDF: ${pdfTitle}`);
  }

  // Working material link
  if (shareUrl && shareUrl.trim()) {
    lines.push('');
    lines.push(`View PDF: ${shareUrl.trim()}`);
  }

  return lines.join('\n');
}

/**
 * Shared utility for sharing CampusNotes study materials:
 * 1. Generates a canonical, stable URL using the application routing: `${window.location.origin}/materials/${material.id}`.
 * 2. Uses the native Web Share API (navigator.share) on supported platforms (Android, iOS, modern desktop).
 * 3. Gracefully handles user cancellation (AbortError) without false error notifications.
 * 4. Provides a robust fallback to clipboard copying (via navigator.clipboard or textarea execCommand).
 * 5. Does NOT fetch or transfer PDF blob data just to share.
 * 6. Never exposes private R2 object keys, Firebase credentials, or unauthorized unpublished PDFs in shared URLs.
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

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/materials/${material.id}`
      : `/materials/${material.id}`;

  const subjectName = resolveSubjectName(material, subject);
  const formattedText = formatShareText(material, subjectName, shareUrl);

  const shareData = {
    title: material.title ? `${material.title} — CampusNotes` : 'CampusNotes — Study Material',
    text: formattedText,
    url: shareUrl,
  };

  // 1. Try native Web Share API (Mobile phones, tablets, supported desktop browsers)
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

  // 2. Clipboard API fallback
  let copied = false;
  if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(formattedText);
      copied = true;
    } catch {
      copied = false;
    }
  }

  // 3. Fallback for insecure context or older mobile web views
  if (!copied && typeof document !== 'undefined') {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = formattedText;
      textarea.style.position = 'fixed';
      textarea.style.left = '-999999px';
      textarea.style.top = '-999999px';
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
    showToast?.('Link Copied', 'Study material details and link copied to clipboard.');
    return true;
  } else {
    showToast?.('Share Material', formattedText);
    return false;
  }
}
