import React from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, Home, Search } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 py-16 text-center">
      <div className="w-16 h-16 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center mb-6 shadow-sm">
        <GraduationCap className="w-8 h-8" />
      </div>
      <span className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-2">
        Error 404
      </span>
      <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 mb-3">
        Page Not Found
      </h1>
      <p className="text-sm sm:text-base text-slate-500 max-w-md mb-8 leading-relaxed">
        The requested resource is not available. Please verify the academic URL or return to CampusNotes.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-xs sm:text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm shadow-blue-500/20"
        >
          <Home className="w-4 h-4" />
          <span>CampusNotes Home</span>
        </Link>
        <Link
          to="/materials"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-100 text-slate-700 text-xs sm:text-sm font-semibold rounded-xl hover:bg-slate-200 transition-colors"
        >
          <Search className="w-4 h-4" />
          <span>Browse Materials</span>
        </Link>
      </div>
    </div>
  );
};
