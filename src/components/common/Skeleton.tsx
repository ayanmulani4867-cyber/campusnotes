import React from 'react';

export const MaterialCardSkeleton: React.FC = () => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm animate-pulse space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="h-6 w-24 bg-slate-200 rounded-lg"></div>
        <div className="h-5 w-16 bg-slate-200 rounded-full"></div>
      </div>
      <div className="space-y-2">
        <div className="h-5 w-4/5 bg-slate-200 rounded"></div>
        <div className="h-4 w-2/3 bg-slate-100 rounded"></div>
      </div>
      <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
        <div className="h-4 w-16 bg-slate-200 rounded"></div>
        <div className="h-4 w-20 bg-slate-200 rounded"></div>
      </div>
      <div className="grid grid-cols-2 gap-2 pt-2">
        <div className="h-9 bg-slate-200 rounded-xl"></div>
        <div className="h-9 bg-slate-200 rounded-xl"></div>
      </div>
    </div>
  );
};

export const SubjectCardSkeleton: React.FC = () => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm animate-pulse space-y-4">
      <div className="flex items-center justify-between">
        <div className="w-12 h-12 bg-slate-200 rounded-xl"></div>
        <div className="w-16 h-6 bg-slate-200 rounded-md"></div>
      </div>
      <div className="space-y-2">
        <div className="h-6 w-3/4 bg-slate-200 rounded"></div>
        <div className="h-4 w-full bg-slate-100 rounded"></div>
        <div className="h-4 w-2/3 bg-slate-100 rounded"></div>
      </div>
      <div className="h-8 bg-slate-100 rounded-lg"></div>
    </div>
  );
};

export const TableRowSkeleton: React.FC = () => {
  return (
    <tr className="animate-pulse border-b border-slate-100">
      <td className="p-4">
        <div className="h-4 w-40 bg-slate-200 rounded"></div>
        <div className="h-3 w-24 bg-slate-100 rounded mt-1"></div>
      </td>
      <td className="p-4">
        <div className="h-5 w-20 bg-slate-200 rounded-full"></div>
      </td>
      <td className="p-4">
        <div className="h-4 w-28 bg-slate-200 rounded"></div>
      </td>
      <td className="p-4">
        <div className="h-4 w-16 bg-slate-200 rounded"></div>
      </td>
      <td className="p-4">
        <div className="h-8 w-24 bg-slate-200 rounded-lg"></div>
      </td>
    </tr>
  );
};
