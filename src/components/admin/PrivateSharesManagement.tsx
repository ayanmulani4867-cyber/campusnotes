import React, { useState, useEffect } from 'react';
import {
  Share2,
  Trash2,
  Ban,
  Calendar,
  Clock,
  User,
  RefreshCw,
  Search,
  AlertTriangle,
  CheckCircle,
  XCircle,
  FileText,
  Copy,
  Check,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import {
  listPrivateShares,
  revokePrivateShare,
  updateShareExpiration,
  deletePrivateShare,
} from '../../services/privateShareService';
import { useToast } from '../../context/ToastContext';
import { formatFileSize } from '../materials/MaterialCard';
import type { PrivateShareRecord } from '../../types/privateShare';

interface PrivateSharesManagementProps {
  onOpenCreateShare?: () => void;
}

export const PrivateSharesManagement: React.FC<PrivateSharesManagementProps> = ({
  onOpenCreateShare,
}) => {
  const toast = useToast();

  const [shares, setShares] = useState<PrivateShareRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expired' | 'revoked'>('all');

  // Confirmation modals
  const [revokingShare, setRevokingShare] = useState<PrivateShareRecord | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  const [deletingShare, setDeletingShare] = useState<PrivateShareRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [editingExpiryShare, setEditingExpiryShare] = useState<PrivateShareRecord | null>(null);
  const [newExpiryInput, setNewExpiryInput] = useState('');
  const [isUpdatingExpiry, setIsUpdatingExpiry] = useState(false);

  const [copiedShareId, setCopiedShareId] = useState<string | null>(null);

  const loadShares = async () => {
    setLoading(true);
    try {
      const records = await listPrivateShares();
      setShares(records);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Failed to load private shares', msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShares();
  }, []);

  const handleRevokeConfirm = async () => {
    if (!revokingShare) return;
    setIsRevoking(true);
    try {
      const ok = await revokePrivateShare(revokingShare.id);
      if (ok) {
        toast.success(
          'Private Link Revoked',
          `Access through this private link has been revoked immediately.`
        );
        setRevokingShare(null);
        await loadShares();
      } else {
        toast.error('Revocation Error', 'Failed to revoke the sharing link.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Revocation Failed', msg);
    } finally {
      setIsRevoking(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingShare) return;
    setIsDeleting(true);
    try {
      const ok = await deletePrivateShare(deletingShare.id);
      if (ok) {
        toast.success(
          'Sharing Record Removed',
          'The private sharing record was safely removed. The original material remains intact.'
        );
        setDeletingShare(null);
        await loadShares();
      } else {
        toast.error('Delete Error', 'Failed to remove the sharing record.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Deletion Failed', msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUpdateExpirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpiryShare) return;
    setIsUpdatingExpiry(true);
    try {
      const newTimestamp = newExpiryInput ? new Date(newExpiryInput).getTime() : null;
      const ok = await updateShareExpiration(editingExpiryShare.id, newTimestamp);
      if (ok) {
        toast.success(
          'Expiration Updated',
          newTimestamp ? 'Link expiration timestamp has been updated.' : 'Link expiration has been removed.'
        );
        setEditingExpiryShare(null);
        await loadShares();
      } else {
        toast.error('Update Error', 'Failed to update link expiration.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Update Failed', msg);
    } finally {
      setIsUpdatingExpiry(false);
    }
  };

  const filteredShares = shares.filter((share) => {
    if (statusFilter !== 'all' && share.status !== statusFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = (share.materialTitle || '').toLowerCase().includes(q);
      const matchFile = (share.fileName || '').toLowerCase().includes(q);
      const matchRecipient = (share.recipientName || '').toLowerCase().includes(q);
      const matchEmail = (share.recipientEmail || '').toLowerCase().includes(q);
      if (!matchTitle && !matchFile && !matchRecipient && !matchEmail) {
        return false;
      }
    }
    return true;
  });

  const getStatusBadge = (status: PrivateShareRecord['status']) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Active</span>
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span>Expired</span>
          </span>
        );
      case 'revoked':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            <span>Revoked</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
            <Share2 className="w-5 h-5 text-blue-600" />
            <span>Private Sharing Links</span>
          </h3>
          <p className="text-xs text-slate-500">
            Manage, inspect, revoke, and update expiration on {shares.length} private access links.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadShares}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
            title="Refresh private links list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
            <span>Refresh</span>
          </button>

          {onOpenCreateShare && (
            <button
              type="button"
              onClick={onOpenCreateShare}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share Material</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Row */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by material title, filename, or recipient..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium focus:ring-2 focus:ring-blue-600"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="expired">Expired Only</option>
            <option value="revoked">Revoked Only</option>
          </select>
        </div>
      </div>

      {/* Table / List */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-10 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
            <p className="text-xs">Loading private sharing records...</p>
          </div>
        ) : filteredShares.length === 0 ? (
          <div className="p-10 text-center">
            <Share2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <h4 className="text-sm font-semibold text-slate-800">No Private Links Found</h4>
            <p className="text-xs text-slate-500 mt-1">
              {shares.length === 0
                ? 'No materials have been shared privately yet. Click "Share Privately" on any material to create a secure link.'
                : 'No shares match your search or status filter.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                  <th className="py-3 px-3.5">Material & Recipient</th>
                  <th className="py-3 px-3.5">Created</th>
                  <th className="py-3 px-3.5">Expiration</th>
                  <th className="py-3 px-3.5">Status</th>
                  <th className="py-3 px-3.5 text-center">Accesses</th>
                  <th className="py-3 px-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredShares.map((share) => {
                  return (
                    <tr key={share.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3.5 max-w-xs">
                        <p className="font-semibold text-slate-900 text-xs sm:text-sm truncate">
                          {share.materialTitle}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-500">
                          <span className="font-mono">{share.fileName}</span>
                          {share.fileSize > 0 && <span>&bull; {formatFileSize(share.fileSize)}</span>}
                        </div>
                        {(share.recipientName || share.recipientEmail) && (
                          <div className="flex items-center gap-1.5 mt-1 text-[11px] text-blue-600 bg-blue-50/80 px-2 py-0.5 rounded w-fit">
                            <User className="w-3 h-3 text-blue-500 shrink-0" />
                            <span>
                              {share.recipientName || ''}
                              {share.recipientName && share.recipientEmail ? ` (${share.recipientEmail})` : share.recipientEmail || ''}
                            </span>
                          </div>
                        )}
                        {share.instructions && (
                          <p className="text-[11px] text-slate-500 mt-1 line-clamp-1 italic">
                            "{share.instructions}"
                          </p>
                        )}
                      </td>

                      <td className="py-3 px-3.5 text-slate-600 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{new Date(share.createdAt).toLocaleDateString()}</span>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {new Date(share.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>

                      <td className="py-3 px-3.5 text-slate-600 whitespace-nowrap">
                        {share.expiresAt ? (
                          <div>
                            <div className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              <span className={Date.now() > share.expiresAt ? 'text-amber-600 font-semibold' : ''}>
                                {new Date(share.expiresAt).toLocaleDateString()}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400">
                              {new Date(share.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Never</span>
                        )}
                      </td>

                      <td className="py-3 px-3.5 whitespace-nowrap">
                        {getStatusBadge(share.status)}
                      </td>

                      <td className="py-3 px-3.5 text-center text-slate-600 font-semibold">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px]">
                          {share.accessCount || 0}
                        </span>
                      </td>

                      <td className="py-3 px-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Expiration edit button */}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingExpiryShare(share);
                              setNewExpiryInput(
                                share.expiresAt
                                  ? new Date(share.expiresAt).toISOString().slice(0, 16)
                                  : ''
                              );
                            }}
                            className="px-2 py-1 rounded text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
                            title="Update Expiration Date"
                          >
                            <Clock className="w-3 h-3 text-slate-500 inline mr-1" />
                            <span>Expiry</span>
                          </button>

                          {/* Revoke button */}
                          {share.status !== 'revoked' ? (
                            <button
                              type="button"
                              onClick={() => setRevokingShare(share)}
                              className="px-2 py-1 rounded text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-colors"
                              title="Revoke Link Access"
                            >
                              <Ban className="w-3 h-3 text-rose-600 inline mr-1" />
                              <span>Revoke</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-rose-600 font-medium px-2 py-1">
                              Revoked
                            </span>
                          )}

                          {/* Delete record button */}
                          <button
                            type="button"
                            onClick={() => setDeletingShare(share)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Delete Sharing Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

      {/* Revocation Confirmation Dialog */}
      <Modal
        isOpen={Boolean(revokingShare)}
        onClose={() => setRevokingShare(null)}
        title="Revoke Private Link?"
        description="Immediate access termination confirmation."
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">Are you sure you want to revoke this link?</p>
              <p className="text-[11px] leading-relaxed text-rose-800">
                Anyone attempting to access or download "
                <strong>{revokingShare?.materialTitle}</strong>" through this specific link will immediately be rejected with an unavailable notice.
              </p>
              <p className="text-[11px] text-slate-600 font-medium pt-1">
                Note: The original study material will NOT be deleted or modified.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setRevokingShare(null)}
              className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isRevoking}
              onClick={handleRevokeConfirm}
              className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              {isRevoking ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
              <span>Revoke Access Now</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Sharing Record Confirmation Dialog */}
      <Modal
        isOpen={Boolean(deletingShare)}
        onClose={() => setDeletingShare(null)}
        title="Remove Sharing Record?"
        description="Delete private link entry from system registry."
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">Permanently delete this sharing record?</p>
              <p className="text-[11px] leading-relaxed text-amber-800">
                This removes the private share configuration for "
                <strong>{deletingShare?.materialTitle}</strong>". Future requests using this token will be permanently rejected.
              </p>
              <p className="text-[11px] text-slate-600 font-medium pt-1">
                Important: The original study material and its public availability will NOT be deleted or altered.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setDeletingShare(null)}
              className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isDeleting}
              onClick={handleDeleteConfirm}
              className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              {isDeleting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              <span>Delete Sharing Record</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Update Expiration Modal */}
      <Modal
        isOpen={Boolean(editingExpiryShare)}
        onClose={() => setEditingExpiryShare(null)}
        title="Update Link Expiration"
        description={`Configure when the private link for "${editingExpiryShare?.materialTitle}" expires.`}
        maxWidth="sm"
      >
        <form onSubmit={handleUpdateExpirySubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Expiration Date & Time
            </label>
            <input
              type="datetime-local"
              value={newExpiryInput}
              onChange={(e) => setNewExpiryInput(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Leave blank to remove expiration (link stays active until manually revoked).
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setEditingExpiryShare(null)}
              className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUpdatingExpiry}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              {isUpdatingExpiry && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>Save Expiration</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
