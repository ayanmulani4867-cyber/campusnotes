import React, { useState, useMemo } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  BookOpen,
  RefreshCw,
  Layers,
  Search,
  ArrowRight,
  FileText,
} from 'lucide-react';
import { Subject, Semester, StudyMaterial } from '../../types';
import {
  saveSubject,
  deleteSubject,
  saveSemester,
  deleteSemester,
  seedStandardCseSem5Subjects,
  DEFAULT_SEMESTER_5,
} from '../../services/firebaseService';
import { Modal } from '../common/Modal';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { activityLogService } from '../../services/activityLogService';

interface SubjectManagerProps {
  subjects: Subject[];
  semesters?: Semester[];
  materials?: StudyMaterial[];
  onRefresh: () => Promise<void>;
  loading: boolean;
  activeSection?: 'semesters' | 'subjects' | 'both';
  onNavigateToMaterials?: (subjectId: string) => void;
  onNavigateToSubjects?: (semesterId: string) => void;
  initialSemesterId?: string;
}

export const SubjectManager: React.FC<SubjectManagerProps> = ({
  subjects,
  semesters = [DEFAULT_SEMESTER_5],
  materials = [],
  onRefresh,
  loading,
  activeSection = 'both',
  onNavigateToMaterials,
  onNavigateToSubjects,
  initialSemesterId,
}) => {
  const toast = useToast();
  const { admin } = useAuth();

  // Active semester filter ('all' or semester id like 'sem_5')
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>(
    initialSemesterId || 'all'
  );

  // Search filters
  const [semesterSearchQuery, setSemesterSearchQuery] = useState('');
  const [subjectSearchQuery, setSubjectSearchQuery] = useState('');

  // Semester Modal State
  const [semesterModalOpen, setSemesterModalOpen] = useState(false);
  const [editingSemester, setEditingSemester] = useState<Semester | null>(null);
  const [semesterFormData, setSemesterFormData] = useState({
    id: '',
    number: '1',
    name: '',
    description: '',
    active: true,
  });
  const [savingSemester, setSavingSemester] = useState(false);

  // Subject Modal State
  const [subjectModalOpen, setSubjectModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [subjectFormData, setSubjectFormData] = useState({
    id: '',
    name: '',
    code: '',
    semesterId: 'sem_5',
    description: '',
    active: true,
  });
  const [savingSubject, setSavingSubject] = useState(false);
  const [seeding, setSeeding] = useState(false);

  // Fallback to active semester list
  const activeSemestersList = useMemo(() => {
    return semesters && semesters.length > 0 ? semesters : [DEFAULT_SEMESTER_5];
  }, [semesters]);

  // Compute subject counts per semester
  const subjectCountsBySemester = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const sub of subjects) {
      const sId = sub.semesterId || 'sem_5';
      counts[sId] = (counts[sId] || 0) + 1;
    }
    return counts;
  }, [subjects]);

  // Compute materials count per subject
  const materialCountsBySubject = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const mat of materials) {
      counts[mat.subjectId] = (counts[mat.subjectId] || 0) + 1;
    }
    return counts;
  }, [materials]);

  // Filtered semesters based on search query
  const filteredSemesters = useMemo(() => {
    const q = semesterSearchQuery.trim().toLowerCase();
    if (!q) return activeSemestersList;
    return activeSemestersList.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        String(s.number).includes(q) ||
        (s.description || '').toLowerCase().includes(q)
    );
  }, [activeSemestersList, semesterSearchQuery]);

  // Filtered subjects based on selected semester and search query
  const filteredSubjects = useMemo(() => {
    let list = subjects;
    if (selectedSemesterId !== 'all') {
      list = list.filter((s) => (s.semesterId || 'sem_5') === selectedSemesterId);
    }
    const q = subjectSearchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.code.toLowerCase().includes(q) ||
          (s.description || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [subjects, selectedSemesterId, subjectSearchQuery]);

  // ----------------------------------------------------
  // SEMESTER HANDLERS
  // ----------------------------------------------------

  const handleOpenAddSemester = () => {
    setEditingSemester(null);
    // Suggest the next highest semester number
    const maxNumber = activeSemestersList.reduce((max, s) => Math.max(max, s.number || 0), 0);
    const nextNumber = maxNumber > 0 ? maxNumber + 1 : 1;

    setSemesterFormData({
      id: `sem_${nextNumber}`,
      number: String(nextNumber),
      name: `Semester ${nextNumber}`,
      description: '',
      active: true,
    });
    setSemesterModalOpen(true);
  };

  const handleOpenEditSemester = (sem: Semester) => {
    setEditingSemester(sem);
    setSemesterFormData({
      id: sem.id,
      number: String(sem.number),
      name: sem.name,
      description: sem.description || '',
      active: sem.active !== false,
    });
    setSemesterModalOpen(true);
  };

  const handleSemesterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const semNum = Math.floor(Number(semesterFormData.number));
    if (isNaN(semNum) || semNum <= 0) {
      toast.error('Validation Error', 'Semester number must be a valid positive integer.');
      return;
    }
    if (!semesterFormData.name.trim()) {
      toast.error('Validation Error', 'Semester display name is required.');
      return;
    }

    // Check duplicate semester numbers
    const duplicate = activeSemestersList.find(
      (s) => s.number === semNum && s.id !== semesterFormData.id
    );
    if (duplicate) {
      toast.error(
        'Duplicate Semester',
        `Semester ${semNum} already exists with name "${duplicate.name}".`
      );
      return;
    }

    try {
      setSavingSemester(true);
      const result = await saveSemester(
        {
          id: semesterFormData.id || `sem_${semNum}`,
          number: semNum,
          name: semesterFormData.name.trim(),
          description: semesterFormData.description.trim(),
          active: semesterFormData.active,
        },
        Boolean(editingSemester)
      );

      await activityLogService.logActivity({
        adminEmail: admin?.email,
        adminUid: admin?.uid,
        action: editingSemester ? 'SEMESTER_UPDATE' : 'SEMESTER_CREATE',
        resourceId: semesterFormData.id,
        resourceName: semesterFormData.name.trim(),
        result: 'SUCCESS',
        metadata: {
          number: semNum,
          active: semesterFormData.active,
          cloudSynced: result?.cloudSynced,
        },
      });

      if (result && !result.cloudSynced) {
        toast.warning(
          editingSemester ? 'Semester Updated (Local)' : 'Semester Created (Local)',
          `"${semesterFormData.name}" saved locally. To enable multi-device cloud synchronization, publish database.rules.json in Firebase Console -> Realtime Database -> Rules.`
        );
      } else {
        toast.success(
          editingSemester ? 'Semester Updated' : 'Semester Created',
          `"${semesterFormData.name}" saved successfully.`
        );
      }
      setSemesterModalOpen(false);
      await onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('PERMISSION_DENIED') || msg.includes('Permission denied')) {
        toast.error(
          'Permission Denied',
          'Database write was denied. Please ensure database.rules.json is published in Firebase Console -> Realtime Database -> Rules.'
        );
      } else {
        toast.error('Failed to Save Semester', msg);
      }
    } finally {
      setSavingSemester(false);
    }
  };

  const handleToggleSemesterActive = async (sem: Semester) => {
    try {
      const nextActive = !sem.active;
      const result = await saveSemester(
        {
          ...sem,
          active: nextActive,
        },
        true
      );
      await activityLogService.logActivity({
        adminEmail: admin?.email,
        adminUid: admin?.uid,
        action: 'SEMESTER_UPDATE',
        resourceId: sem.id,
        resourceName: sem.name,
        result: 'SUCCESS',
        metadata: { active: nextActive, cloudSynced: result?.cloudSynced },
      });
      if (result && !result.cloudSynced) {
        toast.warning(
          nextActive ? 'Semester Activated (Local)' : 'Semester Deactivated (Local)',
          `"${sem.name}" is now ${nextActive ? 'visible' : 'hidden'} locally. Publish database.rules.json in Firebase Console to sync to cloud.`
        );
      } else {
        toast.info(
          nextActive ? 'Semester Activated' : 'Semester Deactivated',
          `"${sem.name}" is now ${nextActive ? 'visible' : 'hidden'} to public visitors.`
        );
      }
      await onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('PERMISSION_DENIED') || msg.includes('Permission denied')) {
        toast.error(
          'Permission Denied',
          'Database write was denied. Please ensure database.rules.json is published in Firebase Console -> Realtime Database -> Rules.'
        );
      } else {
        toast.error('Toggle Failed', msg);
      }
    }
  };

  const handleDeleteSemester = async (sem: Semester) => {
    const assignedCount = subjectCountsBySemester[sem.id] || 0;
    if (assignedCount > 0) {
      toast.error(
        'Cannot Delete Semester',
        `Semester "${sem.name}" contains ${assignedCount} subject(s). Please reassign or delete these subjects first.`
      );
      return;
    }

    const confirm = window.confirm(
      `Are you sure you want to permanently delete "${sem.name}" (Semester ${sem.number})?`
    );
    if (!confirm) return;

    try {
      await deleteSemester(sem.id);
      await activityLogService.logActivity({
        adminEmail: admin?.email,
        adminUid: admin?.uid,
        action: 'SEMESTER_DELETE',
        resourceId: sem.id,
        resourceName: sem.name,
        result: 'SUCCESS',
      });
      toast.success('Semester Deleted', `"${sem.name}" has been removed.`);
      if (selectedSemesterId === sem.id) {
        setSelectedSemesterId('all');
      }
      await onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('PERMISSION_DENIED') || msg.includes('Permission denied')) {
        toast.error(
          'Permission Denied',
          'Database write was denied. Please ensure database.rules.json is published in Firebase Console -> Realtime Database -> Rules.'
        );
      } else {
        toast.error('Deletion Blocked', msg);
      }
    }
  };

  // ----------------------------------------------------
  // SUBJECT HANDLERS
  // ----------------------------------------------------

  const handleOpenAddSubject = () => {
    setEditingSubject(null);
    const defaultSem =
      selectedSemesterId !== 'all' ? selectedSemesterId : activeSemestersList[0]?.id || 'sem_5';

    setSubjectFormData({
      id: `sub_${Date.now()}`,
      name: '',
      code: '',
      semesterId: defaultSem,
      description: '',
      active: true,
    });
    setSubjectModalOpen(true);
  };

  const handleOpenEditSubject = (subject: Subject) => {
    setEditingSubject(subject);
    setSubjectFormData({
      id: subject.id,
      name: subject.name,
      code: subject.code,
      semesterId: subject.semesterId || 'sem_5',
      description: subject.description || '',
      active: subject.active !== false,
    });
    setSubjectModalOpen(true);
  };

  const handleSubjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectFormData.name.trim() || !subjectFormData.code.trim()) {
      toast.error('Validation Error', 'Subject Name and Course Code are required.');
      return;
    }

    const targetSem = activeSemestersList.find((s) => s.id === subjectFormData.semesterId);
    const targetSemNumber = targetSem ? targetSem.number : 5;

    // Check duplicate course codes within the same semester
    const duplicate = subjects.find(
      (s) =>
        s.code.trim().toUpperCase() === subjectFormData.code.trim().toUpperCase() &&
        (s.semesterId || 'sem_5') === subjectFormData.semesterId &&
        s.id !== subjectFormData.id
    );
    if (duplicate) {
      toast.error(
        'Duplicate Course Code',
        `Course code "${subjectFormData.code.toUpperCase()}" already exists in ${targetSem?.name || 'this semester'}.`
      );
      return;
    }

    try {
      setSavingSubject(true);
      await saveSubject(
        {
          id: subjectFormData.id,
          name: subjectFormData.name.trim(),
          code: subjectFormData.code.trim().toUpperCase(),
          semesterId: subjectFormData.semesterId,
          semesterNumber: targetSemNumber,
          description: subjectFormData.description.trim(),
          active: subjectFormData.active,
        },
        Boolean(editingSubject)
      );

      await activityLogService.logActivity({
        adminEmail: admin?.email,
        adminUid: admin?.uid,
        action: editingSubject ? 'SUBJECT_UPDATE' : 'SUBJECT_CREATE',
        resourceId: subjectFormData.id,
        resourceName: `${subjectFormData.code.trim().toUpperCase()} - ${subjectFormData.name.trim()}`,
        result: 'SUCCESS',
        metadata: {
          code: subjectFormData.code.trim().toUpperCase(),
          semesterId: subjectFormData.semesterId,
          semesterNumber: targetSemNumber,
          active: subjectFormData.active,
        },
      });

      toast.success(
        editingSubject ? 'Subject Updated' : 'Subject Added',
        `${subjectFormData.code} - ${subjectFormData.name} saved successfully.`
      );
      setSubjectModalOpen(false);
      await onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Failed to Save Subject', msg);
    } finally {
      setSavingSubject(false);
    }
  };

  const handleDeleteSubject = async (subject: Subject) => {
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
      toast.error('Cannot Delete Subject', err instanceof Error ? err.message : String(err));
    }
  };

  const handleToggleSubjectActive = async (subject: Subject) => {
    try {
      const nextActive = !subject.active;
      await saveSubject(
        {
          id: subject.id,
          name: subject.name,
          code: subject.code,
          semesterId: subject.semesterId || 'sem_5',
          semesterNumber: subject.semesterNumber ?? 5,
          description: subject.description,
          active: nextActive,
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
        metadata: { active: nextActive },
      });
      toast.info(
        nextActive ? 'Subject Activated' : 'Subject Deactivated',
        `${subject.code} visibility updated.`
      );
      await onRefresh();
    } catch (err: unknown) {
      toast.error('Toggle Failed', err instanceof Error ? err.message : String(err));
    }
  };

  const handleSeedSubjects = async () => {
    const confirmSeed = window.confirm(
      'This will ensure the nine official CSE Semester 5 subjects exist in the database without altering other semesters. Proceed?'
    );
    if (!confirmSeed) return;

    try {
      setSeeding(true);
      await seedStandardCseSem5Subjects();
      toast.success(
        'Subjects Synchronized',
        'Official CSE Semester 5 subjects have been verified successfully.'
      );
      await onRefresh();
    } catch (err: unknown) {
      toast.error('Sync Failed', err instanceof Error ? err.message : String(err));
    } finally {
      setSeeding(false);
    }
  };

  const showSemesters = activeSection === 'semesters' || activeSection === 'both';
  const showSubjects = activeSection === 'subjects' || activeSection === 'both';

  return (
    <div className="space-y-6">
      {/* ============================================================== */}
      {/* 1. SEMESTER MANAGEMENT SECTION                                 */}
      {/* ============================================================== */}
      {showSemesters && (
        <div className="bg-white p-4 sm:p-5 rounded-lg border border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-600" />
                <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  Manage Semesters
                </h2>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  {activeSemestersList.length}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure academic semesters, visibility status, and curriculum structure. Click a semester to view its subjects.
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleOpenAddSemester}
                className="w-full sm:w-auto min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Semester</span>
              </button>
            </div>
          </div>

          {/* Semester Search & Quick Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={semesterSearchQuery}
                onChange={(e) => setSemesterSearchQuery(e.target.value)}
                placeholder="Search semesters by name or number..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900"
              />
            </div>
          </div>

          {/* Semester Selection Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 no-scrollbar touch-pan-x">
            <button
              type="button"
              onClick={() => setSelectedSemesterId('all')}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-2 border cursor-pointer ${
                selectedSemesterId === 'all'
                  ? 'bg-blue-600 text-white border-blue-600 font-semibold shadow-sm'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>All Semesters</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  selectedSemesterId === 'all'
                    ? 'bg-blue-700 text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {subjects.length}
              </span>
            </button>

            {filteredSemesters.map((sem) => {
              const isSelected = selectedSemesterId === sem.id;
              const subCount = subjectCountsBySemester[sem.id] || 0;

              return (
                <div
                  key={sem.id}
                  className={`inline-flex items-center rounded-lg border transition-colors ${
                    isSelected
                      ? 'bg-blue-50 border-blue-300 text-blue-900 shadow-sm'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedSemesterId(sem.id)}
                    className="min-h-[38px] px-3 py-1.5 text-xs font-medium whitespace-nowrap flex items-center gap-2 text-left cursor-pointer"
                  >
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        sem.active ? 'bg-green-500' : 'bg-amber-400'
                      }`}
                      title={sem.active ? 'Active (Publicly Visible)' : 'Hidden (Admin Only)'}
                    />
                    <span className="font-semibold">{sem.name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        isSelected
                          ? 'bg-blue-200 text-blue-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {subCount}
                    </span>
                  </button>

                  {/* Inline Quick Actions for Semester */}
                  <div className="flex items-center pr-1.5 pl-0.5 gap-0.5 border-l border-slate-200/60 my-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEditSemester(sem)}
                      className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-slate-100 cursor-pointer"
                      title={`Edit ${sem.name}`}
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleSemesterActive(sem)}
                      className="p-1 rounded text-slate-400 hover:text-amber-600 hover:bg-slate-100 cursor-pointer"
                      title={sem.active ? 'Deactivate Semester' : 'Activate Semester'}
                    >
                      <span className="text-[10px] font-bold leading-none px-0.5">
                        {sem.active ? 'ON' : 'OFF'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSemester(sem)}
                      className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                      title={`Delete ${sem.name} (blocked if subjects exist)`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Full Semesters Table in Dedicated Semesters View */}
          {activeSection === 'semesters' && (
            <div className="mt-4 border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                    <th className="py-2.5 px-4">Semester Number</th>
                    <th className="py-2.5 px-4">Display Name</th>
                    <th className="py-2.5 px-4">Curriculum Subjects</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4">Description</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSemesters.map((sem) => {
                    const subCount = subjectCountsBySemester[sem.id] || 0;
                    return (
                      <tr key={sem.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                          Semester {sem.number}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-900">
                          {sem.name}
                        </td>
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSemesterId(sem.id);
                              if (onNavigateToSubjects) onNavigateToSubjects(sem.id);
                            }}
                            className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                          >
                            <span>{subCount} {subCount === 1 ? 'subject' : 'subjects'}</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </td>
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => handleToggleSemesterActive(sem)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-colors cursor-pointer ${
                              sem.active
                                ? 'bg-slate-100 text-slate-800 border border-slate-200 hover:bg-slate-200'
                                : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                            }`}
                            title="Click to toggle visibility"
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                sem.active ? 'bg-green-500' : 'bg-amber-500'
                              }`}
                            />
                            <span>{sem.active ? 'Active' : 'Hidden'}</span>
                          </button>
                        </td>
                        <td className="py-3 px-4 text-slate-500 max-w-xs truncate">
                          {sem.description || '—'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEditSemester(sem)}
                              className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSemester(sem)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                              title="Delete semester"
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
      )}

      {/* ============================================================== */}
      {/* 2. SUBJECTS LISTING & CONTROLS                                 */}
      {/* ============================================================== */}
      {showSubjects && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-lg border border-slate-200">
            <div>
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-600" />
                <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  {selectedSemesterId === 'all'
                    ? 'All Curriculum Subjects'
                    : `${activeSemestersList.find((s) => s.id === selectedSemesterId)?.name || 'Semester'} Subjects`}
                </h2>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  {filteredSubjects.length}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {selectedSemesterId === 'all'
                  ? 'Showing subjects across all configured semesters.'
                  : `Manage subjects and syllabus associations for ${activeSemestersList.find((s) => s.id === selectedSemesterId)?.name || 'this semester'}.`}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleSeedSubjects}
                disabled={seeding || loading}
                className="w-full sm:w-auto min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                title="Ensure the 9 standard Semester 5 subjects exist"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${seeding ? 'animate-spin' : ''}`} />
                <span>{seeding ? 'Verifying...' : 'Verify Sem 5 Subjects'}</span>
              </button>

              <button
                type="button"
                onClick={handleOpenAddSubject}
                className="w-full sm:w-auto min-h-[40px] inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Subject</span>
              </button>
            </div>
          </div>

          {/* Subject Filter Pills & Search */}
          <div className="bg-white p-3.5 rounded-lg border border-slate-200 space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={subjectSearchQuery}
                  onChange={(e) => setSubjectSearchQuery(e.target.value)}
                  placeholder="Search subjects by course code or name..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900"
                />
              </div>

              {/* Semester Tabs for Switching */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar touch-pan-x">
                <button
                  type="button"
                  onClick={() => setSelectedSemesterId('all')}
                  className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors border cursor-pointer ${
                    selectedSemesterId === 'all'
                      ? 'bg-blue-600 text-white border-blue-600 font-semibold shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  All Semesters ({subjects.length})
                </button>
                {activeSemestersList.map((sem) => (
                  <button
                    key={sem.id}
                    type="button"
                    onClick={() => setSelectedSemesterId(sem.id)}
                    className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors border cursor-pointer ${
                      selectedSemesterId === sem.id
                        ? 'bg-blue-600 text-white border-blue-600 font-semibold shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {sem.name} ({subjectCountsBySemester[sem.id] || 0})
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Subjects Table */}
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-slate-400">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-600" />
                <p className="text-xs">Loading subjects from Firebase...</p>
              </div>
            ) : filteredSubjects.length === 0 ? (
              <div className="p-12 text-center">
                <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h4 className="text-base font-semibold text-slate-800">No Subjects in this Semester</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-5">
                  {selectedSemesterId === 'all'
                    ? 'No curriculum subjects match your search.'
                    : 'This semester does not have any subjects assigned yet. Click "Add Subject" to create one.'}
                </p>
                <button
                  type="button"
                  onClick={handleOpenAddSubject}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Subject</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                      <th className="py-3 px-4">Subject Name & Code</th>
                      <th className="py-3 px-4">Semester</th>
                      <th className="py-3 px-4">Associated Materials</th>
                      <th className="py-3 px-4">Description</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredSubjects.map((sub) => {
                      const semMatch = activeSemestersList.find(
                        (s) => s.id === (sub.semesterId || 'sem_5')
                      );
                      const semDisplay = semMatch ? semMatch.name : `Semester ${sub.semesterNumber || 5}`;
                      const matCount = materialCountsBySubject[sub.id] || 0;

                      return (
                        <tr key={sub.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <span className="font-mono text-[11px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                {sub.code}
                              </span>
                              <span className="font-medium text-slate-900 text-xs sm:text-sm">
                                {sub.name}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                              {semDisplay}
                            </span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => {
                                if (onNavigateToMaterials) {
                                  onNavigateToMaterials(sub.id);
                                }
                              }}
                              className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                              title={`View study materials for ${sub.code}`}
                            >
                              <FileText className="w-3.5 h-3.5 text-slate-400" />
                              <span>{matCount} {matCount === 1 ? 'material' : 'materials'}</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </td>
                          <td className="py-3 px-4 max-w-xs sm:max-w-md">
                            <p className="text-slate-500 truncate">{sub.description || '—'}</p>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleToggleSubjectActive(sub)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-colors cursor-pointer ${
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
                              />
                              <span>{sub.active ? 'Active' : 'Hidden'}</span>
                            </button>
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenEditSubject(sub)}
                                className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center p-2 rounded-md text-slate-500 hover:text-blue-600 hover:bg-slate-100 active:bg-slate-200 transition-colors cursor-pointer"
                                title="Edit or Reassign Subject"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteSubject(sub)}
                                className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center p-2 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 active:bg-rose-100 transition-colors cursor-pointer"
                                title="Delete subject (blocked if materials exist)"
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
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. SEMESTER CREATE / EDIT MODAL                                */}
      {/* ============================================================== */}
      <Modal
        isOpen={semesterModalOpen}
        onClose={() => setSemesterModalOpen(false)}
        title={editingSemester ? `Edit ${editingSemester.name}` : 'Add New Semester'}
        description="Configure academic semester number, display label, and visibility."
      >
        <form onSubmit={handleSemesterSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Semester Number *
              </label>
              <input
                type="number"
                min="1"
                max="12"
                required
                value={semesterFormData.number}
                onChange={(e) => {
                  const val = e.target.value;
                  setSemesterFormData({
                    ...semesterFormData,
                    number: val,
                    name: semesterFormData.name ? semesterFormData.name : `Semester ${val}`,
                  });
                }}
                className="w-full min-h-[42px] text-sm px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Display Name *
              </label>
              <input
                type="text"
                required
                value={semesterFormData.name}
                onChange={(e) => setSemesterFormData({ ...semesterFormData, name: e.target.value })}
                placeholder="e.g. Semester 1, Semester 5, Semester 6"
                className="w-full min-h-[42px] text-sm px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Description / Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={semesterFormData.description}
              onChange={(e) =>
                setSemesterFormData({ ...semesterFormData, description: e.target.value })
              }
              placeholder="e.g. Computer Science Engineering curriculum for Autumn term..."
              className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 placeholder:text-slate-400"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="semester-active"
              checked={semesterFormData.active}
              onChange={(e) =>
                setSemesterFormData({ ...semesterFormData, active: e.target.checked })
              }
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
            />
            <label htmlFor="semester-active" className="text-xs font-medium text-slate-700">
              Active (Visible to students on public catalog and navigation)
            </label>
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setSemesterModalOpen(false)}
              className="w-full sm:w-auto min-h-[42px] px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors text-center cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingSemester}
              className="w-full sm:w-auto min-h-[42px] px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg transition-colors disabled:opacity-50 text-center cursor-pointer"
            >
              {savingSemester ? 'Saving...' : editingSemester ? 'Update Semester' : 'Create Semester'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ============================================================== */}
      {/* 4. SUBJECT CREATE / EDIT / REASSIGN MODAL                       */}
      {/* ============================================================== */}
      <Modal
        isOpen={subjectModalOpen}
        onClose={() => setSubjectModalOpen(false)}
        title={editingSubject ? `Edit Subject (${editingSubject.code})` : 'Add New Subject'}
        description="Configure course details and assign or move between academic semesters."
      >
        <form onSubmit={handleSubjectSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Course Code *
              </label>
              <input
                type="text"
                required
                value={subjectFormData.code}
                onChange={(e) => setSubjectFormData({ ...subjectFormData, code: e.target.value })}
                placeholder="e.g. 23CS3501"
                className="w-full min-h-[42px] text-sm uppercase px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Semester Assignment *
              </label>
              <select
                required
                value={subjectFormData.semesterId}
                onChange={(e) =>
                  setSubjectFormData({ ...subjectFormData, semesterId: e.target.value })
                }
                className="w-full min-h-[42px] text-xs sm:text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium text-slate-900 cursor-pointer"
              >
                {activeSemestersList.map((sem) => (
                  <option key={sem.id} value={sem.id}>
                    {sem.name} (Semester {sem.number})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Official Subject Name *
            </label>
            <input
              type="text"
              required
              value={subjectFormData.name}
              onChange={(e) => setSubjectFormData({ ...subjectFormData, name: e.target.value })}
              placeholder="e.g. Advanced Database Engineering"
              className="w-full min-h-[42px] text-sm px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Description / Course Scope
            </label>
            <textarea
              rows={3}
              value={subjectFormData.description}
              onChange={(e) =>
                setSubjectFormData({ ...subjectFormData, description: e.target.value })
              }
              placeholder="Brief summary of units, topics, and syllabus focus..."
              className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 placeholder:text-slate-400"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="subject-active"
              checked={subjectFormData.active}
              onChange={(e) =>
                setSubjectFormData({ ...subjectFormData, active: e.target.checked })
              }
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
            />
            <label htmlFor="subject-active" className="text-xs font-medium text-slate-700">
              Active (Visible to public students on curriculum catalog)
            </label>
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setSubjectModalOpen(false)}
              className="w-full sm:w-auto min-h-[42px] px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors text-center cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingSubject}
              className="w-full sm:w-auto min-h-[42px] px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg transition-colors disabled:opacity-50 text-center cursor-pointer"
            >
              {savingSubject ? 'Saving...' : editingSubject ? 'Update Subject' : 'Create Subject'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
