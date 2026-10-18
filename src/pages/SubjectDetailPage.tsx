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
    return materials.filter((m) => {
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
  }, [materials, selectedCategory, searchQuery]);

  if (!subjectLoading && !subject) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-12 space-y-6 sm:space-y-8">
      {/* Back Link */}
      <div>
        <Link
          to="/subjects"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Subjects</span>
        </Link>

        {/* Subject Header Banner */}
        {subjectLoading && !subject ? (
          <div className="bg-white rounded-lg border border-slate-200 p-4 sm:p-8 animate-pulse space-y-3">
            <div className="h-5 bg-slate-200 rounded w-24"></div>
            <div className="h-8 bg-slate-200 rounded w-3/4"></div>
            <div className="h-4 bg-slate-200 rounded w-1/2"></div>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-slate-200 p-4 sm:p-8">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="font-mono text-xs sm:text-sm font-medium px-2.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                {subject?.code}
              </span>
              <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                CSE Semester 5
              </span>
              <span className="text-xs font-medium text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                {materials.length} Published {materials.length === 1 ? 'Resource' : 'Resources'}
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 break-words">
              {subject?.name}
            </h1>

            <p className="text-xs sm:text-sm text-slate-600 mt-3 max-w-3xl leading-relaxed break-words">
              {subject?.description ||
                'Access all university examination notes, lab experiments, previous year question papers, and assignment sheets for this subject.'}
            </p>
          </div>
        )}
      </div>

      {/* Category Tabs & Quick Search */}
      <div className="space-y-4">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 no-scrollbar -mx-1 px-1">
          <button
            type="button"
            onClick={() => setSelectedCategory('')}
            className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors shrink-0 ${
              !selectedCategory
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
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
                className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 shrink-0 ${
                  isSelected
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <span>{cat.shortName}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isSelected ? 'bg-blue-700 text-blue-100' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search within subject */}
        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search within ${subject?.name || 'this subject'}...`}
            className="w-full min-h-[42px] pl-10 pr-4 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-800 placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Materials List */}
      {materialsLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
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
              ? `No published study materials under ${selectedCategory} for ${subject?.name}.`
              : `No published study materials found for ${subject?.name} yet.`
          }
          actionText={selectedCategory ? 'Show All Subject Materials' : 'Explore Other Subjects'}
          onActionClick={selectedCategory ? () => setSelectedCategory('') : undefined}
          actionTo={!selectedCategory ? '/subjects' : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {filteredMaterials.map((m) => (
            <MaterialCard key={m.id} material={m} subject={subject || undefined} />
          ))}
        </div>
      )}
    </div>
  );
};
