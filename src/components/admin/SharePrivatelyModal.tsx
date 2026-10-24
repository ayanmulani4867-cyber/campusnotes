import React, { useState, useEffect } from 'react';
import {
  Share2,
  Copy,
  Check,
  Calendar,
  Clock,
  User,
  Mail,
  FileText,
  AlertTriangle,
  ExternalLink,
  MessageCircle,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { StudyMaterial } from '../../types';
import { createPrivateShare } from '../../services/privateShareService';
import { useToast } from '../../context/ToastContext';
import { getFileFormatInfo } from '../../utils/fileTypes';
import type { CreatePrivateShareResult } from '../../types/privateShare';

interface SharePrivatelyModalProps {
  isOpen: boolean;
  onClose: () => void;
  material: StudyMaterial | null;
  onShareCreated?: (result: CreatePrivateShareResult) => void;
}

export const SharePrivatelyModal: React.FC<SharePrivatelyModalProps> = ({
  isOpen,
  onClose,
  material,
  onShareCreated,
}) => {
  const toast = useToast();

  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [instructions, setInstructions] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [expirationPreset, setExpirationPreset] = useState<'24h' | '7d' | '30d' | 'custom' | 'never'>('7d');
  const [customExpirationDate, setCustomExpirationDate] = useState('');

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedShare, setGeneratedShare] = useState<CreatePrivateShareResult | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setRecipientName('');
      setRecipientEmail('');
      setInstructions('');
      setDueDate('');
      setExpirationPreset('7d');
      setCustomExpirationDate('');
      setGeneratedShare(null);
      setCopied(false);
      setIsGenerating(false);
    }
  }, [isOpen, material]);

  if (!material) return null;

  const fileFormat = getFileFormatInfo(material.fileName);

  // Compute expiration timestamp based on preset
  const calculateExpiresAt = (): number | null => {
    const now = Date.now();
    if (expirationPreset === 'never') return null;
    if (expirationPreset === '24h') return now + 24 * 60 * 60 * 1000;
    if (expirationPreset === '7d') return now + 7 * 24 * 60 * 60 * 1000;
    if (expirationPreset === '30d') return now + 30 * 24 * 60 * 60 * 1000;
    if (expirationPreset === 'custom' && customExpirationDate) {
      const parsed = new Date(customExpirationDate).getTime();
      return isNaN(parsed) ? null : parsed;
    }
    return now + 7 * 24 * 60 * 60 * 1000;
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!material) return;

    setIsGenerating(true);
    try {
      const parsedDueDate = dueDate ? new Date(dueDate).getTime() : null;
      const expiresAt = calculateExpiresAt();

      const result = await createPrivateShare({
        materialId: material.id,
        recipientName: recipientName.trim() || undefined,
        recipientEmail: recipientEmail.trim() || undefined,
        instructions: instructions.trim() || undefined,
        dueDate: parsedDueDate,
        expiresAt,
      });

      setGeneratedShare(result);
      onShareCreated?.(result);
      toast.success(
        'Private Link Generated',
        'Secure share link generated successfully. Ready to send to recipient.'
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Generation Failed', msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyLink = async () => {
    if (!generatedShare?.shareUrl) return;
    try {
      await navigator.clipboard.writeText(generatedShare.shareUrl);
      setCopied(true);
      toast.success('Link Copied', 'Private link copied to clipboard.');
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback
      toast.info('Share URL', generatedShare.shareUrl);
    }
  };

  const handleNativeShare = async () => {
    if (!generatedShare?.shareUrl) return;

    const shareData = {
      title: material.title,
      text: instructions ? `${material.title}\n\nInstructions: ${instructions}` : material.title,
      url: generatedShare.shareUrl,
    };

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share(shareData);
        return;
      } catch (err: unknown) {
        if (
          err instanceof Error &&
          (err.name === 'AbortError' || err.message.toLowerCase().includes('cancel'))
        ) {
          return;
        }
      }
    }

    // Fallback to clipboard copy
    handleCopyLink();
  };

  const getWhatsAppShareUrl = (): string => {
    if (!generatedShare?.shareUrl) return '#';
    const text = encodeURIComponent(
      `Hello${recipientName ? ' ' + recipientName : ''}, here is the private study material link for "${material.title}":\n\n${generatedShare.shareUrl}\n\n(No account or login required to download).`
    );
    return `https://api.whatsapp.com/send?text=${text}`;
  };

  const getEmailShareUrl = (): string => {
    if (!generatedShare?.shareUrl) return '#';
    const subject = encodeURIComponent(`CampusNotes Material: ${material.title}`);
    const body = encodeURIComponent(
      `Hi${recipientName ? ' ' + recipientName : ''},\n\nYou have been shared a private study material on CampusNotes:\n\nTitle: ${material.title}\nFile: ${material.fileName}\n${instructions ? `\nInstructions: ${instructions}\n` : ''}${dueDate ? `Due Date: ${new Date(dueDate).toLocaleDateString()}\n` : ''}\nOpen and download the material immediately without logging in:\n${generatedShare.shareUrl}\n\nRegards,\nCampusNotes Administrator`
    );
    return `mailto:${encodeURIComponent(recipientEmail || '')}?subject=${subject}&body=${body}`;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Share Privately"
      description="Create a secure, direct link for anyone to access and download this material without requiring an account or login."
      maxWidth="lg"
    >
      <div className="space-y-5">
        {/* Material Summary Card (Automatically Selected) */}
        <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3.5 sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-600 block mb-0.5">
                Selected Material
              </span>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug break-words">
                {material.title}
              </h3>
              <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-slate-500">
                <span className="font-mono text-[11px] font-medium px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                  {material.fileName}
                </span>
                <span className="text-slate-400">&bull;</span>
                <span className="text-[11px] font-medium text-slate-600">
                  {fileFormat.label}
                </span>
                <span className="text-slate-400">&bull;</span>
                <span className="text-[11px] font-medium text-slate-600">
                  {material.academicYear}
                </span>
              </div>
            </div>
            <span className="px-2 py-1 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
              {material.category.toUpperCase()}
            </span>
          </div>
        </div>

        {!generatedShare ? (
          /* Form for generating link */
          <form onSubmit={handleGenerate} className="space-y-4">
            {/* Recipient Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>Recipient Name</span>
                  <span className="text-slate-400 font-normal text-[11px]">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="e.g. John Doe, Section B"
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900 placeholder:text-slate-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>Recipient Identifier / Email</span>
                  <span className="text-slate-400 font-normal text-[11px]">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="e.g. student@college.edu or Roll #42"
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900 placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Assignment Instructions */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span>Assignment Instructions / Notes</span>
                <span className="text-slate-400 font-normal text-[11px]">(Optional)</span>
              </label>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={2}
                placeholder="e.g. Please solve Questions 1 to 4 and submit by Friday. Refer to lecture notes for theorems."
                className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900 placeholder:text-slate-400 resize-none"
              />
            </div>

            {/* Due Date & Expiration Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Due Date</span>
                  <span className="text-slate-400 font-normal text-[11px]">(Optional)</span>
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Link Expiration</span>
                  <span className="text-slate-400 font-normal text-[11px]">(Optional)</span>
                </label>
                <select
                  value={expirationPreset}
                  onChange={(e) => setExpirationPreset(e.target.value as any)}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900"
                >
                  <option value="24h">Expires in 24 hours</option>
                  <option value="7d">Expires in 7 days (Recommended)</option>
                  <option value="30d">Expires in 30 days</option>
                  <option value="custom">Custom Date</option>
                  <option value="never">No Expiration (Active until revoked)</option>
                </select>
              </div>
            </div>

            {expirationPreset === 'custom' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Custom Expiration Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={customExpirationDate}
                  onChange={(e) => setCustomExpirationDate(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900"
                  required={expirationPreset === 'custom'}
                />
              </div>
            )}

            {/* Security Notice per Requirement 9 */}
            <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-lg flex items-start gap-2 text-xs text-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed text-[11px]">
                <strong className="font-semibold block mb-0.5 text-amber-900">
                  Access Model Notice:
                </strong>
                Because this private link intentionally requires no login, password, or access code, anyone who possesses the link may download the material until the link expires or is manually revoked. You can revoke this link at any time in the management panel.
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isGenerating}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Generating Link...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Generate Private Link</span>
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          /* Result view after link generation */
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl text-emerald-900 text-xs">
              <div className="flex items-center gap-2 font-bold text-sm text-emerald-800 mb-1">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>Private Link Ready</span>
              </div>
              <p className="text-[11px] text-emerald-700 leading-relaxed">
                The private link has been cryptographically generated and registered. The recipient can immediately open this link and download the file with zero registration or login.
              </p>
            </div>

            {/* Generated URL Box */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Unique Private Link URL:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={generatedShare.shareUrl}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  className="w-full text-xs font-mono px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none select-all"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className={`px-3 py-2.5 rounded-lg text-xs font-semibold border transition-colors shrink-0 flex items-center gap-1.5 ${
                    copied
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                  title="Copy link to clipboard"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Copied' : 'Copy Link'}</span>
                </button>
              </div>
            </div>

            {/* Quick Share Buttons */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                Direct Sharing Channels
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Share2 className="w-3.5 h-3.5 text-blue-600" />
                  <span>Share Link</span>
                </button>

                <a
                  href={getWhatsAppShareUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 border border-slate-200 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                  <span>WhatsApp</span>
                </a>

                <a
                  href={getEmailShareUrl()}
                  className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 border border-slate-200 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Mail className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Email</span>
                </a>
              </div>
            </div>

            {/* Test Link Button */}
            <div className="pt-1">
              <a
                href={generatedShare.shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 hover:underline"
              >
                <span>Preview recipient page in new tab</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
