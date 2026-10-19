import React, { useState, useEffect, useMemo } from 'react';
import {
  Eye,
  Users,
  Calendar,
  Activity,
  Laptop,
  Smartphone,
  Tablet,
  Globe,
  RefreshCw,
  ShieldCheck,
  ArrowUpRight,
  Clock,
  Compass,
  CheckCircle,
  FileText,
  BookOpen,
} from 'lucide-react';
import { VisitorAnalyticsSummary } from '../../types';
import { analyticsService } from '../../services/analyticsService';
import { useToast } from '../../context/ToastContext';

export const VisitorAnalyticsSection: React.FC = () => {
  const toast = useToast();
  const [summary, setSummary] = useState<VisitorAnalyticsSummary>(() =>
    analyticsService.getAnalyticsSummary()
  );
  const [daysRange, setDaysRange] = useState<7 | 30>(7);
  const [isSyncing, setIsSyncing] = useState(false);

  const todayLabel = useMemo(
    () => new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    []
  );

  const loadData = () => {
    const data = analyticsService.getAnalyticsSummary();
    setSummary(data);
  };

  useEffect(() => {
    // Auto refresh every 30 seconds while on this tab
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleSyncFirebase = async () => {
    try {
      setIsSyncing(true);
      await analyticsService.syncWithFirebase();
      toast.success('Analytics Synced', 'Aggregated visitor statistics saved to Firebase.');
      loadData();
    } catch (err: unknown) {
      toast.error('Sync Notice', err instanceof Error ? err.message : String(err));
    } finally {
      setIsSyncing(false);
    }
  };

  if (!summary) {
    return (
      <div className="p-8 text-center">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-2" />
        <p className="text-xs text-slate-500">Loading visitor analytics...</p>
      </div>
    );
  }

  const activeDailyStats = daysRange === 7 ? summary.stats7Days : summary.stats30Days;
  const maxDayViews = Math.max(...activeDailyStats.map((d) => d.pageViews), 1);

  const getDeviceIcon = (type: string) => {
    if (type.toLowerCase() === 'mobile') return <Smartphone className="w-4 h-4 text-purple-600" />;
    if (type.toLowerCase() === 'tablet') return <Tablet className="w-4 h-4 text-amber-600" />;
    return <Laptop className="w-4 h-4 text-blue-600" />;
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">Visitor Analytics Dashboard</h2>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Telemetry
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time, privacy-respecting metrics for CSE Semester 5 Study Hub (No fingerprinting, no PII)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleSyncFirebase}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>Sync with Firebase</span>
          </button>
        </div>
      </div>

      {/* 4 Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Page Views */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Page Views</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Eye className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 font-mono">
              {summary.totalPageViews.toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
              <span className="text-emerald-600 font-medium">Cumulative</span> across all course pages
            </p>
          </div>
        </div>

        {/* Estimated Unique Visitors */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Estimated Unique Visitors</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 font-mono">
              {summary.estimatedUniqueVisitors.toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Distinct visitor sessions (no persistent tracking)
            </p>
          </div>
        </div>

        {/* Today's Visitors */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Today's Visitors</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 font-mono">
              {summary.todayVisitors.toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Active sessions on {todayLabel}
            </p>
          </div>
        </div>

        {/* Active Visitors (Last 5 Minutes) */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Active Visitors (Last 5m)</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <div className="text-2xl font-bold text-slate-900 font-mono">
              {summary.activeVisitors5Min}
            </div>
            {summary.activeVisitors5Min > 0 ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                Live Now
              </span>
            ) : (
              <span className="text-[11px] text-slate-400">Idle</span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Heartbeat active within past 300 seconds
          </p>
        </div>
      </div>

      {/* Visitor Statistics (7 and 30 Days) */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Visitor Statistics</h3>
            <p className="text-xs text-slate-500">Page views and unique visitors daily breakdown</p>
          </div>

          <div className="inline-flex p-1 rounded-lg bg-slate-100 border border-slate-200 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setDaysRange(7)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                daysRange === 7
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Last 7 Days
            </button>
            <button
              type="button"
              onClick={() => setDaysRange(30)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                daysRange === 30
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Last 30 Days
            </button>
          </div>
        </div>

        {/* Visual Bar Chart */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono mb-2">
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-blue-600 inline-block" /> Page Views
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-indigo-400 inline-block" /> Unique Visitors
              </span>
            </div>
            <span>Max Daily Views: {maxDayViews}</span>
          </div>

          <div className="h-44 flex items-end gap-1 sm:gap-2 pt-4 pb-2 border-b border-slate-100 overflow-x-auto">
            {activeDailyStats.map((stat, idx) => {
              const viewHeight = Math.max(Math.round((stat.pageViews / maxDayViews) * 100), 4);
              const uniqueHeight = Math.max(Math.round((stat.uniqueVisitors / maxDayViews) * 100), 2);
              const displayDate = stat.date.substring(5); // MM-DD

              return (
                <div
                  key={stat.date}
                  className="flex-1 min-w-[20px] flex flex-col items-center justify-end group relative h-full"
                >
                  {/* Tooltip */}
                  <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] rounded px-2 py-1 pointer-events-none whitespace-nowrap z-20 shadow-md">
                    <span className="font-bold">{stat.date}</span>: {stat.pageViews} views, {stat.uniqueVisitors} visitors
                  </div>

                  <div className="w-full flex items-end justify-center gap-0.5 sm:gap-1 h-full">
                    {/* Page Views Bar */}
                    <div
                      style={{ height: `${viewHeight}%` }}
                      className="w-1/2 bg-blue-600 hover:bg-blue-700 rounded-t transition-all"
                    />
                    {/* Unique Visitors Bar */}
                    <div
                      style={{ height: `${uniqueHeight}%` }}
                      className="w-1/2 bg-indigo-400 hover:bg-indigo-500 rounded-t transition-all"
                    />
                  </div>

                  <span className="text-[9px] text-slate-500 font-mono mt-1 transform -rotate-45 sm:rotate-0 origin-top-left">
                    {idx % (daysRange === 30 ? 3 : 1) === 0 ? displayDate : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Most Visited Pages & Most Visited Subjects */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most Visited Pages */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-blue-600" />
                Most Visited Pages
              </h3>
              <p className="text-xs text-slate-500">Route paths ranked by total visitor hits</p>
            </div>
            <span className="text-xs font-mono text-slate-500">{summary.mostVisitedPages.length} routes</span>
          </div>

          <div className="space-y-3 flex-1">
            {summary.mostVisitedPages.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No page view data recorded yet.</p>
            ) : (
              summary.mostVisitedPages.map((page, index) => {
                const totalViews = summary.totalPageViews || 1;
                const percent = Math.round((page.count / totalViews) * 100);
                return (
                  <div key={page.path} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 truncate max-w-[240px]">
                        <span className="w-4 text-slate-400 font-mono text-[11px]">#{index + 1}</span>
                        <span className="font-mono text-slate-800 truncate" title={page.path}>
                          {page.path}
                        </span>
                      </div>
                      <span className="font-mono font-semibold text-slate-900">
                        {page.count.toLocaleString()} views ({percent}%)
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full"
                        style={{ width: `${Math.max(percent, 3)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Most Visited Subjects */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-indigo-600" />
                Most Visited Subjects
              </h3>
              <p className="text-xs text-slate-500">CSE Semester 5 courses ranked by student engagement</p>
            </div>
            <span className="text-xs font-mono text-slate-500">{summary.mostVisitedSubjects.length} subjects</span>
          </div>

          <div className="space-y-3 flex-1">
            {summary.mostVisitedSubjects.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No subject view data recorded yet.</p>
            ) : (
              summary.mostVisitedSubjects.map((sub, index) => {
                const totalSubjectViews =
                  summary.mostVisitedSubjects.reduce((acc, curr) => acc + curr.count, 0) || 1;
                const percent = Math.round((sub.count / totalSubjectViews) * 100);
                return (
                  <div key={sub.subjectId} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 truncate max-w-[240px]">
                        <span className="w-4 text-slate-400 font-mono text-[11px]">#{index + 1}</span>
                        <span className="font-medium text-slate-800 truncate" title={sub.subjectName}>
                          {sub.subjectName}
                        </span>
                      </div>
                      <span className="font-mono font-semibold text-slate-900">
                        {sub.count.toLocaleString()} views
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 rounded-full"
                        style={{ width: `${Math.max(percent, 3)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Technology Breakdown (Devices, Browsers, Operating Systems) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Device Types */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Laptop className="w-4 h-4 text-blue-600" />
            Device Types
          </h4>
          <div className="space-y-2.5">
            {summary.deviceTypes.map((item) => (
              <div key={item.type} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  {getDeviceIcon(item.type)}
                  <span className="text-slate-700 font-medium">{item.type}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 font-mono">{item.count}</span>
                  <span className="font-semibold text-slate-900 font-mono w-10 text-right">
                    {item.percentage}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Browsers */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Compass className="w-4 h-4 text-emerald-600" />
            Browsers
          </h4>
          <div className="space-y-2.5">
            {summary.browsers.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <span className="text-slate-700 font-medium">{item.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 font-mono">{item.count}</span>
                  <span className="font-semibold text-slate-900 font-mono w-10 text-right">
                    {item.percentage}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Operating Systems */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Globe className="w-4 h-4 text-purple-600" />
            Operating Systems
          </h4>
          <div className="space-y-2.5">
            {summary.operatingSystems.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <span className="text-slate-700 font-medium">{item.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 font-mono">{item.count}</span>
                  <span className="font-semibold text-slate-900 font-mono w-10 text-right">
                    {item.percentage}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* IP Addresses & Recent Visitor Sessions */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-blue-600" />
              Recent Visitor Activity & IP Addresses
            </h3>
            <p className="text-xs text-slate-500">
              Technical session telemetry and authenticated user activity
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500">
            Showing {summary.recentSessions.length} active sessions
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
                <th className="py-2.5 px-4">Visitor Type</th>
                <th className="py-2.5 px-4">IP Address</th>
                <th className="py-2.5 px-4">Device & OS</th>
                <th className="py-2.5 px-4">Browser</th>
                <th className="py-2.5 px-4">Pages Hit</th>
                <th className="py-2.5 px-4 text-right">Last Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {summary.recentSessions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    No visitor sessions recorded yet.
                  </td>
                </tr>
              ) : (
                summary.recentSessions.map((session) => {
                  const isRecent = summary.lastUpdated - session.lastActiveAt < 5 * 60 * 1000;
                  return (
                    <tr key={session.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-4">
                        {session.isAuthenticated ? (
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800">
                              <ShieldCheck className="w-3 h-3 text-blue-600" />
                              Admin
                            </span>
                            <span className="text-slate-600 font-mono truncate max-w-[120px]">
                              {session.userEmail || 'Administrator'}
                            </span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700">
                            Student Visitor
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-mono font-medium text-slate-800">
                        {session.ipAddress || 'Local / Protected'}
                      </td>
                      <td className="py-2.5 px-4 text-slate-700">
                        <div className="flex items-center gap-1.5">
                          {getDeviceIcon(session.deviceType)}
                          <span>
                            {session.deviceType} • {session.os}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-slate-700">{session.browser}</td>
                      <td className="py-2.5 px-4 font-mono text-slate-800">{session.pagesVisited}</td>
                      <td className="py-2.5 px-4 text-right">
                        <span
                          className={`inline-flex items-center gap-1 font-mono text-[11px] ${
                            isRecent ? 'text-emerald-600 font-semibold' : 'text-slate-500'
                          }`}
                        >
                          {isRecent && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                          {new Date(session.lastActiveAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Privacy Notice Banner */}
      <div className="p-3.5 bg-slate-100 border border-slate-200 rounded-lg flex items-start gap-3 text-xs text-slate-600">
        <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-slate-800">Lightweight & Privacy Preserving: </span>
          Visitor sessions use randomized anonymous tokens stored in session memory without canvas or hardware fingerprinting.
          IP addresses are retrieved at most once per session and never linked to personal student identities.
        </div>
      </div>
    </div>
  );
};
