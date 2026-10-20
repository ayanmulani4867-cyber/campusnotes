import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import { CATEGORIES } from '../../types';

export const Footer: React.FC = () => {
  const location = useLocation();
  const isAdminLogin = location.pathname === '/admin/login';

  if (isAdminLogin) {
    return (
      <footer className="bg-slate-50 text-slate-600 border-t border-slate-200 py-6 mt-auto">
        <div className="max-w-md mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 text-center sm:text-left">
          <p>&copy; {new Date().getFullYear()} CampusNotes</p>
          <p className="font-medium text-slate-600">
            Developed and Managed by Ayan Mulani
          </p>
        </div>
      </footer>
    );
  }

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

          {/* Col 3: Navigation */}
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
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 text-center sm:text-left">
          <p>
            &copy; {new Date().getFullYear()} CampusNotes
          </p>
          <p className="font-medium text-slate-600">
            Developed and Managed by Ayan Mulani
          </p>
        </div>
      </div>
    </footer>
  );
};
