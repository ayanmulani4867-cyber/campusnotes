import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Download,
  FileText,
  Calendar,
  Clock,
  User,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  FileArchive,
  FileSpreadsheet,
  Presentation,
  Image as ImageIcon,
  CheckCircle2,
  FileQuestion,
  BookOpen,
} from 'lucide-react';
import { validatePrivateShare, getPrivateFileDownloadUrl } from '../services/privateShareService';
import { formatFileSize } from '../components/materials/MaterialCard';
import type { PrivateSharePublicInfo } from '../types/privateShare';

type DiagnosticErrorType =
  | 'invalid'
  | 'expired'
  | 'revoked'
  | 'not_found'
  | 'permission_denied'
  | 'worker_error'
  | 'material_missing'
  | 'storage_error'
  | 'network';

interface DiagnosticInfo {
  type: DiagnosticErrorType;
  title: string;
  description: string;
  adminHint?: string;
}

function parseDiagnostics(err: unknown): DiagnosticInfo {
  const rawMsg = err instanceof Error ? err.message : String(err);
  const lower = rawMsg.toLowerCase();

  if (rawMsg.startsWith('REVOKED:') || lower.includes('revoked')) {
    return {
      type: 'revoked',
      title: 'Private Link Revoked',
      description: 'This private sharing link was revoked by an administrator. Access to this document has been discontinued.',
      adminHint: 'Record status is set to "revoked".',
    };
  }

  if (rawMsg.startsWith('EXPIRED:') || lower.includes('expired')) {
    return {
      type: 'expired',
      title: 'Private Link Expired',
      description: 'This private sharing link reached its expiration date and is no longer accessible. Please contact the administrator or instructor to request a new link.',
      adminHint: 'Current timestamp exceeds the configured expiresAt.',
    };
  }

  if (rawMsg.startsWith('NOT_FOUND:') || lower.includes('not found') || lower.includes('unavailable')) {
    return {
      type: 'not_found',
      title: 'Sharing Record Not Found',
      description: 'This private sharing link was not found. Please confirm you have copied the entire URL correctly.',
      adminHint: 'No matching tokenHash found in Cloudflare R2 shares/ or RTDB privateShares/.',
    };
  }

  if (rawMsg.startsWith('PERMISSION_DENIED:') || lower.includes('permission_denied') || lower.includes('permission denied')) {
    return {
      type: 'permission_denied',
      title: 'Database Access Restricted',
      description: 'Database security policies restricted access to this document. Please contact the administrator to ensure database rules are active.',
      adminHint: 'Firebase RTDB returned PERMISSION_DENIED. Check database.rules.json rules for privateShares/$shareHash.',
    };
  }

  if (rawMsg.startsWith('WORKER_UNCONFIGURED:') || rawMsg.startsWith('WORKER_ERROR:') || lower.includes('worker')) {
    return {
      type: 'worker_error',
      title: 'Storage Service Unavailable',
      description: 'The document delivery service is temporarily unreachable. Please retry in a few moments.',
      adminHint: 'Cloudflare Worker returned an error or route is not deployed.',
    };
  }

  if (rawMsg.startsWith('MATERIAL_MISSING:') || lower.includes('material missing') || lower.includes('material not found')) {
    return {
      type: 'material_missing',
      title: 'Document Not Found',
      description: 'The study material associated with this link is no longer available in the repository.',
      adminHint: 'The materialId associated with this share no longer exists.',
    };
  }

  if (lower.includes('storage') || lower.includes('bucket')) {
    return {
      type: 'storage_error',
      title: 'Storage Retrieval Failure',
      description: 'The document file could not be retrieved from storage. Please notify the administrator.',
      adminHint: 'R2 object key was not found or could not be streamed.',
    };
  }

  if (lower.includes('network') || lower.includes('failed to fetch')) {
    return {
      type: 'network',
      title: 'Connection Error',
      description: 'Could not connect to the document server. Please check your internet connection and try again.',
      adminHint: 'Client HTTP request failed due to offline network or CORS block.',
    };
  }

  if (rawMsg.startsWith('INVALID_TOKEN:') || lower.includes('invalid access token')) {
    return {
      type: 'invalid',
      title: 'Invalid Sharing Token',
      description: 'The access token in this sharing link is malformed or invalid.',
      adminHint: 'Token failed validation check (length or character set).',
    };
  }

  return {
    type: 'not_found',
    title: 'Link Unavailable',
    description: 'This private sharing link is unavailable or no longer active.',
    adminHint: rawMsg,
  };
}

