import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home,
  BookOpen,
  FileText,
  MoreHorizontal,
  X,
  Upload,
  GraduationCap,
  HelpCircle,
  FileSpreadsheet,
  FlaskConical,
  FileQuestion,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { prefetchRoute } from '../../utils/routePrefetch';

export const MobileBottomNav: React.FC = () => {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  // Close more menu whenever the route path changes
  useEffect(() => {
    setIsMoreOpen(false);
  }, [location.pathname]);

  // Handle keyboard Escape to dismiss More menu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMoreOpen) {
        setIsMoreOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMoreOpen]);

  // Listen to external toggle events (e.g. from mobile top navbar hamburger button)
  useEffect(() => {
    const handleExternalToggle = () => {
      setIsMoreOpen((prev) => !prev);
    };
    window.addEventListener('campusnotes:toggle-more-menu', handleExternalToggle);
    return () => {
      window.removeEventListener('campusnotes:toggle-more-menu', handleExternalToggle);
    };
  }, []);

  // Determine active states for the 4 bottom navigation items
  const isHomeActive = location.pathname === '/';
  const isSubjectsActive = location.pathname.startsWith('/subjects');
  const isMaterialsActive = location.pathname.startsWith('/materials');
  const isMoreRoute =
    location.pathname.startsWith('/category') ||
    location.pathname === '/about' ||
    location.pathname === '/contribute' ||
    location.pathname.startsWith('/admin');
  const isMoreActive = isMoreOpen || isMoreRoute;

  return (
    <>
      {/* 1. Fixed Mobile Bottom Navigation Bar (Visible only on mobile devices) */}
      <nav
        aria-label="Mobile Bottom Navigation"
        className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200/90 shadow-[0_-1px_4px_rgba(0,0,0,0.04)] md:hidden pb-[env(safe-area-inset-bottom)]"
      >
        <div className="grid grid-cols-4 h-16 max-w-md mx-auto items-center px-2">
          {/* Item 1: Home */}
          <Link
            to="/"
            onClick={() => setIsMoreOpen(false)}
            className={`flex flex-col items-center justify-center gap-1 py-1 px-1 rounded-lg transition-colors min-h-[44px] touch-manipulation focus:outline-none ${
              isHomeActive
                ? 'text-blue-600 font-semibold'
                : 'text-slate-500 hover:text-slate-800 font-medium'
            }`}
            aria-label="Home"
            aria-current={isHomeActive ? 'page' : undefined}
          >
            <Home className="w-5 h-5 shrink-0 stroke-[2.2]" />
            <span className="text-[11px] leading-tight">Home</span>
          </Link>

          {/* Item 2: Subjects */}
          <Link
            to="/subjects"
            onPointerEnter={() => prefetchRoute('subjects')}
            onTouchStart={() => prefetchRoute('subjects')}
            onClick={() => setIsMoreOpen(false)}
            className={`flex flex-col items-center justify-center gap-1 py-1 px-1 rounded-lg transition-colors min-h-[44px] touch-manipulation focus:outline-none ${
              isSubjectsActive
                ? 'text-blue-600 font-semibold'
                : 'text-slate-500 hover:text-slate-800 font-medium'
            }`}
            aria-label="Subjects"
            aria-current={isSubjectsActive ? 'page' : undefined}
          >
            <BookOpen className="w-5 h-5 shrink-0 stroke-[2.2]" />
            <span className="text-[11px] leading-tight">Subjects</span>
          </Link>

          {/* Item 3: Materials */}
          <Link
            to="/materials"
            onPointerEnter={() => prefetchRoute('materials')}
            onTouchStart={() => prefetchRoute('materials')}
            onClick={() => setIsMoreOpen(false)}
            className={`flex flex-col items-center justify-center gap-1 py-1 px-1 rounded-lg transition-colors min-h-[44px] touch-manipulation focus:outline-none ${
              isMaterialsActive
                ? 'text-blue-600 font-semibold'
                : 'text-slate-500 hover:text-slate-800 font-medium'
            }`}
            aria-label="Materials"
            aria-current={isMaterialsActive ? 'page' : undefined}
          >
            <FileText className="w-5 h-5 shrink-0 stroke-[2.2]" />
            <span className="text-[11px] leading-tight">Materials</span>
          </Link>

          {/* Item 4: More */}
          <button
            type="button"
            onClick={() => setIsMoreOpen(!isMoreOpen)}
            className={`flex flex-col items-center justify-center gap-1 py-1 px-1 rounded-lg transition-colors min-h-[44px] touch-manipulation focus:outline-none cursor-pointer ${
              isMoreActive
                ? 'text-blue-600 font-semibold'
                : 'text-slate-500 hover:text-slate-800 font-medium'
            }`}
            aria-label="More navigation options"
            aria-expanded={isMoreOpen}
          >
            <MoreHorizontal className="w-5 h-5 shrink-0 stroke-[2.2]" />
            <span className="text-[11px] leading-tight">More</span>
          </button>
        </div>
      </nav>

      {/* 2. Clean Mobile-Friendly More Menu (Slide-up Bottom Sheet) */}
      {isMoreOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="More navigation menu"
          className="fixed inset-0 z-50 md:hidden flex flex-col justify-end"
        >
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-200"
            onClick={() => setIsMoreOpen(false)}
            aria-hidden="true"
          />

          {/* Bottom Sheet Drawer */}
          <div className="relative bg-white rounded-t-2xl border-t border-slate-200 shadow-2xl max-h-[85vh] flex flex-col z-10 pb-[calc(1.25rem+env(safe-area-inset-bottom))] animate-in slide-in-from-bottom duration-200 overflow-hidden">
            {/* Top pill drag handle */}
            <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mt-3 mb-1 shrink-0" />

            {/* Sheet Header */}
            <div className="flex items-center justify-between px-5 py-2.5 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center">
                  <MoreHorizontal className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">More Navigation</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsMoreOpen(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 active:bg-slate-200 transition-colors"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sheet Scrollable Links Container */}
            <div className="overflow-y-auto px-4 py-3 space-y-4 max-h-[calc(85vh-7rem)]">
              {/* Primary Actions */}
              <div>
                <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Quick Actions
                </p>
                <div className="space-y-1">
                  <Link
                    to="/contribute"
                    onClick={() => setIsMoreOpen(false)}
                    className={`flex items-center justify-between px-3.5 py-3 rounded-xl min-h-[44px] transition-colors ${
                      location.pathname === '/contribute'
                        ? 'bg-blue-50 text-blue-700 font-semibold'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                        <Upload className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold">Contribute Study Materials</div>
                        <div className="text-[11px] text-slate-500">Upload notes, assignments, PYQs</div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                  </Link>

                  <Link
                    to="/about"
                    onClick={() => setIsMoreOpen(false)}
                    className={`flex items-center justify-between px-3.5 py-3 rounded-xl min-h-[44px] transition-colors ${
                      location.pathname === '/about'
                        ? 'bg-blue-50 text-blue-700 font-semibold'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                        <GraduationCap className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold">About CampusNotes</div>
                        <div className="text-[11px] text-slate-500">Open access mission, platform &amp; FAQs</div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                  </Link>
                </div>
              </div>

              {/* Curriculum Categories */}
              <div>
                <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Study Categories
                </p>
                <div className="grid grid-cols-1 gap-1">
                  <Link
                    to="/category/question-banks"
                    onClick={() => setIsMoreOpen(false)}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg min-h-[44px] text-sm transition-colors ${
                      location.pathname === '/category/question-banks'
                        ? 'bg-blue-50 text-blue-700 font-semibold'
                        : 'text-slate-700 hover:bg-slate-50 hover:text-blue-600 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <HelpCircle className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>Question Banks</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </Link>

                  <Link
                    to="/category/notes"
                    onClick={() => setIsMoreOpen(false)}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg min-h-[44px] text-sm transition-colors ${
                      location.pathname === '/category/notes'
                        ? 'bg-blue-50 text-blue-700 font-semibold'
                        : 'text-slate-700 hover:bg-slate-50 hover:text-blue-600 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <BookOpen className="w-4 h-4 text-blue-500 shrink-0" />
                      <span>Lecture Notes</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </Link>

                  <Link
                    to="/category/assignments"
                    onClick={() => setIsMoreOpen(false)}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg min-h-[44px] text-sm transition-colors ${
                      location.pathname === '/category/assignments'
                        ? 'bg-blue-50 text-blue-700 font-semibold'
                        : 'text-slate-700 hover:bg-slate-50 hover:text-blue-600 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>Assignments</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </Link>

                  <Link
                    to="/category/experiments"
                    onClick={() => setIsMoreOpen(false)}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg min-h-[44px] text-sm transition-colors ${
                      location.pathname === '/category/experiments'
                        ? 'bg-blue-50 text-blue-700 font-semibold'
                        : 'text-slate-700 hover:bg-slate-50 hover:text-blue-600 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <FlaskConical className="w-4 h-4 text-purple-500 shrink-0" />
                      <span>Lab Practicals</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </Link>

                  <Link
                    to="/category/pyq"
                    onClick={() => setIsMoreOpen(false)}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg min-h-[44px] text-sm transition-colors ${
                      location.pathname === '/category/pyq'
                        ? 'bg-blue-50 text-blue-700 font-semibold'
                        : 'text-slate-700 hover:bg-slate-50 hover:text-blue-600 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <FileQuestion className="w-4 h-4 text-rose-500 shrink-0" />
                      <span>Previous Year Questions (PYQs)</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </Link>

                  <Link
                    to="/category/syllabus"
                    onClick={() => setIsMoreOpen(false)}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg min-h-[44px] text-sm transition-colors ${
                      location.pathname === '/category/syllabus'
                        ? 'bg-blue-50 text-blue-700 font-semibold'
                        : 'text-slate-700 hover:bg-slate-50 hover:text-blue-600 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <GraduationCap className="w-4 h-4 text-indigo-500 shrink-0" />
                      <span>Syllabus &amp; Curriculum</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </Link>
                </div>
              </div>

              {/* Administrative section (if logged in) */}
              {isAuthenticated && (
                <div className="pt-2 border-t border-slate-100">
                  <Link
                    to="/admin/dashboard"
                    onClick={() => setIsMoreOpen(false)}
                    className="flex items-center justify-between px-3.5 py-3 bg-emerald-50 text-emerald-800 rounded-xl min-h-[44px] font-semibold text-sm border border-emerald-200"
                  >
                    <div className="flex items-center gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Admin Dashboard</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-emerald-600 shrink-0" />
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

