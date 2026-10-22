import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Layers,
  ArrowRight,
} from 'lucide-react';
import { Subject, StudyMaterial, Semester } from '../types';
import { OFFICIAL_CSE_SEM_5_SUBJECTS } from '../constants/subjects';
import {
  subscribeToPublicSubjects,
  subscribeToPublicMaterials,
  subscribeToPublicSemesters,
  getPublicSemesters,
  isSubjectSemesterActive,
  DEFAULT_SEMESTER_5,
} from '../services/firebaseService';
import { SubjectCardSkeleton } from '../components/common/Skeleton';
import { EmptyState } from '../components/common/EmptyState';
import { cacheService } from '../services/cacheService';

export const SubjectsPage: React.FC = () => {
  // Synchronous state initialization from cache / static baseline for instant render
  const [subjects, setSubjects] = useState<Subject[]>(() => {
    const cached = cacheService.get<Subject[]>('public_subjects');
    if (cached && cached.length > 0) return cached;
    return OFFICIAL_CSE_SEM_5_SUBJECTS.map((s) => ({
      ...s,
      semesterId: 'sem_5',
      semesterNumber: 5,
      createdAt: 0,
      updatedAt: 0,
    }));
  });

  const [semesters, setSemesters] = useState<Semester[]>(() => {
    const cached = cacheService.get<Semester[]>('public_semesters');
    if (cached && cached.length > 0) return cached;
    return [DEFAULT_SEMESTER_5];
  });

  const [selectedSemesterId, setSelectedSemesterId] = useState<string>('all');

  const [materials, setMaterials] = useState<StudyMaterial[]>(() => {
    return (
      cacheService.get<StudyMaterial[]>('public_materials') ||
      cacheService.get<StudyMaterial[]>('public_materials_limit_150') ||
      cacheService.get<StudyMaterial[]>('public_materials_limit_100') ||
      []
    );
  });
  const [loading, setLoading] = useState<boolean>(() => {
    const cached = cacheService.get<Subject[]>('public_subjects');
    return (!cached || cached.length === 0) && OFFICIAL_CSE_SEM_5_SUBJECTS.length === 0;
  });

  useEffect(() => {
    let isMounted = true;

    // Initial fetch from getPublicSemesters
    getPublicSemesters()
      .then((sems) => {
        if (!isMounted) return;
        if (sems && sems.length > 0) setSemesters(sems);
      })
      .catch(() => {});

    const unsubSems = subscribeToPublicSemesters(
      (sems) => {
        if (!isMounted) return;
        setSemesters(sems && sems.length > 0 ? sems : [DEFAULT_SEMESTER_5]);
      },
      (err) => console.warn('Subjects page semesters listener notice:', err)
    );

    const unsubSubs = subscribeToPublicSubjects(
      (subs) => {
        if (!isMounted) return;
        setSubjects(subs);
        setLoading(false);
      },
      (err) => {
        console.warn('Subjects page subjects listener notice:', err);
        if (isMounted) setLoading(false);
      }
    );

    const unsubMats = subscribeToPublicMaterials(
      (mats) => {
        if (!isMounted) return;
        setMaterials(mats);
      },
      150,
      (err) => console.warn('Subjects page materials listener notice:', err)
    );

    return () => {
      isMounted = false;
      unsubSems();
      unsubSubs();
      unsubMats();
    };
  }, []);

  // Auto-reset selected semester if it was deactivated by an admin
  useEffect(() => {
    if (selectedSemesterId !== 'all' && semesters.length > 0) {
      const exists = semesters.some((s) => s.id === selectedSemesterId);
      if (!exists) {
        setSelectedSemesterId('all');
      }
    }
  }, [semesters, selectedSemesterId]);

  const getMaterialCountForSubject = (subjectId: string): number => {
    return materials.filter((m) => m.subjectId === subjectId && m.published).length;
  };

  const filteredSubjects = useMemo(() => {
    // Only subjects whose semester is currently active
    const active = subjects.filter(
      (s) => s.active !== false && isSubjectSemesterActive(s, semesters)
    );
    if (selectedSemesterId === 'all') return active;

    return active.filter((s) => {
      if (s.semesterId && s.semesterId === selectedSemesterId) return true;
      const targetSem = semesters.find((sem) => sem.id === selectedSemesterId);
      if (targetSem && typeof s.semesterNumber === 'number') {
        return s.semesterNumber === targetSem.number;
      }
      if (!s.semesterId && (selectedSemesterId === 'sem_5' || (targetSem && targetSem.number === 5))) {
        return true;
      }
      return false;
    });
  }, [subjects, selectedSemesterId, semesters]);

  const activeSemesterObj = semesters.find((s) => s.id === selectedSemesterId);

  return (
    <div className="w-full max-w-7xl mx-auto min-w-0 px-3.5 sm:px-6 lg:px-8 py-6 sm:py-12 space-y-6 sm:space-y-8 box-border">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-600 mb-1">
          <Layers className="w-4 h-4" />
          <span>Curriculum Structure</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 break-words">
          {selectedSemesterId === 'all'
            ? 'Curriculum Subjects'
            : `${activeSemesterObj?.name || 'Curriculum'} Subjects`}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
          {selectedSemesterId === 'all'
            ? 'Comprehensive curriculum subjects for engineering students. Explore verified study notes, practical files, and previous year exam questions.'
            : `Curriculum subjects and verified study materials for ${activeSemesterObj?.name || 'this semester'}.`}
        </p>
      </div>

      {/* Semester Filter Tabs */}
      {semesters.length > 1 && (
        <div className="w-full max-w-full min-w-0 overflow-x-auto pb-1 no-scrollbar touch-pan-x">
          <div className="inline-flex items-center gap-1.5 min-w-max">
            <button
              type="button"
              onClick={() => setSelectedSemesterId('all')}
              className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors border ${
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
                  onClick={() => setSelectedSemesterId(isSelected ? 'all' : sem.id)}
                  className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors border ${
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

      {/* Subjects Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 w-full max-w-full min-w-0">
          <SubjectCardSkeleton />
          <SubjectCardSkeleton />
          <SubjectCardSkeleton />
          <SubjectCardSkeleton />
          <SubjectCardSkeleton />
          <SubjectCardSkeleton />
        </div>
      ) : filteredSubjects.length === 0 ? (
        <EmptyState
          title="No Subjects Available"
          description={
            selectedSemesterId === 'all'
              ? 'Official subjects have not been configured in the database yet. The administrator can initialize them from the Admin Portal.'
              : `No subjects have been configured for ${activeSemesterObj?.name || 'this semester'} yet.`
          }
          actionText="Admin Portal"
          actionTo="/admin/login"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 w-full max-w-full min-w-0">
          {filteredSubjects.map((sub) => {
            const count = getMaterialCountForSubject(sub.id);
            const semDisplay =
              semesters.find((s) => s.id === (sub.semesterId || 'sem_5'))?.name ||
              `Semester ${sub.semesterNumber || 5}`;

            return (
              <Link
                key={sub.id}
                to={`/subjects/${sub.id}`}
                className="group bg-white rounded-lg border border-slate-200 p-4 sm:p-6 hover:border-slate-300 transition-colors flex flex-col justify-between active:scale-[0.99] active:bg-slate-50 touch-manipulation cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                        {sub.code}
                      </span>
                      <span className="text-[11px] font-medium text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                        {semDisplay}
                      </span>
                    </div>
                    <span className="text-xs font-normal text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                      {count} {count === 1 ? 'Material' : 'Materials'}
                    </span>
                  </div>

                  <h3 className="text-base sm:text-lg font-semibold text-slate-900 group-hover:text-blue-600 transition-colors break-words">
                    {sub.name}
                  </h3>

                  <p className="text-xs text-slate-500 mt-2 line-clamp-3 leading-relaxed break-words">
                    {sub.description ||
                      'Standard university curriculum course for Computer Science and Engineering.'}
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-medium text-blue-600 min-h-[36px]">
                  <span>View Subject Materials</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};
