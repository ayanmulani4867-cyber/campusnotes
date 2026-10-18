import React from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, ShieldCheck } from 'lucide-react';
import { CATEGORIES } from '../../types';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-slate-50 text-slate-600 border-t border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Col 1: Branding */}
          <div className="md:col-span-2 space-y-3">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                <GraduationCap className="w-4 h-4" />
              </div>
              <span className="text-xl font-bold tracking-tight text-slate-900">CampusNotes</span>
            </Link>
            <p className="text-sm text-slate-500 max-w-md leading-relaxed">
              Curated study materials for Computer Science & Engineering Semester 5. Free access to verified notes, assignments, lab practicals, and previous year question papers.
            </p>
            <p className="text-xs text-slate-400">
              Free public access &bull; No student login required
            </p>
          </div>

          {/* Col 2: Categories */}
          <div>
            <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-3">
              Categories
            </h3>
            <ul className="space-y-2 text-xs">
              {CATEGORIES.slice(0, 5).map((cat) => (
                <li key={cat.id}>
                  <Link
                    to={`/category/${cat.id}`}
                    className="text-slate-500 hover:text-slate-900 transition-colors"
                  >
                    {cat.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  to="/materials"
                  className="text-blue-600 hover:text-blue-700 font-medium inline-block mt-1"
                >
                  View All &rarr;
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Navigation & Admin */}
          <div>
            <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-3">
              Quick Links
            </h3>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/subjects" className="text-slate-500 hover:text-slate-900 transition-colors">
                  Subject Catalog
                </Link>
              </li>
              <li>
                <Link to="/about" className="text-slate-500 hover:text-slate-900 transition-colors">
                  About
                </Link>
              </li>
              <li>
                <Link
                  to="/admin/login"
                  className="text-slate-500 hover:text-slate-900 transition-colors inline-flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                  <span>Admin Login</span>
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <p>
            &copy; {new Date().getFullYear()} CampusNotes. Designed for Computer Science & Engineering Semester 5.
          </p>
          <p>
            All academic materials are intended for study and revision purposes.
          </p>
        </div>
      </div>
    </footer>
  );
};
