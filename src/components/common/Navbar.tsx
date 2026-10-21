import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  GraduationCap,
  BookOpen,
  Search,
  Menu,
  X,
  ShieldCheck,
  ChevronDown,
  Layers,
  FileText,
  FlaskConical,
  Share2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { CATEGORIES } from '../../types';
import { OFFICIAL_CSE_SEM_5_SUBJECTS } from '../../constants/subjects';
import { prefetchRoute } from '../../utils/routePrefetch';

export const Navbar: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/materials?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
      setMobileMenuOpen(false);
    }
  };

  const isActive = (path: string) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo & Simple Public Brand: CampusNotes */}
          <Link
            to="/"
            className="flex items-center gap-2.5 text-slate-900 hover:text-blue-600 transition-colors focus:outline-none"
          >
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm">
              <GraduationCap className="w-5 h-5" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">
              CampusNotes
            </span>
          </Link>

          {/* Desktop Search Bar */}
          <form
            onSubmit={handleSearchSubmit}
            className="hidden md:flex flex-1 max-w-xs xl:max-w-sm mx-3 relative"
          >
            <div className="relative w-full">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search notes, assignments, experiments..."
                className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-100 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-slate-800 placeholder:text-slate-400 transition-all"
              />
            </div>
          </form>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1 text-sm font-medium">
            <Link
              to="/"
              className={`px-3 py-1.5 rounded-md transition-colors ${
                isActive('/') && location.pathname === '/'
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
                isActive('/materials') && !location.search.includes('assignments') && !location.search.includes('experiments')
                  ? 'text-blue-600 bg-blue-50 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Materials
            </Link>

            <Link
              to="/category/assignments"
              onPointerEnter={() => prefetchRoute('category')}
              onTouchStart={() => prefetchRoute('category')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                location.pathname === '/category/assignments'
                  ? 'text-blue-600 bg-blue-50 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Assignments
            </Link>

            <Link
              to="/category/experiments"
              onPointerEnter={() => prefetchRoute('category')}
              onTouchStart={() => prefetchRoute('category')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                location.pathname === '/category/experiments'
                  ? 'text-blue-600 bg-blue-50 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Experiments
            </Link>

            {/* Categories Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setCategoriesOpen(!categoriesOpen)}
                onPointerEnter={() => prefetchRoute('category')}
                onBlur={() => setTimeout(() => setCategoriesOpen(false), 200)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md transition-colors ${
                  location.pathname.startsWith('/category') &&
                  location.pathname !== '/category/assignments' &&
                  location.pathname !== '/category/experiments'
                    ? 'text-blue-600 bg-blue-50 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>More Categories</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-70" />
              </button>

              {categoriesOpen && (
                <div className="absolute right-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-slate-200 py-1.5 z-50">
                  {CATEGORIES.map((cat) => (
                    <Link
                      key={cat.id}
                      to={`/category/${cat.id}`}
                      onPointerEnter={() => prefetchRoute('category')}
                      onClick={() => setCategoriesOpen(false)}
                      className="flex items-center justify-between px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors"
                    >
                      <span className="font-medium">{cat.shortName}</span>
                    </Link>
                  ))}
                  <div className="border-t border-slate-100 my-1"></div>
                  <Link
                    to="/share-assignment"
                    onPointerEnter={() => prefetchRoute('shareAssignment')}
                    onClick={() => setCategoriesOpen(false)}
                    className="flex items-center justify-between px-3 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50/60 hover:bg-emerald-100 transition-colors rounded-b-md"
                  >
                    <span className="flex items-center gap-1.5">
                      <Share2 className="w-3.5 h-3.5 text-emerald-600" />
                      Share Assignment
                    </span>
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide">WhatsApp</span>
                  </Link>
                </div>
              )}
            </div>

            <Link
              to="/about"
              onPointerEnter={() => prefetchRoute('about')}
              onTouchStart={() => prefetchRoute('about')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                isActive('/about')
                  ? 'text-blue-600 bg-blue-50 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              About
            </Link>
          </nav>

          {/* Right Action: Admin Access (authenticated admins only) */}
          {isAuthenticated && (
            <div className="hidden sm:flex items-center gap-2">
              <Link
                to="/admin/dashboard"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>Admin Dashboard</span>
              </Link>
            </div>
          )}

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

        {/* Mobile Search Bar */}
        <div className="md:hidden pb-3">
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notes, assignments, experiments..."
              className="w-full min-h-[42px] pl-9 pr-3 py-2 text-sm bg-slate-100 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-800 placeholder:text-slate-400"
            />
          </form>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1">
          <Link
            to="/"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-800 hover:bg-slate-50 active:bg-slate-100 min-h-[44px]"
          >
            <BookOpen className="w-4 h-4 text-blue-600" />
            <span>Home</span>
          </Link>

          <Link
            to="/subjects"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-800 hover:bg-slate-50 active:bg-slate-100 min-h-[44px]"
          >
            <Layers className="w-4 h-4 text-blue-600" />
            <span>Subjects</span>
          </Link>

          <Link
            to="/materials"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-800 hover:bg-slate-50 active:bg-slate-100 min-h-[44px]"
          >
            <FileText className="w-4 h-4 text-blue-600" />
            <span>All Materials</span>
          </Link>

          <Link
            to="/category/assignments"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-800 hover:bg-slate-50 active:bg-slate-100 min-h-[44px]"
          >
            <FileText className="w-4 h-4 text-emerald-600" />
            <span>Assignments (30)</span>
          </Link>

          <Link
            to="/share-assignment"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-emerald-800 bg-emerald-50/70 hover:bg-emerald-100 active:bg-emerald-100 min-h-[44px]"
          >
            <Share2 className="w-4 h-4 text-emerald-600" />
            <span>Share Assignment (WhatsApp)</span>
          </Link>

          <Link
            to="/category/experiments"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-800 hover:bg-slate-50 active:bg-slate-100 min-h-[44px]"
          >
            <FlaskConical className="w-4 h-4 text-purple-600" />
            <span>Experiments / Practicals (32)</span>
          </Link>

          {/* Semester 5 Subjects Section */}
          <div className="pt-2 pb-1 border-t border-slate-100">
            <div className="flex items-center justify-between px-3 py-1">
              <p className="text-xs font-semibold uppercase text-slate-400">
                Semester 5 Subjects
              </p>
              <Link
                to="/subjects"
                onClick={() => setMobileMenuOpen(false)}
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-800"
              >
                All 9 Subjects &rarr;
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-1 mt-1 max-h-56 overflow-y-auto pr-1">
              {OFFICIAL_CSE_SEM_5_SUBJECTS.map((sub) => (
                <Link
                  key={sub.id}
                  to={`/subjects/${sub.id}`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-between px-3 py-2 rounded-lg text-xs text-slate-700 hover:bg-slate-100 active:bg-slate-200 min-h-[38px] transition-colors"
                >
                  <span className="font-medium truncate pr-2">{sub.name}</span>
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                    {sub.code}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          <div className="pt-2 pb-1 border-t border-slate-100">
            <p className="px-3 text-xs font-semibold uppercase text-slate-400">
              Categories
            </p>
            <div className="grid grid-cols-2 gap-1.5 mt-1.5">
              {CATEGORIES.map((cat) => (
                <Link
                  key={cat.id}
                  to={`/category/${cat.id}`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2 rounded-lg text-xs text-slate-700 hover:bg-slate-100 active:bg-slate-200 min-h-[38px] flex items-center"
                >
                  {cat.shortName}
                </Link>
              ))}
            </div>
          </div>

          <Link
            to="/about"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-800 hover:bg-slate-50 active:bg-slate-100 min-h-[44px]"
          >
            <GraduationCap className="w-4 h-4 text-blue-600" />
            <span>About</span>
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
