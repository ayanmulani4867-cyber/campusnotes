import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  ArrowRight,
  BookOpen,
} from 'lucide-react';
import { StudyMaterial, Subject, Semester, CATEGORIES } from '../types';
import {
  subscribeToPublicMaterials,
  subscribeToPublicSubjects,
  subscribeToPublicSemesters,
  DEFAULT_INITIAL_SEMESTERS,
  isSubjectSemesterActive,
} from '../services/firebaseService';
import { sortStudyMaterialsAscending } from '../utils/materialSorting';
import { MaterialCard } from '../components/materials/MaterialCard';
import { cacheService } from '../services/cacheService';
import { OFFICIAL_CSE_SEM_5_SUBJECTS } from '../constants/subjects';
import {
  MaterialCardSkeleton,
  SubjectCardSkeleton,
} from '../components/common/Skeleton';

export const HomePage: React.FC = () => {
  // Synchronous state initialization from cache / static baseline for near-instant first paint
  const [materials, setMaterials] = useState<StudyMaterial[]>(() => {
    return (
      cacheService.get<StudyMaterial[]>('public_materials') ||
      cacheService.get<StudyMaterial[]>('public_materials_limit_150') ||
      cacheService.get<StudyMaterial[]>('public_materials_limit_100') ||
      []
    );
  });
  const [subjects, setSubjects] = useState<Subject[]>(() => {
    const cached = cacheService.get<Subject[]>('public_subjects');
    if (cached && cached.length > 0) return cached;
    return OFFICIAL_CSE_SEM_5_SUBJECTS.map((s) => ({
      ...s,
      createdAt: 0,
      updatedAt: 0,
    }));
  });
  const [semesters, setSemesters] = useState<Semester[]>(() => {
    const cached = cacheService.get<Semester[]>('public_semesters');
    if (cached && cached.length > 0) return cached;
    return DEFAULT_INITIAL_SEMESTERS.filter((s) => s.active !== false);
  });
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>('all');
  const [materialsLoading, setMaterialsLoading] = useState<boolean>(() => {
    const cached =
      cacheService.get<StudyMaterial[]>('public_materials') ||
      cacheService.get<StudyMaterial[]>('public_materials_limit_150') ||
      cacheService.get<StudyMaterial[]>('public_materials_limit_100');
    return !cached || cached.length === 0;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    const unsubMats = subscribeToPublicMaterials(
      (data) => {
        if (!isMounted) return;
        setMaterials(data);
        setMaterialsLoading(false);
      },
      150,
      (err) => {
        console.warn('Home materials listener notice:', err);
        if (isMounted) setMaterialsLoading(false);
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

    const unsubSems = subscribeToPublicSemesters(
      (data) => {
        if (!isMounted) return;
        setSemesters(data);
      },
      (err) => {
        console.warn('Home semesters listener notice:', err);
      }
    );

    return () => {
      isMounted = false;
      unsubMats();
      unsubSubs();
      unsubSems();
    };
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/materials?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  // Auto-reset selected semester if it was deactivated by an admin
  useEffect(() => {
    if (selectedSemesterId !== 'all' && semesters.length > 0) {
      const exists = semesters.some((s) => s.id === selectedSemesterId);
      if (!exists) {
        setSelectedSemesterId('all');
      }
    }
  }, [semesters, selectedSemesterId]);

  // All subjects across active semesters
  const allActiveSubjects = useMemo(() => {
    return subjects.filter(
      (s) => s.active !== false && isSubjectSemesterActive(s, semesters)
    );
  }, [subjects, semesters]);

  const filteredSubjects = useMemo(() => {
    if (selectedSemesterId === 'all') return allActiveSubjects;

    return allActiveSubjects.filter((s) => {
      // 1. Exact semesterId match
      if (s.semesterId && s.semesterId === selectedSemesterId) {
        return true;
      }
      // 2. Backward compatibility: subjects missing semesterId default to Semester 5
      if (!s.semesterId) {
        if (selectedSemesterId === 'sem_5') return true;
        const target = semesters.find((sem) => sem.id === selectedSemesterId);
        if (target && target.number === 5) return true;
        return false;
      }
      // 3. Fallback match by semester number
      const targetSem = semesters.find((sem) => sem.id === selectedSemesterId);
      if (targetSem && typeof s.semesterNumber === 'number') {
        return s.semesterNumber === targetSem.number;
      }
      return false;
    });
  }, [allActiveSubjects, selectedSemesterId, semesters]);

  const filteredMaterials = useMemo(() => {
    const activeSubjectIds = new Set(allActiveSubjects.map((s) => s.id));
    const valid = materials.filter((m) => activeSubjectIds.has(m.subjectId));
    const list =
      selectedCategory === 'all'
        ? valid
        : valid.filter((m) => m.category === selectedCategory);
    return sortStudyMaterialsAscending(list).slice(0, 12);
  }, [materials, selectedCategory, allActiveSubjects]);

  const selectedSemesterObj = semesters.find((s) => s.id === selectedSemesterId);

  return (
    <div className="space-y-8 sm:space-y-12 pb-16">
      {/* 1. Compact Hero Section & Search */}
      <section className="bg-white border-b border-slate-200 py-5 sm:py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 break-words">
            CampusNotes
          </h1>
          <p className="mt-2 text-xs sm:text-base text-slate-600 max-w-xl mx-auto">
            Clean, verified study materials, assignments, lecture notes, and lab practicals for engineering students.
          </p>

          {/* Simple Search Bar */}
          <form
            onSubmit={handleSearchSubmit}
            className="mt-4 sm:mt-5 max-w-lg mx-auto relative"
          >
            <div className="relative flex items-center bg-slate-50 border border-slate-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-600 focus-within:border-blue-600 focus-within:bg-white transition-all shadow-sm">
              <Search className="w-4 sm:w-5 h-4 sm:h-5 text-slate-400 ml-3 flex-shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search subject, assignment, unit, topic..."
                className="w-full min-h-[44px] py-2 pl-2.5 pr-24 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none bg-transparent"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="mr-1 min-h-[30px] px-2 text-xs text-slate-400 hover:text-slate-600 font-medium"
                  aria-label="Clear search"
                >
                  Clear
                </button>
              )}
              <button
                type="submit"
                className="mr-1.5 min-h-[34px] px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold rounded-md transition-colors shrink-0"
              >
                Search
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* 2. Curriculum Subjects Section */}
      <section className="w-full max-w-7xl mx-auto min-w-0 px-3.5 sm:px-6 lg:px-8 box-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 sm:mb-4">
          <div>
            <h2 className="text-base sm:text-xl font-bold text-slate-900">Curriculum Subjects</h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Choose your semester and subject to find notes, assignments, and practicals.
            </p>
          </div>
          <Link
            to="/subjects"
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 shrink-0 self-start sm:self-auto"
          >
            All Subjects &rarr;
          </Link>
        </div>

        {/* Dynamic Semester Selection Tabs */}
        {semesters.length > 0 && (
          <div className="w-full max-w-full min-w-0 overflow-x-auto pb-2 mb-4 no-scrollbar touch-pan-x">
            <div className="inline-flex items-center gap-1.5 min-w-max">
              <button
                type="button"
                onClick={() => setSelectedSemesterId('all')}
                className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors border cursor-pointer ${
                  selectedSemesterId === 'all'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                All Semesters
              </button>
              {semesters.map((sem) => {
                const isSelected = selectedSemesterId === sem.id;
                return (
                  <button
                    key={sem.id}
                    type="button"
                    onClick={() => setSelectedSemesterId(sem.id)}
                    className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors border cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {sem.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {subjects.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <SubjectCardSkeleton />
            <SubjectCardSkeleton />
            <SubjectCardSkeleton />
          </div>
        ) : filteredSubjects.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 sm:p-12 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
              <BookOpen className="w-6 h-6" />
            </div>
            <h3 className="text-sm sm:text-base font-semibold text-slate-900">
              No subjects available for {selectedSemesterObj?.name || 'this semester'} yet
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Lecture notes, lab manuals, and assignments for this semester will be published soon.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedSemesterId('all')}
                className="min-h-[34px] px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer"
              >
                View All Subjects
              </button>
              {selectedSemesterId !== 'sem_5' && (
                <button
                  type="button"
                  onClick={() => setSelectedSemesterId('sem_5')}
                  className="min-h-[34px] px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                >
                  View Semester 5
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {filteredSubjects.map((sub) => {
              return (
                <Link
                  key={sub.id}
                  to={`/subjects/${sub.id}`}
                  className="group bg-white border border-slate-200 rounded-xl p-4 sm:p-5 hover:border-blue-400 hover:shadow-sm transition-all flex flex-col justify-between active:scale-[0.99] active:bg-slate-50 touch-manipulation cursor-pointer"
                >
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors leading-snug">
                      {sub.name}
                    </h3>
                    <div className="mt-1.5 flex items-center flex-wrap gap-2 text-xs text-slate-500">
                      <span className="font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        Code: {sub.code}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="font-medium text-slate-600">
                        Semester {sub.semesterNumber ?? 5}
                      </span>
                    </div>
                    {sub.description && (
                      <p className="mt-2 text-xs text-slate-500 line-clamp-2">
                        {sub.description}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs sm:text-sm font-semibold text-blue-600 group-hover:text-blue-700">
                    <span>View Notes &amp; Materials</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* 3. Recent Study Materials */}
      <section className="w-full max-w-7xl mx-auto min-w-0 px-3.5 sm:px-6 lg:px-8 box-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 sm:mb-4">
          <div>
            <h2 className="text-base sm:text-xl font-bold text-slate-900">
              Recent Study Materials
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Verified documents with instant preview, download, and sharing
            </p>
          </div>
          <Link
            to="/materials"
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 self-start sm:self-auto shrink-0"
          >
            Browse All ({materials.length}) &rarr;
          </Link>
        </div>

        {/* Quick Category Filter Pills directly above materials */}
        <div className="w-full max-w-full min-w-0 overflow-x-auto pb-2 mb-4 no-scrollbar touch-pan-x">
          <div className="inline-flex items-center gap-1.5 min-w-max">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              All Categories
            </button>
            {CATEGORIES.slice(0, 5).map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(isSelected ? 'all' : cat.id)}
                  className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {cat.shortName}
                </button>
              );
            })}
          </div>
        </div>

        {materialsLoading ? (
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
