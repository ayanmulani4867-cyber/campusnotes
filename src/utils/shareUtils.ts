/**
 * Shared utility for sharing CampusNotes study materials:
 * 1. Generates a canonical, stable URL using the application routing: `${window.location.origin}/materials/${material.id}`.
 * 2. Uses the native Web Share API (navigator.share) on supported platforms (Android, iOS, modern desktop).
 * 3. Gracefully handles user cancellation (AbortError) without false error notifications.
 * 4. Provides a robust fallback to clipboard copying (via navigator.clipboard or textarea execCommand).
 * 5. Does NOT fetch or transfer PDF blob data just to share.
 */
export async function shareMaterial(
  material: { id: string; title: string },
  showToast?: (title: string, message: string) => void
): Promise<boolean> {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const shareUrl = `${origin}/materials/${material.id}`;
  const shareData = {
    title: `${material.title} — CampusNotes`,
    text: `Check out "${material.title}" on CampusNotes (CSE Semester 5):`,
    url: shareUrl,
  };

  // 1. Try native Web Share API (Mobile phones, tablets, supported desktop browsers)
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share(shareData);
      return true;
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
    showToast?.('Link Copied', 'Material link copied to clipboard.');
    return true;
  } else {
    showToast?.('Share Link', shareUrl);
    return false;
  }
}
