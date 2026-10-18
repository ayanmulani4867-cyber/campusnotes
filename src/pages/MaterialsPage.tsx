import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { StudyMaterial, Subject, MaterialFilterState } from '../types';
import {
  subscribeToPublicMaterials,
  subscribeToPublicSubjects,
} from '../services/firebaseService';
import { MaterialCard } from '../components/materials/MaterialCard';
import { MaterialFilter } from '../components/materials/MaterialFilter';
import { MaterialCardSkeleton } from '../components/common/Skeleton';
import { EmptyState } from '../components/common/EmptyState';
import { FileText, RefreshCw } from 'lucide-react';
import { compareMaterialsAscending } from '../utils/materialSorting';

export const MaterialsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  // Initialize filter state from search params
  const [filters, setFilters] = useState<MaterialFilterState>({
    searchQuery: searchParams.get('search') || '',
    subjectId: searchParams.get('subject') || '',
    category: searchParams.get('category') || '',
    academicYear: searchParams.get('year') || '',
    sortBy: 'newest',
  });

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const unsubMats = subscribeToPublicMaterials(
      (mats) => {
        if (!isMounted) return;
        setMaterials(mats);
        setLoading(false);
      },
      150,
      (err) => {
        console.warn('Materials listener warning:', err);
        if (isMounted) setLoading(false);
      }
    );

    const unsubSubs = subscribeToPublicSubjects(
      (subs) => {
        if (!isMounted) return;
        setSubjects(subs);
      },
      (err) => {
        console.warn('Subjects listener warning:', err);
      }
    );

    return () => {
      isMounted = false;
      unsubMats();
      unsubSubs();
    };
  }, []);

  // Sync state changes with URL query parameters
  const handleFilterChange = (updates: Partial<MaterialFilterState>) => {
    setFilters((prev) => {
      const next = { ...prev, ...updates };

      const params: Record<string, string> = {};
      if (next.searchQuery) params.search = next.searchQuery;
      if (next.subjectId) params.subject = next.subjectId;
      if (next.category) params.category = next.category;
      if (next.academicYear) params.year = next.academicYear;

      setSearchParams(params, { replace: true });
      return next;
    });
  };

  const handleResetFilters = () => {
    setFilters({
      searchQuery: '',
      subjectId: '',
      category: '',
      academicYear: '',
      sortBy: 'newest',
    });
    setSearchParams({}, { replace: true });
  };

  // Filter and sort items efficiently
  const filteredMaterials = useMemo(() => {
    const q = filters.searchQuery.trim().toLowerCase();

    return materials
      .filter((m) => {
        // Only published items
        if (!m.published) return false;

        // Subject filter
        if (filters.subjectId && m.subjectId !== filters.subjectId) {
          return false;
        }

        // Category filter
        if (filters.category && m.category !== filters.category) {
          return false;
        }

        // Academic year filter
        if (filters.academicYear && m.academicYear !== filters.academicYear) {
          return false;
        }

        // Search text matching (title, description, tags, unit, subject name)
        if (q) {
          const matchTitle = m.title.toLowerCase().includes(q);
          const matchDesc = (m.description || '').toLowerCase().includes(q);
          const matchTags = m.tags ? m.tags.some((t) => t.toLowerCase().includes(q)) : false;
          const matchUnit =
            m.unitNumber !== undefined && m.unitNumber !== null
              ? `unit ${m.unitNumber}`.includes(q)
              : false;

          const subject = subjects.find((s) => s.id === m.subjectId);
          const matchSubject = subject
            ? subject.name.toLowerCase().includes(q) || subject.code.toLowerCase().includes(q)
            : false;

          if (!matchTitle && !matchDesc && !matchTags && !matchUnit && !matchSubject) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (filters.sortBy === 'newest') {
          return (b.createdAt || 0) - (a.createdAt || 0);
        }
        if (filters.sortBy === 'oldest') {
          return (a.createdAt || 0) - (b.createdAt || 0);
        }
        if (filters.sortBy === 'size') {
          return (b.fileSize || 0) - (a.fileSize || 0);
        }
        return compareMaterialsAscending(a, b);
      });
  }, [materials, subjects, filters]);

  return (
    <div className="w-full max-w-7xl mx-auto min-w-0 px-3.5 sm:px-6 lg:px-8 py-6 sm:py-12 space-y-6 sm:space-y-8 box-border">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-600 mb-1">
          <FileText className="w-4 h-4" />
          <span>Academic Resource Directory</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 break-words">
          All Study Materials
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
          Browse, filter, and download verified notes, assignment solutions, laboratory practicals, and previous year examination papers for CSE Semester 5.
        </p>
      </div>

      {/* Filter and Search Panel */}
      <MaterialFilter
        filters={filters}
        subjects={subjects}
        onFilterChange={handleFilterChange}
        onReset={handleResetFilters}
        totalResults={filteredMaterials.length}
      />

      {/* Results Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 w-full max-w-full min-w-0">
          <MaterialCardSkeleton />
          <MaterialCardSkeleton />
          <MaterialCardSkeleton />
          <MaterialCardSkeleton />
          <MaterialCardSkeleton />
          <MaterialCardSkeleton />
          <MaterialCardSkeleton />
          <MaterialCardSkeleton />
        </div>
      ) : filteredMaterials.length === 0 ? (
        <EmptyState
          icon="search"
          title="No Matching Materials Found"
          description="We couldn't find any documents matching your current filter criteria. Try adjusting the search keywords or resetting filters."
          actionText="Reset All Filters"
          onActionClick={handleResetFilters}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 w-full max-w-full min-w-0">
          {filteredMaterials.map((material) => {
            const subject = subjects.find((s) => s.id === material.subjectId);
            return <MaterialCard key={material.id} material={material} subject={subject} />;
          })}
        </div>
      )}
    </div>
  );
};
