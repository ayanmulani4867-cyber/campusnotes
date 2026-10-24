import React, { useEffect, useState, useMemo } from 'react';
import {
  LogOut,
  Plus,
  Search,
  BookOpen,
  FileText,
  Layers,
  Edit2,
  Trash2,
  RefreshCw,
  Key,
  Wrench,
  Upload,
  FileCheck,
  Menu,
  X,
  LayoutDashboard,
  GraduationCap,
  ArrowRight,
  BarChart3,
  History,
  HeartPulse,
  Share2,
} from 'lucide-react';
import { updateAdminPassword } from '../../services/authService';
import { Modal } from '../../components/common/Modal';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  StudyMaterial,
  Subject,
  Semester,
  DashboardStats,
  AcademicCategory,
  MATERIAL_TYPE_OPTIONS,
  isLabSubject,
} from '../../types';
import {
  getAllMaterialsAdmin,
  getAllSubjectsAdmin,
  getAllSemestersAdmin,
  togglePublishMaterial,
  deleteMaterial,
  getMaintenanceMode,
  setMaintenanceMode,
  uploadPdfFile,
  createMaterial,
  MAX_FILE_SIZE_BYTES,
} from '../../services/firebaseService';
import { formatFileSize } from '../../components/materials/MaterialCard';
import {
  validateClientFile,
  ACCEPTED_FILE_EXTENSIONS,
} from '../../utils/fileTypes';
import { SubjectManager } from '../../components/admin/SubjectManager';
import { MaterialFormModal } from '../../components/admin/MaterialFormModal';
import { ReplacePdfModal } from '../../components/admin/ReplacePdfModal';
import { SharePrivatelyModal } from '../../components/admin/SharePrivatelyModal';
import { PrivateSharesManagement } from '../../components/admin/PrivateSharesManagement';
import { VisitorAnalyticsSection } from '../../components/admin/VisitorAnalyticsSection';
import { AdminActivityLogSection } from '../../components/admin/AdminActivityLogSection';
import { WebsiteHealthSection } from '../../components/admin/WebsiteHealthSection';
import { activityLogService } from '../../services/activityLogService';

type AdminTab =
  | 'dashboard'
  | 'semesters'
  | 'subjects'
  | 'materials'
  | 'upload'
  | 'analytics'
  | 'activity'
  | 'health'
  | 'maintenance';

