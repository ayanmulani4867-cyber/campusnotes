import React, { useState, useId } from 'react';
import {
  formatAssignmentShareMessage,
  copyAssignmentMessage,
  openWhatsAppShare,
  ASSIGNMENT_SHARE_URL,
} from '../../utils/assignmentShareUtils';
import { OFFICIAL_CSE_SEM_5_SUBJECTS } from '../../constants/subjects';
import { useToast } from '../../context/ToastContext';
import {
  Copy,
  Check,
  Share2,
  FileText,
  MessageCircle,
  Sparkles,
} from 'lucide-react';

interface ShareAssignmentCardProps {
  initialSubject?: string;
  initialAssignmentNumber?: string | number;
  className?: string;
  compact?: boolean;
}

export const ShareAssignmentCard: React.FC<ShareAssignmentCardProps> = ({
  initialSubject = '',
  initialAssignmentNumber = '',
  className = '',
  compact = false,
}) => {
  const toast = useToast();
  const subjectInputId = useId();
  const assignmentInputId = useId();

  const [subjectName, setSubjectName] = useState(initialSubject);
  const [assignmentNumber, setAssignmentNumber] = useState(
    initialAssignmentNumber !== '' ? String(initialAssignmentNumber) : ''
  );
  const [copied, setCopied] = useState(false);
  const [validationError, setValidationError] = useState('');

  // Generate live message
  const isComplete = Boolean(subjectName.trim() && assignmentNumber.trim());
  const formattedMessage = formatAssignmentShareMessage(
    subjectName || '[Subject Name]',
    assignmentNumber || '[Assignment Number]'
  );
  const actualMessageToSend = isComplete
    ? formatAssignmentShareMessage(subjectName, assignmentNumber)
    : '';

  const handleCopy = async () => {
    if (!subjectName.trim()) {
      setValidationError('Please enter a subject name');
      toast.error('Missing Subject', 'Please enter a Subject Name before copying.');
      return;
    }
    if (!assignmentNumber.trim()) {
      setValidationError('Please enter an assignment number');
      toast.error('Missing Assignment Number', 'Please enter an Assignment Number before copying.');
      return;
    }

    setValidationError('');
    const success = await copyAssignmentMessage(actualMessageToSend);
    if (success) {
      setCopied(true);
      toast.success('Message Copied', 'WhatsApp message copied to clipboard.');
      setTimeout(() => setCopied(false), 2500);
    } else {
      toast.error('Copy Failed', 'Could not copy message automatically.');
    }
  };

  const handleWhatsAppShare = () => {
    if (!subjectName.trim()) {
      setValidationError('Please enter a subject name');
      toast.error('Missing Subject', 'Please enter a Subject Name before sharing.');
      return;
    }
    if (!assignmentNumber.trim()) {
      setValidationError('Please enter an assignment number');
      toast.error('Missing Assignment Number', 'Please enter an Assignment Number before sharing.');
      return;
    }

    setValidationError('');
    openWhatsAppShare(actualMessageToSend);
  };

  // Quick subject suggestions from official curriculum
  const quickSubjects = [
    'Core Java',
    'Operating Systems',
    'Computer Networks',
    'Database Systems',
    'Design & Analysis of Algorithms',
    'Software Engineering',
  ];

  const quickNumbers = ['1', '2', '3', '4', '5', '6', '7', '8'];

  return (
    <div
      className={`bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 w-full max-w-full min-w-0 box-border ${className}`}
    >
      {/* Header */}
      <div className="flex items-start sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
            <Share2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Share Assignment</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60 hidden sm:inline-flex">
                WhatsApp Ready
              </span>
            </h3>
            {!compact && (
              <p className="text-xs text-slate-500 mt-0.5">
                Generate a clean, ready-to-share message for your college WhatsApp group
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Form Inputs */}
      <div className="space-y-4">
        {/* Row 1: Subject Name */}
        <div>
          <label
            htmlFor={subjectInputId}
            className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5"
          >
            Subject Name <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              id={subjectInputId}
              type="text"
              value={subjectName}
              onChange={(e) => {
                setSubjectName(e.target.value);
                if (validationError) setValidationError('');
              }}
              placeholder="e.g. 23CS3501 - Core Java or Operating Systems"
              className="w-full min-h-[44px] px-3.5 py-2 text-xs sm:text-sm bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-colors"
            />
          </div>

          {/* Quick Subject Chips */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[11px] font-medium text-slate-400 mr-0.5">Quick:</span>
            {quickSubjects.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => {
                  setSubjectName(name);
                  if (validationError) setValidationError('');
                }}
                className={`min-h-[28px] px-2.5 py-0.5 rounded-md text-[11px] font-medium border transition-colors inline-flex items-center ${
                  subjectName === name
                    ? 'bg-blue-50 text-blue-700 border-blue-300'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Assignment Number */}
        <div>
          <label
            htmlFor={assignmentInputId}
            className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5"
          >
            Assignment Number <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              id={assignmentInputId}
              type="text"
              value={assignmentNumber}
              onChange={(e) => {
                setAssignmentNumber(e.target.value);
                if (validationError) setValidationError('');
              }}
              placeholder="e.g. 1, 2, 3 or Assignment 1"
              className="w-full min-h-[44px] px-3.5 py-2 text-xs sm:text-sm bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-colors"
            />
          </div>

          {/* Quick Number Chips */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[11px] font-medium text-slate-400 mr-0.5">No.:</span>
            {quickNumbers.map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => {
                  setAssignmentNumber(num);
                  if (validationError) setValidationError('');
                }}
                className={`min-h-[28px] px-2.5 py-0.5 rounded-md text-[11px] font-semibold border transition-colors inline-flex items-center ${
                  assignmentNumber === num
                    ? 'bg-blue-50 text-blue-700 border-blue-300'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                }`}
              >
                {num}
              </button>
            ))}
          </div>
        </div>

        {/* Inline Validation Alert */}
        {validationError && (
          <p className="text-xs font-medium text-red-600 animate-in fade-in">
            {validationError}
          </p>
        )}

        {/* Live Message Preview Card */}
        <div className="mt-4 pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
              Message Preview
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              {ASSIGNMENT_SHARE_URL}
            </span>
          </div>

          <div className="bg-slate-900 text-slate-100 rounded-lg sm:rounded-xl p-3.5 sm:p-4 font-mono text-xs sm:text-sm leading-relaxed border border-slate-800 shadow-inner select-all relative overflow-x-auto">
            <pre className="whitespace-pre-wrap break-words font-sans">
              {formattedMessage}
            </pre>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3">
          {/* Copy Message Button */}
          <button
            type="button"
            onClick={handleCopy}
            className={`min-h-[44px] flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold border transition-all active:scale-[0.99] touch-manipulation cursor-pointer ${
              copied
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                : 'bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 border-slate-300 shadow-sm'
            }`}
          >
            {copied ? (
              <Check className="w-4 h-4 text-emerald-600" />
            ) : (
              <Copy className="w-4 h-4 text-slate-600" />
            )}
            <span>{copied ? 'Copied to Clipboard!' : 'Copy Message'}</span>
          </button>

          {/* Share on WhatsApp Button */}
          <button
            type="button"
            onClick={handleWhatsAppShare}
            className="min-h-[44px] flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white transition-all shadow-sm active:scale-[0.99] touch-manipulation cursor-pointer"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Share on WhatsApp</span>
          </button>
        </div>
      </div>
    </div>
  );
};
