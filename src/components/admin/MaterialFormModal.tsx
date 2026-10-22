import React, { useState, useEffect, useMemo } from 'react';
import {
  Upload,
  FileText,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import {
  StudyMaterial,
  Subject,
  AcademicCategory,
  MATERIAL_TYPE_OPTIONS,
  isLabSubject,
} from '../../types';
import {
  uploadPdfFile,
  createMaterial,
  updateMaterial,
  replaceMaterialPdf,
  MAX_FILE_SIZE_BYTES,
} from '../../services/firebaseService';
import { formatFileSize } from '../materials/MaterialCard';
import { Modal } from '../common/Modal';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { activityLogService } from '../../services/activityLogService';

interface MaterialFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: Subject[];
  semesters?: import('../../types').Semester[];
  editingMaterial?: StudyMaterial | null;
  onSuccess: () => Promise<void>;
}

export const MaterialFormModal: React.FC<MaterialFormModalProps> = ({
  isOpen,
  onClose,
  subjects,
  semesters = [],
  editingMaterial,
  onSuccess,
}) => {
  const toast = useToast();
  const { admin } = useAuth();

  const isEdit = Boolean(editingMaterial);

  const [selectedSemesterFilter, setSelectedSemesterFilter] = useState<string>('all');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [category, setCategory] = useState<AcademicCategory>('notes');
  const [academicYear, setAcademicYear] = useState('2026-27');
  const [unitNumber, setUnitNumber] = useState<string>('');
  const [assignmentNumber, setAssignmentNumber] = useState<string>('');
  const [experimentNumber, setExperimentNumber] = useState<string>('');
  const [tagsInput, setTagsInput] = useState('');
  const [published, setPublished] = useState(true);

  // File state (new upload OR replacement file during edit)
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [bytesUploaded, setBytesUploaded] = useState<number>(0);
  const [totalFileBytes, setTotalFileBytes] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Active subject object to detect laboratory courses
  const currentSubject = subjects.find((s) => s.id === subjectId) || null;
  const isSelectedLab = isLabSubject(currentSubject);

  // Group subjects by semester for organized display
  const groupedSubjects = useMemo(() => {
    const map = new Map<number, Subject[]>();
    for (const s of subjects) {
      const semNum = s.semesterNumber ?? 5;
      if (!map.has(semNum)) map.set(semNum, []);
      map.get(semNum)!.push(s);
    }
    const sortedKeys = Array.from(map.keys()).sort((a, b) => a - b);
    return sortedKeys.map((semNum) => ({
      semesterName: `Semester ${semNum}`,
      subjects: map.get(semNum)!,
    }));
  }, [subjects]);

  const displayGroupedSubjects = useMemo(() => {
    if (selectedSemesterFilter === 'all') {
      return groupedSubjects;
    }
    const targetSemNum = Number(selectedSemesterFilter);
    const filtered = groupedSubjects.filter((g) => g.semesterName === `Semester ${targetSemNum}`);
    return filtered.length > 0 ? filtered : groupedSubjects;
  }, [groupedSubjects, selectedSemesterFilter]);

  useEffect(() => {
    if (editingMaterial) {
      setTitle(editingMaterial.title);
      setDescription(editingMaterial.description || '');
      setSubjectId(editingMaterial.subjectId);
      setCategory(editingMaterial.category);
      setAcademicYear(editingMaterial.academicYear || '2026-27');
      setUnitNumber(
        editingMaterial.unitNumber !== undefined && editingMaterial.unitNumber !== null
          ? String(editingMaterial.unitNumber)
          : ''
      );
      setAssignmentNumber(
        editingMaterial.assignmentNumber !== undefined &&
          editingMaterial.assignmentNumber !== null
          ? String(editingMaterial.assignmentNumber)
          : ''
      );
      setExperimentNumber(
        editingMaterial.experimentNumber !== undefined &&
          editingMaterial.experimentNumber !== null
          ? String(editingMaterial.experimentNumber)
          : ''
      );
      setTagsInput(editingMaterial.tags ? editingMaterial.tags.join(', ') : '');
      setPublished(editingMaterial.published);
      setSelectedFile(null);
    } else {
      // Default reset
      setTitle('');
      setDescription('');
      setSubjectId(subjects.length > 0 ? subjects[0].id : '');
      setCategory('notes');
      setAcademicYear('2026-27');
      setUnitNumber('');
      setAssignmentNumber('');
      setExperimentNumber('');
      setTagsInput('');
      setPublished(true);
      setSelectedFile(null);
    }
    setUploadProgress(null);
  }, [editingMaterial, subjects, isOpen]);

  // When switching to a lab subject, prevent 'assignments' category
  const handleSubjectChange = (newSubjectId: string) => {
    setSubjectId(newSubjectId);
    const sub = subjects.find((s) => s.id === newSubjectId);
    if (isLabSubject(sub) && category === 'assignments') {
      setCategory('experiments');
      toast.info(
        'Laboratory Course Selected',
        'Laboratory courses host Experiments / Practicals rather than Assignments.'
      );
    }
  };

  const handleCategoryChange = (newCat: AcademicCategory) => {
    if (isSelectedLab && newCat === 'assignments') {
      toast.error(
        'Invalid Category for Laboratory',
        'Laboratory courses (23CS3504, 23CS3505, 23CS3506) host Experiments / Practicals, not Assignments.'
      );
      setCategory('experiments');
      return;
    }
    setCategory(newCat);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Invalid File Type', 'Only PDF files (.pdf) are permitted.');
      e.target.value = '';
      setSelectedFile(null);
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error(
        'File Exceeds Limit',
        `File size (${formatFileSize(file.size)}) exceeds maximum allowed size of 25 MB.`
      );
      e.target.value = '';
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error('Validation Error', 'Please enter a title for the material.');
      return;
    }
    if (!subjectId) {
      toast.error('Validation Error', 'Please select a subject from the dropdown.');
      return;
    }
    if (!isEdit && !selectedFile) {
      toast.error('Validation Error', 'Please select a valid PDF file (max 25 MB).');
      return;
    }

    // Lab subject academic integrity check
    if (isSelectedLab && category === 'assignments') {
      toast.error(
        'Academic Distribution Protection',
        'Assignments cannot be created for laboratory subjects. Please select "Experiment / Practical".'
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const parsedUnit = unitNumber.trim() ? parseInt(unitNumber.trim(), 10) : null;
      const parsedAssign =
        assignmentNumber.trim() ? parseInt(assignmentNumber.trim(), 10) : null;
      const parsedExp =
        experimentNumber.trim() ? parseInt(experimentNumber.trim(), 10) : null;
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      if (isEdit && editingMaterial) {
        // Edit flow
        const updates: Partial<StudyMaterial> = {
          title: title.trim(),
          description: description.trim(),
          subjectId,
          category,
          academicYear,
          unitNumber: parsedUnit,
          assignmentNumber: parsedAssign,
          experimentNumber: parsedExp,
          tags,
          published,
        };

        if (selectedFile) {
          // Both metadata edit AND replacement PDF in one form
          await replaceMaterialPdf(
            editingMaterial,
            selectedFile,
            updates,
            (percent, transferred, total) => {
              setUploadProgress(percent);
              setBytesUploaded(transferred);
              setTotalFileBytes(total);
            }
          );
          await activityLogService.logActivity({
            adminEmail: admin?.email,
            adminUid: admin?.uid,
            action: 'PDF_REPLACE',
            resourceId: editingMaterial.id,
            resourceName: updates.title || editingMaterial.title,
            result: 'SUCCESS',
            metadata: {
              newFileName: selectedFile.name,
              newFileSize: selectedFile.size,
              category: updates.category || editingMaterial.category,
            },
          });
          toast.success('PDF Replaced Successfully', 'PDF replaced successfully.');
        } else {
          // Metadata-only edit
          await updateMaterial(editingMaterial.id, updates, editingMaterial);
          await activityLogService.logActivity({
            adminEmail: admin?.email,
            adminUid: admin?.uid,
            action: 'MATERIAL_UPDATE',
            resourceId: editingMaterial.id,
            resourceName: updates.title || editingMaterial.title,
            result: 'SUCCESS',
            metadata: {
              category: updates.category || editingMaterial.category,
              published: updates.published !== undefined ? updates.published : editingMaterial.published,
            },
          });
          toast.success(
            'Material Updated',
            `Material updated successfully.`
          );
        }

        onClose();
        await onSuccess();
      } else {
        // New Material Upload flow
        if (!selectedFile) return;

        const materialId = `mat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

        // 1. Upload to Realtime Database
        const uploadResult = await uploadPdfFile(
          selectedFile,
          subjectId,
          materialId,
          (percent, transferred, total) => {
            setUploadProgress(percent);
            setBytesUploaded(transferred);
            setTotalFileBytes(total);
          },
          published
        );

        // 2. Save metadata to RTDB
        await createMaterial({
          id: materialId,
          title: title.trim(),
          description: description.trim(),
          subjectId,
          category,
          academicYear,
          unitNumber: parsedUnit,
          assignmentNumber: parsedAssign,
          experimentNumber: parsedExp,
          tags,
          fileName: uploadResult.fileName,
          storagePath: uploadResult.storagePath,
          downloadUrl: uploadResult.downloadUrl,
          blobId: uploadResult.blobId,
          storageProvider: uploadResult.storageProvider,
          r2Key: uploadResult.r2Key,
          r2Url: uploadResult.r2Url,
          fileSize: uploadResult.fileSize,
          published,
          createdBy: admin?.uid || 'admin',
        });

        await activityLogService.logActivity({
          adminEmail: admin?.email,
          adminUid: admin?.uid,
          action: 'MATERIAL_UPLOAD',
          resourceId: materialId,
          resourceName: title.trim(),
          result: 'SUCCESS',
          metadata: {
            fileName: uploadResult.fileName,
            fileSize: uploadResult.fileSize,
            category,
            subjectId,
            published,
          },
        });

        toast.success(
          'Upload Complete',
          `Material uploaded successfully.`
        );
        onClose();
        await onSuccess();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('PERMISSION_DENIED') || msg.includes('Permission denied')) {
        toast.error('Permission Denied', 'Database write was denied. Please ensure database.rules.json is published in Firebase Console -> Realtime Database -> Rules.');
      } else {
        toast.error('Operation Failed', msg);
      }
    } finally {
      setIsSubmitting(false);
      setUploadProgress(null);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !isSubmitting && onClose()}
      title={isEdit ? 'Edit Material & Replace PDF' : 'Upload Study Material'}
      description={
        isEdit
          ? 'Update material details or select a new PDF to replace the current document.'
          : 'Upload a study document with subject and type for CSE Semester 5.'
      }
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Semester, Subject & Material Type Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Semester
            </label>
            <select
              value={selectedSemesterFilter}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedSemesterFilter(val);
                if (val !== 'all') {
                  const targetNum = Number(val);
                  const firstMatch = subjects.find(
                    (s) => (s.semesterNumber ?? 5) === targetNum
                  );
                  if (firstMatch) {
                    handleSubjectChange(firstMatch.id);
                  }
                }
              }}
              className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900"
            >
              <option value="all">All Semesters</option>
              {semesters.length > 0
                ? semesters.map((sem) => (
                    <option key={sem.id} value={String(sem.number)}>
                      {sem.name}
                    </option>
                  ))
                : groupedSubjects.map((g) => {
                    const num = g.semesterName.replace('Semester ', '');
                    return (
                      <option key={g.semesterName} value={num}>
                        {g.semesterName}
                      </option>
                    );
                  })}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Subject *
            </label>
            <select
              required
              value={subjectId}
              onChange={(e) => handleSubjectChange(e.target.value)}
              className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900"
            >
              {(selectedSemesterFilter === 'all' ? groupedSubjects : displayGroupedSubjects).map((group) => (
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
              value={category}
              onChange={(e) => handleCategoryChange(e.target.value as AcademicCategory)}
              className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900"
            >
              {MATERIAL_TYPE_OPTIONS.map((t) => (
                <option
                  key={t.id}
                  value={t.id}
                  disabled={isSelectedLab && t.id === 'assignments'}
                >
                  {t.label} {isSelectedLab && t.id === 'assignments' ? '(Labs host Practicals)' : ''}
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
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Assignment 1: Multithreading & Synchronization, or Unit 1 Notes"
            className="w-full text-sm px-3.5 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white text-slate-900 placeholder:text-slate-400"
          />
        </div>

        {/* Description (Optional) */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Description (Optional)
          </label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief overview, problem statements, or instructions for students..."
            className="w-full text-sm px-3.5 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white text-slate-900 placeholder:text-slate-400"
          />
        </div>

        {/* Dynamic Number Field based on Material Type + Academic Year */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Academic Year
            </label>
            <input
              type="text"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              placeholder="2026-27"
              className="w-full min-h-[42px] text-sm px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900"
            />
          </div>

          {category === 'assignments' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Assignment # (1–6)
              </label>
              <input
                type="number"
                min="1"
                max="20"
                value={assignmentNumber}
                onChange={(e) => setAssignmentNumber(e.target.value)}
                placeholder="1"
                className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900"
              />
            </div>
          )}

          {category === 'experiments' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Experiment # (1–12)
              </label>
              <input
                type="number"
                min="1"
                max="25"
                value={experimentNumber}
                onChange={(e) => setExperimentNumber(e.target.value)}
                placeholder="1"
                className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900"
              />
            </div>
          )}

          {category === 'notes' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Unit # (Optional)
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={unitNumber}
                onChange={(e) => setUnitNumber(e.target.value)}
                placeholder="1"
                className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Search Tags (Optional)
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g. Unit 1, Solved, Lab"
              className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900 placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Current PDF Details & Preview (When in Edit mode) */}
        {isEdit && editingMaterial && (
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">
                Current PDF Document
              </span>
              <a
                href={`/materials/${editingMaterial.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
              >
                <span>Open Document Reader</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <span className="font-mono truncate max-w-sm">
                {editingMaterial.fileName}
              </span>
              <span className="text-slate-400">({formatFileSize(editingMaterial.fileSize)})</span>
            </div>
          </div>
        )}

        {/* Replacement PDF Selection (In Edit mode) OR Primary PDF (In New mode) */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            {isEdit
              ? 'Select Replacement PDF (Optional)'
              : 'Select PDF Document (Max 6 MB) *'}
          </label>
          {isEdit && (
            <p className="text-[11px] text-slate-500 mb-2">
              Leave empty to keep current file. Selecting a new PDF replaces the file safely in Realtime Database upon save.
            </p>
          )}

          <div className="border border-dashed border-slate-300 rounded-lg p-4 text-center hover:border-slate-400 transition-colors bg-white">
            <input
              type="file"
              id="material-pdf-upload"
              accept=".pdf,application/pdf"
              onChange={handleFileChange}
              className="hidden"
              disabled={isSubmitting}
            />
            <label htmlFor="material-pdf-upload" className="cursor-pointer block">
              <Upload className="w-5 h-5 text-slate-400 mx-auto mb-1.5" />
              <p className="text-xs font-medium text-slate-800">
                {selectedFile
                  ? `Selected: ${selectedFile.name}`
                  : isEdit
                  ? 'Click to choose replacement PDF file'
                  : 'Click to select PDF document'}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {selectedFile
                  ? `File size: ${formatFileSize(selectedFile.size)}`
                  : 'PDF format (.pdf) up to 6 MB for Realtime Database storage'}
              </p>
            </label>
          </div>

          {selectedFile && (
            <div className="mt-1.5 flex items-center justify-between text-xs text-slate-800 bg-slate-50 px-3 py-1.5 rounded-md border border-slate-200">
              <span className="truncate max-w-[80%]">
                {isEdit ? 'Ready to replace with: ' : 'Selected file: '}
                <strong>{selectedFile.name}</strong> ({formatFileSize(selectedFile.size)})
              </span>
              <button
                type="button"
                onClick={() => setSelectedFile(null)}
                className="text-xs font-medium text-rose-600 hover:underline shrink-0"
              >
                Clear Selection
              </button>
            </div>
          )}
        </div>

        {/* Upload Progress Bar */}
        {uploadProgress !== null && (
          <div className="space-y-1.5 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center justify-between text-xs font-medium text-slate-800">
              <span>Uploading to Realtime Database...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-500 font-medium">
              <span>Transferred: {formatFileSize(bytesUploaded)}</span>
              <span>Total: {formatFileSize(totalFileBytes)}</span>
            </div>
          </div>
        )}

        {/* Publication Status Toggle */}
        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
          <div>
            <p className="text-xs font-medium text-slate-900">Publication Status</p>
            <p className="text-[11px] text-slate-500">
              {published
                ? 'Published: Visible immediately on the public website.'
                : 'Draft: Saved in admin dashboard only, hidden from public.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPublished(!published)}
            className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors ${
              published
                ? 'bg-white text-slate-800 border-slate-300 shadow-sm'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
          >
            {published ? 'Published' : 'Draft'}
          </button>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-full sm:w-auto min-h-[42px] px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 text-center"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || (!isEdit && !selectedFile)}
            className="w-full sm:w-auto min-h-[42px] px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {isSubmitting ? (
              <span>Uploading...</span>
            ) : isEdit ? (
              <span>Save Changes</span>
            ) : (
              <span>Upload Material</span>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