export const AdminDashboardPage: React.FC = () => {
  const { admin, logout } = useAuth();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [loading, setLoading] = useState(true);

  // Maintenance mode state
  const [maintenanceMode, setMaintenanceModeState] = useState(false);
  const [isTogglingMaintenance, setIsTogglingMaintenance] = useState(false);

  // Filters for materials table
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSemester, setFilterSemester] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all'); // all, published, drafts

  // Modals state
  const [editingMaterial, setEditingMaterial] = useState<StudyMaterial | null>(null);
  const [replacingMaterial, setReplacingMaterial] = useState<StudyMaterial | null>(null);
  const [sharingMaterial, setSharingMaterial] = useState<StudyMaterial | null>(null);
  const [materialsSubTab, setMaterialsSubTab] = useState<'catalog' | 'privateShares'>('catalog');
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Inline Upload Form state
  const [uploadSemesterId, setUploadSemesterId] = useState('');
  const [uploadSubjectId, setUploadSubjectId] = useState('');
  const [uploadType, setUploadType] = useState<AcademicCategory>('notes');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadNum, setUploadNum] = useState('');
  const [uploadYear, setUploadYear] = useState('2026-27');
  const [uploadPublished, setUploadPublished] = useState(true);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadBytesTransferred, setUploadBytesTransferred] = useState(0);
  const [uploadTotalBytes, setUploadTotalBytes] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const selectedUploadSubject = subjects.find((s) => s.id === uploadSubjectId) || null;
  const isUploadLab = isLabSubject(selectedUploadSubject);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPasswordInput.trim().length < 6) {
      toast.error('Weak Password', 'Password must be at least 6 characters long.');
      return;
    }
    try {
      setIsUpdatingPassword(true);
      await updateAdminPassword(newPasswordInput.trim());
      await activityLogService.logActivity({
        adminEmail: admin?.email,
        adminUid: admin?.uid,
        action: 'ADMIN_PASSWORD_CHANGE',
        resourceId: admin?.uid || 'admin',
        resourceName: 'Administrator Credentials',
        result: 'SUCCESS',
      });
      toast.success(
        'Password Updated',
        'Administrator credentials updated successfully.'
      );
      setPasswordModalOpen(false);
      setNewPasswordInput('');
    } catch (err: unknown) {
      await activityLogService.logActivity({
        adminEmail: admin?.email,
        adminUid: admin?.uid,
        action: 'ADMIN_PASSWORD_CHANGE',
        resourceId: admin?.uid || 'admin',
        resourceName: 'Administrator Credentials',
        result: 'FAILURE',
        errorMessage: err instanceof Error ? err.message : String(err),
      });
      toast.error('Update Failed', err instanceof Error ? err.message : String(err));
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const refreshData = async () => {
    try {
      setLoading(true);
      const [mats, subs, sems, maint] = await Promise.all([
        getAllMaterialsAdmin(),
        getAllSubjectsAdmin(),
        getAllSemestersAdmin(),
        getMaintenanceMode().catch(() => false),
      ]);
      setMaterials(mats);
      setSubjects(subs);
      setSemesters(sems);
      setMaintenanceModeState(maint);

      if (!uploadSemesterId && sems.length > 0) {
        setUploadSemesterId(sems[0].id);
      }
      if (!uploadSubjectId && subs.length > 0) {
        setUploadSubjectId(subs[0].id);
      }
    } catch (err) {
      console.warn('Refresh notice:', err);
    } finally {
      setLoading(false);
    }
  };

  const groupedSubjects = useMemo(() => {
    const groups: { semesterName: string; subjects: Subject[] }[] = [];
    const semMap = new Map<string, string>();
    for (const sem of semesters) {
      semMap.set(sem.id, sem.name);
    }
    const map = new Map<string, Subject[]>();
    for (const s of subjects) {
      const sId = s.semesterId || 'sem_5';
      if (!map.has(sId)) {
        map.set(sId, []);
      }
      map.get(sId)!.push(s);
    }
    for (const sem of semesters) {
      if (map.has(sem.id)) {
        groups.push({
          semesterName: sem.name,
          subjects: map.get(sem.id)!,
        });
        map.delete(sem.id);
      }
    }
    for (const [sId, subs] of map.entries()) {
      const name = semMap.get(sId) || (sId === 'sem_5' ? 'Semester 5' : sId);
      groups.push({
        semesterName: name,
        subjects: subs,
      });
    }
    return groups;
  }, [subjects, semesters]);

  useEffect(() => {
    refreshData();
  }, []);

  // Compute stats synchronously without cascading re-renders
  const stats = useMemo<DashboardStats | null>(() => {
    if (loading && materials.length === 0 && subjects.length === 0) return null;

    const categoryCounts: Record<AcademicCategory, number> = {
      notes: 0,
      assignments: 0,
      experiments: 0,
      pyq: 0,
      'question-banks': 0,
      syllabus: 0,
      reference: 0,
    };

    let publishedCount = 0;
    let unpublishedCount = 0;

    for (const m of materials) {
      if (m.published) {
        publishedCount++;
      } else {
        unpublishedCount++;
      }
      if (m.category && categoryCounts[m.category] !== undefined) {
        categoryCounts[m.category]++;
      }
    }

    return {
      totalMaterials: materials.length,
      publishedCount,
      unpublishedCount,
      totalSubjects: subjects.length,
      categoryCounts,
    };
  }, [materials, subjects, loading]);

  const handleTogglePublish = async (material: StudyMaterial) => {
    try {
      const newStatus = await togglePublishMaterial(material);
      setMaterials((prev) =>
        prev.map((m) => (m.id === material.id ? { ...m, published: newStatus } : m))
      );
      await activityLogService.logActivity({
        adminEmail: admin?.email,
        adminUid: admin?.uid,
        action: 'MATERIAL_PUBLISH_TOGGLE',
        resourceId: material.id,
        resourceName: material.title,
        result: 'SUCCESS',
        metadata: {
          previousValue: material.published ? 'published' : 'draft',
          newValue: newStatus ? 'published' : 'draft',
          published: newStatus,
        },
      });
      toast.success(
        newStatus ? 'Material Published' : 'Material Unpublished',
        `"${material.title}" is now ${newStatus ? 'visible to students' : 'saved as draft'}.`
      );
    } catch (err: unknown) {
      await activityLogService.logActivity({
        adminEmail: admin?.email,
        adminUid: admin?.uid,
        action: 'MATERIAL_PUBLISH_TOGGLE',
        resourceId: material.id,
        resourceName: material.title,
        result: 'FAILURE',
        errorMessage: err instanceof Error ? err.message : String(err),
      });
      toast.error('Update Failed', err instanceof Error ? err.message : String(err));
    }
  };

  const handleDeleteMaterial = async (material: StudyMaterial) => {
    const confirm = window.confirm(
      `Are you sure you want to permanently delete "${material.title}"?\nThis removes both database records and the PDF stored in Realtime Database.`
    );
    if (!confirm) return;

    try {
      await deleteMaterial(material);
      setMaterials((prev) => prev.filter((m) => m.id !== material.id));
      await activityLogService.logActivity({
        adminEmail: admin?.email,
        adminUid: admin?.uid,
        action: 'MATERIAL_DELETE',
        resourceId: material.id,
        resourceName: material.title,
        result: 'SUCCESS',
        metadata: {
          fileName: material.fileName,
          category: material.category,
        },
      });
      toast.success('Material Deleted', `"${material.title}" has been deleted.`);
    } catch (err: unknown) {
      await activityLogService.logActivity({
        adminEmail: admin?.email,
        adminUid: admin?.uid,
        action: 'MATERIAL_DELETE',
        resourceId: material.id,
        resourceName: material.title,
        result: 'FAILURE',
        errorMessage: err instanceof Error ? err.message : String(err),
      });
      toast.error('Deletion Failed', err instanceof Error ? err.message : String(err));
    }
  };

  const handleToggleMaintenance = async () => {
    try {
      setIsTogglingMaintenance(true);
      const nextState = !maintenanceMode;
      await setMaintenanceMode(nextState);
      setMaintenanceModeState(nextState);
      await activityLogService.logActivity({
        adminEmail: admin?.email,
        adminUid: admin?.uid,
        action: 'MAINTENANCE_TOGGLE',
        resourceId: 'maintenanceMode',
        resourceName: 'System Maintenance Mode',
        result: 'SUCCESS',
        metadata: {
          previousValue: maintenanceMode ? 'enabled' : 'disabled',
          newValue: nextState ? 'enabled' : 'disabled',
        },
      });
      toast.success(
        nextState ? 'Maintenance Mode Enabled' : 'Maintenance Mode Disabled',
        nextState
          ? 'Public visitors are now redirected to the maintenance notice. Public access is locked.'
          : 'CampusNotes is now live and fully accessible to students.'
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await activityLogService.logActivity({
        adminEmail: admin?.email,
        adminUid: admin?.uid,
        action: 'MAINTENANCE_TOGGLE',
        resourceId: 'maintenanceMode',
        resourceName: 'System Maintenance Mode',
        result: 'FAILURE',
        errorMessage: msg,
      });
      if (msg.includes('PERMISSION_DENIED') || msg.includes('Permission denied')) {
        toast.error('Permission Denied', 'Database write was denied. Please ensure database.rules.json is published in Firebase Console -> Realtime Database -> Rules.');
      } else {
        toast.error('Failed to update maintenance mode', msg);
      }
    } finally {
      setIsTogglingMaintenance(false);
    }
  };

  // Inline Upload Form Handlers
  const handleUploadSubjectChange = (newSubId: string) => {
    setUploadSubjectId(newSubId);
    const sub = subjects.find((s) => s.id === newSubId);
    if (isLabSubject(sub) && uploadType === 'assignments') {
      setUploadType('experiments');
      toast.info('Laboratory Course', 'Laboratory courses host Experiments / Practicals rather than Assignments.');
    }
  };

  const handleUploadTypeChange = (newType: AcademicCategory) => {
    if (isUploadLab && newType === 'assignments') {
      toast.error('Invalid for Lab Courses', 'Laboratory courses host Experiments / Practicals, not Assignments.');
      setUploadType('experiments');
      return;
    }
    setUploadType(newType);
  };

  const handleUploadFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = await validateClientFile(file, MAX_FILE_SIZE_BYTES);
    if (!validation.valid) {
      toast.error('Invalid File', validation.error || 'The selected file format is not supported.');
      e.target.value = '';
      setUploadFile(null);
      return;
    }

    setUploadFile(file);
  };

  const handleInlineUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!uploadSubjectId) {
      toast.error('Validation Error', 'Please select a subject from the dropdown.');
      return;
    }
    if (!uploadTitle.trim()) {
      toast.error('Validation Error', 'Please enter a title for the material.');
      return;
    }
    if (!uploadFile) {
      toast.error('Validation Error', 'Please select a study material file to upload.');
      return;
    }
    if (isUploadLab && uploadType === 'assignments') {
      toast.error('Academic Rule', 'Assignments cannot be created for laboratory subjects. Please choose Experiment / Practical.');
      return;
    }

    setIsUploading(true);

    try {
      const materialId = `mat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const parsedNum = uploadNum.trim() ? parseInt(uploadNum.trim(), 10) : null;

      // 1. Upload to Realtime Database
      const uploadResult = await uploadPdfFile(
        uploadFile,
        uploadSubjectId,
        materialId,
        (percent, transferred, total) => {
          setUploadProgress(percent);
          setUploadBytesTransferred(transferred);
          setUploadTotalBytes(total);
        },
        uploadPublished
      );

      // 2. Save metadata to RTDB
      const newMaterial: StudyMaterial = {
        id: materialId,
        title: uploadTitle.trim(),
        description: uploadDesc.trim(),
        subjectId: uploadSubjectId,
        category: uploadType,
        academicYear: uploadYear.trim() || '2026-27',
        assignmentNumber: uploadType === 'assignments' ? parsedNum : null,
        experimentNumber: uploadType === 'experiments' ? parsedNum : null,
        unitNumber: uploadType === 'notes' ? parsedNum : null,
        fileName: uploadResult.fileName,
        mimeType: uploadResult.mimeType,
        storagePath: uploadResult.storagePath,
        downloadUrl: uploadResult.downloadUrl,
        blobId: uploadResult.blobId,
        storageProvider: uploadResult.storageProvider,
        r2Key: uploadResult.r2Key,
        r2Url: uploadResult.r2Url,
        fileSize: uploadResult.fileSize,
        published: uploadPublished,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: admin?.uid || 'admin',
      };

      await createMaterial(newMaterial);

      await activityLogService.logActivity({
        adminEmail: admin?.email,
        adminUid: admin?.uid,
        action: 'MATERIAL_UPLOAD',
        resourceId: materialId,
        resourceName: uploadTitle.trim(),
        result: 'SUCCESS',
        metadata: {
          fileName: uploadResult.fileName,
          fileSize: uploadResult.fileSize,
          category: uploadType,
          subjectId: uploadSubjectId,
          published: uploadPublished,
        },
      });

      // Optimistically insert into materials state
      setMaterials((prev) => [newMaterial, ...prev]);

      toast.success('Upload Successful', 'Material uploaded successfully.');

      // Reset form fields
      setUploadTitle('');
      setUploadDesc('');
      setUploadNum('');
      setUploadFile(null);
      setUploadProgress(null);

      await refreshData();
      setActiveTab('materials');
    } catch (err: unknown) {
      await activityLogService.logActivity({
        adminEmail: admin?.email,
        adminUid: admin?.uid,
        action: 'MATERIAL_UPLOAD',
        resourceId: uploadTitle.trim() || 'unknown',
        resourceName: uploadTitle.trim() || 'Upload Attempt',
        result: 'FAILURE',
        errorMessage: err instanceof Error ? err.message : String(err),
      });
      toast.error('Upload Failed', err instanceof Error ? err.message : String(err));
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  // Filtered materials
  const filteredMaterials = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return materials.filter((m) => {
      const sub = subjects.find((s) => s.id === m.subjectId);
      if (filterSemester) {
        const targetSem = semesters.find((sem) => sem.id === filterSemester);
        const subSemId = sub?.semesterId || (sub?.semesterNumber ? `sem_${sub.semesterNumber}` : 'sem_5');
        const matchesSemId = subSemId === filterSemester;
        const matchesSemNum = targetSem && (sub?.semesterNumber ?? 5) === targetSem.number;
        if (!matchesSemId && !matchesSemNum) return false;
      }
      if (filterSubject && m.subjectId !== filterSubject) return false;
      if (filterType && m.category !== filterType) return false;
      if (filterStatus === 'published' && !m.published) return false;
      if (filterStatus === 'drafts' && m.published) return false;

      if (q) {
        const matchTitle = m.title.toLowerCase().includes(q);
        const matchDesc = (m.description || '').toLowerCase().includes(q);
        const matchFile = (m.fileName || '').toLowerCase().includes(q);
        const matchSub = sub
          ? sub.name.toLowerCase().includes(q) || sub.code.toLowerCase().includes(q)
          : false;

        if (!matchTitle && !matchDesc && !matchFile && !matchSub) return false;
      }
      return true;
    });
  }, [materials, searchQuery, filterSemester, filterSubject, filterType, filterStatus, subjects, semesters]);

  const recentMaterials = useMemo(() => {
    return [...materials]
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, 5);
  }, [materials]);

  const navItems = [
    { id: 'dashboard' as AdminTab, label: 'Dashboard', icon: LayoutDashboard },
    {
      id: 'semesters' as AdminTab,
      label: 'Manage Semesters',
      icon: Layers,
      count: semesters.length,
    },
    {
      id: 'subjects' as AdminTab,
      label: 'Manage Subjects',
      icon: BookOpen,
      count: subjects.length,
    },
    {
      id: 'materials' as AdminTab,
      label: 'Manage Study Materials',
      icon: FileText,
      count: materials.length,
    },
    {
      id: 'analytics' as AdminTab,
      label: 'Visitor Analytics',
      icon: BarChart3,
    },
    {
      id: 'activity' as AdminTab,
      label: 'Activity Log',
      icon: History,
    },
    {
      id: 'health' as AdminTab,
      label: 'Website Health',
      icon: HeartPulse,
    },
    {
      id: 'maintenance' as AdminTab,
      label: 'Maintenance Mode',
      icon: Wrench,
      badge: maintenanceMode ? 'ON' : undefined,
    },
  ];

  return (
    <div className="flex-1 flex flex-col md:flex-row w-full bg-[#F8FAFC]">
      {/* Mobile Top Bar */}
      <div className="md:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold shadow-sm">
            <GraduationCap className="w-4 h-4" />
          </div>
          <div>
            <h1 className="font-bold text-slate-900 text-sm leading-none">CampusNotes Admin</h1>
            <span className="text-[11px] text-slate-500 font-mono truncate max-w-[150px] block mt-0.5">
              {admin?.email}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 active:bg-slate-100"
          aria-label="Toggle Navigation Menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-slate-200 p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isSelected = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full min-h-[44px] flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium text-left transition-colors ${
                  isSelected
                    ? 'bg-blue-50 text-blue-600 font-semibold'
                    : 'text-slate-700 hover:bg-slate-50 active:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.count !== undefined && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      isSelected ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
                {item.badge && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          <div className="pt-2 mt-2 border-t border-slate-100 space-y-1">
            <button
              type="button"
              onClick={() => {
                refreshData();
                setMobileMenuOpen(false);
              }}
              className="w-full min-h-[44px] flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 active:bg-slate-100 text-left transition-colors"
            >
              <RefreshCw className={`w-4 h-4 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
              <span>Sync Firebase</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setPasswordModalOpen(true);
                setMobileMenuOpen(false);
              }}
              className="w-full min-h-[44px] flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 active:bg-slate-100 text-left transition-colors"
            >
              <Key className="w-4 h-4 text-slate-400" />
              <span>Change Password</span>
            </button>

            <button
              type="button"
              onClick={() => logout()}
              className="w-full min-h-[44px] flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 active:bg-rose-100 text-left transition-colors"
            >
              <LogOut className="w-4 h-4 text-slate-400" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}

      {/* Desktop Clean Sidebar (250px wide) */}
      <aside className="hidden md:flex w-[250px] bg-white border-r border-slate-200 p-5 flex-col justify-between shrink-0">
        <div className="space-y-6">
          {/* Top Brand & Administrator Identity */}
          <div className="pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold shadow-sm">
                <GraduationCap className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-base font-bold text-slate-900 leading-tight">CampusNotes</h1>
                <span className="text-[11px] font-medium text-slate-500">Administrator</span>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span
                className="text-xs text-slate-600 font-mono truncate max-w-[150px]"
                title={admin?.email || ''}
              >
                {admin?.email}
              </span>
              {maintenanceMode && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                  Maintenance
                </span>
              )}
            </div>
          </div>

          {/* 5 Navigation Items */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isSelected = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-left transition-colors ${
                    isSelected
                      ? 'bg-blue-50 text-blue-600 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.count !== undefined && (
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                        isSelected ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                  {item.badge && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Bottom Controls */}
        <div className="pt-4 border-t border-slate-100 space-y-1">
          <button
            type="button"
            onClick={refreshData}
            disabled={loading}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors text-left"
          >
            <RefreshCw className={`w-4 h-4 text-slate-400 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            <span>Sync Firebase</span>
          </button>

          <button
            type="button"
            onClick={() => setPasswordModalOpen(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors text-left"
          >
            <Key className="w-4 h-4 text-slate-400" />
            <span>Change Password</span>
          </button>

          <button
            type="button"
            onClick={() => logout()}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition-colors text-left"
          >
            <LogOut className="w-4 h-4 text-slate-400" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-3.5 sm:p-6 md:p-8 min-w-0 bg-[#F8FAFC] space-y-6">
        {/* ============================================================== */}
        {/* 1. DASHBOARD OVERVIEW TAB                                      */}
        {/* ============================================================== */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Dashboard Overview</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage your study materials and semester resources.
              </p>
            </div>

            {/* Four Compact Statistics Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg border border-slate-200 p-4">
                <p className="text-xs font-medium text-slate-500">Total Materials</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {materials.length}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">Curriculum documents</p>
              </div>

              <div className="bg-white rounded-lg border border-slate-200 p-4">
                <p className="text-xs font-medium text-slate-500">Published</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {stats ? stats.publishedCount : materials.filter((m) => m.published).length}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">Visible to students</p>
              </div>

              <div className="bg-white rounded-lg border border-slate-200 p-4">
                <p className="text-xs font-medium text-slate-500">Drafts</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {stats ? stats.unpublishedCount : materials.filter((m) => !m.published).length}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">Unpublished</p>
              </div>

              <div className="bg-white rounded-lg border border-slate-200 p-4">
                <p className="text-xs font-medium text-slate-500">Subjects</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {subjects.length}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">Configured courses</p>
              </div>
            </div>

            {/* Compact Quick Actions */}
            <div className="bg-white rounded-lg border border-slate-200 p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">Quick Actions</h3>
                <p className="text-xs text-slate-500">Fast access to key management workflows.</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('upload')}
                  className="px-3.5 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Upload Material</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('materials')}
                  className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
                >
                  <span>View All Materials</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('semesters')}
                  className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
                >
                  <span>Manage Semesters</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('subjects')}
                  className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
                >
                  <span>Manage Subjects</span>
                </button>
              </div>
            </div>

            {/* System Intelligence & Monitoring Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                type="button"
                onClick={() => setActiveTab('analytics')}
                className="p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm text-left transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                  <span className="text-[11px] font-semibold text-blue-600 flex items-center gap-1">
                    Open <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </div>
                <h4 className="text-xs font-bold text-slate-900 mt-2.5">Visitor Analytics</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Page views, unique visitors, 7/30d trends & device metrics.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('activity')}
                className="p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm text-left transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <History className="w-4 h-4" />
                  </div>
                  <span className="text-[11px] font-semibold text-indigo-600 flex items-center gap-1">
                    Open <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </div>
                <h4 className="text-xs font-bold text-slate-900 mt-2.5">Admin Activity Log</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Auditable history of uploads, publications, and configurations.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('health')}
                className="p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm text-left transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <HeartPulse className="w-4 h-4" />
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                    Open <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </div>
                <h4 className="text-xs font-bold text-slate-900 mt-2.5">Website Health</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Availability, latency, error captures & PDF failure status.
                </p>
              </button>
            </div>

            {/* Recent Materials Section */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm">Recent Materials</h3>
                  <p className="text-xs text-slate-500">Latest uploaded documents in the curriculum.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('materials')}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <span>View All ({materials.length})</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {recentMaterials.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No materials uploaded yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                        <th className="py-2.5 px-4">Title</th>
                        <th className="py-2.5 px-4">Subject</th>
                        <th className="py-2.5 px-4">Type</th>
                        <th className="py-2.5 px-4">Status</th>
                        <th className="py-2.5 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {recentMaterials.map((mat) => {
                        const sub = subjects.find((s) => s.id === mat.subjectId);
                        const typeOpt = MATERIAL_TYPE_OPTIONS.find((t) => t.id === mat.category);
                        return (
                          <tr key={mat.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-2.5 px-4 max-w-xs truncate font-medium text-slate-900">
                              {mat.title}
                            </td>
                            <td className="py-2.5 px-4 text-slate-600">
                              <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                                {sub?.code || '—'}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-slate-600">
                              {typeOpt?.label || mat.category}
                            </td>
                            <td className="py-2.5 px-4">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium ${
                                  mat.published
                                    ? 'bg-slate-100 text-slate-800 border border-slate-200'
                                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                                }`}
                              >
                                {mat.published && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                )}
                                <span>{mat.published ? 'Published' : 'Draft'}</span>
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setSharingMaterial(mat)}
                                  className="text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded border border-blue-200 transition-colors inline-flex items-center gap-1"
                                  title="Share Privately"
                                >
                                  <Share2 className="w-3 h-3 text-blue-600" />
                                  <span>Share Privately</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingMaterial(mat)}
                                  className="text-xs font-medium text-slate-700 hover:text-blue-600 px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
                                >
                                  Edit
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
        {/* 2. ALL MATERIALS TAB                                           */}
        {/* ============================================================== */}
        {activeTab === 'materials' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">Study Materials</h2>
                <p className="text-xs text-slate-500">
                  Manage, filter, edit details, and privately share curriculum documents.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('upload')}
                className="px-3.5 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Upload Material</span>
              </button>
            </div>

            {/* Sub-tab pills: All Materials vs Private Shares */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
              <button
                type="button"
                onClick={() => setMaterialsSubTab('catalog')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                  materialsSubTab === 'catalog'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>All Materials ({materials.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setMaterialsSubTab('privateShares')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                  materialsSubTab === 'privateShares'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Private Shares</span>
              </button>
            </div>

            {materialsSubTab === 'privateShares' ? (
              <PrivateSharesManagement
                onOpenCreateShare={() => {
                  setMaterialsSubTab('catalog');
                  toast.info(
                    'Select a Material to Share',
                    'Click "Share Privately" next to any material in the table below to generate a private link.'
                  );
                }}
              />
            ) : (
              <>
            {/* Simple Filters Row */}
            <div className="bg-white p-3.5 rounded-lg border border-slate-200 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by title or filename..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900"
                  />
                </div>

                <select
                  value={filterSemester}
                  onChange={(e) => {
                    setFilterSemester(e.target.value);
                    setFilterSubject('');
                  }}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium focus:ring-2 focus:ring-blue-600"
                >
                  <option value="">All Semesters</option>
                  {semesters.map((sem) => (
                    <option key={sem.id} value={sem.id}>
                      {sem.name}
                    </option>
                  ))}
                </select>

                <select
                  value={filterSubject}
                  onChange={(e) => setFilterSubject(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium focus:ring-2 focus:ring-blue-600"
                >
                  <option value="">All Subjects</option>
                  {groupedSubjects
                    .filter((group) => {
                      if (!filterSemester) return true;
                      const targetSem = semesters.find((s) => s.id === filterSemester);
                      return targetSem ? group.semesterName === targetSem.name : true;
                    })
                    .map((group) => (
                      <optgroup key={group.semesterName} label={group.semesterName}>
                        {group.subjects.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.code} — {s.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                </select>

                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium focus:ring-2 focus:ring-blue-600"
                >
                  <option value="">All Material Types</option>
                  {MATERIAL_TYPE_OPTIONS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium focus:ring-2 focus:ring-blue-600"
                >
                  <option value="all">All Statuses</option>
                  <option value="published">Published</option>
                  <option value="drafts">Drafts Only</option>
                </select>
              </div>

              {(filterSemester || filterSubject || filterType || filterStatus !== 'all' || searchQuery) && (
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setFilterSemester('');
                      setFilterSubject('');
                      setFilterType('');
                      setFilterStatus('all');
                      setSearchQuery('');
                    }}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    Reset filters
                  </button>
                  <span className="text-slate-500">
                    Showing {filteredMaterials.length} of {materials.length} items
                  </span>
                </div>
              )}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block bg-white rounded-lg border border-slate-200 overflow-hidden">
              {loading ? (
                <div className="p-10 text-center text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                  <p className="text-xs">Loading materials...</p>
                </div>
              ) : filteredMaterials.length === 0 ? (
                <div className="p-10 text-center">
                  <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <h4 className="text-sm font-semibold text-slate-800">No Materials Found</h4>
                  <p className="text-xs text-slate-500 mt-1">Adjust your search or filters.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                        <th className="py-3 px-3.5">Title</th>
                        <th className="py-3 px-3.5">Subject</th>
                        <th className="py-3 px-3.5">Material Type</th>
                        <th className="py-3 px-3.5">PDF Filename</th>
                        <th className="py-3 px-3.5">Status</th>
                        <th className="py-3 px-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredMaterials.map((mat) => {
                        const subject = subjects.find((s) => s.id === mat.subjectId);
                        const typeOpt = MATERIAL_TYPE_OPTIONS.find((t) => t.id === mat.category);

                        return (
                          <tr key={mat.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3 px-3.5 max-w-xs">
                              <p className="font-semibold text-slate-900 text-xs sm:text-sm truncate">
                                {mat.title}
                              </p>
                              <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-500">
                                <span>{mat.academicYear}</span>
                                {mat.assignmentNumber && <span>&bull; Assignment #{mat.assignmentNumber}</span>}
                                {mat.experimentNumber && <span>&bull; Experiment #{mat.experimentNumber}</span>}
                                {mat.unitNumber && <span>&bull; Unit #{mat.unitNumber}</span>}
                              </div>
                            </td>

                            <td className="py-3 px-3.5">
                              <span className="font-mono text-[11px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                {subject ? subject.code : '—'}
                              </span>
                              <p className="text-[11px] text-slate-600 mt-0.5 truncate max-w-[150px]">
                                {subject ? subject.name : 'Unknown Subject'}
                              </p>
                            </td>

                            <td className="py-3 px-3.5">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                {typeOpt ? typeOpt.label : mat.category}
                              </span>
                            </td>

                            <td className="py-3 px-3.5">
                              <a
                                href={`/materials/${mat.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-slate-800 hover:text-blue-600 truncate max-w-[160px] block"
                                title={`Open Reader: ${mat.fileName}`}
                              >
                                {mat.fileName}
                              </a>
                              <p className="text-[11px] text-slate-400">
                                {formatFileSize(mat.fileSize)}
                              </p>
                            </td>

                            <td className="py-3 px-3.5">
                              <button
                                type="button"
                                onClick={() => handleTogglePublish(mat)}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
                                  mat.published
                                    ? 'bg-slate-100 text-slate-800 border border-slate-200'
                                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                                }`}
                                title="Click to toggle publish status"
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    mat.published ? 'bg-green-500' : 'bg-amber-500'
                                  }`}
                                />
                                <span>{mat.published ? 'Published' : 'Draft'}</span>
                              </button>
                            </td>

                            <td className="py-3 px-3.5 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setSharingMaterial(mat)}
                                  className="px-2.5 py-1 rounded-md text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors inline-flex items-center gap-1.5"
                                  title="Share Privately without recipient login"
                                >
                                  <Share2 className="w-3 h-3 text-blue-600" />
                                  <span>Share Privately</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setEditingMaterial(mat)}
                                  className="px-2.5 py-1 rounded-md text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5"
                                >
                                  <Edit2 className="w-3 h-3 text-slate-500" />
                                  <span>Edit</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setReplacingMaterial(mat)}
                                  className="px-2.5 py-1 rounded-md text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5"
                                >
                                  <FileCheck className="w-3 h-3 text-slate-500" />
                                  <span>Replace PDF</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteMaterial(mat)}
                                  className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                  title="Delete Material"
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

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
              {loading ? (
                <div className="p-8 text-center text-slate-400 bg-white rounded-lg border border-slate-200">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                  <p className="text-xs">Loading materials...</p>
                </div>
              ) : filteredMaterials.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-lg border border-slate-200">
                  <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <h4 className="text-sm font-semibold text-slate-800">No Materials Found</h4>
                </div>
              ) : (
                filteredMaterials.map((mat) => {
                  const subject = subjects.find((s) => s.id === mat.subjectId);
                  const typeOpt = MATERIAL_TYPE_OPTIONS.find((t) => t.id === mat.category);

                  return (
                    <div key={mat.id} className="bg-white p-4 rounded-lg border border-slate-200 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <h4 className="font-semibold text-sm text-slate-900 leading-snug">
                            {mat.title}
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {subject ? `${subject.code} — ${subject.name}` : mat.subjectId}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleTogglePublish(mat)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0 ${
                            mat.published
                              ? 'bg-slate-100 text-slate-800 border border-slate-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${mat.published ? 'bg-green-500' : 'bg-amber-500'}`} />
                          <span>{mat.published ? 'Published' : 'Draft'}</span>
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        <span className="px-2 py-0.5 rounded bg-slate-100 font-medium text-slate-700 border border-slate-200">
                          {typeOpt ? typeOpt.label : mat.category}
                        </span>
                        {mat.assignmentNumber && <span>Assign #{mat.assignmentNumber}</span>}
                        {mat.experimentNumber && <span>Exp #{mat.experimentNumber}</span>}
                        {mat.unitNumber && <span>Unit #{mat.unitNumber}</span>}
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                        <a
                          href={`/materials/${mat.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-800 hover:text-blue-600 font-medium truncate max-w-[180px]"
                        >
                          {mat.fileName}
                        </a>
                        <span className="text-slate-400 text-[11px]">{formatFileSize(mat.fileSize)}</span>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setSharingMaterial(mat)}
                          className="flex-1 min-h-[40px] inline-flex items-center justify-center py-2 px-2 bg-blue-50 text-blue-700 hover:bg-blue-100 active:bg-blue-200 rounded-lg text-xs font-semibold border border-blue-200 text-center gap-1.5"
                        >
                          <Share2 className="w-3.5 h-3.5 text-blue-600" />
                          <span>Share Privately</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setEditingMaterial(mat)}
                          className="flex-1 min-h-[40px] inline-flex items-center justify-center py-2 px-2 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100 rounded-lg text-xs font-semibold border border-slate-200 text-center"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => setReplacingMaterial(mat)}
                          className="flex-1 min-h-[40px] inline-flex items-center justify-center py-2 px-2 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100 rounded-lg text-xs font-semibold border border-slate-200 text-center"
                        >
                          Replace PDF
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteMaterial(mat)}
                          aria-label={`Delete ${mat.title}`}
                          className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center p-2 text-slate-400 hover:text-rose-600 bg-white border border-slate-200 hover:bg-rose-50 active:bg-rose-100 rounded-lg shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
              </>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* 3. UPLOAD MATERIAL TAB                                         */}
        {/* ============================================================== */}
        {activeTab === 'upload' && (
          <div className="max-w-3xl bg-white rounded-lg border border-slate-200 p-6 sm:p-8 space-y-6">
            <div className="border-b border-slate-200 pb-3">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Upload Material</h2>
              <p className="text-xs text-slate-500 mt-1">
                Add new study materials, assignments, or practicals to the semester curriculum.
              </p>
            </div>

            <form onSubmit={handleInlineUploadSubmit} className="space-y-4">
              {/* 3-column grid on desktop for Semester, Subject & Material Type */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Semester
                  </label>
                  <select
                    value={uploadSemesterId}
                    onChange={(e) => {
                      const semId = e.target.value;
                      setUploadSemesterId(semId);
                      if (semId) {
                        const targetSem = semesters.find((s) => s.id === semId);
                        const firstSub = subjects.find(
                          (s) =>
                            (s.semesterId && s.semesterId === semId) ||
                            (targetSem && (s.semesterNumber ?? 5) === targetSem.number)
                        );
                        if (firstSub) {
                          handleUploadSubjectChange(firstSub.id);
                        }
                      }
                    }}
                    className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900"
                  >
                    <option value="">All Semesters</option>
                    {semesters.map((sem) => (
                      <option key={sem.id} value={sem.id}>
                        {sem.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Subject *
                  </label>
                  <select
                    required
                    value={uploadSubjectId}
                    onChange={(e) => handleUploadSubjectChange(e.target.value)}
                    className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900"
                  >
                    {groupedSubjects
                      .filter((group) => {
                        if (!uploadSemesterId) return true;
                        const targetSem = semesters.find((s) => s.id === uploadSemesterId);
                        return targetSem ? group.semesterName === targetSem.name : true;
                      })
                      .map((group) => (
                        <optgroup key={group.semesterName} label={group.semesterName}>
                          {group.subjects.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.code} — {s.name}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Material Type *
                  </label>
                  <select
                    required
                    value={uploadType}
                    onChange={(e) => handleUploadTypeChange(e.target.value as AcademicCategory)}
                    className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900"
                  >
                    {MATERIAL_TYPE_OPTIONS.map((t) => (
                      <option
                        key={t.id}
                        value={t.id}
                        disabled={isUploadLab && t.id === 'assignments'}
                      >
                        {t.label} {isUploadLab && t.id === 'assignments' ? '(Labs host Practicals)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  required
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="e.g. Unit 1 Notes: Relational Database Architecture"
                  className="w-full text-sm px-3.5 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900 placeholder:text-slate-400"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  value={uploadDesc}
                  onChange={(e) => setUploadDesc(e.target.value)}
                  placeholder="Brief summary or instructions..."
                  className="w-full text-sm px-3.5 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900 placeholder:text-slate-400"
                />
              </div>

              {/* 2-column grid on desktop for Number & Year */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {uploadType === 'assignments'
                      ? 'Assignment Number (Optional)'
                      : uploadType === 'experiments'
                      ? 'Experiment Number (Optional)'
                      : 'Unit Number (Optional)'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={uploadNum}
                    onChange={(e) => setUploadNum(e.target.value)}
                    placeholder="e.g. 1"
                    className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Academic Year
                  </label>
                  <input
                    type="text"
                    value={uploadYear}
                    onChange={(e) => setUploadYear(e.target.value)}
                    placeholder="2026-27"
                    className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900"
                  />
                </div>
              </div>

              {/* Study Material File Upload */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Study Material File (Max 50 MB) *
                </label>
                <div className="border border-dashed border-slate-300 rounded-lg p-5 text-center bg-white hover:border-slate-400 transition-colors">
                  <input
                    type="file"
                    id="inline-pdf-upload"
                    accept={ACCEPTED_FILE_EXTENSIONS}
                    onChange={handleUploadFileChange}
                    className="hidden"
                    disabled={isUploading}
                  />
                  <label htmlFor="inline-pdf-upload" className="cursor-pointer block">
                    <Upload className="w-5 h-5 text-slate-400 mx-auto mb-1.5" />
                    <p className="text-xs font-medium text-slate-800">
                      {uploadFile ? `Selected: ${uploadFile.name}` : 'Click to select a file from your computer'}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {uploadFile ? `Size: ${formatFileSize(uploadFile.size)}` : 'Supports PDF, Word, Excel, PowerPoint, Text, RTF, Images, and ZIP archives'}
                    </p>
                  </label>
                </div>

                {uploadFile && (
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-700 bg-slate-50 px-3 py-1.5 rounded-md border border-slate-200">
                    <span>File: <strong>{uploadFile.name}</strong></span>
                    <button
                      type="button"
                      onClick={() => setUploadFile(null)}
                      className="text-rose-600 font-medium hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              {/* Upload Progress Bar */}
              {uploadProgress !== null && (
                <div className="space-y-1.5 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center justify-between text-xs font-medium text-slate-800">
                    <span>
                      Uploading file...{' '}
                      {uploadTotalBytes > 0 && `(${formatFileSize(uploadBytesTransferred)} / ${formatFileSize(uploadTotalBytes)})`}
                    </span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Publication Status */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <p className="text-xs font-medium text-slate-900">Publication Status</p>
                  <p className="text-[11px] text-slate-500">
                    {uploadPublished ? 'Visible to students immediately.' : 'Saved as draft.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setUploadPublished(!uploadPublished)}
                  className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors ${
                    uploadPublished
                      ? 'bg-white text-slate-800 border-slate-300 shadow-sm'
                      : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}
                >
                  {uploadPublished ? 'Published' : 'Draft'}
                </button>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveTab('materials')}
                  disabled={isUploading}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isUploading || !uploadFile}
                  className="px-5 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{isUploading ? 'Uploading...' : 'Upload Material'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ============================================================== */}
        {/* 4. MANAGE SEMESTERS TAB                                        */}
        {/* ============================================================== */}
        {activeTab === 'semesters' && (
          <SubjectManager
            activeSection="semesters"
            subjects={subjects}
            semesters={semesters}
            materials={materials}
            onRefresh={refreshData}
            loading={loading}
            onNavigateToSubjects={() => setActiveTab('subjects')}
            onNavigateToMaterials={(subId) => {
              setFilterSubject(subId);
              setActiveTab('materials');
            }}
          />
        )}

        {/* ============================================================== */}
        {/* 5. MANAGE SUBJECTS TAB                                         */}
        {/* ============================================================== */}
        {activeTab === 'subjects' && (
          <SubjectManager
            activeSection="subjects"
            subjects={subjects}
            semesters={semesters}
            materials={materials}
            onRefresh={refreshData}
            loading={loading}
            onNavigateToSubjects={() => setActiveTab('subjects')}
            onNavigateToMaterials={(subId) => {
              setFilterSubject(subId);
              setActiveTab('materials');
            }}
          />
        )}

        {/* ============================================================== */}
        {/* 5. MAINTENANCE MODE TAB                                        */}
        {/* ============================================================== */}
        {activeTab === 'maintenance' && (
          <div className="max-w-2xl bg-white rounded-lg border border-slate-200 p-6 sm:p-8 space-y-6">
            <div className="border-b border-slate-200 pb-3">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Maintenance Mode</h2>
              <p className="text-xs text-slate-500 mt-1">
                Pause public access while performing curriculum maintenance or file updates.
              </p>
            </div>

            <div
              className={`p-4 rounded-xl border flex items-center gap-3.5 ${
                maintenanceMode
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  maintenanceMode ? 'bg-amber-200 text-amber-900' : 'bg-slate-200 text-slate-700'
                }`}
              >
                <Wrench className="w-5 h-5" />
              </div>

              <div>
                <h3 className="font-semibold text-sm">
                  {maintenanceMode ? 'Maintenance Mode is Active' : 'Public Website is Live'}
                </h3>
                <p className="text-xs mt-0.5 opacity-90 leading-relaxed">
                  {maintenanceMode
                    ? 'Public access is restricted to the maintenance notice. Authorized administrators retain full access.'
                    : 'CampusNotes is live and study materials are accessible to students.'}
                </p>
              </div>
            </div>

            <div>
              <button
                type="button"
                onClick={handleToggleMaintenance}
                disabled={isTogglingMaintenance}
                className={`w-full py-2.5 rounded-lg text-xs font-semibold text-white transition-colors flex items-center justify-center gap-2 ${
                  maintenanceMode
                    ? 'bg-slate-700 hover:bg-slate-800'
                    : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                <Wrench className="w-4 h-4" />
                <span>
                  {isTogglingMaintenance
                    ? 'Updating...'
                    : maintenanceMode
                    ? 'Disable Maintenance Mode'
                    : 'Enable Maintenance Mode'}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* 6. VISITOR ANALYTICS TAB                                       */}
        {/* ============================================================== */}
        {activeTab === 'analytics' && <VisitorAnalyticsSection />}

        {/* ============================================================== */}
        {/* 7. ADMIN ACTIVITY LOG TAB                                      */}
        {/* ============================================================== */}
        {activeTab === 'activity' && <AdminActivityLogSection />}

        {/* ============================================================== */}
        {/* 8. WEBSITE HEALTH MONITOR TAB                                  */}
        {/* ============================================================== */}
        {activeTab === 'health' && <WebsiteHealthSection />}
      </main>

      {/* Modals */}
      <MaterialFormModal
        isOpen={Boolean(editingMaterial)}
        onClose={() => setEditingMaterial(null)}
        subjects={subjects}
        semesters={semesters}
        editingMaterial={editingMaterial}
        onSuccess={async () => {
          await refreshData();
        }}
      />

      <ReplacePdfModal
        isOpen={Boolean(replacingMaterial)}
        onClose={() => setReplacingMaterial(null)}
        material={replacingMaterial}
        onSuccess={async () => {
          await refreshData();
        }}
      />

      <SharePrivatelyModal
        isOpen={Boolean(sharingMaterial)}
        onClose={() => setSharingMaterial(null)}
        material={sharingMaterial}
      />

      <Modal
        isOpen={passwordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
        title="Update Administrator Password"
        description="Change administrator credentials."
      >
        <form onSubmit={handleUpdatePassword} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              New Password *
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={newPasswordInput}
              onChange={(e) => setNewPasswordInput(e.target.value)}
              placeholder="Minimum 6 characters"
              className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setPasswordModalOpen(false)}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUpdatingPassword}
              className="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
            >
              {isUpdatingPassword ? 'Updating...' : 'Save Password'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
