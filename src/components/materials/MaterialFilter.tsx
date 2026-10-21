import React from 'react';
import { Search, RotateCcw, ChevronDown } from 'lucide-react';
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
    <div className="bg-white rounded-lg border border-slate-200 p-3.5 sm:p-5 space-y-4">
      {/* 1. Primary Control: Top Search bar */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={filters.searchQuery}
          onChange={(e) => onFilterChange({ searchQuery: e.target.value })}
          placeholder="Search by title, topic, unit number, or keyword..."
          className="w-full min-h-[42px] pl-10 pr-12 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition-colors placeholder:text-slate-400 text-slate-800"
        />
        {filters.searchQuery && (
          <button
            type="button"
            onClick={() => onFilterChange({ searchQuery: '' })}
            className="absolute right-3 top-1/2 -translate-y-1/2 min-h-[32px] px-2 text-xs text-slate-400 hover:text-slate-600 font-medium"
          >
            Clear
          </button>
        )}
      </div>

      {/* 2. Primary Control: Category Pills (horizontal scrollable on mobile) */}
      <div className="w-full max-w-full min-w-0 overflow-x-auto pb-1.5 no-scrollbar touch-pan-x">
        <div className="inline-flex items-center gap-1.5 min-w-max">
          <button
            type="button"
            onClick={() => onFilterChange({ category: '' })}
            className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors shrink-0 ${
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
                className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors shrink-0 ${
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

      {/* 3. Primary Control: Subject Filter */}
      <div className="pt-1 border-t border-slate-100">
        <label className="block text-[11px] font-medium text-slate-500 mb-1">
          Subject
        </label>
        <select
          value={filters.subjectId}
          onChange={(e) => onFilterChange({ subjectId: e.target.value })}
          className="w-full min-h-[42px] text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
        >
          <option value="">All Subjects</option>
          {subjects.map((sub) => (
            <option key={sub.id} value={sub.id}>
              {sub.code} — {sub.name}
            </option>
          ))}
        </select>
      </div>

      {/* 4. Compact Expandable Area for Secondary Filters (Sort & Academic Year) */}
      <details className="group pt-1 border-t border-slate-100">
        <summary className="text-xs font-medium text-slate-500 hover:text-slate-800 cursor-pointer flex items-center justify-between py-1 select-none">
          <span>More options (Sort Order & Academic Year)</span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-open:rotate-180 transition-transform" />
        </summary>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2.5">
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
              className="w-full min-h-[42px] text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="title">Title (A-Z)</option>
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
              className="w-full min-h-[42px] text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
            >
              <option value="">All Academic Years</option>
              {academicYears.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>
        </div>
      </details>

      {/* Results Counter & Reset */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 pt-1 border-t border-slate-100">
        <span>
          Showing <strong className="text-slate-800">{totalResults}</strong> verified materials
        </span>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onReset}
            className="min-h-[36px] inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 active:text-blue-900 font-medium px-2 py-1 rounded"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Filters</span>
          </button>
        )}
      </div>
    </div>
  );
};
