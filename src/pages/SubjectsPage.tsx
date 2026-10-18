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
import {
  getPublicSubjects,
  getPublicMaterials,
} from '../services/firebaseService';
import { SubjectCardSkeleton } from '../components/common/Skeleton';
import { EmptyState } from '../components/common/EmptyState';

export const SubjectsPage: React.FC = () => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [subs, mats] = await Promise.all([
          getPublicSubjects(),
          getPublicMaterials(150),
        ]);
        setSubjects(subs);
        setMaterials(mats);
      } catch (err) {
        console.error('Error loading subjects:', err);
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-12 space-y-6 sm:space-y-8">
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {subjects.map((sub) => {
            const count = getMaterialCountForSubject(sub.id);
            return (
              <Link
                key={sub.id}
                to={`/subjects/${sub.id}`}
                className="group bg-white rounded-lg border border-slate-200 p-4 sm:p-6 hover:border-slate-300 transition-colors flex flex-col justify-between"
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
