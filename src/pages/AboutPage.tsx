import React from 'react';
import {
  GraduationCap,
  BookOpen,
  CheckCircle2,
  DownloadCloud,
  ShieldCheck,
} from 'lucide-react';

export const AboutPage: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-16 space-y-8 sm:space-y-12">
      {/* Header */}
      <div className="text-center space-y-3 sm:space-y-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/80 text-xs font-semibold">
          <BookOpen className="w-4 h-4 shrink-0" />
          <span>Educational Resource Hub</span>
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 break-words">
          About CampusNotes
        </h1>
        <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
          A personal educational initiative dedicated to sharing organized study notes, reference materials, and academic PDFs for students.
        </p>
      </div>

      {/* Purpose & Mission Card */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-6 sm:p-10 shadow-sm space-y-6">
        <div className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
            Our Purpose & Vision
          </h2>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            <strong>CampusNotes</strong> is a personal website created to make finding and accessing academic study materials simple, open, and barrier-free. College students often spend valuable study time navigating fragmented portals, broken drive links, and complicated platforms just to find essential lecture notes and syllabus guides.
          </p>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            This platform brings together curated study notes, previous year question papers, assignments, and practical manuals in one clean, distraction-free environment. Everything is freely accessible with zero account requirements, allowing learners to focus on what matters most: understanding the subject matter.
          </p>
        </div>

        {/* Highlights Checklist */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-6 border-t border-slate-100">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-slate-900">Free & Open Access</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                All published notes and PDFs can be browsed, read, and downloaded without student logins or registrations.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-slate-900">Curated Educational PDFs</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Systematically structured documents covering core subjects, syllabus units, and practical lab experiments.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-slate-900">In-Browser PDF Reader</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Preview and study materials directly in your browser with responsive zoom and navigation before downloading.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-slate-900">Clean, Fast & Ad-Free</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                A streamlined user interface free from clutter, paywalls, and annoying popups for focused study sessions.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Highlights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <GraduationCap className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Academic Organization</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Study materials are neatly categorized by subjects, modules, and content types—including lecture notes, assignments, and exam references.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <DownloadCloud className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Instant Downloads</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Reliable, direct document delivery ensures you can save verified PDFs to your device for convenient offline revision.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Verified Quality</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Each document is reviewed to ensure readability, syllabus accuracy, and clean formatting so students can study with confidence.
          </p>
        </div>
      </div>

      {/* Frequently Asked Questions */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-6 sm:p-10 shadow-sm space-y-6">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          Frequently Asked Questions
        </h2>

        <div className="divide-y divide-slate-100 space-y-4">
          <div className="pt-4 first:pt-0">
            <h4 className="text-sm font-bold text-slate-900">
              Do I need to create an account to view or download notes?
            </h4>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
              No. All materials on CampusNotes are publicly accessible. You can browse, preview, and download any study material without registering or logging in.
            </p>
          </div>

          <div className="pt-4">
            <h4 className="text-sm font-bold text-slate-900">
              What kind of study resources are available?
            </h4>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
              The platform hosts comprehensive lecture notes, assignment solutions, laboratory practical manuals, previous year question papers, and official syllabus guidelines.
            </p>
          </div>

          <div className="pt-4">
            <h4 className="text-sm font-bold text-slate-900">
              How are materials curated and added to CampusNotes?
            </h4>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
              Resources are curated and organized systematically to ensure high academic quality, clear formatting, and strict relevance to current coursework.
            </p>
          </div>

          <div className="pt-4">
            <h4 className="text-sm font-bold text-slate-900">
              Can I share materials with my peers?
            </h4>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
              Yes. Every study material features an integrated share button that lets you quickly copy a formatted link or share directly to your study group.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
