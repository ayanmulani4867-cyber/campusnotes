import React, { useState, useEffect } from 'react';
import {
  Download,
  ExternalLink,
  FileText,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { StudyMaterial } from '../../types';
import { fetchPdfBlobUrl, downloadStudyMaterial } from '../../services/firebaseService';
import { useToast } from '../../context/ToastContext';

interface PdfViewerProps {
  material: StudyMaterial;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({ material }) => {
  const toast = useToast();
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setLoadError(false);
    setErrorMessage('');

    async function resolve() {
      try {
        const url = await fetchPdfBlobUrl(material);
        if (isMounted) {
          setResolvedUrl(url);
          setIsLoading(false);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setLoadError(true);
          setErrorMessage(err instanceof Error ? err.message : 'Could not load PDF document.');
          setIsLoading(false);
        }
      }
    }

    resolve();

    return () => {
      isMounted = false;
    };
  }, [material]);

  const handleDownload = async () => {
    if (downloading) return;
    try {
      setDownloading(true);
      await downloadStudyMaterial(material);
      toast.success('Download Complete', `"${material.fileName || material.title}" downloaded.`);
    } catch (err: unknown) {
      toast.error('Download Failed', err instanceof Error ? err.message : String(err));
    } finally {
      setDownloading(false);
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
    <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm flex flex-col h-[750px] max-h-[85vh]">
      {/* Viewer Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-white border-b border-slate-200 text-slate-900 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <span className="text-xs sm:text-sm font-semibold text-slate-900 truncate max-w-[200px] sm:max-w-md">
            {material.fileName || material.title}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Open direct in new tab */}
          {resolvedUrl && (
            <a
              href={resolvedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium border border-slate-200 transition-colors"
              title="Open in new window"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Open Fullscreen</span>
            </a>
          )}

          {/* Download button */}
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm disabled:opacity-50"
          >
            {downloading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>{downloading ? 'Downloading...' : 'Download'}</span>
          </button>
        </div>
      </div>

      {/* Embedded Viewer Container */}
      <div className="relative flex-1 bg-slate-100 flex items-center justify-center overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 z-10">
            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mb-3" />
            <p className="text-sm font-semibold text-slate-700">Loading PDF document...</p>
            <p className="text-xs text-slate-400 mt-1">Retrieving document from Realtime Database</p>
          </div>
        )}

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
              {resolvedUrl && (
                <a
                  href={resolvedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-xl hover:bg-blue-700 transition-colors"
                >
                  Open in Browser Tab
                </a>
              )}
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                className="px-4 py-2 bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl hover:bg-slate-300 transition-colors disabled:opacity-50"
              >
                {downloading ? 'Downloading...' : 'Download PDF'}
              </button>
            </div>
          </div>
        ) : (
          viewerSrc && (
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
          )
        )}
      </div>

      {/* Viewer Footer Status */}
      <div className="px-4 py-2 bg-white border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-400">
        <span>Verified Academic Document • CSE Semester 5</span>
        <span>Realtime Database Secure Delivery</span>
      </div>
    </div>
  );
};
