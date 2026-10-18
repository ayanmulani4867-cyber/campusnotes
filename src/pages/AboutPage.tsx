import React from 'react';
import { Link } from 'react-router-dom';
import {
  GraduationCap,
  ShieldCheck,
  Zap,
  BookOpen,
  CheckCircle2,
  Database,
  Lock,
  DownloadCloud,
} from 'lucide-react';

export const AboutPage: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-12">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 text-xs font-semibold">
          <GraduationCap className="w-4 h-4" />
          <span>Strict Academic Scope: CSE Semester 5 ONLY</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900">
          About CampusNotes
        </h1>
        <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Fast, clean study materials platform engineered specifically for 5th Semester Computer Science & Engineering students.
        </p>
      </div>

      {/* Scope Mission Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-8 sm:p-10 shadow-sm space-y-6">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          Academic Focus & Mission
        </h2>
        <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
          Traditional college portals often suffer from cumbersome multi-tier navigation, mandatory student logins, broken attachments, and confusing college ERP features like fee payments and attendance tracking.
        </p>
        <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
          <strong>CampusNotes</strong> eliminates all unnecessary friction. It is intentionally scoped to a single critical academic milestone: <span className="text-blue-600 font-semibold">Computer Science & Engineering — Semester 5</span>. Here, you find zero distractions, zero login barriers, and instant direct access to verified study material.
        </p>

        {/* Scope checklist */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-slate-900">Department: CSE Only</p>
              <p className="text-xs text-slate-500">
                Tailored for Computer Science core subjects and lab practicals.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-slate-900">Semester: 5th Only</p>
              <p className="text-xs text-slate-500">
                Covers official Semester V subjects: Advanced Java, DAA, Advanced Database Engineering, Labs, Electives, and Minors.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-slate-900">No Student Login Required</p>
              <p className="text-xs text-slate-500">
                Public access for instant browsing, searching, and downloading.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-slate-900">Secure Admin Governance</p>
              <p className="text-xs text-slate-500">
                Only authenticated, authorized faculty administrators can publish content.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Architecture & Performance Architecture */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Database className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Firebase Realtime Database</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Lightweight, normalized JSON structure partitioned into public and administrative tiers. Indexed queries deliver sub-50ms metadata queries.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <DownloadCloud className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Cloud Storage Delivery</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            All PDF notes and lab files are served directly from Google Cloud Storage with byte-range caching, bypassing application server bottlenecks.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Zap className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-slate-900">500 Concurrent Users Target</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Architected for examination rush periods with client caching, debounced queries, and isolated read paths.
          </p>
        </div>
      </div>

      {/* Frequently Asked Questions */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-8 sm:p-10 shadow-sm space-y-6">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          Frequently Asked Questions (FAQ)
        </h2>

        <div className="divide-y divide-slate-100 space-y-4">
          <div className="pt-4 first:pt-0">
            <h4 className="text-sm font-bold text-slate-900">
              Do I need to create an account or register to download notes?
            </h4>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
              No. Public visitors can freely search, preview, and download all published study materials without registering, logging in, or providing any personal information.
            </p>
          </div>

          <div className="pt-4">
            <h4 className="text-sm font-bold text-slate-900">
              Why does CampusNotes only cover Semester 5 Computer Science?
            </h4>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
              Semester 5 is universally recognized as the pivotal semester in Computer Science curricula containing core advanced subjects like Advanced Java, Design Analysis & Algorithms, and Advanced Database Engineering. Dedicating the hub ensures 100% syllabus alignment.
            </p>
          </div>

          <div className="pt-4">
            <h4 className="text-sm font-bold text-slate-900">
              How can professors or class representatives upload new materials?
            </h4>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
              Authorized administrators can log in via the{' '}
              <Link to="/admin/login" className="text-blue-600 hover:underline font-semibold">
                Administrator Portal
              </Link>{' '}
              to manage subjects, upload PDFs up to 25 MB, and edit published resources.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
