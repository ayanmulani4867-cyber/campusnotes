import React from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Download,
  Eye,
  Calendar,
  HardDrive,
  Hash,
  Tag,
} from 'lucide-react';
import { StudyMaterial, Subject, CATEGORIES } from '../../types';

interface MaterialCardProps {
  material: StudyMaterial;
  subject?: Subject;
  onPreview?: (material: StudyMaterial) => void;
}

export const formatFileSize = (bytes: number): string => {
  if (!bytes || bytes === 0) return '0 KB';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

export const formatDate = (timestamp: number): string => {
  if (!timestamp) return 'Recent';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(timestamp));
};

export const MaterialCard: React.FC<MaterialCardProps> = ({
  material,
  subject,
}) => {
  const categoryMeta = CATEGORIES.find((c) => c.id === material.category) || {
    id: material.category,
    name: material.category,
    shortName: material.category,
    badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Use target=_blank and download attribute
    const link = document.createElement('a');
    link.href = material.downloadUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.download = material.fileName || `${material.title}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="group bg-white rounded-lg border border-slate-200 p-5 hover:border-slate-300 transition-colors flex flex-col justify-between">
      <div>
        {/* Badges Bar: Category & Academic Year */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <span
            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200"
          >
            {categoryMeta.shortName}
          </span>
          <span className="text-[11px] font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
            {material.academicYear}
          </span>
        </div>

        {/* Title */}
        <Link
          to={`/materials/${material.id}`}
          className="block group-hover:text-blue-600 transition-colors"
        >
          <h3 className="text-base font-semibold text-slate-900 line-clamp-2 leading-snug">
            {material.title}
          </h3>
        </Link>

        {/* Subject Name / Code */}
        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-600 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
          <span>{subject ? `${subject.code} — ${subject.name}` : 'CSE Semester 5'}</span>
        </div>

        {/* Description */}
        {material.description && (
          <p className="mt-2 text-xs text-slate-500 line-clamp-2 leading-relaxed">
            {material.description}
          </p>
        )}

        {/* Unit / Experiment / Assignment Number Badges */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {material.unitNumber !== undefined && material.unitNumber !== null && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded">
              <Hash className="w-3 h-3 text-slate-400" />
              <span>Unit {material.unitNumber}</span>
            </span>
          )}
          {material.assignmentNumber !== undefined && material.assignmentNumber !== null && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded">
              <Hash className="w-3 h-3 text-slate-400" />
              <span>Assignment {material.assignmentNumber}</span>
            </span>
          )}
          {material.experimentNumber !== undefined && material.experimentNumber !== null && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded">
              <Hash className="w-3 h-3 text-slate-400" />
              <span>Exp {material.experimentNumber}</span>
            </span>
          )}
        </div>

        {/* Optional Tags */}
        {material.tags && material.tags.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1">
            {material.tags.slice(0, 3).map((tag, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-0.5 text-[10px] text-slate-500 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded"
              >
                <Tag className="w-2.5 h-2.5 opacity-60" />
                <span>{tag}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Footer Info & Actions */}
      <div className="mt-5 pt-3.5 border-t border-slate-100">
        <div className="flex items-center justify-between text-[11px] text-slate-500 mb-3 font-medium">
          <span className="flex items-center gap-1">
            <HardDrive className="w-3.5 h-3.5 text-slate-400" />
            <span>{formatFileSize(material.fileSize)}</span>
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>{formatDate(material.createdAt)}</span>
          </span>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <Link
            to={`/materials/${material.id}`}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
          >
            <Eye className="w-3.5 h-3.5 text-slate-500" />
            <span>View PDF</span>
          </Link>

          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download</span>
          </button>
        </div>
      </div>
    </div>
  );
};
