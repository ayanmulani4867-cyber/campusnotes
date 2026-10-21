/**
 * Assignment WhatsApp Sharing Utilities for CampusNotes.
 *
 * Adheres strictly to the specification:
 * Subject: [Subject Name]
 * Assignment No.: [Assignment Number]
 * https://campusnotes.space
 *
 * Rule: Only one website link: https://campusnotes.space.
 * Never includes www.campusnotes.space or any other URL.
 */

export const ASSIGNMENT_SHARE_URL = 'https://campusnotes.space';

/**
 * Normalizes assignment number input if user prefixed with "Assignment" or "No."
 * e.g., "Assignment 2" -> "2", "No. 3" -> "3", "1" -> "1"
 */
export function normalizeAssignmentNumber(input: string | number): string {
  const trimmed = String(input ?? '').trim();
  const cleaned = trimmed.replace(/^(assignment\s*(no\.?)?:?|no\.?:?)\s*/i, '');
  return cleaned || trimmed;
}

/**
 * Formats the exact 3-line WhatsApp-ready message according to specification:
 * Subject: [Subject Name]
 * Assignment No.: [Assignment Number]
 * https://campusnotes.space
 */
export function formatAssignmentShareMessage(
  subjectName: string,
  assignmentNumber: string | number
): string {
  const cleanSubject = String(subjectName ?? '').trim();
  const cleanNumber = normalizeAssignmentNumber(assignmentNumber);

  return `Subject: ${cleanSubject}\nAssignment No.: ${cleanNumber}\n${ASSIGNMENT_SHARE_URL}`;
}

/**
 * Generates the canonical WhatsApp web/app share URL with prefilled text
 */
export function getWhatsAppShareUrl(message: string): string {
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
}

/**
 * Copies message text to clipboard with fallback for older browsers and webviews
 */
export async function copyAssignmentMessage(message: string): Promise<boolean> {
  if (!message) return false;

  // 1. Modern Async Clipboard API
  if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(message);
      return true;
    } catch {
      // Fallback below
    }
  }

  // 2. Fallback using temporary textarea
  if (typeof document !== 'undefined') {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = message;
      textarea.style.position = 'fixed';
      textarea.style.left = '-999999px';
      textarea.style.top = '-999999px';
      textarea.setAttribute('readonly', '');
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Opens WhatsApp with the message prefilled in a new window/app
 */
export function openWhatsAppShare(message: string): void {
  const url = getWhatsAppShareUrl(message);
  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
