import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Upload,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowLeft,
  X,
  FileCheck,
} from 'lucide-react';
import { Semester, Subject, SubmissionCategory } from '../types';
import {
  subscribeToPublicSemesters,
  subscribeToPublicSubjects,
  DEFAULT_INITIAL_SEMESTERS,
  MAX_FILE_SIZE_BYTES,
} from '../services/firebaseService';
import {
  validateClientFile,
  ACCEPTED_FILE_EXTENSIONS,
  getFileFormatInfo,
} from '../utils/fileTypes';
import { formatFileSize } from '../components/materials/MaterialCard';
import { submitStudentContribution } from '../services/contributionService';
import { useToast } from '../context/ToastContext';

const CONTRIBUTION_CATEGORIES: { id: SubmissionCategory; label: string }[] = [
  { id: 'notes', label: 'Notes' },
  { id: 'assignments', label: 'Assignments' },
  { id: 'experiments', label: 'Practical Experiments' },
  { id: 'pyq', label: 'Question Papers' },
  { id: 'presentations', label: 'Presentations' },
  { id: 'other', label: 'Other Study Materials' },
];

export const ContributePage: React.FC = () => {
  const toast = useToast();

  const [semesters, setSemesters] = useState<Semester[]>(() =>
    DEFAULT_INITIAL_SEMESTERS.filter((s) => s.active !== false)
  );
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Form inputs
  const [studentName, setStudentName] = useState('');
  const [email, setEmail] = useState('');
  const [college, setCollege] = useState('');
  const [materialTitle, setMaterialTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedSemesterId, setSelectedSemesterId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<SubmissionCategory>('notes');

  // Anti-spam & honeypot
  const [honeypot, setHoneypot] = useState('');
  const formMountTimeRef = useRef<number>(Date.now());

  // File & upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [bytesUploaded, setBytesUploaded] = useState(0);
  const [totalFileBytes, setTotalFileBytes] = useState(0);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Subscribe to real-time semesters and subjects
  useEffect(() => {
    formMountTimeRef.current = Date.now();
    let isMounted = true;

    const unsubSems = subscribeToPublicSemesters((data) => {
      if (!isMounted) return;
      const activeSems = data.filter((s) => s.active !== false);
      setSemesters(activeSems);
      if (activeSems.length > 0 && !selectedSemesterId) {
        setSelectedSemesterId(activeSems[0].id);
      }
    });

    const unsubSubs = subscribeToPublicSubjects((data) => {
      if (!isMounted) return;
      setSubjects(data);
      setLoadingInitial(false);
    });

    return () => {
      isMounted = false;
      unsubSems();
      unsubSubs();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Filter subjects by selected semester
  const availableSubjects = useMemo(() => {
    if (!selectedSemesterId) return subjects;
    return subjects.filter((s) => s.semesterId === selectedSemesterId);
  }, [subjects, selectedSemesterId]);

  // Set default subject when semester or subjects change
  useEffect(() => {
    if (availableSubjects.length > 0) {
      const exists = availableSubjects.some((s) => s.id === selectedSubjectId);
      if (!exists) {
        setSelectedSubjectId(availableSubjects[0].id);
      }
    } else {
      setSelectedSubjectId('');
    }
  }, [availableSubjects, selectedSubjectId]);

  const handleFileSelect = async (file: File) => {
    setErrorMessage(null);
    const validation = await validateClientFile(file, MAX_FILE_SIZE_BYTES);
    if (!validation.valid) {
      setErrorMessage(validation.error || 'Invalid file format or size.');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setSelectedFile(file);
    if (!materialTitle) {
      const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setMaterialTitle(baseName.charAt(0).toUpperCase() + baseName.slice(1));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await handleFileSelect(files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (honeypot) {
      setErrorMessage('Automated submission rejected.');
      return;
    }

    if (!studentName.trim()) {
      setErrorMessage('Please provide your name.');
      return;
    }

    if (!materialTitle.trim()) {
      setErrorMessage('Please provide a title for the material.');
      return;
    }

    if (!selectedSemesterId) {
      setErrorMessage('Please select a semester.');
      return;
    }

    if (!selectedSubjectId) {
      setErrorMessage('Please select a subject.');
      return;
    }

    if (!selectedFile) {
      setErrorMessage('Please select a file to upload.');
      return;
    }

    try {
      setIsSubmitting(true);
      setUploadProgress(0);
      setBytesUploaded(0);
      setTotalFileBytes(selectedFile.size);

      abortControllerRef.current = new AbortController();

      await submitStudentContribution(
        {
          studentName: studentName.trim(),
          email: email.trim() || undefined,
          college: college.trim() || undefined,
          materialTitle: materialTitle.trim(),
          description: description.trim() || undefined,
          semesterId: selectedSemesterId,
          subjectId: selectedSubjectId,
          category: selectedCategory,
          honeypot: honeypot || undefined,
          formStartTime: formMountTimeRef.current,
        },
        selectedFile,
        (percent, bytesTransferred, total) => {
          setUploadProgress(percent);
          setBytesUploaded(bytesTransferred);
          setTotalFileBytes(total);
        },
        abortControllerRef.current.signal
      );

      setSubmissionSuccess(true);
      toast.success(
        'Submission Received',
        'Thank you for contributing! Your material has been submitted for review.'
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
      toast.error('Submission Failed', msg);
    } finally {
      setIsSubmitting(false);
      abortControllerRef.current = null;
    }
  };

  const handleResetForm = () => {
    setSubmissionSuccess(false);
    setSelectedFile(null);
    setUploadProgress(null);
    setBytesUploaded(0);
    setTotalFileBytes(0);
    setErrorMessage(null);
    setMaterialTitle('');
    setDescription('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    formMountTimeRef.current = Date.now();
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10 w-full space-y-6">
      {/* Back to Home Link */}
      <div>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </Link>
      </div>

      {/* Page Heading */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
          Contribute Study Materials
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-slate-500">
          Share your study materials with fellow students. Submissions are reviewed before publishing.
        </p>
      </div>

      {/* Main Content Area */}
      {submissionSuccess ? (
        /* Clean Success State */
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-6 sm:p-10 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Material Submitted Successfully!
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
              Thank you for contributing to CampusNotes! Your material has been submitted successfully. It will become available after administrator approval.
            </p>
          </div>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleResetForm}
              className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Upload className="w-4 h-4" />
              <span>Contribute Another Material</span>
            </button>
            <Link
              to="/"
              className="w-full sm:w-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-semibold rounded-lg transition-colors flex items-center justify-center"
            >
              <span>Return to Homepage</span>
            </Link>
          </div>
        </div>
      ) : (
        /* Simplified Contribution Form */
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-5 sm:p-7">
          {/* Error Message Alert */}
          {errorMessage && (
            <div className="mb-5 p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs text-rose-800">
                <p className="font-semibold">Unable to submit material</p>
                <p className="mt-0.5 leading-relaxed">{errorMessage}</p>
              </div>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-rose-400 hover:text-rose-600 p-0.5"
                aria-label="Dismiss error"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Invisible Honeypot for Bot Protection */}
            <input
              type="text"
              name="website_url"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              className="hidden"
              aria-hidden="true"
            />

            {/* 1. Contributor Details */}
            <div className="space-y-3">
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Contributor Details
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Your Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-transparent transition bg-white"
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Email Address <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. rahul@example.com"
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-transparent transition bg-white"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    College / Department <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={college}
                    onChange={(e) => setCollege(e.target.value)}
                    placeholder="e.g. Computer Science & Engineering"
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-transparent transition bg-white"
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </div>

            {/* 2. Material Details */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Material Details
              </h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Material Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={materialTitle}
                    onChange={(e) => setMaterialTitle(e.target.value)}
                    placeholder="e.g. Operating Systems Unit 3 Virtual Memory Notes"
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-transparent transition bg-white"
                    disabled={isSubmitting}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Semester <span className="text-rose-500">*</span>
                    </label>
                    <select
                      required
                      value={selectedSemesterId}
                      onChange={(e) => setSelectedSemesterId(e.target.value)}
                      className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
                      disabled={isSubmitting || semesters.length === 0}
                    >
                      {semesters.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Subject <span className="text-rose-500">*</span>
                    </label>
                    <select
                      required
                      value={selectedSubjectId}
                      onChange={(e) => setSelectedSubjectId(e.target.value)}
                      className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
                      disabled={isSubmitting || availableSubjects.length === 0}
                    >
                      {availableSubjects.map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.code ? `${sub.code} - ` : ''}
                          {sub.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Category <span className="text-rose-500">*</span>
                    </label>
                    <select
                      required
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value as SubmissionCategory)}
                      className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
                      disabled={isSubmitting}
                    >
                      {CONTRIBUTION_CATEGORIES.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Description <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief overview of topics or chapters covered..."
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-transparent transition bg-white resize-y"
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </div>

            {/* 3. Upload Material */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Upload Material <span className="text-rose-500">*</span>
                </label>
                <span className="text-[11px] text-slate-400">Max size: 50 MB</span>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_FILE_EXTENSIONS}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileSelect(f);
                }}
                className="hidden"
                disabled={isSubmitting}
              />

              {!selectedFile ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => !isSubmitting && fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                    isDragging
                      ? 'border-blue-500 bg-blue-50/40'
                      : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
                  }`}
                >
                  <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-2">
                    <Upload className="w-5 h-5" />
                  </div>
                  <p className="text-xs sm:text-sm font-semibold text-slate-800">
                    Click to choose a file or drag and drop here
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Supports PDF, DOC, DOCX, TXT, RTF, PPT, PPTX, XLS, XLSX, CSV, JPG, PNG, WEBP, ZIP (up to 50 MB)
                  </p>
                </div>
              ) : (
                <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                      <FileCheck className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-semibold text-slate-900 truncate">
                        {selectedFile.name}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {formatFileSize(selectedFile.size)} &bull; {getFileFormatInfo(selectedFile.name).label}
                      </p>
                    </div>
                  </div>
                  {!isSubmitting && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 px-2 py-1 rounded-md hover:bg-blue-50 transition-colors cursor-pointer"
                      >
                        Replace
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-200 transition-colors cursor-pointer"
                        aria-label="Remove file"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Upload Progress Bar */}
              {isSubmitting && uploadProgress !== null && (
                <div className="p-3 rounded-lg border border-blue-200 bg-blue-50/50 space-y-1.5">
                  <div className="flex justify-between items-center text-xs font-semibold text-blue-900">
                    <span className="flex items-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                      <span>Uploading study material...</span>
                    </span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-blue-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all duration-200"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>{formatFileSize(bytesUploaded)} transferred</span>
                    <span>Total: {formatFileSize(totalFileBytes)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* 4. Submission Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || !selectedFile}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white font-semibold text-xs sm:text-sm rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Uploading... ({uploadProgress ?? 0}%)</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Submit for Review</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
