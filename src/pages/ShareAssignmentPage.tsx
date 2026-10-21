import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Share2, Sparkles, CheckCircle2, MessageCircle } from 'lucide-react';
import { ShareAssignmentCard } from '../components/materials/ShareAssignmentCard';

export const ShareAssignmentPage: React.FC = () => {
  return (
    <div className="w-full max-w-4xl mx-auto px-3.5 sm:px-6 lg:px-8 py-6 sm:py-12 space-y-6 sm:space-y-8 box-border">
      {/* Back button */}
      <div>
        <Link
          to="/category/assignments"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 transition-colors mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Assignments</span>
        </Link>

        {/* Page Header */}
        <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 p-5 sm:p-8 shadow-sm">
          <div className="flex flex-wrap items-center gap-2 mb-2.5">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <MessageCircle className="w-3.5 h-3.5" />
              WhatsApp Share Tool
            </span>
            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              CampusNotes
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 break-words">
            Share Assignment
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-2 max-w-2xl leading-relaxed">
            Generate and copy a professional, formatted WhatsApp message to share any CSE Semester 5 assignment with your classmates or study group.
          </p>
        </div>
      </div>

      {/* Main Interactive Tool Card */}
      <ShareAssignmentCard />

      {/* How it Works / Instructions */}
      <div className="bg-slate-50 rounded-xl sm:rounded-2xl border border-slate-200/80 p-5 sm:p-6 text-xs sm:text-sm text-slate-600 space-y-3">
        <h2 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-600" />
          How It Works
        </h2>
        <ul className="space-y-2 list-none pl-0">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              <strong>Pick or Type Subject:</strong> Select one of the quick CSE Semester 5 subject pills or enter any custom subject name.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              <strong>Enter Assignment Number:</strong> Select an assignment number pill or enter the specific number.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              <strong>Copy or Share:</strong> Click <em>Copy Message</em> to copy to clipboard, or click <em>Share on WhatsApp</em> to open WhatsApp with the message already filled in.
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
};
