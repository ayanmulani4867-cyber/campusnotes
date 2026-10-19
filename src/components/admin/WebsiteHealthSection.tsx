import React, { useState, useEffect } from 'react';
import {
  HeartPulse,
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Database,
  FileCheck,
  AlertCircle,
  Wifi,
  WifiOff,
  ShieldCheck,
  Clock,
  Trash2,
  Wrench,
  Download,
  Upload,
} from 'lucide-react';
import { WebsiteHealthStatus } from '../../types';
import { healthMonitorService } from '../../services/healthMonitorService';
import { useToast } from '../../context/ToastContext';
import { R2_WORKER_URL } from '../../config/firebase';

export const WebsiteHealthSection: React.FC = () => {
  const toast = useToast();
  const [health, setHealth] = useState<WebsiteHealthStatus | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [timeAgo, setTimeAgo] = useState('Just now');

  const executeHealthCheck = async (showToast = false) => {
    try {
      setIsChecking(true);
      const res = await healthMonitorService.runHealthCheck();
      setHealth(res);
      if (showToast) {
        toast.success(
          'Health Check Complete',
          `Availability: ${res.availability} • RTDB Latency: ${res.rtdbLatencyMs ? res.rtdbLatencyMs + 'ms' : 'N/A'}`
        );
      }
    } catch (err: unknown) {
      if (showToast) {
        toast.error('Health Check Failed', err instanceof Error ? err.message : String(err));
      }
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    executeHealthCheck();

    // Auto health check every 45 seconds while viewing this tab
    const interval = setInterval(() => {
      executeHealthCheck(false);
    }, 45000);

    return () => clearInterval(interval);
  }, []);

  // Compute relative time string
  useEffect(() => {
    if (!health?.lastCheckTimestamp) return;

    const updateTimer = () => {
      const diffSec = Math.round((Date.now() - health.lastCheckTimestamp) / 1000);
      if (diffSec < 5) {
        setTimeAgo('Just now');
      } else if (diffSec < 60) {
        setTimeAgo(`${diffSec} seconds ago`);
      } else {
        const mins = Math.floor(diffSec / 60);
        setTimeAgo(`${mins} minute${mins > 1 ? 's' : ''} ago`);
      }
    };

    updateTimer();
    const timer = setInterval(updateTimer, 5000);
    return () => clearInterval(timer);
  }, [health?.lastCheckTimestamp]);

  const handleClearErrors = () => {
    healthMonitorService.clearErrors();
    toast.success('Errors Cleared', 'Application runtime error log has been reset.');
    executeHealthCheck(false);
  };

  if (!health) {
    return (
      <div className="p-8 text-center">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-2" />
        <p className="text-xs text-slate-500">Checking system health and Firebase connectivity...</p>
      </div>
    );
  }

  const pdfTotalOps =
    health.pdfHealth.totalUploadAttempts + health.pdfHealth.totalDownloadAttempts;
  const pdfTotalSuccesses =
    health.pdfHealth.uploadSuccesses + health.pdfHealth.downloadSuccesses;
  const pdfSuccessRate =
    pdfTotalOps > 0 ? Math.round((pdfTotalSuccesses / pdfTotalOps) * 100) : 100;

  const getAvailabilityBanner = () => {
    switch (health.availability) {
      case 'OPERATIONAL':
        return {
          bgColor: 'bg-emerald-50 border-emerald-200 text-emerald-900',
          iconColor: 'text-emerald-600',
          icon: CheckCircle2,
          title: 'All Systems Operational',
          subtitle: 'Website, Firebase Realtime Database, and PDF blob pipelines are running normally.',
        };
      case 'MAINTENANCE':
        return {
          bgColor: 'bg-amber-50 border-amber-200 text-amber-900',
          iconColor: 'text-amber-600',
          icon: Wrench,
          title: 'Maintenance Mode Active',
          subtitle: 'Public student access is currently paused. Administrators maintain full system control.',
        };
      case 'DEGRADED':
        return {
          bgColor: 'bg-yellow-50 border-yellow-200 text-yellow-900',
          iconColor: 'text-yellow-600',
          icon: AlertTriangle,
          title: 'Degraded Performance Detected',
          subtitle: 'Elevated Realtime Database latency or transient connectivity issues detected.',
        };
      case 'OFFLINE':
      default:
        return {
          bgColor: 'bg-rose-50 border-rose-200 text-rose-900',
          iconColor: 'text-rose-600',
          icon: XCircle,
          title: 'System Offline',
          subtitle: 'Browser network connection appears to be disconnected or unreachable.',
        };
    }
  };

  const banner = getAvailabilityBanner();
  const BannerIcon = banner.icon;

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">Website Health Monitor</h2>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              <HeartPulse className="w-3.5 h-3.5 text-blue-600" />
              Live Diagnostic
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Lightweight health checks, Firebase connection latency, application errors, and PDF failure detection
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-[11px] text-slate-500 flex items-center gap-1 font-mono">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Checked: {timeAgo}</span>
          </div>

          <button
            type="button"
            onClick={() => executeHealthCheck(true)}
            disabled={isChecking}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
            <span>Run Health Check</span>
          </button>
        </div>
      </div>

      {/* Availability Status Banner */}
      <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${banner.bgColor}`}>
        <div className="flex items-start sm:items-center gap-3">
          <BannerIcon className={`w-6 h-6 ${banner.iconColor} shrink-0`} />
          <div>
            <h3 className="text-sm font-bold leading-tight">{banner.title}</h3>
            <p className="text-xs opacity-90 mt-0.5">{banner.subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono self-end sm:self-auto">
          {health.rtdbLatencyMs !== null && (
            <span className="px-2.5 py-1 rounded bg-white/70 border border-current font-bold">
              Latency: {health.rtdbLatencyMs} ms
            </span>
          )}
          <span className="px-2.5 py-1 rounded bg-white/70 border border-current font-bold">
            Status: {health.availability}
          </span>
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Firebase Realtime Database */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Firebase Connectivity</span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${health.firebaseConnected ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
              <Database className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${health.firebaseConnected ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              <span className="text-base font-bold text-slate-900">
                {health.firebaseConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1 font-mono">
              RTDB WebSocket: {health.rtdbLatencyMs ? `${health.rtdbLatencyMs}ms ping` : 'N/A'}
            </p>
          </div>
        </div>

        {/* Website Availability & Browser Online */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Network Availability</span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${health.isOnline ? 'bg-blue-50 text-blue-600' : 'bg-rose-50 text-rose-600'}`}>
              {health.isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${health.isOnline ? 'bg-blue-500' : 'bg-rose-500'}`} />
              <span className="text-base font-bold text-slate-900">
                {health.isOnline ? 'Online (Public)' : 'Offline'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Maintenance mode: <span className="font-semibold">{health.maintenanceMode ? 'Active' : 'Off'}</span>
            </p>
          </div>
        </div>

        {/* Application Errors */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Application Errors</span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${health.totalErrorsLogged === 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-slate-900">
              {health.totalErrorsLogged}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {health.totalErrorsLogged === 0 ? (
                <span className="text-emerald-600 font-medium">Clean execution</span>
              ) : (
                <span>Runtime / Promise rejections</span>
              )}
            </p>
          </div>
        </div>

        {/* PDF Service Health */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">PDF Pipeline Health</span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${pdfSuccessRate >= 95 ? 'bg-indigo-50 text-indigo-600' : 'bg-rose-50 text-rose-600'}`}>
              <FileCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-slate-900">
              {pdfSuccessRate}%
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {health.pdfHealth.recentFailures.length === 0 ? (
                <span className="text-emerald-600 font-medium">0 failures detected</span>
              ) : (
                <span className="text-rose-600 font-medium">{health.pdfHealth.recentFailures.length} failure(s) recorded</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* PDF Storage & Operation Diagnostics */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <FileCheck className="w-4 h-4 text-blue-600" />
              PDF Upload & Download Diagnostics
            </h3>
            <p className="text-xs text-slate-500">
              Monitors Realtime Database binary blob transfers, magic signature checks, and size thresholds
            </p>
          </div>
          <span className="text-xs font-mono font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
            Success Rate: {pdfSuccessRate}%
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 mb-4">
          {/* Uploads card */}
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                <Upload className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-800">Upload Operations</span>
                <p className="text-[11px] text-slate-500">
                  {health.pdfHealth.uploadSuccesses} succeeded • {health.pdfHealth.uploadFailures} failed
                </p>
              </div>
            </div>
            <span className="text-sm font-bold font-mono text-slate-900">
              {health.pdfHealth.totalUploadAttempts} total
            </span>
          </div>

          {/* Downloads card */}
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                <Download className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-800">Download Operations</span>
                <p className="text-[11px] text-slate-500">
                  {health.pdfHealth.downloadSuccesses} succeeded • {health.pdfHealth.downloadFailures} failed
                </p>
              </div>
            </div>
            <span className="text-sm font-bold font-mono text-slate-900">
              {health.pdfHealth.totalDownloadAttempts} total
            </span>
          </div>
        </div>

        {/* Recent PDF Failures Log */}
        {health.pdfHealth.recentFailures.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <h4 className="text-xs font-bold text-rose-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              Detected PDF Failures ({health.pdfHealth.recentFailures.length})
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-200">
                    <th className="py-1.5 px-3">Type</th>
                    <th className="py-1.5 px-3">File / Resource</th>
                    <th className="py-1.5 px-3">Detected Error</th>
                    <th className="py-1.5 px-3 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {health.pdfHealth.recentFailures.map((fail) => (
                    <tr key={fail.id} className="text-slate-700">
                      <td className="py-1.5 px-3 font-semibold text-rose-600">{fail.type}</td>
                      <td className="py-1.5 px-3">{fail.fileName || fail.materialId || 'N/A'}</td>
                      <td className="py-1.5 px-3 text-rose-700 truncate max-w-[280px]" title={fail.error}>
                        {fail.error}
                      </td>
                      <td className="py-1.5 px-3 text-right text-slate-400">
                        {new Date(fail.timestamp).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Application Errors Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              Application Error Log
            </h3>
            <p className="text-xs text-slate-500">
              Captured unhandled runtime errors, network promise rejections, and Firebase access notices
            </p>
          </div>

          {health.recentErrors.length > 0 && (
            <button
              type="button"
              onClick={handleClearErrors}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition-colors border border-slate-200"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Errors</span>
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
                <th className="py-2.5 px-4">Error Type</th>
                <th className="py-2.5 px-4">Error Message</th>
                <th className="py-2.5 px-4">Source</th>
                <th className="py-2.5 px-4 text-center">Occurrences</th>
                <th className="py-2.5 px-4 text-right">Last Seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {health.recentErrors.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 font-sans text-xs">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
                    Zero errors detected. All application modules operating normally.
                  </td>
                </tr>
              ) : (
                health.recentErrors.map((err) => (
                  <tr key={err.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2 px-4 whitespace-nowrap">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        {err.type}
                      </span>
                    </td>
                    <td className="py-2 px-4 font-sans text-slate-800 max-w-sm truncate" title={err.message}>
                      {err.message}
                    </td>
                    <td className="py-2 px-4 text-slate-500 truncate max-w-[150px]" title={err.source || 'inline'}>
                      {err.source ? err.source.split('/').pop() : 'script'}
                    </td>
                    <td className="py-2 px-4 text-center font-bold text-slate-800">{err.count}</td>
                    <td className="py-2 px-4 text-right text-slate-500 whitespace-nowrap">
                      {new Date(err.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Diagnostics Specifications */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
          Architecture & Configuration Details
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
            <span className="text-slate-500 block text-[11px]">Firebase Project ID</span>
            <span className="font-mono font-semibold text-slate-900">campusnotes-e62cf</span>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
            <span className="text-slate-500 block text-[11px]">Storage Engine</span>
            <span className="font-mono font-semibold text-slate-900">
              {R2_WORKER_URL ? 'Cloudflare R2 + RTDB Hybrid' : 'Realtime Database (/file_blobs)'}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
            <span className="text-slate-500 block text-[11px]">Max PDF Size Standard</span>
            <span className="font-mono font-semibold text-slate-900">
              {R2_WORKER_URL ? '50 MB (Cloudflare R2)' : '6.0 MB Raw Binary (~8 MB Base64)'}
            </span>
          </div>
        </div>
      </div>

      {/* Lightweight Monitoring Notice */}
      <div className="p-3.5 bg-slate-100 border border-slate-200 rounded-lg flex items-start gap-3 text-xs text-slate-600">
        <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-slate-800">Lightweight Monitoring: </span>
          Health checks use minimal WebSocket pings and passive error listeners. No expensive or repeated PDF downloads are performed. No paid third-party monitoring services are used.
        </div>
      </div>
    </div>
  );
};
