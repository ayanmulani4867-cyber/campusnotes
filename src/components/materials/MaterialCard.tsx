import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Download,
  Eye,
  Calendar,
  HardDrive,
  Hash,
  Tag,
  RefreshCw,
  Share2,
  Check,
} from 'lucide-react';
import { StudyMaterial, Subject, CATEGORIES } from '../../types';
import { downloadStudyMaterial } from '../../services/firebaseService';
import { shareMaterial } from '../../utils/shareUtils';
import { useToast } from '../../context/ToastContext';

interface MaterialCardProps {
  material: StudyMaterial;
  subject?: Subject;
  onPreview?: (material: StudyMaterial) => void;
}

const indianDateFormatter = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

export const formatFileSize = (bytes: number): string => {
  if (!bytes || bytes === 0) return '0 KB';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

export const formatDate = (timestamp: number): string => {
  if (!timestamp) return 'Recent';
  try {
    return indianDateFormatter.format(new Date(timestamp));
  } catch {
    return 'Recent';
  }
};

export const MaterialCard: React.FC<MaterialCardProps> = React.memo(({
  material,
  subject,
}) => {
  const toast = useToast();
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  const categoryMeta = CATEGORIES.find((c) => c.id === material.category) || {
    id: material.category,
    name: material.category,
    shortName: material.category,
    badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (downloading) return;
    try {
      setDownloading(true);
      await downloadStudyMaterial(material);
      toast.success('Download Complete', `"${material.fileName || material.title}" downloaded.`);
    } catch (err: unknown) {
      toast.error('Download Failed', err instanceof Error ? err.message : String(err));
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const success = await shareMaterial(
      material,
      (title, msg) => {
        toast.success(title, msg);
      },
      subject
    );
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="group bg-white rounded-xl sm:rounded-2xl border border-slate-200/90 p-4 sm:p-5 hover:border-slate-300 hover:shadow-md transition-all flex flex-col justify-between active:scale-[0.99] touch-manipulation shadow-sm w-full max-w-full min-w-0 box-border">
      <div className="min-w-0 w-full">
        {/* Badges Bar: Category & Academic Year */}
        <div className="flex items-center justify-between gap-2 mb-3 min-w-0">
          <span
            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 shrink-0"
          >
            {categoryMeta.shortName}
          </span>
          <span className="text-[11px] font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 shrink-0">
            {material.academicYear}
          </span>
        </div>

        {/* Title */}
        <Link
          to={`/materials/${material.id}`}
          className="block group-hover:text-blue-600 transition-colors min-w-0"
        >
          <h3 className="text-base font-semibold text-slate-900 line-clamp-2 leading-snug break-words">
            {material.title}
          </h3>
        </Link>

        {/* Subject Name / Code */}
        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-600 font-medium min-w-0">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0"></span>
          {subject ? (
            <Link
              to={`/subjects/${subject.id}`}
              onClick={(e) => e.stopPropagation()}
              className="truncate min-w-0 hover:text-blue-600 transition-colors"
            >
              {subject.code} — {subject.name}
            </Link>
          ) : (
            <span className="truncate min-w-0">CSE Semester 5</span>
          )}
        </div>

        {/* Description */}
        {material.description && (
          <p className="mt-2 text-xs text-slate-500 line-clamp-2 leading-relaxed break-words">
            {material.description}
          </p>
        )}

        {/* Unit / Experiment / Assignment Number Badges */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 min-w-0">
          {material.unitNumber !== undefined && material.unitNumber !== null && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded shrink-0">
              <Hash className="w-3 h-3 text-slate-400" />
              <span>Unit {material.unitNumber}</span>
            </span>
          )}
          {material.assignmentNumber !== undefined && material.assignmentNumber !== null && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded shrink-0">
              <Hash className="w-3 h-3 text-slate-400" />
              <span>Assignment {material.assignmentNumber}</span>
            </span>
          )}
          {material.experimentNumber !== undefined && material.experimentNumber !== null && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded shrink-0">
              <Hash className="w-3 h-3 text-slate-400" />
              <span>Exp {material.experimentNumber}</span>
            </span>
          )}
        </div>

        {/* Optional Tags */}
        {material.tags && material.tags.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1 min-w-0">
            {material.tags.slice(0, 3).map((tag, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-0.5 text-[10px] text-slate-500 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded shrink-0"
              >
                <Tag className="w-2.5 h-2.5 opacity-60" />
                <span className="truncate max-w-[120px]">{tag}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Footer Info & Actions */}
      <div className="mt-5 pt-3.5 border-t border-slate-100 min-w-0 w-full">
        <div className="flex items-center justify-between text-[11px] text-slate-500 mb-3 font-medium min-w-0">
          <span className="flex items-center gap-1 shrink-0">
            <HardDrive className="w-3.5 h-3.5 text-slate-400" />
            <span>{formatFileSize(material.fileSize)}</span>
          </span>
          <span className="flex items-center gap-1 shrink-0">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>{formatDate(material.createdAt)}</span>
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 w-full">
          <Link
            to={`/materials/${material.id}`}
            aria-label={`View PDF for ${material.title}`}
            className="flex-1 min-w-0 min-h-[42px] inline-flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 active:bg-slate-100 rounded-lg transition-colors box-border"
          >
            <Eye className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span className="truncate">View</span>
          </Link>

          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            aria-label={`Download ${material.title}`}
            className="flex-1 min-w-0 min-h-[42px] inline-flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed box-border"
          >
            {downloading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
            ) : (
              <Download className="w-3.5 h-3.5 shrink-0" />
            )}
            <span className="truncate">{downloading ? 'Saving...' : 'Download'}</span>
          </button>

          <button
            type="button"
            onClick={handleShare}
            aria-label={`Share ${material.title}`}
            title={copied ? 'Link Copied!' : 'Share Material'}
            className={`min-h-[42px] min-w-[40px] sm:min-w-[42px] px-2 sm:px-2.5 py-2 inline-flex items-center justify-center text-xs font-medium rounded-lg border transition-colors shrink-0 box-border ${
              copied
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                : 'text-slate-700 bg-white border-slate-200 hover:bg-slate-50 active:bg-slate-100'
            }`}
          >
            {copied ? (
              <Check className="w-4 h-4 text-emerald-600" />
            ) : (
              <Share2 className="w-4 h-4 text-slate-600" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
});

MaterialCard.displayName = 'MaterialCard';
