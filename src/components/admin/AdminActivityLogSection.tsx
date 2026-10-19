import React, { useState, useEffect, useMemo } from 'react';
import {
  History,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Upload,
  FileText,
  Trash2,
  Wrench,
  Key,
  BookOpen,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  Info,
  Layers,
} from 'lucide-react';
import { AdminActivityRecord, AdminActionType } from '../../types';
import { activityLogService } from '../../services/activityLogService';
import { useToast } from '../../context/ToastContext';
import { formatFileSize } from '../materials/MaterialCard';

export const AdminActivityLogSection: React.FC = () => {
  const toast = useToast();
  const [logs, setLogs] = useState<AdminActivityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [resultFilter, setResultFilter] = useState<string>('all');
  const [selectedRecord, setSelectedRecord] = useState<AdminActivityRecord | null>(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const data = await activityLogService.getActivityLogs();
      setLogs(data);
    } catch (err: unknown) {
      toast.error('Log Load Error', err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();

    const handleLogged = () => {
      fetchLogs();
    };

    window.addEventListener('campusnotes:activity_logged', handleLogged);
    return () => {
      window.removeEventListener('campusnotes:activity_logged', handleLogged);
    };
  }, []);

  const filteredLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return logs.filter((item) => {
      // Action filter
      if (actionFilter !== 'all') {
        if (actionFilter === 'materials' && !item.action.startsWith('MATERIAL_')) return false;
        if (actionFilter === 'pdf' && item.action !== 'PDF_REPLACE') return false;
        if (actionFilter === 'maintenance' && item.action !== 'MAINTENANCE_TOGGLE') return false;
        if (actionFilter === 'password' && item.action !== 'ADMIN_PASSWORD_CHANGE') return false;
        if (actionFilter === 'subjects' && !item.action.startsWith('SUBJECT_')) return false;
      }

      // Result filter
      if (resultFilter === 'success' && item.result !== 'SUCCESS') return false;
      if (resultFilter === 'failure' && item.result !== 'FAILURE') return false;

      // Search query
      if (q) {
        const matchResId = (item.resourceId || '').toLowerCase().includes(q);
        const matchName = (item.resourceName || '').toLowerCase().includes(q);
        const matchEmail = (item.adminEmail || '').toLowerCase().includes(q);
        const matchAction = item.action.toLowerCase().includes(q);
        const matchError = (item.errorMessage || '').toLowerCase().includes(q);
        if (!matchResId && !matchName && !matchEmail && !matchAction && !matchError) {
          return false;
        }
      }

      return true;
    });
  }, [logs, searchQuery, actionFilter, resultFilter]);

  const stats = useMemo(() => {
    const total = logs.length;
    const successes = logs.filter((l) => l.result === 'SUCCESS').length;
    const failures = logs.filter((l) => l.result === 'FAILURE').length;
    return { total, successes, failures };
  }, [logs]);

  const getActionBadge = (action: AdminActionType) => {
    switch (action) {
      case 'MATERIAL_UPLOAD':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Upload className="w-3 h-3 text-emerald-600" />
            Upload
          </span>
        );
      case 'MATERIAL_PUBLISH_TOGGLE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <FileText className="w-3 h-3 text-blue-600" />
            Publish Status
          </span>
        );
      case 'MATERIAL_UPDATE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">
            <FileText className="w-3 h-3 text-sky-600" />
            Material Edit
          </span>
        );
      case 'PDF_REPLACE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <Layers className="w-3 h-3 text-amber-600" />
            PDF Replace
          </span>
        );
      case 'MATERIAL_DELETE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <Trash2 className="w-3 h-3 text-rose-600" />
            Deletion
          </span>
        );
      case 'MAINTENANCE_TOGGLE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-50 text-orange-800 border border-orange-200">
            <Wrench className="w-3 h-3 text-orange-600" />
            Maintenance
          </span>
        );
      case 'ADMIN_PASSWORD_CHANGE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            <Key className="w-3 h-3 text-purple-600" />
            Admin Password
          </span>
        );
      case 'SUBJECT_CREATE':
      case 'SUBJECT_UPDATE':
      case 'SUBJECT_DELETE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <BookOpen className="w-3 h-3 text-indigo-600" />
            {action.replace('SUBJECT_', 'Subject ')}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
            {action}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">Admin Activity Log</h2>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              <ShieldCheck className="w-3 h-3 text-blue-600" />
              Auditable Log
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable tracking of uploads, publications, replacements, deletions, and maintenance changes
          </p>
        </div>

        <button
          type="button"
          onClick={fetchLogs}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Logs</span>
        </button>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500">Total Recorded Actions</span>
            <div className="text-2xl font-bold text-slate-900 font-mono mt-1">{stats.total}</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <History className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500">Successful Operations</span>
            <div className="text-2xl font-bold text-emerald-600 font-mono mt-1">{stats.successes}</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500">Operation Failures</span>
            <div className="text-2xl font-bold text-rose-600 font-mono mt-1">{stats.failures}</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
            <XCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by resource ID, material name, or admin email..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Action Filter */}
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            aria-label="Filter activity logs by action type"
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">All Actions</option>
            <option value="materials">Materials (Upload/Edit/Publish/Delete)</option>
            <option value="pdf">PDF Replacements</option>
            <option value="maintenance">Maintenance Mode</option>
            <option value="password">Password Changes</option>
            <option value="subjects">Subjects</option>
          </select>

          {/* Result Filter */}
          <select
            value={resultFilter}
            onChange={(e) => setResultFilter(e.target.value)}
            aria-label="Filter activity logs by operation result"
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">All Results</option>
            <option value="success">Success Only</option>
            <option value="failure">Failure Only</option>
          </select>
        </div>
      </div>

      {/* Activity Log Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
                <th className="py-2.5 px-4">Timestamp</th>
                <th className="py-2.5 px-4">Administrator</th>
                <th className="py-2.5 px-4">Action</th>
                <th className="py-2.5 px-4">Target Resource</th>
                <th className="py-2.5 px-4">Result</th>
                <th className="py-2.5 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    {loading
                      ? 'Loading activity log records...'
                      : searchQuery || actionFilter !== 'all' || resultFilter !== 'all'
                      ? 'No activity logs matching current filters.'
                      : 'No administrative actions recorded yet. (Actions will appear here as you upload, edit, or configure materials).'}
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const date = new Date(log.timestamp);
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Timestamp */}
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <div className="font-mono text-slate-800 text-[11px]">
                          {date.toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                      </td>

                      {/* Administrator */}
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <span
                          className="font-mono text-slate-700 font-medium text-[11px]"
                          title={log.adminEmail}
                        >
                          {log.adminEmail}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-2.5 px-4 whitespace-nowrap">{getActionBadge(log.action)}</td>

                      {/* Target Resource */}
                      <td className="py-2.5 px-4">
                        <div className="font-medium text-slate-900 truncate max-w-[200px]" title={log.resourceName || log.resourceId}>
                          {log.resourceName || log.resourceId}
                        </div>
                        <div className="font-mono text-[10px] text-slate-400 truncate max-w-[180px]">
                          {log.resourceId}
                        </div>
                      </td>

                      {/* Result */}
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        {log.result === 'SUCCESS' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Success
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 text-rose-700 font-semibold text-[11px]"
                            title={log.errorMessage || 'Operation failed'}
                          >
                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                            Failed
                          </span>
                        )}
                      </td>

                      {/* Details Button */}
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedRecord(log)}
                          className="p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="View metadata and execution details"
                        >
                          <Info className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-lg w-full p-5 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">Activity Record Details</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Record ID:</span>
                <span className="font-mono text-slate-800">{selectedRecord.id}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Timestamp:</span>
                <span className="font-mono text-slate-800">
                  {new Date(selectedRecord.timestamp).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Administrator:</span>
                <span className="font-mono text-slate-800">{selectedRecord.adminEmail}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Action:</span>
                <div>{getActionBadge(selectedRecord.action)}</div>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Resource ID:</span>
                <span className="font-mono text-slate-800">{selectedRecord.resourceId}</span>
              </div>
              {selectedRecord.resourceName && (
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">Resource Name:</span>
                  <span className="font-medium text-slate-800 text-right max-w-[250px]">
                    {selectedRecord.resourceName}
                  </span>
                </div>
              )}
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Result:</span>
                <span
                  className={`font-semibold ${
                    selectedRecord.result === 'SUCCESS' ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {selectedRecord.result}
                </span>
              </div>
              {selectedRecord.errorMessage && (
                <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-800 text-[11px]">
                  <span className="font-bold">Error Message: </span>
                  {selectedRecord.errorMessage}
                </div>
              )}

              {/* Metadata JSON breakdown */}
              {selectedRecord.metadata && Object.keys(selectedRecord.metadata).length > 0 && (
                <div className="pt-2">
                  <span className="text-slate-500 font-semibold block mb-1">Operation Metadata:</span>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 font-mono text-[11px] text-slate-700 space-y-1">
                    {Object.entries(selectedRecord.metadata).map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <span className="text-slate-500">{k}:</span>
                        <span className="font-semibold text-slate-800">
                          {k.toLowerCase().includes('size') && typeof v === 'number'
                            ? formatFileSize(v)
                            : String(v)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Security notice */}
      <div className="p-3.5 bg-slate-100 border border-slate-200 rounded-lg flex items-start gap-3 text-xs text-slate-600">
        <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-slate-800">Integrity & Audit Standard: </span>
          Activity logs record administrative operations in real time. Historical records are never invented. Passwords, auth tokens, and raw PDF contents are strictly excluded from logging.
        </div>
      </div>
    </div>
  );
};
