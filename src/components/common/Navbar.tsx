import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  GraduationCap,
  BookOpen,
  Menu,
  X,
  ShieldCheck,
  Layers,
  FileText,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { prefetchRoute } from '../../utils/routePrefetch';

export const Navbar: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Logo */}
          <Link
            to="/"
            onClick={() => {
              setMobileMenuOpen(false);
              setMoreMenuOpen(false);
            }}
            className="flex items-center gap-2 text-slate-900 hover:text-blue-600 transition-colors focus:outline-none shrink-0"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm">
              <GraduationCap className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
              CampusNotes
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1 text-sm font-medium">
            <Link
              to="/"
              className={`px-3 py-1.5 rounded-md transition-colors ${
                isActive('/')
                  ? 'text-blue-600 bg-blue-50 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Home
            </Link>

            <Link
              to="/subjects"
              onPointerEnter={() => prefetchRoute('subjects')}
              onTouchStart={() => prefetchRoute('subjects')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                isActive('/subjects')
                  ? 'text-blue-600 bg-blue-50 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Subjects
            </Link>

            <Link
              to="/materials"
              onPointerEnter={() => prefetchRoute('materials')}
              onTouchStart={() => prefetchRoute('materials')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                isActive('/materials')
                  ? 'text-blue-600 bg-blue-50 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Materials
            </Link>

            {/* Secondary navigation inside one simple menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md transition-colors ${
                  location.pathname.startsWith('/category') || isActive('/about')
                    ? 'text-blue-600 bg-blue-50 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
                aria-expanded={moreMenuOpen}
              >
                <span>More</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-150 ${
                    moreMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {moreMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setMoreMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-1.5 w-48 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-30 animate-in fade-in zoom-in-95 duration-100">
                    <Link
                      to="/category/assignments"
                      onClick={() => setMoreMenuOpen(false)}
                      className="flex items-center px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-600"
                    >
                      Assignments
                    </Link>
                    <Link
                      to="/category/notes"
                      onClick={() => setMoreMenuOpen(false)}
                      className="flex items-center px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-600"
                    >
                      Lecture Notes
                    </Link>
                    <Link
                      to="/category/experiments"
                      onClick={() => setMoreMenuOpen(false)}
                      className="flex items-center px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-600"
                    >
                      Lab Practicals
                    </Link>
                    <div className="my-1 border-t border-slate-100" />
                    <Link
                      to="/about"
                      onClick={() => setMoreMenuOpen(false)}
                      className="flex items-center px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-600"
                    >
                      About CampusNotes
                    </Link>
                  </div>
                </>
              )}
            </div>

            {isAuthenticated && (
              <Link
                to="/admin/dashboard"
                className="ml-2 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>Admin</span>
              </Link>
            )}
          </nav>

          {/* Mobile Menu Button */}
          <div className="flex lg:hidden items-center">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center p-2.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Clean Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1 shadow-lg">
          <Link
            to="/"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-800 hover:bg-slate-50 active:bg-slate-100 min-h-[44px]"
          >
            <BookOpen className="w-4 h-4 text-blue-600" />
            <span>Home</span>
          </Link>

          <Link
            to="/subjects"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-800 hover:bg-slate-50 active:bg-slate-100 min-h-[44px]"
          >
            <Layers className="w-4 h-4 text-blue-600" />
            <span>Subjects</span>
          </Link>

          <Link
            to="/category/assignments"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-800 hover:bg-slate-50 active:bg-slate-100 min-h-[44px]"
          >
            <FileText className="w-4 h-4 text-emerald-600" />
            <span>Assignments</span>
          </Link>

          <Link
            to="/category/notes"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-800 hover:bg-slate-50 active:bg-slate-100 min-h-[44px]"
          >
            <BookOpen className="w-4 h-4 text-amber-600" />
            <span>Lecture Notes</span>
          </Link>

          <Link
            to="/materials"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-800 hover:bg-slate-50 active:bg-slate-100 min-h-[44px]"
          >
            <FileText className="w-4 h-4 text-blue-600" />
            <span>All Materials</span>
          </Link>

          <Link
            to="/about"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-800 hover:bg-slate-50 active:bg-slate-100 min-h-[44px]"
          >
            <GraduationCap className="w-4 h-4 text-blue-600" />
            <span>About CampusNotes</span>
          </Link>

          {isAuthenticated && (
            <div className="pt-2 border-t border-slate-100">
              <Link
                to="/admin/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center gap-2 w-full min-h-[44px] py-2 bg-emerald-50 text-emerald-800 font-semibold rounded-lg border border-emerald-200 text-sm active:bg-emerald-100"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Admin Dashboard</span>
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
};
