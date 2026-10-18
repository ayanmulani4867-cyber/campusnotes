import React from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, Wrench, ShieldCheck, Lock } from 'lucide-react';

export const MaintenanceNotice: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-900 px-4 py-16">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 shadow-sm text-center space-y-6">
        {/* Brand Icon */}
        <div className="inline-flex w-14 h-14 rounded-2xl bg-blue-600 items-center justify-center text-white shadow-sm mb-1">
          <GraduationCap className="w-7 h-7" />
        </div>

        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold mb-3">
            <Wrench className="w-3.5 h-3.5 text-blue-600" />
            <span>Curriculum Maintenance</span>
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            CampusNotes
          </h1>
          <p className="mt-3 text-sm text-slate-600 leading-relaxed">
            CampusNotes is currently undergoing scheduled maintenance and curriculum synchronization for Computer Science & Engineering Semester 5.
          </p>
          <p className="mt-2 text-xs text-slate-400">
            Public downloads and study material browsing will resume once maintenance is completed.
          </p>
        </div>

        {/* Notice Box */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-left text-xs text-slate-600 space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
            <Lock className="w-4 h-4 text-slate-500" />
            <span>Public Access Temporarily Suspended</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            During maintenance mode, public requests to documents, assignments, and practicals are strictly paused to prevent data inconsistency during updates.
          </p>
        </div>

        {/* Admin Gateway */}
        <div className="pt-4 border-t border-slate-100">
          <Link
            to="/admin/login"
            className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-semibold"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Authorized Administrator Access &rarr;</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
