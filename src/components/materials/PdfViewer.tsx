import React, { useState, useEffect } from 'react';
import {
  Download,
  ExternalLink,
  FileText,
  AlertCircle,
  RefreshCw,
  Share2,
  Check,
  BookOpen,
} from 'lucide-react';
import { StudyMaterial, Subject } from '../../types';
import {
  fetchPdfBlobUrl,
  downloadStudyMaterial,
  extractBlobId,
  isPdfCached,
  getCachedBlobUrl,
  isMaterialPdfCached,
  getCachedPdfUrl,
} from '../../services/firebaseService';
import { shareMaterial } from '../../utils/shareUtils';
import { useToast } from '../../context/ToastContext';
import { formatFileSize } from './MaterialCard';

interface PdfViewerProps {
  material: StudyMaterial;
  subject?: Subject;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({ material, subject }) => {
  const toast = useToast();
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [downloadProgressText, setDownloadProgressText] = useState('');
  const [copied, setCopied] = useState(false);
  const [isReaderActive, setIsReaderActive] = useState(false);

  const blobId = extractBlobId(material);

  // Initialize or check if document is already cached in session memory
  useEffect(() => {
    let isMounted = true;
    setLoadError(false);
    setErrorMessage('');

    // 1. Static demo PDF -> Instant display without network
    if (material.downloadUrl && material.downloadUrl.startsWith('/demo-pdfs/')) {
      setResolvedUrl(material.downloadUrl);
      setIsReaderActive(true);
      setIsLoading(false);
      return;
    }

    // 2. Already in session memory cache (R2, RTDB, or preloaded) -> Instant display without network
    const cachedUrl = getCachedPdfUrl(material);
    if (cachedUrl) {
      setResolvedUrl(cachedUrl);
      setIsReaderActive(true);
      setIsLoading(false);
      return;
    }

    // 3. Not yet downloaded -> Keep reader on-demand to save bandwidth
    if (isMounted) {
      setResolvedUrl(null);
      setIsReaderActive(false);
      setIsLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [material.id, material.downloadUrl, material.blobId, material.r2Key, blobId]);

  // Load document reader on explicit user demand
  const handleLoadReader = async () => {
    if (isLoading || isReaderActive) return;
    setIsReaderActive(true);
    setIsLoading(true);
    setLoadError(false);
    setErrorMessage('');
    setLoadingProgress('Connecting to database...');

    try {
      const url = await fetchPdfBlobUrl(material, (status) => {
        setLoadingProgress(status);
      });
      setResolvedUrl(url);
    } catch (err: unknown) {
      setLoadError(true);
      setErrorMessage(
        err instanceof Error ? err.message : 'Could not load PDF document reader.'
      );
    } finally {
      setIsLoading(false);
      setLoadingProgress('');
    }
  };

  const handleDownload = async () => {
    if (downloading) return;
    try {
      setDownloading(true);
      setDownloadProgressText('Connecting...');
      await downloadStudyMaterial(material, (status) => {
        setDownloadProgressText(status);
      });

      // Automatically activate reader using the newly downloaded cached blob
      const newlyCachedUrl = getCachedPdfUrl(material);
      if (newlyCachedUrl) {
        setResolvedUrl(newlyCachedUrl);
        setIsReaderActive(true);
      }

      toast.success('Download Complete', `"${material.fileName || material.title}" downloaded.`);
    } catch (err: unknown) {
      toast.error('Download Failed', err instanceof Error ? err.message : String(err));
    } finally {
      setDownloading(false);
      setDownloadProgressText('');
    }
  };

  const handleShare = async () => {
    const success = await shareMaterial(
      material,
      (title, msg) => {
        toast.success(title, msg);
      },
      subject
    );
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const isLocalOrBlob =
    resolvedUrl?.startsWith('blob:') ||
    resolvedUrl?.startsWith('/') ||
    resolvedUrl?.startsWith('data:');

  const viewerSrc = isLocalOrBlob
    ? (resolvedUrl || '')
    : resolvedUrl
    ? `https://docs.google.com/viewer?url=${encodeURIComponent(resolvedUrl)}&embedded=true`
    : '';

  return (
    <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm flex flex-col h-[440px] sm:h-[650px] lg:h-[750px] max-h-[82vh]">
      {/* Viewer Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-3 sm:px-4 py-2.5 sm:py-3 bg-white border-b border-slate-200 text-slate-900 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0 w-full sm:w-auto sm:max-w-[55%]">
          <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <span className="text-xs sm:text-sm font-semibold text-slate-900 truncate">
            {material.fileName || material.title}
          </span>
          {material.fileSize ? (
            <span className="text-[11px] font-medium text-slate-400 shrink-0">
              ({formatFileSize(material.fileSize)})
            </span>
          ) : null}
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-1.5 sm:gap-2 w-full sm:w-auto">
          {/* Share button */}
          <button
            type="button"
            onClick={handleShare}
            aria-label={`Share ${material.title}`}
            title={copied ? 'Link Copied!' : 'Share Material'}
            className={`flex-1 sm:flex-none min-h-[38px] sm:min-h-[40px] px-2.5 sm:px-3 py-1.5 inline-flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              copied
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 active:bg-slate-200'
            }`}
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Share2 className="w-3.5 h-3.5 text-slate-600" />
            )}
            <span>{copied ? 'Copied!' : 'Share'}</span>
          </button>

          {/* Open direct in new tab (available when loaded or local) */}
          {resolvedUrl ? (
            <a
              href={resolvedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 sm:flex-none min-h-[38px] sm:min-h-[40px] inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 transition-colors"
              title="Open in new window"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
              <span>Fullscreen</span>
            </a>
          ) : (
            <button
              type="button"
              onClick={handleLoadReader}
              disabled={isLoading || downloading}
              className="flex-1 sm:flex-none min-h-[38px] sm:min-h-[40px] inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 transition-colors disabled:opacity-50"
              title="Load Document Reader"
            >
              <BookOpen className="w-3.5 h-3.5 text-slate-600" />
              <span>Read Online</span>
            </button>
          )}

          {/* Download button with live progress telemetry */}
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="flex-1 sm:flex-none min-h-[38px] sm:min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm disabled:opacity-60"
          >
            {downloading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span className="truncate max-w-[130px] sm:max-w-none">
              {downloadProgressText || (downloading ? 'Downloading...' : 'Download')}
            </span>
          </button>
        </div>
      </div>

      {/* Embedded Viewer Container */}
      <div className="relative flex-1 bg-slate-100 flex items-center justify-center overflow-hidden">
        {/* State 1: Active Loading Spinner with Live Progress */}
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 z-10 px-4 text-center">
            <RefreshCw className="w-9 h-9 text-blue-600 animate-spin mb-3.5" />
            <p className="text-sm font-bold text-slate-800">
              {loadingProgress || 'Loading PDF document...'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Retrieving document from Realtime Database
            </p>
          </div>
        )}

        {/* State 2: Load Error Screen */}
        {loadError ? (
          <div className="text-center p-6 max-w-md">
            <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
            <h4 className="text-base font-bold text-slate-900 mb-1">
              Document Preview Unavailable
            </h4>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              {errorMessage ||
                'Your browser or network prevented the inline PDF reader from displaying. You can download the document directly below.'}
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                className="px-5 py-2.5 bg-blue-600 text-white text-xs font-semibold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
              >
                <Download className="w-4 h-4" />
                <span>{downloading ? 'Downloading...' : 'Download PDF Directly'}</span>
              </button>
            </div>
          </div>
        ) : isReaderActive && viewerSrc ? (
          /* State 3: Active Document Iframe */
          <iframe
            src={viewerSrc}
            title={material.title}
            className="w-full h-full border-0"
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false);
              setLoadError(true);
            }}
          />
        ) : (
          /* State 4: Clean On-Demand Preview Card (0 KB loaded until requested) */
          <div className="text-center p-6 sm:p-8 max-w-md bg-white rounded-2xl border border-slate-200/90 shadow-sm mx-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4 border border-blue-100 shadow-sm">
              <FileText className="w-7 h-7" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-1 leading-snug">
              {material.title}
            </h3>
            <p className="text-xs text-slate-500 mb-1 truncate max-w-xs mx-auto">
              {material.fileName || 'PDF Document'}
            </p>
            {material.fileSize ? (
              <span className="inline-block text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full mb-5">
                File size: {formatFileSize(material.fileSize)}
              </span>
            ) : (
              <div className="mb-4" />
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                className="w-full sm:w-auto min-h-[42px] px-5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {downloading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>{downloadProgressText || (downloading ? 'Downloading...' : 'Download PDF')}</span>
              </button>

              <button
                type="button"
                onClick={handleLoadReader}
                disabled={isLoading || downloading}
                className="w-full sm:w-auto min-h-[42px] px-5 py-2 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 text-xs font-semibold rounded-xl transition-colors border border-slate-200 flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <BookOpen className="w-4 h-4 text-slate-600" />
                <span>Read Document Online</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-4">
              Tip: Download once to view offline and avoid repeating database reads.
            </p>
          </div>
        )}
      </div>

      {/* Viewer Footer Status */}
      <div className="px-3 sm:px-4 py-2 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 text-[11px] text-slate-400">
        <span>Verified Academic Document • CSE Semester 5</span>
        <span className="hidden sm:inline">Realtime Database Secure Delivery</span>
      </div>
    </div>
  );
};
