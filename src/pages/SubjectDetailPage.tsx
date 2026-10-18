import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Layers,
  ArrowLeft,
  Search,
  BookOpen,
  Filter,
  FileText,
  Calendar,
  X,
  RotateCcw,
} from 'lucide-react';
import { Subject, StudyMaterial, CATEGORIES, AcademicCategory } from '../types';
import { OFFICIAL_CSE_SEM_5_SUBJECTS } from '../constants/subjects';
import {
  subscribeToPublicSubjects,
  subscribeToSubjectMaterials,
} from '../services/firebaseService';
import { MaterialCard } from '../components/materials/MaterialCard';
import { MaterialCardSkeleton } from '../components/common/Skeleton';
import { EmptyState } from '../components/common/EmptyState';
import { sortStudyMaterialsAscending } from '../utils/materialSorting';

export const SubjectDetailPage: React.FC = () => {
  const { subjectId } = useParams<{ subjectId: string }>();

  const [subject, setSubject] = useState<Subject | null>(null);
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [subjectLoading, setSubjectLoading] = useState(true);
  const [materialsLoading, setMaterialsLoading] = useState(true);

  // Filters within subject
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!subjectId) return;
    let isMounted = true;
    setSubjectLoading(true);
    setMaterialsLoading(true);

    const rawId = decodeURIComponent(subjectId).trim();
    const normalized = rawId.toLowerCase();

    // 1. Instant matching from static curriculum to guarantee ZERO latency on mobile
    const instantMatch = OFFICIAL_CSE_SEM_5_SUBJECTS.find(
      (s) =>
        s.id.toLowerCase() === normalized ||
        s.code.toLowerCase() === normalized ||
        s.name.toLowerCase() === normalized
    );

    if (instantMatch) {
      setSubject({
        ...instantMatch,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      setSubjectLoading(false);
    }

    const canonicalId = instantMatch ? instantMatch.id : rawId;

    // 2. Real-time subscription to subjects
    const unsubSubs = subscribeToPublicSubjects(
      (subs) => {
        if (!isMounted) return;
        const currentSubject =
          subs.find(
            (s) =>
              s.id.toLowerCase() === normalized ||
              s.code.toLowerCase() === normalized ||
              s.name.toLowerCase() === normalized
          ) ||
          instantMatch ||
          null;

        if (currentSubject) {
          setSubject({
            ...currentSubject,
            createdAt:
              'createdAt' in currentSubject && typeof currentSubject.createdAt === 'number'
                ? currentSubject.createdAt
                : Date.now(),
            updatedAt:
              'updatedAt' in currentSubject && typeof currentSubject.updatedAt === 'number'
                ? currentSubject.updatedAt
                : Date.now(),
          });
        } else {
          setSubject(null);
        }
        setSubjectLoading(false);
      },
      (err) => {
        console.warn('Subject detail subjects listener notice:', err);
        if (isMounted) setSubjectLoading(false);
      }
    );

    // 3. Real-time subscription to materials for this subject
    const unsubMats = subscribeToSubjectMaterials(
      canonicalId,
      (mats) => {
        if (!isMounted) return;
        setMaterials(mats);
        setMaterialsLoading(false);
      },
      (err) => {
        console.warn('Subject materials listener warning:', err);
        if (isMounted) setMaterialsLoading(false);
      }
    );

    return () => {
      isMounted = false;
      unsubSubs();
      unsubMats();
    };
  }, [subjectId]);

  const filteredMaterials = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = materials.filter((m) => {
      if (!m.published) return false;
      if (selectedCategory && m.category !== selectedCategory) return false;
      if (q) {
        const matchTitle = m.title.toLowerCase().includes(q);
        const matchDesc = (m.description || '').toLowerCase().includes(q);
        const matchTags = m.tags ? m.tags.some((t) => t.toLowerCase().includes(q)) : false;
        const matchUnit =
          m.unitNumber !== undefined && m.unitNumber !== null
            ? `unit ${m.unitNumber}`.includes(q)
            : false;
        if (!matchTitle && !matchDesc && !matchTags && !matchUnit) return false;
      }
      return true;
    });
    return sortStudyMaterialsAscending(filtered);
  }, [materials, selectedCategory, searchQuery]);

  const activeCategoryMeta = CATEGORIES.find((c) => c.id === selectedCategory);

  if (!subjectLoading && !subject) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 sm:py-16 text-center">
        <EmptyState
          icon="folder"
          title="Subject Not Found"
          description="The requested CSE Semester 5 subject does not exist or may have been deactivated."
          actionText="Return to All Subjects"
          actionTo="/subjects"
        />
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto min-w-0 px-3.5 sm:px-6 lg:px-8 py-4 sm:py-8 lg:py-12 space-y-4 sm:space-y-6 lg:space-y-8 box-border">
      {/* Back Link */}
      <div>
        <Link
          to="/subjects"
          className="min-h-[44px] inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-600 hover:text-blue-600 active:text-blue-700 transition-colors mb-2 sm:mb-4 px-2 py-1 -ml-2 rounded-lg hover:bg-slate-100 active:bg-slate-200"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Subjects</span>
        </Link>

        {/* Subject Header Banner */}
        {subjectLoading && !subject ? (
          <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 p-4 sm:p-6 lg:p-8 animate-pulse space-y-3 shadow-sm w-full max-w-full min-w-0 box-border">
            <div className="h-5 bg-slate-200 rounded w-28"></div>
            <div className="h-7 sm:h-9 bg-slate-200 rounded w-3/4"></div>
            <div className="h-4 bg-slate-200 rounded w-1/2"></div>
          </div>
        ) : (
          <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 p-4 sm:p-6 lg:p-8 shadow-sm w-full max-w-full min-w-0 box-border">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-2.5 sm:mb-3 min-w-0">
              <span className="font-mono text-xs sm:text-sm font-bold px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                {subject?.code}
              </span>
              <span className="text-[11px] sm:text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200 shrink-0">
                CSE Semester 5
              </span>
              <span className="text-[11px] sm:text-xs font-semibold text-slate-700 bg-slate-50 px-2.5 py-0.5 rounded-md border border-slate-200 shrink-0">
                {materials.length} Published {materials.length === 1 ? 'Resource' : 'Resources'}
              </span>
            </div>

            <h1 className="text-xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900 break-words leading-snug">
              {subject?.name}
            </h1>

            <p className="text-xs sm:text-sm text-slate-600 mt-2 sm:mt-3 leading-relaxed break-words">
              {subject?.description ||
                'Access all university examination notes, lab experiments, previous year question papers, and assignment sheets for this subject.'}
            </p>
          </div>
        )}
      </div>

      {/* Category Tabs & Quick Search */}
      <div className="space-y-3 w-full max-w-full min-w-0">
        {/* Mobile Quick Category Selector Dropdown (visible on narrow screens) */}
        <div className="sm:hidden w-full min-w-0">
          <label htmlFor="mobile-cat-select" className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1 px-1">
            Browse Category
          </label>
          <select
            id="mobile-cat-select"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full min-h-[44px] px-3.5 py-2.5 text-xs font-semibold bg-white border border-slate-200 rounded-xl text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-600 box-border"
          >
            <option value="">All Resources ({materials.length})</option>
            {CATEGORIES.map((cat) => {
              const count = materials.filter((m) => m.category === cat.id && m.published).length;
              return (
                <option key={cat.id} value={cat.id}>
                  {cat.name} ({count})
                </option>
              );
            })}
          </select>
        </div>

        {/* Strictly Contained Horizontal Category Pills */}
        <div className="w-full max-w-full min-w-0 overflow-x-auto pb-1.5 no-scrollbar scroll-smooth touch-pan-x">
          <div className="inline-flex items-center gap-1.5 min-w-max">
            <button
              type="button"
              onClick={() => setSelectedCategory('')}
              className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0 active:scale-95 ${
                !selectedCategory
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                  : 'bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100 border border-slate-200 shadow-sm'
              }`}
            >
              All Resources ({materials.length})
            </button>
            {CATEGORIES.map((cat) => {
              const count = materials.filter((m) => m.category === cat.id && m.published).length;
              const isSelected = selectedCategory === cat.id;

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(isSelected ? '' : cat.id)}
                  className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 active:scale-95 ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                      : 'bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100 border border-slate-200 shadow-sm'
                  }`}
                >
                  <span>{cat.shortName}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isSelected ? 'bg-blue-700 text-blue-100' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Search within subject */}
        <div className="relative max-w-md w-full min-w-0">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search within ${subject?.code || 'this subject'}...`}
            className="w-full min-h-[44px] pl-10 pr-10 py-2.5 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-800 placeholder:text-slate-400 shadow-sm transition-all box-border"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-slate-600"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Active Filter Summary Bar */}
        {(selectedCategory || searchQuery) && (
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-blue-50/80 border border-blue-100 rounded-xl text-xs text-blue-900 w-full min-w-0 box-border">
            <span className="font-medium break-words">
              Showing {filteredMaterials.length} of {materials.length} resources
              {activeCategoryMeta && ` under "${activeCategoryMeta.name}"`}
              {searchQuery && ` matching "${searchQuery}"`}
            </span>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('');
                setSearchQuery('');
              }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900 underline min-h-[36px] px-2 active:opacity-75"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>
        )}
      </div>

      {/* Materials List */}
      {materialsLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-6 w-full max-w-full min-w-0">
          <MaterialCardSkeleton />
          <MaterialCardSkeleton />
          <MaterialCardSkeleton />
          <MaterialCardSkeleton />
        </div>
      ) : filteredMaterials.length === 0 ? (
        <EmptyState
          icon="folder"
          title="No Materials in this Category"
          description={
            selectedCategory
              ? `No published study materials under ${activeCategoryMeta?.name || selectedCategory} for ${subject?.name}.`
              : `No published study materials found for ${subject?.name} matching your filter.`
          }
          actionText={selectedCategory ? 'Show All Subject Materials' : 'Explore Other Subjects'}
          onActionClick={selectedCategory ? () => setSelectedCategory('') : undefined}
          actionTo={!selectedCategory ? '/subjects' : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-6 w-full max-w-full min-w-0">
          {filteredMaterials.map((m) => (
            <MaterialCard key={m.id} material={m} subject={subject || undefined} />
          ))}
        </div>
      )}
    </div>
  );
};
