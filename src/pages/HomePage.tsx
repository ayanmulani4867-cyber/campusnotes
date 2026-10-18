import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  BookOpen,
  ArrowRight,
  FileText,
  Layers,
  FlaskConical,
  Download,
} from 'lucide-react';
import { StudyMaterial, Subject, CATEGORIES, AcademicCategory } from '../types';
import {
  subscribeToPublicMaterials,
  subscribeToPublicSubjects,
} from '../services/firebaseService';
import { MaterialCard } from '../components/materials/MaterialCard';
import {
  MaterialCardSkeleton,
  SubjectCardSkeleton,
} from '../components/common/Skeleton';
import { EmptyState } from '../components/common/EmptyState';

export const HomePage: React.FC = () => {
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const unsubMats = subscribeToPublicMaterials(
      (data) => {
        if (!isMounted) return;
        setMaterials(data);
        setLoading(false);
      },
      20,
      (err) => {
        console.warn('Home materials listener notice:', err);
        if (isMounted) setLoading(false);
      }
    );

    const unsubSubs = subscribeToPublicSubjects(
      (data) => {
        if (!isMounted) return;
        setSubjects(data);
      },
      (err) => {
        console.warn('Home subjects listener notice:', err);
      }
    );

    return () => {
      isMounted = false;
      unsubMats();
      unsubSubs();
    };
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/materials?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const filteredMaterials = useMemo(() => {
    if (selectedCategory === 'all') return materials.slice(0, 8);
    return materials.filter((m) => m.category === selectedCategory).slice(0, 8);
  }, [materials, selectedCategory]);

  return (
    <div className="space-y-10 pb-16">
      {/* 1. Simple Hero Section with CampusNotes Branding */}
      <section className="bg-white border-b border-slate-200 pt-7 pb-8 sm:pt-12 sm:pb-14">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 break-words">
            CampusNotes
          </h1>
          <p className="mt-2.5 text-sm sm:text-base md:text-lg text-slate-600 max-w-2xl mx-auto">
            Simple, clean study materials, assignments, lab practicals, and previous year question papers for CSE Semester 5.
          </p>

          {/* Clear Search Bar */}
          <form
            onSubmit={handleSearchSubmit}
            className="mt-5 max-w-xl mx-auto relative"
          >
            <div className="relative flex items-center bg-slate-50 border border-slate-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-600 focus-within:border-blue-600 focus-within:bg-white transition-all shadow-sm">
              <Search className="w-4 sm:w-5 h-4 sm:h-5 text-slate-400 ml-3 flex-shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search topic or course code (e.g. 23CS3501)..."
                className="w-full min-h-[44px] py-2.5 pl-2.5 pr-20 text-xs sm:text-sm md:text-base text-slate-900 placeholder:text-slate-400 focus:outline-none bg-transparent"
              />
              <button
                type="submit"
                className="absolute right-1.5 min-h-[36px] px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs sm:text-sm font-semibold rounded-md transition-colors"
              >
                Search
              </button>
            </div>
          </form>

          {/* Quick search tags */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 text-xs text-slate-500">
            <span className="font-medium">Quick:</span>
            {['23CS3501', '23CS3502', '23CS3503', 'Java Lab', 'DAA Lab', 'ADB Lab'].map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => navigate(`/materials?search=${encodeURIComponent(q)}`)}
                className="min-h-[30px] px-2 py-0.5 rounded bg-slate-100 hover:bg-blue-50 hover:text-blue-700 active:bg-blue-100 text-slate-600 transition-colors inline-flex items-center"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 2. Straightforward Category Filters */}
      <section className="w-full max-w-7xl mx-auto min-w-0 px-3.5 sm:px-6 lg:px-8 box-border">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="text-base sm:text-lg font-bold text-slate-900">Filter by Category</h2>
          <Link
            to="/materials"
            className="text-xs font-semibold text-blue-600 hover:text-blue-800"
          >
            All Materials &rarr;
          </Link>
        </div>

        {/* Straightforward Category Pills */}
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`min-h-[38px] px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-medium border transition-colors inline-flex items-center ${
              selectedCategory === 'all'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 active:bg-slate-100'
            }`}
          >
            All Categories
          </button>
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(isSelected ? 'all' : cat.id)}
                className={`min-h-[38px] px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-medium border transition-colors inline-flex items-center ${
                  isSelected
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 active:bg-slate-100'
                }`}
              >
                {cat.name}
              </button>
            );
          })}
        </div>
      </section>

      {/* 3. Subjects Grid (Exact 9 Semester V Subjects) */}
      <section className="w-full max-w-7xl mx-auto min-w-0 px-3.5 sm:px-6 lg:px-8 box-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">Semester 5 Subjects</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select any of the 9 official curriculum subjects to view organized materials
            </p>
          </div>
          <Link
            to="/subjects"
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 self-start sm:self-auto"
          >
            View Subject List &rarr;
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <SubjectCardSkeleton />
            <SubjectCardSkeleton />
            <SubjectCardSkeleton />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {subjects.map((sub) => (
              <Link
                key={sub.id}
                to={`/subjects/${sub.id}`}
                className="bg-white border border-slate-200 rounded-lg p-4 sm:p-5 hover:border-slate-300 transition-colors flex flex-col justify-between active:scale-[0.99] active:bg-slate-50 touch-manipulation cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                      {sub.code}
                    </span>
                    <span className="text-[11px] text-slate-500">Semester 5</span>
                  </div>
                  <h3 className="text-base font-semibold text-slate-900 hover:text-blue-600 transition-colors">
                    {sub.name}
                  </h3>
                  {sub.description && (
                    <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">
                      {sub.description}
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-medium text-blue-600 min-h-[36px]">
                  <span>Open Subject</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* 4. Published Materials Section */}
      <section className="w-full max-w-7xl mx-auto min-w-0 px-3.5 sm:px-6 lg:px-8 box-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">
              {selectedCategory === 'all'
                ? 'Recent Study Materials'
                : CATEGORIES.find((c) => c.id === selectedCategory)?.name || 'Materials'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Verified documents with instant PDF preview and download
            </p>
          </div>
          <Link
            to={selectedCategory === 'all' ? '/materials' : `/category/${selectedCategory}`}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 self-start sm:self-auto"
          >
            View All ({materials.length}) &rarr;
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MaterialCardSkeleton />
            <MaterialCardSkeleton />
            <MaterialCardSkeleton />
            <MaterialCardSkeleton />
          </div>
        ) : filteredMaterials.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg p-8 text-center max-w-md mx-auto">
            <p className="text-sm font-semibold text-slate-800">No materials found</p>
            <p className="text-xs text-slate-500 mt-1">
              No materials match this category yet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredMaterials.map((item) => {
              const sub = subjects.find((s) => s.id === item.subjectId);
              return <MaterialCard key={item.id} material={item} subject={sub} />;
            })}
          </div>
        )}
      </section>
    </div>
  );
};