export const PrivateAssignmentPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();

  const [shareInfo, setShareInfo] = useState<PrivateSharePublicInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [diagnosticInfo, setDiagnosticInfo] = useState<DiagnosticInfo | null>(null);
  const [textPreviewContent, setTextPreviewContent] = useState<string | null>(null);
  const [isLoadingTextPreview, setIsLoadingTextPreview] = useState(false);

  useEffect(() => {
    // Add noindex tag dynamically to protect recipient privacy and prevent search engine indexing
    let metaTag = document.querySelector('meta[name="robots"]');
    let addedMeta = false;
    if (!metaTag) {
      metaTag = document.createElement('meta');
      metaTag.setAttribute('name', 'robots');
      metaTag.setAttribute('content', 'noindex, nofollow');
      document.head.appendChild(metaTag);
      addedMeta = true;
    } else {
      metaTag.setAttribute('content', 'noindex, nofollow');
    }

    return () => {
      if (addedMeta && metaTag && metaTag.parentNode) {
        metaTag.parentNode.removeChild(metaTag);
      }
    };
  }, []);

  const loadShareData = async () => {
    if (!token) {
      setIsLoading(false);
      setDiagnosticInfo({
        type: 'invalid',
        title: 'Missing Token',
        description: 'No private sharing token was provided in the URL.',
      });
      return;
    }

    setIsLoading(true);
    setDiagnosticInfo(null);

    try {
      const data = await validatePrivateShare(token);
      setShareInfo(data);

      // If text/csv format, fetch short preview text
      const ext = data.fileTypeInfo?.extension?.toLowerCase();
      if ((ext === 'txt' || ext === 'csv') && data.previewUrl) {
        setIsLoadingTextPreview(true);
        fetch(data.previewUrl)
          .then((res) => (res.ok ? res.text() : ''))
          .then((text) => {
            setTextPreviewContent(text.slice(0, 10000));
          })
          .catch(() => {})
          .finally(() => setIsLoadingTextPreview(false));
      }
    } catch (err: unknown) {
      const parsed = parseDiagnostics(err);
      setDiagnosticInfo(parsed);
      // Log diagnostic details safely without exposing the raw access token
      console.warn(`[PrivateShare Diagnostics] Error type: ${parsed.type}, Detail: ${parsed.adminHint || 'none'}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadShareData();
  }, [token]);

  // File category icon resolver
  const getFormatIcon = (category?: string, ext?: string) => {
    switch (category) {
      case 'image':
        return <ImageIcon className="w-8 h-8 text-emerald-600" />;
      case 'spreadsheet':
        return <FileSpreadsheet className="w-8 h-8 text-green-600" />;
      case 'presentation':
        return <Presentation className="w-8 h-8 text-amber-600" />;
      case 'archive':
        return <FileArchive className="w-8 h-8 text-purple-600" />;
      case 'document':
      default:
        return ext === 'pdf' ? (
          <FileText className="w-8 h-8 text-rose-600" />
        ) : (
          <FileText className="w-8 h-8 text-blue-600" />
        );
    }
  };

  // ---------------------------------------------------------------------------
  // 1. Loading State
  // ---------------------------------------------------------------------------
  if (isLoading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 mb-4 shadow-sm animate-pulse">
          <RefreshCw className="w-6 h-6 animate-spin" />
        </div>
        <h2 className="text-base font-bold text-slate-800">Verifying Private Link...</h2>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          Securing authorized direct access. No login or password required.
        </p>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // 2. Error / Unavailable State with Rich Diagnostics
  // ---------------------------------------------------------------------------
  if (diagnosticInfo || !shareInfo) {
    const info = diagnosticInfo || {
      type: 'not_found' as DiagnosticErrorType,
      title: 'Link Unavailable',
      description: 'This private sharing link is invalid, expired, or no longer available.',
    };

    return (
      <div className="min-h-[75vh] flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 text-center shadow-lg space-y-5 animate-in fade-in zoom-in-95">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mx-auto">
            <AlertCircle className="w-7 h-7" />
          </div>

          <div>
            <div className="inline-block px-2.5 py-0.5 mb-2 rounded-full text-[10px] font-bold tracking-wider uppercase bg-slate-100 text-slate-600 border border-slate-200">
              {info.type.replace('_', ' ')}
            </div>
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900">{info.title}</h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
              {info.description}
            </p>
          </div>

          <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-center gap-2">
            <button
              type="button"
              onClick={loadShareData}
              className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center justify-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Link</span>
            </button>
            <Link
              to="/"
              className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              Go to CampusNotes
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // 3. Authorized Material View (No Login Required)
  // ---------------------------------------------------------------------------
  const { fileTypeInfo, previewUrl, downloadUrl } = shareInfo;
  const isPdf = fileTypeInfo?.extension?.toLowerCase() === 'pdf';
  const isImage = fileTypeInfo?.category === 'image';
  const isText = fileTypeInfo?.extension?.toLowerCase() === 'txt' || fileTypeInfo?.extension?.toLowerCase() === 'csv';

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6">
      {/* Top Direct Access Trust Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl sm:rounded-2xl p-4 sm:p-6 text-white shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-100">
                Authorized Direct Share
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-500/20 text-emerald-100 border border-emerald-400/30 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="w-3 h-3 text-emerald-300" />
                <span>No Login Required</span>
              </span>
            </div>
            <p className="text-xs text-blue-100/90 mt-0.5">
              You have been granted direct access to download this study material.
            </p>
          </div>
        </div>

        <a
          href={downloadUrl}
          download={shareInfo.fileName}
          className="w-full sm:w-auto px-5 py-2.5 bg-white text-blue-700 hover:bg-blue-50 active:bg-blue-100 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-sm shrink-0"
        >
          <Download className="w-4 h-4" />
          <span>Download File</span>
        </a>
      </div>

      {/* Main Material Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-7 shadow-sm space-y-6">
        {/* Title Header */}
        <div className="space-y-2 border-b border-slate-100 pb-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wide bg-blue-50 text-blue-700 border border-blue-200">
              {fileTypeInfo?.label || 'Document'}
            </span>

            {shareInfo.recipientName && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200">
                <User className="w-3 h-3 text-slate-500" />
                <span>Shared with {shareInfo.recipientName}</span>
              </span>
            )}

            {shareInfo.dueDate && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-md border border-amber-200">
                <Calendar className="w-3 h-3 text-amber-600" />
                <span>Due: {new Date(shareInfo.dueDate).toLocaleDateString()}</span>
              </span>
            )}
          </div>

          <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-slate-900 leading-tight break-words">
            {shareInfo.materialTitle}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
            <span className="font-mono text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
              {shareInfo.fileName}
            </span>
            {shareInfo.fileSize > 0 && (
              <span>Size: <strong>{formatFileSize(shareInfo.fileSize)}</strong></span>
            )}
            <span>
              Shared: {new Date(shareInfo.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Assignment Instructions (if provided) */}
        {shareInfo.instructions && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-blue-600" />
              <span>Assignment Instructions & Notes</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
              {shareInfo.instructions}
            </p>
          </div>
        )}

        {/* Primary Download CTA Card */}
        <div className="p-4 sm:p-5 rounded-xl border border-blue-200/80 bg-blue-50/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-white border border-blue-200 flex items-center justify-center shrink-0 shadow-sm">
              {getFormatIcon(fileTypeInfo?.category, fileTypeInfo?.extension)}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 break-words">
                {shareInfo.fileName}
              </h3>
              <p className="text-xs text-slate-500">
                {fileTypeInfo?.label} &bull; {formatFileSize(shareInfo.fileSize)} &bull; Ready for instant download
              </p>
            </div>
          </div>

          <a
            href={downloadUrl}
            download={shareInfo.fileName}
            className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors shadow-sm shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>Download Material</span>
          </a>
        </div>

        {/* Document Preview Section (Where Safe & Supported) */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm sm:text-base font-bold text-slate-900">Document Preview</h2>
            {previewUrl && (
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 hover:underline"
              >
                <span>Open in new tab</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          {/* 1. PDF Preview */}
          {isPdf && previewUrl ? (
            <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-900 shadow-sm">
              <iframe
                src={`${previewUrl}#toolbar=1&navpanes=0`}
                title={shareInfo.materialTitle}
                className="w-full h-[600px] border-none"
              />
            </div>
          ) : isImage && previewUrl ? (
            /* 2. Image Preview */
            <div className="rounded-xl border border-slate-200 p-4 bg-slate-50 flex items-center justify-center overflow-hidden">
              <img
                src={previewUrl}
                alt={shareInfo.materialTitle}
                className="max-h-[600px] max-w-full rounded-lg object-contain shadow-sm"
              />
            </div>
          ) : isText && textPreviewContent ? (
            /* 3. Text Preview */
            <div className="rounded-xl border border-slate-200 p-4 bg-slate-900 text-slate-100 font-mono text-xs overflow-auto max-h-[500px]">
              <pre className="whitespace-pre-wrap">{textPreviewContent}</pre>
            </div>
          ) : (
            /* 4. Non-previewable Format Card (Word, PowerPoint, Excel, ZIP) */
            <div className="rounded-xl border border-slate-200 p-8 bg-slate-50 text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center mx-auto shadow-sm">
                {getFormatIcon(fileTypeInfo?.category, fileTypeInfo?.extension)}
              </div>
              <div className="max-w-md mx-auto">
                <h4 className="text-sm font-bold text-slate-800">
                  Direct Download Format ({fileTypeInfo?.extension?.toUpperCase()})
                </h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  This file is stored in <strong>{fileTypeInfo?.label}</strong> format. Click the download button below to save and open it with your device's native application (e.g. Microsoft Office, Google Workspace, or Archiver).
                </p>
              </div>
              <div className="pt-2">
                <a
                  href={downloadUrl}
                  download={shareInfo.fileName}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl font-bold text-xs transition-colors shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>Download {shareInfo.fileName}</span>
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="text-center text-xs text-slate-400 pt-4">
        <p>&copy; {new Date().getFullYear()} CampusNotes &bull; Secure Academic Hub</p>
        <p className="mt-1">
          This link was issued directly by the course administrator.
        </p>
      </div>
    </div>
  );
};

export default PrivateAssignmentPage;
