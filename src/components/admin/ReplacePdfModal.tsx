import React, { useState } from 'react';
import { Upload, FileText, AlertTriangle, RefreshCw } from 'lucide-react';
import { StudyMaterial } from '../../types';
import {
  replaceMaterialPdf,
  MAX_FILE_SIZE_BYTES,
} from '../../services/firebaseService';
import { formatFileSize } from '../materials/MaterialCard';
import { Modal } from '../common/Modal';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { activityLogService } from '../../services/activityLogService';

interface ReplacePdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  material: StudyMaterial | null;
  onSuccess: () => Promise<void>;
}

export const ReplacePdfModal: React.FC<ReplacePdfModalProps> = ({
  isOpen,
  onClose,
  material,
  onSuccess,
}) => {
  const toast = useToast();
  const { admin } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [bytesUploaded, setBytesUploaded] = useState<number>(0);
  const [totalFileBytes, setTotalFileBytes] = useState<number>(0);
  const [isReplacing, setIsReplacing] = useState(false);

  if (!material) return null;

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
        `File size (${formatFileSize(file.size)}) exceeds maximum allowed size of 50 MB.`
      );
      e.target.value = '';
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const handleReplace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error('Validation Error', 'Please select a replacement PDF document.');
      return;
    }

    setIsReplacing(true);

    try {
      // Safe replacement workflow:
      // Uploads replacement first -> updates database metadata -> deletes old file only after success
      await replaceMaterialPdf(
        material,
        selectedFile,
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
        resourceId: material.id,
        resourceName: material.title,
        result: 'SUCCESS',
        metadata: {
          previousFileName: material.fileName,
          newFileName: selectedFile.name,
          newFileSize: selectedFile.size,
          category: material.category,
        },
      });

      toast.success(
        'PDF Replaced Successfully',
        'PDF replaced successfully.'
      );
      onClose();
      await onSuccess();
    } catch (err: unknown) {
      await activityLogService.logActivity({
        adminEmail: admin?.email,
        adminUid: admin?.uid,
        action: 'PDF_REPLACE',
        resourceId: material.id,
        resourceName: material.title,
        result: 'FAILURE',
        errorMessage: err instanceof Error ? err.message : String(err),
      });
      toast.error('Replacement Failed', err instanceof Error ? err.message : String(err));
    } finally {
      setIsReplacing(false);
      setUploadProgress(null);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !isReplacing && onClose()}
      title="Replace PDF Document"
      description={`Replace the underlying PDF file for: "${material.title}"`}
    >
      <form onSubmit={handleReplace} className="space-y-4">
        {/* Warning callout */}
        <div className="flex items-start gap-3 p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Safe Replacement Protocol</p>
            <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
              The replacement file will be uploaded and verified before the old PDF is retired. If network interruption occurs, the existing file remains intact.
            </p>
          </div>
        </div>

        {/* Current File Information */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
          <p className="text-[11px] font-semibold text-slate-500">
            Current Document
          </p>
          <div className="flex items-center justify-between text-xs text-slate-800">
            <span className="font-medium truncate max-w-[240px]">
              {material.fileName}
            </span>
            <span className="text-slate-500">{formatFileSize(material.fileSize)}</span>
          </div>
        </div>

        {/* New File Selector */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Choose Replacement PDF (Max 6 MB) *
          </label>
          <div className="border border-dashed border-slate-300 rounded-lg p-5 text-center hover:border-slate-400 transition-colors bg-white">
            <input
              type="file"
              id="replace-pdf-upload"
              accept=".pdf,application/pdf"
              onChange={handleFileChange}
              className="hidden"
              disabled={isReplacing}
            />
            <label htmlFor="replace-pdf-upload" className="cursor-pointer block">
              <Upload className="w-5 h-5 text-slate-400 mx-auto mb-1.5" />
              <p className="text-xs font-medium text-slate-800">
                {selectedFile ? selectedFile.name : 'Click to select replacement PDF from your computer'}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {selectedFile
                  ? `New file size: ${formatFileSize(selectedFile.size)}`
                  : 'Accepts .pdf files only, up to 6 MB for Realtime Database storage'}
              </p>
            </label>
          </div>
        </div>

        {/* Upload Progress Bar */}
        {uploadProgress !== null && (
          <div className="space-y-1.5 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center justify-between text-xs font-medium text-slate-800">
              <span>Uploading replacement PDF to Realtime Database...</span>
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

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isReplacing}
            className="w-full sm:w-auto min-h-[42px] px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 text-center"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isReplacing || !selectedFile}
            className="w-full sm:w-auto min-h-[42px] px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {isReplacing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Replacing...</span>
              </>
            ) : (
              <span>Confirm & Replace File</span>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
