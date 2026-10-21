import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Layers,
  BookOpen,
  ArrowRight,
  GraduationCap,
  Sparkles,
} from 'lucide-react';
import { Subject, StudyMaterial } from '../types';
import { OFFICIAL_CSE_SEM_5_SUBJECTS } from '../constants/subjects';
import {
  getPublicSubjects,
  getPublicMaterials,
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
      createdAt: 0,
      updatedAt: 0,
    }));
  });
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
    async function loadData() {
      try {
        const [subs, mats] = await Promise.all([
          getPublicSubjects(),
          getPublicMaterials(150),
        ]);
        const finalSubs =
          subs && subs.length > 0
            ? subs
            : OFFICIAL_CSE_SEM_5_SUBJECTS.map((s) => ({
                ...s,
                createdAt: Date.now(),
                updatedAt: Date.now(),
              }));
        setSubjects(finalSubs);
        setMaterials(mats);
      } catch (err) {
        console.error('Error loading subjects:', err);
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
    loadData();
  }, []);

  const getMaterialCountForSubject = (subjectId: string): number => {
    return materials.filter((m) => m.subjectId === subjectId && m.published).length;
  };

  return (
    <div className="w-full max-w-7xl mx-auto min-w-0 px-3.5 sm:px-6 lg:px-8 py-6 sm:py-12 space-y-6 sm:space-y-8 box-border">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-600 mb-1">
          <Layers className="w-4 h-4" />
          <span>Curriculum Structure</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 break-words">
          CSE Semester 5 Subjects
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
          Comprehensive curriculum subjects for Computer Science & Engineering 5th semester. Explore verified study notes, practical files, and previous year exam questions.
        </p>
      </div>

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
      ) : subjects.length === 0 ? (
        <EmptyState
          title="No Subjects Available"
          description="Official subjects have not been configured in the database yet. The administrator can initialize them from the Admin Portal."
          actionText="Admin Portal"
          actionTo="/admin/login"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 w-full max-w-full min-w-0">
          {subjects.map((sub) => {
            const count = getMaterialCountForSubject(sub.id);
            return (
              <Link
                key={sub.id}
                to={`/subjects/${sub.id}`}
                className="group bg-white rounded-lg border border-slate-200 p-4 sm:p-6 hover:border-slate-300 transition-colors flex flex-col justify-between active:scale-[0.99] active:bg-slate-50 touch-manipulation cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="font-mono text-xs font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                      {sub.code}
                    </span>
                    <span className="text-xs font-normal text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                      {count} {count === 1 ? 'Material' : 'Materials'}
                    </span>
                  </div>

                  <h3 className="text-base sm:text-lg font-semibold text-slate-900 group-hover:text-blue-600 transition-colors break-words">
                    {sub.name}
                  </h3>

                  <p className="text-xs text-slate-500 mt-2 line-clamp-3 leading-relaxed break-words">
                    {sub.description ||
                      'Standard university curriculum course for Computer Science and Engineering 5th Semester.'}
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
