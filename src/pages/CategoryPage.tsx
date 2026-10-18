import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { BookOpen, Search, ArrowLeft, Filter, Layers } from 'lucide-react';
import {
  AcademicCategory,
  CATEGORIES,
  StudyMaterial,
  Subject,
} from '../types';
import {
  getPublicMaterials,
  getPublicSubjects,
} from '../services/firebaseService';
import { OFFICIAL_CSE_SEM_5_SUBJECTS } from '../constants/subjects';
import { MaterialCard } from '../components/materials/MaterialCard';
import { MaterialCardSkeleton } from '../components/common/Skeleton';
import { EmptyState } from '../components/common/EmptyState';
import { sortStudyMaterialsAscending } from '../utils/materialSorting';

export const CategoryPage: React.FC = () => {
  const { categorySlug } = useParams<{ categorySlug: string }>();

  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters within category
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const currentCategory = CATEGORIES.find((c) => c.id === categorySlug);

  useEffect(() => {
    async function loadCategoryData() {
      try {
        setLoading(true);
        const [mats, subs] = await Promise.all([
          getPublicMaterials(150),
          getPublicSubjects(),
        ]);
        setMaterials(mats);
        setSubjects(
          subs && subs.length > 0
            ? subs
            : OFFICIAL_CSE_SEM_5_SUBJECTS.map((s) => ({
                ...s,
                createdAt: Date.now(),
                updatedAt: Date.now(),
              }))
        );
      } catch (err) {
        console.error('Error loading category materials:', err);
        setSubjects(
          OFFICIAL_CSE_SEM_5_SUBJECTS.map((s) => ({
            ...s,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }))
        );
      } finally {
        setLoading(false);
      }
    }

    loadCategoryData();
  }, [categorySlug]);

  const filteredMaterials = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const filtered = materials.filter((m) => {
      if (!m.published) return false;
      if (m.category !== categorySlug) return false;
      if (selectedSubjectId && m.subjectId !== selectedSubjectId) return false;

      if (q) {
        const matchTitle = m.title.toLowerCase().includes(q);
        const matchDesc = (m.description || '').toLowerCase().includes(q);
        const matchTags = m.tags ? m.tags.some((t) => t.toLowerCase().includes(q)) : false;
        const sub = subjects.find((s) => s.id === m.subjectId);
        const matchSub = sub
          ? sub.name.toLowerCase().includes(q) || sub.code.toLowerCase().includes(q)
          : false;

        if (!matchTitle && !matchDesc && !matchTags && !matchSub) return false;
      }

      return true;
    });
    return sortStudyMaterialsAscending(filtered);
  }, [materials, categorySlug, selectedSubjectId, searchQuery, subjects]);

  if (!currentCategory) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <EmptyState
          icon="folder"
          title="Category Not Recognized"
          description="The requested category is not part of the CSE Semester 5 academic structure."
          actionText="Browse All Materials"
          actionTo="/materials"
        />
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto min-w-0 px-3.5 sm:px-6 lg:px-8 py-6 sm:py-12 space-y-6 sm:space-y-8 box-border">
      {/* Back button */}
      <div>
        <Link
          to="/materials"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Materials</span>
        </Link>

        {/* Category Header Banner */}
        <div className="bg-white rounded-lg border border-slate-200 p-4 sm:p-8 w-full max-w-full min-w-0 box-border">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${currentCategory.badgeColor}`}
            >
              Academic Category
            </span>
            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              CSE Semester 5
            </span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 break-words">
            {currentCategory.name}
          </h1>

          <p className="text-xs sm:text-sm text-slate-600 mt-2 max-w-3xl leading-relaxed break-words">
            {currentCategory.description}
          </p>
        </div>
      </div>

      {/* Filter Row: Subject Dropdown + Search */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${currentCategory.shortName.toLowerCase()}...`}
            className="w-full min-h-[42px] pl-10 pr-4 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-800 placeholder:text-slate-400"
          />
        </div>

        {/* Subject Filter */}
        <div className="w-full sm:w-72">
          <select
            value={selectedSubjectId}
            onChange={(e) => setSelectedSubjectId(e.target.value)}
            className="w-full min-h-[42px] text-xs sm:text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
          >
            <option value="">All Subjects</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Material Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 w-full max-w-full min-w-0">
          <MaterialCardSkeleton />
          <MaterialCardSkeleton />
          <MaterialCardSkeleton />
          <MaterialCardSkeleton />
        </div>
      ) : filteredMaterials.length === 0 ? (
        <EmptyState
          icon="folder"
          title={`No ${currentCategory.shortName} Published Yet`}
          description={`There are currently no published study materials under ${currentCategory.name} matching your filter.`}
          actionText="View All Materials"
          actionTo="/materials"
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 w-full max-w-full min-w-0">
          {filteredMaterials.map((m) => {
            const subject = subjects.find((s) => s.id === m.subjectId);
            return <MaterialCard key={m.id} material={m} subject={subject} />;
          })}
        </div>
      )}
    </div>
  );
};
