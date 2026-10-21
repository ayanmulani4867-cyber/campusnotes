import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  Share2,
  Calendar,
  HardDrive,
  Hash,
  Tag,
  GraduationCap,
  Layers,
  Check,
  RefreshCw,
} from 'lucide-react';
import { StudyMaterial, Subject, CATEGORIES } from '../types';
import {
  getPublicMaterialById,
  getPublicSubjects,
  getPublicMaterialsBySubject,
  fetchPdfBlobUrl,
  downloadStudyMaterial,
} from '../services/firebaseService';
import { PdfViewer } from '../components/materials/PdfViewer';
import { MaterialCard, formatFileSize, formatDate } from '../components/materials/MaterialCard';
import { EmptyState } from '../components/common/EmptyState';
import { useToast } from '../context/ToastContext';
import { shareMaterial } from '../utils/shareUtils';
import { cacheService } from '../services/cacheService';

export const MaterialDetailPage: React.FC = () => {
  const { materialId } = useParams<{ materialId: string }>();
  const toast = useToast();

  // Instant lookup in cacheService to show note metadata on frame 1 without loading spinner
  const [material, setMaterial] = useState<StudyMaterial | null>(() => {
    if (!materialId) return null;
    const directCached = cacheService.get<StudyMaterial>(`material_${materialId}`);
    if (directCached) return directCached;
    const catalog =
      cacheService.get<StudyMaterial[]>('public_materials') ||
      cacheService.get<StudyMaterial[]>('public_materials_limit_150') ||
      cacheService.get<StudyMaterial[]>('public_materials_limit_100');
    if (catalog) {
      return catalog.find((m) => m.id === materialId) || null;
    }
    return null;
  });

  const [subject, setSubject] = useState<Subject | null>(() => {
    if (!materialId) return null;
    const note =
      cacheService.get<StudyMaterial>(`material_${materialId}`) ||
      (
        cacheService.get<StudyMaterial[]>('public_materials') ||
        cacheService.get<StudyMaterial[]>('public_materials_limit_150') ||
        []
      ).find((m) => m.id === materialId);
    if (note) {
      const subs = cacheService.get<Subject[]>('public_subjects');
      if (subs) {
        return subs.find((s) => s.id === note.subjectId) || null;
      }
    }
    return null;
  });

  const [relatedMaterials, setRelatedMaterials] = useState<StudyMaterial[]>([]);
  const [loading, setLoading] = useState<boolean>(() => {
    if (!materialId) return true;
    const directCached = cacheService.get<StudyMaterial>(`material_${materialId}`);
    if (directCached) return false;
    const catalog =
      cacheService.get<StudyMaterial[]>('public_materials') ||
      cacheService.get<StudyMaterial[]>('public_materials_limit_150') ||
      cacheService.get<StudyMaterial[]>('public_materials_limit_100');
    return !catalog || !catalog.some((m) => m.id === materialId);
  });
  const [downloading, setDownloading] = useState(false);
  const [downloadProgressText, setDownloadProgressText] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!materialId) return;
      try {
        const [mat, subs] = await Promise.all([
          getPublicMaterialById(materialId),
          getPublicSubjects(),
        ]);

        setMaterial(mat);

        if (mat) {
          const sub = subs.find((s) => s.id === mat.subjectId) || null;
          setSubject(sub);

          // Fetch related materials from same subject
          const related = await getPublicMaterialsBySubject(mat.subjectId);
          setRelatedMaterials(related.filter((r) => r.id !== mat.id).slice(0, 4));
        }
      } catch (err) {
        console.error('Error loading material details:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [materialId]);

  const handleShare = async () => {
    if (!material) return;
    const success = await shareMaterial(
      material,
      (title, msg) => {
        toast.success(title, msg);
      },
      subject || undefined
    );
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleDownload = async () => {
    if (!material || downloading) return;
    try {
      setDownloading(true);
      setDownloadProgressText('Starting download...');
      await downloadStudyMaterial(material, (status) => {
        setDownloadProgressText(status);
      });
      toast.success('Download Started', `"${material.fileName || material.title}" download initiated.`);
    } catch (err: unknown) {
      toast.error('Download Failed', err instanceof Error ? err.message : String(err));
    } finally {
      setDownloading(false);
      setDownloadProgressText('');
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <RefreshCw className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-3" />
        <p className="text-sm font-semibold text-slate-700">Loading study material...</p>
        <p className="text-xs text-slate-400 mt-1">Fetching metadata from Realtime Database</p>
      </div>
    );
  }

  if (!material) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <EmptyState
          icon="folder"
          title="Document Not Found"
          description="The requested study material may have been unpublished or removed by the administrator."
          actionText="Browse Study Materials"
          actionTo="/materials"
        />
      </div>
    );
  }

  const categoryMeta = CATEGORIES.find((c) => c.id === material.category) || {
    id: material.category,
    name: material.category,
    shortName: material.category,
    badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  return (
    <div className="w-full max-w-7xl mx-auto min-w-0 px-3.5 sm:px-6 lg:px-8 py-4 sm:py-8 lg:py-12 space-y-6 sm:space-y-8 box-border">
      {/* Navigation Breadcrumb */}
      <div>
        <Link
          to="/materials"
          className="min-h-[44px] inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-600 hover:text-blue-600 active:text-blue-700 transition-colors mb-2 sm:mb-4 px-2 py-1 -ml-2 rounded-lg hover:bg-slate-100"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Materials</span>
        </Link>

        {/* Material Detail Banner */}
        <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 p-4 sm:p-6 lg:p-8 shadow-sm w-full max-w-full min-w-0 box-border">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 min-w-0 w-full">
            {/* Badges */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0">
              <Link
                to={`/category/${material.category}`}
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border hover:opacity-90 transition-opacity ${categoryMeta.badgeColor}`}
              >
                {categoryMeta.shortName}
              </Link>

              {subject && (
                <Link
                  to={`/subjects/${subject.id}`}
                  className="font-mono text-xs font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 transition-colors"
                >
                  {subject.code} — {subject.name}
                </Link>
              )}

              <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                {material.academicYear}
              </span>

              {material.unitNumber !== undefined && material.unitNumber !== null && (
                <span className="text-xs font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  Unit {material.unitNumber}
                </span>
              )}
              {material.assignmentNumber !== undefined && material.assignmentNumber !== null && (
                <span className="text-xs font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  Assignment {material.assignmentNumber}
                </span>
              )}
              {material.experimentNumber !== undefined && material.experimentNumber !== null && (
                <span className="text-xs font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  Experiment {material.experimentNumber}
                </span>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 w-full sm:w-auto min-w-0">
              <button
                type="button"
                onClick={handleShare}
                aria-label={`Share ${material.title}`}
                className={`flex-1 sm:flex-none min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                  copied
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                    : 'text-slate-700 bg-white border-slate-200 hover:bg-slate-50 active:bg-slate-100'
                }`}
                title="Share or copy link"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4 text-slate-600" />
                    <span>Share</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                aria-label={`Download ${material.title}`}
                className="flex-1 sm:flex-none min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {downloading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{downloadProgressText || 'Starting download...'}</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Download PDF</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Title & Description */}
          <div className="mt-5 space-y-3">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-slate-900 leading-tight break-words">
              {material.title}
            </h1>

            {material.description && (
              <p className="text-sm text-slate-600 leading-relaxed max-w-3xl">
                {material.description}
              </p>
            )}

            {/* Tags */}
            {material.tags && material.tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-2">
                <span className="text-xs font-semibold text-slate-400">Topics:</span>
                {material.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 text-[11px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md"
                  >
                    <Tag className="w-2.5 h-2.5 opacity-60" />
                    <span>{tag}</span>
                  </span>
                ))}
              </div>
            )}

            {/* Document stats */}
            <div className="flex flex-wrap items-center gap-4 pt-3 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <HardDrive className="w-4 h-4 text-slate-400" />
                <span>File size: {formatFileSize(material.fileSize)}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span>Published: {formatDate(material.createdAt)}</span>
              </span>
              <span className="text-slate-700 font-medium bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                Verified Document
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Embedded PDF Viewer */}
      <section>
        <h2 className="text-lg font-bold text-slate-900 mb-3">Document Reader</h2>
        <PdfViewer material={material} subject={subject || undefined} />
      </section>

      {/* Related Materials Section */}
      {relatedMaterials.length > 0 && (
        <section className="pt-6 border-t border-slate-200">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                More from {subject?.name || 'this Subject'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Other notes, assignments, and PYQs for CSE Semester 5
              </p>
            </div>
            {subject && (
              <Link
                to={`/subjects/${subject.id}`}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800"
              >
                View all subject files &rarr;
              </Link>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {relatedMaterials.map((rel) => (
              <MaterialCard key={rel.id} material={rel} subject={subject || undefined} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
