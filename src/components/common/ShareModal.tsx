import React, { useEffect, useState } from 'react';
import { X, Check, Share2, FileText, ExternalLink } from 'lucide-react';

export interface ShareEventDetail {
  material: {
    id: string;
    title?: string;
    fileName?: string;
    category?: string;
    assignmentNumber?: string | number;
    experimentNumber?: string | number;
    unitNumber?: string | number;
  };
  subjectName?: string | null;
  formattedText: string;
  shareUrl: string;
  title: string;
}

export const ShareModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [shareData, setShareData] = useState<ShareEventDetail | null>(null);
  const [copied, setCopied] = useState(false);
  const [canSystemShare, setCanSystemShare] = useState(false);

  useEffect(() => {
    // Check if system share is supported on this browser/context
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      setCanSystemShare(true);
    }

    const handleOpenShare = (event: Event) => {
      const customEvent = event as CustomEvent<ShareEventDetail>;
      if (customEvent.detail) {
        setShareData(customEvent.detail);
        setIsOpen(true);
        setCopied(false);
      }
    };

    window.addEventListener('campusnotes:share', handleOpenShare);
    return () => {
      window.removeEventListener('campusnotes:share', handleOpenShare);
    };
  }, []);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!isOpen || !shareData) return null;

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleWhatsAppShare = () => {
    const encoded = encodeURIComponent(shareData.formattedText);
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  const handleTelegramShare = () => {
    const encoded = encodeURIComponent(shareData.formattedText);
    const telegramUrl = `https://t.me/share/url?text=${encoded}`;
    window.open(telegramUrl, '_blank', 'noopener,noreferrer');
  };

  const handleSystemShare = async () => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: shareData.title,
          text: shareData.formattedText,
        });
        setIsOpen(false);
      } catch (err) {
        // AbortError is silent
        if (
          err instanceof Error &&
          (err.name === 'AbortError' || err.message.toLowerCase().includes('abort'))
        ) {
          return;
        }
        // Fallback to copy if native share errors
        handleCopy();
      }
    }
  };

  const handleCopy = async () => {
    let success = false;
    if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(shareData.formattedText);
        success = true;
      } catch {
        success = false;
      }
    }

    if (!success && typeof document !== 'undefined') {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = shareData.formattedText;
        textarea.style.position = 'fixed';
        textarea.style.left = '-999999px';
        textarea.style.top = '-999999px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        success = document.execCommand('copy');
        document.body.removeChild(textarea);
      } catch {
        success = false;
      }
    }

    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Share Study Material"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 transition-all"
      onClick={handleClose}
    >
      <div
        className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in slide-in-from-bottom-4 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">
                Share Material
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {shareData.subjectName || 'CSE Semester 5'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 active:bg-slate-200 transition-colors"
            aria-label="Close share sheet"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* App Selector Grid */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
              Select an App to Share
            </p>

            <div className="grid grid-cols-1 gap-2.5">
              {/* WhatsApp Button */}
              <button
                type="button"
                onClick={handleWhatsAppShare}
                className="w-full min-h-[48px] px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl font-semibold text-sm flex items-center justify-between shadow-sm transition-all active:scale-[0.99] touch-manipulation"
              >
                <div className="flex items-center gap-3">
                  {/* WhatsApp SVG Icon */}
                  <svg
                    className="w-5 h-5 fill-current shrink-0"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M17.472 14.382c-.301-.15-1.78-.878-2.056-.978-.276-.101-.477-.15-.678.15-.2.3-.778.978-.953 1.18-.176.2-.352.226-.653.076-.301-.15-1.272-.469-2.424-1.496-.897-.799-1.503-1.786-1.68-2.086-.175-.3-.018-.462.132-.612.136-.135.301-.35.452-.526.15-.175.2-.3.301-.501.101-.2.051-.376-.025-.526-.076-.15-.678-1.633-.929-2.235-.244-.588-.492-.508-.678-.518-.176-.009-.377-.01-.578-.01-.2 0-.528.075-.804.376-.276.3-1.055 1.03-1.055 2.511 0 1.482 1.08 2.912 1.231 3.113.15.2 2.126 3.246 5.15 4.553.72.311 1.282.497 1.72.636.724.23 1.382.197 1.902.12.58-.087 1.78-.727 2.03-1.43.25-.702.25-1.303.176-1.43-.076-.126-.277-.2-.578-.351zM12.04 2C6.502 2 2.01 6.49 2.01 12.025c0 1.968.568 3.864 1.644 5.485L2 22l4.63-1.619a9.98 9.98 0 0 0 5.41 1.644h.005c5.534 0 10.026-4.49 10.026-10.025C22.07 6.49 17.575 2 12.04 2zm0 18.25a8.21 8.21 0 0 1-4.18-1.144l-.3-.178-3.11.815.83-3.033-.195-.31a8.2 8.2 0 0 1-1.258-4.375c0-4.542 3.696-8.238 8.243-8.238 4.542 0 8.238 3.696 8.238 8.238 0 4.543-3.696 8.24-8.238 8.24z" />
                  </svg>
                  <span>Share on WhatsApp</span>
                </div>
                <ExternalLink className="w-4 h-4 opacity-75" />
              </button>

              {/* Telegram Button */}
              <button
                type="button"
                onClick={handleTelegramShare}
                className="w-full min-h-[48px] px-4 py-2.5 bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white rounded-xl font-semibold text-sm flex items-center justify-between shadow-sm transition-all active:scale-[0.99] touch-manipulation"
              >
                <div className="flex items-center gap-3">
                  {/* Telegram SVG Icon */}
                  <svg
                    className="w-5 h-5 fill-current shrink-0"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.05-.19-.06-.05-.16-.03-.23-.02-.1.02-1.72 1.09-4.86 3.21-.46.32-.88.47-1.25.46-.42-.01-1.21-.24-1.8-.43-.73-.24-1.31-.37-1.26-.78.03-.21.32-.43.88-.66 3.44-1.5 5.73-2.49 6.87-2.97 3.27-1.37 3.95-1.61 4.4-1.61.1 0 .32.02.47.14.12.1.16.24.17.34 0 .07.01.22 0 .38z" />
                  </svg>
                  <span>Share on Telegram</span>
                </div>
                <ExternalLink className="w-4 h-4 opacity-75" />
              </button>

              {/* Native System Share (when available) */}
              {canSystemShare && (
                <button
                  type="button"
                  onClick={handleSystemShare}
                  className="w-full min-h-[48px] px-4 py-2.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 rounded-xl font-semibold text-sm flex items-center justify-between border border-slate-200 transition-all active:scale-[0.99] touch-manipulation"
                >
                  <div className="flex items-center gap-3">
                    <Share2 className="w-5 h-5 text-slate-600 shrink-0" />
                    <span>Other Apps (System Picker)</span>
                  </div>
                  <span className="text-xs text-slate-500 font-normal">More...</span>
                </button>
              )}

              {/* Copy Full Message Button */}
              <button
                type="button"
                onClick={handleCopy}
                className={`w-full min-h-[48px] px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-between border transition-all active:scale-[0.99] touch-manipulation ${
                  copied
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  {copied ? (
                    <Check className="w-5 h-5 text-emerald-600 shrink-0" />
                  ) : (
                    <FileText className="w-5 h-5 text-slate-500 shrink-0" />
                  )}
                  <span>{copied ? 'Message Copied!' : 'Copy Formatted Message'}</span>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  {copied ? '✓ Ready to paste' : 'Clipboard'}
                </span>
              </button>
            </div>
          </div>

          {/* Formatted Message Preview */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Message Preview
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                Single link: campusnotes.space
              </span>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 font-mono whitespace-pre-wrap leading-relaxed select-all">
              {shareData.formattedText}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
          <p className="text-[11px] text-slate-400">
            Tap any app above to prefill and share directly.
          </p>
        </div>
      </div>
    </div>
  );
};
