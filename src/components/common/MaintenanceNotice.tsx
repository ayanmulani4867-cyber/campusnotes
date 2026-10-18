import React from 'react';
import { GraduationCap, Wrench } from 'lucide-react';

export const MaintenanceNotice: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-900 px-4 py-12">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm text-center space-y-5 box-border">
        {/* Brand Icon */}
        <div className="inline-flex w-14 h-14 rounded-2xl bg-blue-600 items-center justify-center text-white shadow-sm mx-auto">
          <GraduationCap className="w-7 h-7" />
        </div>

        <div className="space-y-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold">
            <Wrench className="w-3.5 h-3.5 text-blue-600" />
            <span>Maintenance Mode</span>
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            CampusNotes
          </h1>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            CampusNotes is temporarily under maintenance. Please try again later. Thank you for your patience.
          </p>
        </div>
      </div>
    </div>
  );
};

