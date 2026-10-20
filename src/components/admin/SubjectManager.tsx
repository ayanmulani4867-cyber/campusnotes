import React, { useState } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  BookOpen,
  Sparkles,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Subject } from '../../types';
import {
  saveSubject,
  deleteSubject,
  seedStandardCseSem5Subjects,
} from '../../services/firebaseService';
import { Modal } from '../common/Modal';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { activityLogService } from '../../services/activityLogService';

interface SubjectManagerProps {
  subjects: Subject[];
  onRefresh: () => Promise<void>;
  loading: boolean;
}

export const SubjectManager: React.FC<SubjectManagerProps> = ({
  subjects,
  onRefresh,
  loading,
}) => {
  const toast = useToast();
  const { admin } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    code: '',
    description: '',
    active: true,
  });
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const handleOpenAdd = () => {
    setEditingSubject(null);
    setFormData({
      id: `sub_${Date.now()}`,
      name: '',
      code: '',
      description: '',
      active: true,
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (subject: Subject) => {
    setEditingSubject(subject);
    setFormData({
      id: subject.id,
      name: subject.name,
      code: subject.code,
      description: subject.description || '',
      active: subject.active,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.code.trim()) {
      toast.error('Validation Error', 'Subject Name and Course Code are required.');
      return;
    }

    try {
      setSaving(true);
      await saveSubject(
        {
          id: formData.id,
          name: formData.name.trim(),
          code: formData.code.trim().toUpperCase(),
          description: formData.description.trim(),
          active: formData.active,
        },
        Boolean(editingSubject)
      );

      await activityLogService.logActivity({
        adminEmail: admin?.email,
        adminUid: admin?.uid,
        action: editingSubject ? 'SUBJECT_UPDATE' : 'SUBJECT_CREATE',
        resourceId: formData.id,
        resourceName: `${formData.code.trim().toUpperCase()} - ${formData.name.trim()}`,
        result: 'SUCCESS',
        metadata: {
          code: formData.code.trim().toUpperCase(),
          active: formData.active,
        },
      });

      toast.success(
        editingSubject ? 'Subject Updated' : 'Subject Added',
        `${formData.code} - ${formData.name} saved successfully.`
      );
      setModalOpen(false);
      await onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await activityLogService.logActivity({
        adminEmail: admin?.email,
        adminUid: admin?.uid,
        action: editingSubject ? 'SUBJECT_UPDATE' : 'SUBJECT_CREATE',
        resourceId: formData.id,
        resourceName: `${formData.code.trim().toUpperCase()} - ${formData.name.trim()}`,
        result: 'FAILURE',
        errorMessage: msg,
      });
      if (msg.includes('PERMISSION_DENIED') || msg.includes('Permission denied')) {
        toast.error('Permission Denied', 'Database write was denied. Please ensure database.rules.json is published in Firebase Console -> Realtime Database -> Rules.');
      } else {
        toast.error('Failed to Save Subject', msg);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (subject: Subject) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete subject "${subject.code} - ${subject.name}"?`
    );
    if (!confirmDelete) return;

    try {
      await deleteSubject(subject.id);
      await activityLogService.logActivity({
        adminEmail: admin?.email,
        adminUid: admin?.uid,
        action: 'SUBJECT_DELETE',
        resourceId: subject.id,
        resourceName: `${subject.code} - ${subject.name}`,
        result: 'SUCCESS',
      });
      toast.success('Subject Removed', `${subject.code} has been deleted.`);
      await onRefresh();
    } catch (err: unknown) {
      await activityLogService.logActivity({
        adminEmail: admin?.email,
        adminUid: admin?.uid,
        action: 'SUBJECT_DELETE',
        resourceId: subject.id,
        resourceName: `${subject.code} - ${subject.name}`,
        result: 'FAILURE',
        errorMessage: err instanceof Error ? err.message : String(err),
      });
      toast.error('Cannot Delete Subject', err instanceof Error ? err.message : String(err));
    }
  };

  const handleToggleActive = async (subject: Subject) => {
    try {
      await saveSubject(
        {
          id: subject.id,
          name: subject.name,
          code: subject.code,
          description: subject.description,
          active: !subject.active,
        },
        true
      );
      await activityLogService.logActivity({
        adminEmail: admin?.email,
        adminUid: admin?.uid,
        action: 'SUBJECT_UPDATE',
        resourceId: subject.id,
        resourceName: `${subject.code} - ${subject.name}`,
        result: 'SUCCESS',
        metadata: {
          active: !subject.active,
        },
      });
      toast.info(
        subject.active ? 'Subject Deactivated' : 'Subject Activated',
        `${subject.code} visibility updated.`
      );
      await onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('PERMISSION_DENIED') || msg.includes('Permission denied')) {
        toast.error('Permission Denied', 'Database write was denied. Please ensure database.rules.json is published in Firebase Console -> Realtime Database -> Rules.');
      } else {
        toast.error('Toggle Failed', msg);
      }
    }
  };

  const handleSeedSubjects = async () => {
    const confirmSeed = window.confirm(
      'This will sync the subject catalog with the exact nine official CSE Semester V subjects:\n' +
      '1. Advanced Java Programming (23CS3501)\n' +
      '2. Design Analysis and Algorithms (23CS3502)\n' +
      '3. Advanced Database Engineering (23CS3503)\n' +
      '4. Advanced Java Programming Laboratory (23CS3504)\n' +
      '5. Design Analysis and Algorithms Laboratory (23CS3505)\n' +
      '6. Advanced Database Engineering Laboratory (23CS3506)\n' +
      '7. Program Elective Course-I (23CS3507)\n' +
      '8. Multidisciplinary Minor-III (23CSMDXX)\n' +
      '9. Open Elective III (23OECS31)\n\n' +
      'Any excluded subjects (Aptitude Skills-III, Language Skills-III, Mini Project – III) will be safely removed, while legitimate materials for the nine required subjects are preserved. Proceed?'
    );
    if (!confirmSeed) return;

    try {
      setSeeding(true);
      await seedStandardCseSem5Subjects();
      toast.success(
        'Subjects Synchronized',
        'The nine official CSE Semester V subjects have been synchronized successfully.'
      );
      await onRefresh();
    } catch (err: unknown) {
      toast.error('Sync Failed', err instanceof Error ? err.message : String(err));
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-lg border border-slate-200">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Official CSE Semester V Subjects</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Strictly limited to the 9 curriculum subjects for CSE Semester V.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleSeedSubjects}
            disabled={seeding || loading}
            className="w-full sm:w-auto min-h-[42px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            title="Synchronize database with the exact 9 official subjects"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            <span>{seeding ? 'Syncing...' : 'Sync 9 Official Subjects'}</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="w-full sm:w-auto min-h-[42px] inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Subject</span>
          </button>
        </div>
      </div>

      {/* Subjects Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-600" />
            <p className="text-xs">Loading subjects from Firebase...</p>
          </div>
        ) : subjects.length === 0 ? (
          <div className="p-12 text-center">
            <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h4 className="text-base font-semibold text-slate-800">No Subjects Created Yet</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-5">
              You have not added any subjects for CSE Semester 5 yet. You can add them individually or initialize standard university subjects.
            </p>
            <button
              type="button"
              onClick={handleSeedSubjects}
              disabled={seeding}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              <RefreshCw className="w-4 h-4 text-slate-500" />
              <span>Initialize Official CSE Sem V Subjects</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                  <th className="py-3 px-4">Subject Name & Code</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subjects.map((sub) => (
                  <tr key={sub.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-[11px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {sub.code}
                        </span>
                        <span className="font-medium text-slate-900 text-xs sm:text-sm">{sub.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 max-w-md">
                      <p className="text-slate-500 truncate">{sub.description || '—'}</p>
                    </td>
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(sub)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
                          sub.active
                            ? 'bg-slate-100 text-slate-800 border border-slate-200 hover:bg-slate-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                        }`}
                        title="Click to toggle active status"
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            sub.active ? 'bg-green-500' : 'bg-amber-500'
                          }`}
                        ></span>
                        <span>{sub.active ? 'Active' : 'Hidden'}</span>
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(sub)}
                          className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center p-2 rounded-md text-slate-500 hover:text-blue-600 hover:bg-slate-100 active:bg-slate-200 transition-colors"
                          title="Edit subject"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(sub)}
                          className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center p-2 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 active:bg-rose-100 transition-colors"
                          title="Delete subject"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingSubject ? 'Edit Subject' : 'Add New Subject'}
        description="Subjects define the organization of all study materials for CSE Semester 5."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Course Code *
              </label>
              <input
                type="text"
                required
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="e.g. CS501"
                className="w-full min-h-[42px] text-sm uppercase px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Official Subject Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Computer Networks"
                className="w-full min-h-[42px] text-sm px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Description / Course Scope
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief summary of units, topics, and syllabus focus..."
              className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 placeholder:text-slate-400"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="subject-active"
              checked={formData.active}
              onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
            />
            <label htmlFor="subject-active" className="text-xs font-medium text-slate-700">
              Active (Visible to public students on Semester 5 catalog)
            </label>
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="w-full sm:w-auto min-h-[42px] px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors text-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto min-h-[42px] px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg transition-colors disabled:opacity-50 text-center"
            >
              {saving ? 'Saving...' : editingSubject ? 'Update Subject' : 'Create Subject'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
