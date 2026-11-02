import React, { useState, useEffect, useMemo } from 'react';
import {
  Inbox,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Download,
  Trash2,
  RefreshCw,
  FileText,
  AlertCircle,
  ExternalLink,
  User,
  Building,
  Mail,
  Calendar,
} from 'lucide-react';
import { StudentSubmission, Semester, Subject } from '../../types';
import {
  fetchSubmissionsAdmin,
  approveSubmissionAdmin,
  rejectSubmissionAdmin,
  deleteSubmissionAdmin,
  downloadSubmissionFileAdmin,
  fetchSubmissionFileBlobAdmin,
} from '../../services/contributionService';
import { formatFileSize } from '../materials/MaterialCard';
import { getFileFormatInfo } from '../../utils/fileTypes';
import { useToast } from '../../context/ToastContext';
import { Modal } from '../common/Modal';

interface StudentContributionsSectionProps {
  semesters: Semester[];
  subjects: Subject[];
  onRefreshParent?: () => Promise<void>;
}

export const StudentContributionsSection: React.FC<StudentContributionsSectionProps> = ({
  semesters,
  subjects,
  onRefreshParent,
}) => {
  const toast = useToast();

  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Action States
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionLoadingType, setActionLoadingType] = useState<string | null>(null);

  // Preview Modal
  const [previewSubmission, setPreviewSubmission] = useState<StudentSubmission | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Delete Confirmation Modal
  const [deletingSubmission, setDeletingSubmission] = useState<StudentSubmission | null>(null);

  const loadSubmissions = async () => {
    try {
      setLoading(true);
      const data = await fetchSubmissionsAdmin('all');
      setSubmissions(data);
    } catch (err: unknown) {
      console.warn('Notice loading submissions:', err);
      toast.error('Failed to load contributions', err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubmissions();
  }, []);

  // Compute stats
  const stats = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    for (const sub of submissions) {
      if (sub.status === 'pending') pending++;
      else if (sub.status === 'approved') approved++;
      else if (sub.status === 'rejected') rejected++;
    }
    return {
      total: submissions.length,
      pending,
      approved,
      rejected,
    };
  }, [submissions]);

  // Semester and Subject lookup helpers
  const getSemesterName = (semesterId: string) => {
    const s = semesters.find((sem) => sem.id === semesterId);
    return s ? s.name : semesterId === 'sem_5' ? 'Semester 5' : semesterId;
  };

  const getSubjectName = (subjectId: string) => {
    const sub = subjects.find((s) => s.id === subjectId || s.code === subjectId);
    return sub ? `${sub.code ? sub.code + ' - ' : ''}${sub.name}` : subjectId;
  };

  // Filtered submissions
  const filteredSubmissions = useMemo(() => {
    return submissions.filter((sub) => {
      // 1. Status filter
      if (activeFilter !== 'all' && sub.status !== activeFilter) {
        return false;
      }
      // 2. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const studentMatch = sub.studentName.toLowerCase().includes(q);
        const titleMatch = sub.materialTitle.toLowerCase().includes(q);
        const subjectMatch = getSubjectName(sub.subjectId).toLowerCase().includes(q);
        const fileMatch = sub.originalFilename.toLowerCase().includes(q);
        return studentMatch || titleMatch || subjectMatch || fileMatch;
      }
      return true;
    });
  }, [submissions, activeFilter, searchQuery, semesters, subjects]);

  const handleApprove = async (sub: StudentSubmission) => {
    try {
      setActionLoadingId(sub.submissionId);
      setActionLoadingType('approve');
      const res = await approveSubmissionAdmin(sub.submissionId);
      toast.success(
        'Contribution Approved',
        `"${sub.materialTitle}" has been published to public study materials.`
      );
      // Update local state
      setSubmissions((prev) =>
        prev.map((item) =>
          item.submissionId === sub.submissionId
            ? { ...item, status: 'approved', approvedAt: Date.now(), publishedMaterialId: res.materialId }
            : item
        )
      );
      if (onRefreshParent) {
        await onRefreshParent();
      }
    } catch (err: unknown) {
      toast.error('Approval Failed', err instanceof Error ? err.message : String(err));
    } finally {
      setActionLoadingId(null);
      setActionLoadingType(null);
    }
  };

  const handleReject = async (sub: StudentSubmission) => {
    try {
      setActionLoadingId(sub.submissionId);
      setActionLoadingType('reject');
      await rejectSubmissionAdmin(sub.submissionId);
      toast.success('Contribution Rejected', `"${sub.materialTitle}" has been rejected.`);
      // Update local state
      setSubmissions((prev) =>
        prev.map((item) =>
          item.submissionId === sub.submissionId
            ? { ...item, status: 'rejected', rejectedAt: Date.now() }
            : item
        )
      );
    } catch (err: unknown) {
      toast.error('Rejection Failed', err instanceof Error ? err.message : String(err));
    } finally {
      setActionLoadingId(null);
      setActionLoadingType(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingSubmission) return;
    try {
      setActionLoadingId(deletingSubmission.submissionId);
      setActionLoadingType('delete');
      await deleteSubmissionAdmin(deletingSubmission.submissionId);
      toast.success('Contribution Deleted', 'The submission record and file have been deleted.');
      setSubmissions((prev) => prev.filter((item) => item.submissionId !== deletingSubmission.submissionId));
      setDeletingSubmission(null);
    } catch (err: unknown) {
      toast.error('Deletion Failed', err instanceof Error ? err.message : String(err));
    } finally {
      setActionLoadingId(null);
      setActionLoadingType(null);
    }
  };

  const handleDownload = async (sub: StudentSubmission) => {
    try {
      setActionLoadingId(sub.submissionId);
      setActionLoadingType('download');
      await downloadSubmissionFileAdmin(sub.submissionId, sub.originalFilename);
    } catch (err: unknown) {
      toast.error('Download Failed', err instanceof Error ? err.message : String(err));
    } finally {
      setActionLoadingId(null);
      setActionLoadingType(null);
    }
  };

  const handlePreviewOpen = async (sub: StudentSubmission) => {
    setPreviewSubmission(sub);
    setPreviewLoading(true);
    try {
      const { objectUrl } = await fetchSubmissionFileBlobAdmin(sub.submissionId);
      setPreviewBlobUrl(objectUrl);
    } catch (err: unknown) {
      toast.error('Preview Error', 'Failed to load preview for this file.');
      setPreviewSubmission(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handlePreviewClose = () => {
    if (previewBlobUrl) {
      URL.revokeObjectURL(previewBlobUrl);
      setPreviewBlobUrl(null);
    }
    setPreviewSubmission(null);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Summary Cards */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Inbox className="w-6 h-6 text-blue-600" />
            <span>Student Contributions</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Review, approve, and publish materials submitted by students without requiring accounts.
          </p>
        </div>

        <button
          type="button"
          onClick={loadSubmissions}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 active:bg-slate-100 transition shadow-sm self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* 2. Stats Metric Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => setActiveFilter('pending')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
            activeFilter === 'pending'
              ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-400'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-700">Pending Review</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-amber-900 mt-2">{stats.pending}</p>
        </button>

        <button
          type="button"
          onClick={() => setActiveFilter('approved')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
            activeFilter === 'approved'
              ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-400'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-700">Approved & Published</span>
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-900 mt-2">{stats.approved}</p>
        </button>

        <button
          type="button"
          onClick={() => setActiveFilter('rejected')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
            activeFilter === 'rejected'
              ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-400'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-700">Rejected</span>
            <XCircle className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-2xl font-bold text-rose-900 mt-2">{stats.rejected}</p>
        </button>

        <button
          type="button"
          onClick={() => setActiveFilter('all')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
            activeFilter === 'all'
              ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-400'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">Total Submissions</span>
            <Inbox className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{stats.total}</p>
        </button>
      </div>

      {/* 3. Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by student, title, subject, filename..."
            className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
            >
              Clear
            </button>
          )}
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setActiveFilter(filter)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize whitespace-nowrap transition cursor-pointer ${
                activeFilter === filter
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {filter}
              {filter === 'pending' && stats.pending > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] bg-amber-400 text-amber-950 font-bold">
                  {stats.pending}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Submissions Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
            <p className="text-xs font-semibold">Loading student contributions...</p>
          </div>
        ) : filteredSubmissions.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Inbox className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-semibold text-slate-700">No contributions found</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {searchQuery
                ? 'Try a different search query or clear the filter.'
                : activeFilter === 'pending'
                ? 'No pending contributions awaiting review.'
                : 'No contributions recorded in this category.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Material Details</th>
                  <th className="py-3 px-4">Subject & Semester</th>
                  <th className="py-3 px-4">File Info</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredSubmissions.map((sub) => {
                  const formatInfo = getFileFormatInfo(sub.originalFilename);
                  const isActionBusy = actionLoadingId === sub.submissionId;

                  return (
                    <tr
                      key={sub.submissionId}
                      className="hover:bg-slate-50/60 transition-colors"
                    >
                      {/* Student info */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{sub.studentName}</div>
                        {sub.college && (
                          <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <Building className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[140px]">{sub.college}</span>
                          </div>
                        )}
                        {sub.email && (
                          <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[140px]">{sub.email}</span>
                          </div>
                        )}
                      </td>

                      {/* Material Title & Category */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-semibold text-slate-900 line-clamp-1">
                          {sub.materialTitle}
                        </div>
                        {sub.description && (
                          <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                            {sub.description}
                          </div>
                        )}
                        <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-semibold rounded bg-slate-100 text-slate-600 capitalize">
                          {sub.category}
                        </span>
                      </td>

                      {/* Subject & Semester */}
                      <td className="py-3.5 px-4 max-w-[180px]">
                        <div className="font-medium text-slate-800 line-clamp-1">
                          {getSubjectName(sub.subjectId)}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {getSemesterName(sub.semesterId)}
                        </div>
                      </td>

                      {/* File format & size */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-medium text-slate-800 flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded">
                            {formatInfo.extension.toUpperCase()}
                          </span>
                          <span>{formatFileSize(sub.fileSize)}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[140px] mt-0.5">
                          {sub.originalFilename}
                        </div>
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-500">
                        {new Date(sub.submittedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                        <div className="text-[11px] text-slate-400">
                          {new Date(sub.submittedAt).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {sub.status === 'pending' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3" />
                            <span>Pending</span>
                          </span>
                        )}
                        {sub.status === 'approved' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle className="w-3 h-3" />
                            <span>Approved</span>
                          </span>
                        )}
                        {sub.status === 'rejected' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            <XCircle className="w-3 h-3" />
                            <span>Rejected</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          {/* Preview Button */}
                          <button
                            type="button"
                            title="Preview file"
                            onClick={() => handlePreviewOpen(sub)}
                            disabled={isActionBusy}
                            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Download Button */}
                          <button
                            type="button"
                            title="Download file"
                            onClick={() => handleDownload(sub)}
                            disabled={isActionBusy}
                            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                          >
                            <Download className="w-4 h-4" />
                          </button>

                          {/* Approve Button */}
                          {sub.status !== 'approved' && (
                            <button
                              type="button"
                              title="Approve and Publish"
                              onClick={() => handleApprove(sub)}
                              disabled={isActionBusy}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] rounded-lg transition shadow-sm cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"
                            >
                              {isActionBusy && actionLoadingType === 'approve' ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <CheckCircle className="w-3 h-3" />
                              )}
                              <span>Approve</span>
                            </button>
                          )}

                          {/* Reject Button */}
                          {sub.status === 'pending' && (
                            <button
                              type="button"
                              title="Reject submission"
                              onClick={() => handleReject(sub)}
                              disabled={isActionBusy}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 font-semibold text-[11px] rounded-lg border border-slate-200 transition cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"
                            >
                              {isActionBusy && actionLoadingType === 'reject' ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <XCircle className="w-3 h-3" />
                              )}
                              <span>Reject</span>
                            </button>
                          )}

                          {/* Delete Button */}
                          <button
                            type="button"
                            title="Delete submission"
                            onClick={() => setDeletingSubmission(sub)}
                            disabled={isActionBusy}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. Preview Modal */}
      {previewSubmission && (
        <Modal
          isOpen={Boolean(previewSubmission)}
          onClose={handlePreviewClose}
          title={`Preview: ${previewSubmission.materialTitle}`}
          maxWidth="4xl"
        >
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-semibold text-slate-900">{previewSubmission.studentName}</span>
                <span className="text-slate-500"> &bull; {previewSubmission.originalFilename}</span>
                <span className="text-slate-500"> ({formatFileSize(previewSubmission.fileSize)})</span>
              </div>
              <button
                type="button"
                onClick={() => handleDownload(previewSubmission)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Original</span>
              </button>
            </div>

            {previewLoading ? (
              <div className="p-16 text-center text-slate-500">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-600" />
                <p className="text-xs font-semibold">Loading document preview...</p>
              </div>
            ) : previewBlobUrl ? (
              <div className="w-full h-[65vh] rounded-lg border border-slate-200 overflow-hidden bg-slate-100 flex items-center justify-center">
                {previewSubmission.originalFilename.toLowerCase().endsWith('.pdf') ? (
                  <iframe
                    src={previewBlobUrl}
                    title="Document Preview"
                    className="w-full h-full border-none"
                  />
                ) : previewSubmission.mimeType.startsWith('image/') ? (
                  <img
                    src={previewBlobUrl}
                    alt={previewSubmission.materialTitle}
                    className="max-w-full max-h-full object-contain p-2"
                  />
                ) : (
                  <div className="text-center p-8">
                    <FileText className="w-12 h-12 mx-auto text-slate-400 mb-2" />
                    <p className="text-sm font-semibold text-slate-800">Preview not available for this format</p>
                    <p className="text-xs text-slate-500 mt-1 mb-4">
                      Direct preview in browser is supported for PDF and image files. Download the file to view its full content.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleDownload(previewSubmission)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg transition"
                    >
                      Download File
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center text-rose-600 text-xs font-semibold">
                Failed to load document content.
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* 6. Delete Confirmation Modal */}
      {deletingSubmission && (
        <Modal
          isOpen={Boolean(deletingSubmission)}
          onClose={() => setDeletingSubmission(null)}
          title="Delete Student Contribution"
          maxWidth="md"
        >
          <div className="space-y-4">
            <p className="text-xs sm:text-sm text-slate-600">
              Are you sure you want to delete the submission{' '}
              <strong className="text-slate-900">"{deletingSubmission.materialTitle}"</strong> by{' '}
              <strong className="text-slate-900">{deletingSubmission.studentName}</strong>?
            </p>
            <p className="text-[11px] text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-100">
              This will permanently delete the uploaded file from pending storage. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingSubmission(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition shadow-sm"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
