import React from 'react';
import { Search, Filter, RotateCcw } from 'lucide-react';
import { Subject, MaterialFilterState, CATEGORIES } from '../../types';

interface MaterialFilterProps {
  filters: MaterialFilterState;
  subjects: Subject[];
  onFilterChange: (updates: Partial<MaterialFilterState>) => void;
  onReset: () => void;
  totalResults: number;
}

export const MaterialFilter: React.FC<MaterialFilterProps> = ({
  filters,
  subjects,
  onFilterChange,
  onReset,
  totalResults,
}) => {
  const hasActiveFilters =
    Boolean(filters.searchQuery) ||
    Boolean(filters.subjectId) ||
    Boolean(filters.category) ||
    Boolean(filters.academicYear) ||
    filters.sortBy !== 'newest';

  const academicYears = ['2026-27', '2025-26', '2024-25', '2023-24'];

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
      {/* Top Search bar */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={filters.searchQuery}
          onChange={(e) => onFilterChange({ searchQuery: e.target.value })}
          placeholder="Search by title, topic, unit number, or keyword..."
          className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition-colors placeholder:text-slate-400 text-slate-800"
        />
        {filters.searchQuery && (
          <button
            type="button"
            onClick={() => onFilterChange({ searchQuery: '' })}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 font-medium"
          >
            Clear
          </button>
        )}
      </div>

      {/* Category Pills (horizontal scrollable on mobile) */}
      <div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          <button
            type="button"
            onClick={() => onFilterChange({ category: '' })}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              !filters.category
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Categories
          </button>
          {CATEGORIES.map((cat) => {
            const isSelected = filters.category === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onFilterChange({ category: isSelected ? '' : cat.id })}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  isSelected
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat.shortName}
              </button>
            );
          })}
        </div>
      </div>

      {/* Dropdown Filters Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-slate-100">
        {/* Subject Dropdown */}
        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1">
            Subject
          </label>
          <select
            value={filters.subjectId}
            onChange={(e) => onFilterChange({ subjectId: e.target.value })}
            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
          >
            <option value="">All Subjects</option>
            {subjects.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.code} — {sub.name}
              </option>
            ))}
          </select>
        </div>

        {/* Academic Year */}
        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1">
            Academic Year
          </label>
          <select
            value={filters.academicYear}
            onChange={(e) => onFilterChange({ academicYear: e.target.value })}
            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
          >
            <option value="">All Academic Years</option>
            {academicYears.map((yr) => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </select>
        </div>

        {/* Sort By */}
        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1">
            Sort Order
          </label>
          <select
            value={filters.sortBy}
            onChange={(e) =>
              onFilterChange({
                sortBy: e.target.value as MaterialFilterState['sortBy'],
              })
            }
            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
          >
            <option value="newest">Newest Uploads First</option>
            <option value="oldest">Oldest First</option>
            <option value="title">Title (Alphabetical A-Z)</option>
            <option value="size">File Size (Largest First)</option>
          </select>
        </div>
      </div>

      {/* Results Counter & Reset */}
      <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
        <span>
          Showing <strong className="text-slate-800">{totalResults}</strong> verified materials
        </span>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Filters</span>
          </button>
        )}
      </div>
    </div>
  );
};
