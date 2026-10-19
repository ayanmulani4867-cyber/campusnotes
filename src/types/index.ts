// Strict Academic Scope: CSE Semester 5 ONLY

export type AcademicCategory =
  | 'notes'
  | 'assignments'
  | 'experiments'
  | 'pyq'
  | 'question-banks'
  | 'syllabus'
  | 'reference';

export interface CategoryInfo {
  id: AcademicCategory;
  name: string;
  shortName: string;
  description: string;
  icon: string;
  badgeColor: string;
}

export const CATEGORIES: CategoryInfo[] = [
  {
    id: 'notes',
    name: 'Lecture Notes',
    shortName: 'Notes',
    description: 'Unit-wise theory notes, lecture slides, and handwritten summaries prepared for Semester 5.',
    icon: 'BookOpen',
    badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  {
    id: 'assignments',
    name: 'Assignments',
    shortName: 'Assignments',
    description: 'Weekly assignments, problem sets, and tutorial sheets with problem statements.',
    icon: 'FileSpreadsheet',
    badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  {
    id: 'experiments',
    name: 'Experiments / Practicals',
    shortName: 'Practicals',
    description: 'Lab manuals, experiment write-ups, source code listings, and viva guidelines.',
    icon: 'FlaskConical',
    badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  {
    id: 'pyq',
    name: 'Previous Year Questions (PYQs)',
    shortName: 'PYQs',
    description: 'Mid-term and end-semester university examination papers from previous academic years.',
    icon: 'FileQuestion',
    badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  {
    id: 'question-banks',
    name: 'Question Banks',
    shortName: 'Question Banks',
    description: 'Curated question banks, important exam questions, and sample question banks.',
    icon: 'HelpCircle',
    badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  {
    id: 'syllabus',
    name: 'Syllabus & Course Outcomes',
    shortName: 'Syllabus',
    description: 'Official university syllabus, course curriculum, marks distribution, and text references.',
    icon: 'GraduationCap',
    badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  {
    id: 'reference',
    name: 'Reference Materials',
    shortName: 'Reference',
    description: 'Standard textbook chapters, cheatsheets, research whitepapers, and reference guides.',
    icon: 'Library',
    badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
  },
];

export const MATERIAL_TYPE_OPTIONS: { id: AcademicCategory; label: string }[] = [
  { id: 'notes', label: 'Notes' },
  { id: 'assignments', label: 'Assignment' },
  { id: 'experiments', label: 'Experiment / Practical' },
  { id: 'pyq', label: 'Previous Year Questions (PYQs)' },
  { id: 'question-banks', label: 'Question Bank' },
  { id: 'syllabus', label: 'Syllabus' },
  { id: 'reference', label: 'Reference Material' },
];

/**
 * Returns true if the subject is an official Laboratory course
 * (e.g. 23CS3504, 23CS3505, 23CS3506). Laboratory courses host Experiments, not Assignments.
 */
export function isLabSubject(subject?: { code?: string; name?: string } | null): boolean {
  if (!subject) return false;
  const code = (subject.code || '').trim().toUpperCase();
  const name = (subject.name || '').toLowerCase();
  return (
    code === '23CS3504' ||
    code === '23CS3505' ||
    code === '23CS3506' ||
    name.includes('laboratory') ||
    name.includes(' lab')
  );
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  description?: string;
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface StudyMaterial {
  id: string;
  title: string;
  description: string;
  subjectId: string;
  category: AcademicCategory;
  academicYear: string; // e.g. "2024-25", "2025-26", "2026-27"
  unitNumber?: number | null;
  assignmentNumber?: number | null;
  experimentNumber?: number | null;
  tags?: string[];
  fileName: string;
  storagePath: string;
  downloadUrl: string;
  blobId?: string; // Reference to RTDB /file_blobs/{blobId}
  fileSize: number; // in bytes
  published: boolean;
  createdAt: number;
  updatedAt: number;
  createdBy?: string;
}

export interface FileBlobRecord {
  blob_id: string;
  material_id: string;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  data_base64: string;
  published: boolean;
  created_at: number;
}

export interface MaterialFilterState {
  searchQuery: string;
  subjectId: string;
  category: string;
  academicYear: string;
  sortBy: 'newest' | 'oldest' | 'title' | 'size';
}

export interface AdminUser {
  uid: string;
  email: string | null;
  displayName?: string | null;
  isAuthorizedAdmin: boolean;
  isDevelopmentDefault?: boolean;
  requiresPasswordChange?: boolean;
}

export interface DashboardStats {
  totalMaterials: number;
  publishedCount: number;
  unpublishedCount: number;
  totalSubjects: number;
  categoryCounts: Record<AcademicCategory, number>;
}

export * from './adminFeatures';

