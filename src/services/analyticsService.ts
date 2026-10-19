import { ref, get, set } from 'firebase/database';
import { database } from '../config/firebase';
import {
  DeviceType,
  VisitorSession,
  PageViewEvent,
  DailyAnalytics,
  VisitorAnalyticsSummary,
} from '../types';

const STORAGE_KEY = 'campusnotes_visitor_analytics_v1';
const SESSION_STORAGE_KEY = 'campusnotes_session_id';
const IP_STORAGE_KEY = 'campusnotes_session_ip';

interface StoredAnalyticsData {
  totalPageViews: number;
  sessions: Record<string, VisitorSession>;
  pageViews: Record<string, number>;
  subjectViews: Record<string, { count: number; name?: string }>;
  daily: Record<string, { pageViews: number; uniqueVisitors: string[] }>;
  deviceCounts: Record<string, number>;
  browserCounts: Record<string, number>;
  osCounts: Record<string, number>;
  recentPageViews: PageViewEvent[];
  lastUpdated: number;
}

/**
 * Parses user-agent string into standard Device Type without fingerprinting.
 */
export function detectDeviceType(ua: string): DeviceType {
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return 'Tablet';
  }
  if (
    /Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/i.test(
      ua
    )
  ) {
    return 'Mobile';
  }
  return 'Desktop';
}

/**
 * Parses user-agent into primary browser name.
 */
export function detectBrowser(ua: string): string {
  if (/edg/i.test(ua)) return 'Edge';
  if (/opr\//i.test(ua) || /opera/i.test(ua)) return 'Opera';
  if (/chrome|crios/i.test(ua)) return 'Chrome';
  if (/firefox|fxios/i.test(ua)) return 'Firefox';
  if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) return 'Safari';
  return 'Other';
}

/**
 * Parses user-agent into primary Operating System.
 */
export function detectOS(ua: string): string {
  if (/windows/i.test(ua)) return 'Windows';
  if (/android/i.test(ua)) return 'Android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'iOS';
  if (/macintosh|mac os x/i.test(ua)) return 'macOS';
  if (/linux/i.test(ua)) return 'Linux';
  if (/cros/i.test(ua)) return 'ChromeOS';
  return 'Other';
}

/**
 * Generates an anonymous random session identifier.
 * Does NOT use canvas, hardware, or persistent device fingerprinting.
 */
function getOrCreateSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!id) {
      id = `vis_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
      sessionStorage.setItem(SESSION_STORAGE_KEY, id);
    }
    return id;
  } catch {
    return `vis_${Date.now()}`;
  }
}

/**
 * Lightweight IP retrieval with caching in sessionStorage.
 * Makes at most one HTTP lookup per browser session, with a strict 2.5s timeout.
 */
async function getCachedOrFetchIp(): Promise<string> {
  try {
    const cached = sessionStorage.getItem(IP_STORAGE_KEY);
    if (cached) return cached;

    // Use lightweight public API with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);

    const res = await fetch('https://api.ipify.org?format=json', {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.ip === 'string') {
        sessionStorage.setItem(IP_STORAGE_KEY, data.ip);
        return data.ip;
      }
    }
  } catch {
    // Network blocked, offline, or adblocker - fallback gracefully
  }
  return 'Local / Protected';
}

/**
 * Load analytics data from localStorage with graceful fallback.
 */
function loadLocalData(): StoredAnalyticsData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.totalPageViews === 'number') {
        return parsed as StoredAnalyticsData;
      }
    }
  } catch {
    // Ignore parse or storage quota errors
  }

  return {
    totalPageViews: 0,
    sessions: {},
    pageViews: {},
    subjectViews: {},
    daily: {},
    deviceCounts: { Desktop: 0, Mobile: 0, Tablet: 0 },
    browserCounts: {},
    osCounts: {},
    recentPageViews: [],
    lastUpdated: Date.now(),
  };
}

/**
 * Save analytics data to localStorage.
 */
function saveLocalData(data: StoredAnalyticsData): void {
  try {
    data.lastUpdated = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore quota errors
  }
}

/**
 * Returns formatted date key YYYY-MM-DD.
 */
function getTodayDateKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

class AnalyticsService {
  private ipPromise: Promise<string> | null = null;
  private currentIp = 'Local / Protected';

  constructor() {
    if (typeof window !== 'undefined') {
      this.ipPromise = getCachedOrFetchIp().then((ip) => {
        this.currentIp = ip;
        return ip;
      });
    }
  }

  /**
   * Tracks a page view event. Lightweight and non-blocking.
   */
  public async trackPageView(
    path: string,
    title?: string,
    subjectId?: string,
    subjectName?: string,
    authUser?: { email?: string | null; isAuthorizedAdmin?: boolean } | null
  ): Promise<void> {
    try {
      const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
      const device = detectDeviceType(ua);
      const browser = detectBrowser(ua);
      const os = detectOS(ua);
      const sessionId = getOrCreateSessionId();
      const now = Date.now();
      const today = getTodayDateKey();

      // Retrieve cached IP if ready
      let ip = this.currentIp;
      if (ip === 'Local / Protected' && this.ipPromise) {
        ip = await Promise.race([
          this.ipPromise,
          new Promise<string>((resolve) => setTimeout(() => resolve('Local / Protected'), 300)),
        ]);
        this.currentIp = ip;
      }

      const isAuthenticated = Boolean(authUser?.isAuthorizedAdmin);
      const userRole = isAuthenticated ? 'administrator' : 'student_visitor';
      const userEmail = authUser?.email || undefined;

      const data = loadLocalData();

      // 1. Total views
      data.totalPageViews += 1;

      // 2. Session update
      if (!data.sessions[sessionId]) {
        data.sessions[sessionId] = {
          id: sessionId,
          startedAt: now,
          lastActiveAt: now,
          ipAddress: ip,
          deviceType: device,
          browser,
          os,
          isAuthenticated,
          userRole,
          userEmail,
          pagesVisited: 1,
        };
      } else {
        const s = data.sessions[sessionId];
        s.lastActiveAt = now;
        s.pagesVisited += 1;
        if (ip && ip !== 'Local / Protected') s.ipAddress = ip;
        if (isAuthenticated) {
          s.isAuthenticated = true;
          s.userRole = 'administrator';
          s.userEmail = userEmail;
        }
      }

      // Keep only most recent 60 sessions to prevent storage bloating
      const sessionKeys = Object.keys(data.sessions);
      if (sessionKeys.length > 60) {
        const sorted = sessionKeys.sort(
          (a, b) => data.sessions[b].lastActiveAt - data.sessions[a].lastActiveAt
        );
        const trimmed: Record<string, VisitorSession> = {};
        sorted.slice(0, 60).forEach((k) => {
          trimmed[k] = data.sessions[k];
        });
        data.sessions = trimmed;
      }

      // 3. Page views per route
      const cleanPath = path || '/';
      data.pageViews[cleanPath] = (data.pageViews[cleanPath] || 0) + 1;

      // 4. Subject views
      if (subjectId) {
        if (!data.subjectViews[subjectId]) {
          data.subjectViews[subjectId] = {
            count: 1,
            name: subjectName || subjectId,
          };
        } else {
          data.subjectViews[subjectId].count += 1;
          if (subjectName) data.subjectViews[subjectId].name = subjectName;
        }
      }

      // 5. Daily analytics
      if (!data.daily[today]) {
        data.daily[today] = {
          pageViews: 1,
          uniqueVisitors: [sessionId],
        };
      } else {
        data.daily[today].pageViews += 1;
        if (!data.daily[today].uniqueVisitors.includes(sessionId)) {
          data.daily[today].uniqueVisitors.push(sessionId);
        }
      }

      // 6. Device, Browser, OS counts
      data.deviceCounts[device] = (data.deviceCounts[device] || 0) + 1;
      data.browserCounts[browser] = (data.browserCounts[browser] || 0) + 1;
      data.osCounts[os] = (data.osCounts[os] || 0) + 1;

      // 7. Recent page view event log (capped at 40)
      const pageEvent: PageViewEvent = {
        id: `pv_${now}_${Math.random().toString(36).substring(2, 6)}`,
        path: cleanPath,
        title,
        subjectId,
        timestamp: now,
        sessionId,
        deviceType: device,
        browser,
        os,
        ipAddress: ip,
        isAuthenticated,
        userEmail,
      };

      data.recentPageViews = [pageEvent, ...data.recentPageViews].slice(0, 40);

      saveLocalData(data);
    } catch (err) {
      console.warn('Analytics tracking notice:', err);
    }
  }

  /**
   * Heartbeat to mark active visitors in the last 5 minutes.
   */
  public updateHeartbeat(): void {
    try {
      const sessionId = getOrCreateSessionId();
      const data = loadLocalData();
      if (data.sessions[sessionId]) {
        data.sessions[sessionId].lastActiveAt = Date.now();
        saveLocalData(data);
      }
    } catch {
      // Ignore
    }
  }

  /**
   * Computes the full analytics summary for the Admin Dashboard.
   */
  public getAnalyticsSummary(): VisitorAnalyticsSummary {
    const data = loadLocalData();
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;
    const today = getTodayDateKey();

    // 1. Total page views
    const totalPageViews = data.totalPageViews;

    // 2. Estimated unique visitors
    const allSessionIds = Object.keys(data.sessions);
    const estimatedUniqueVisitors = Math.max(allSessionIds.length, 1);

    // 3. Today's visitors
    const todayVisitors = data.daily[today]
      ? data.daily[today].uniqueVisitors.length
      : 0;

    // 4. Active visitors within last 5 minutes
    const activeVisitors5Min = Object.values(data.sessions).filter(
      (s) => s.lastActiveAt >= fiveMinutesAgo
    ).length;

    // 5. Visitor statistics for last 7 and 30 days
    const stats7Days = this.generateDailyStats(data, 7);
    const stats30Days = this.generateDailyStats(data, 30);

    // 6. Most visited pages
    const mostVisitedPages = Object.entries(data.pageViews)
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Most visited subjects
    const mostVisitedSubjects = Object.entries(data.subjectViews)
      .map(([subjectId, info]) => ({
        subjectId,
        subjectName: info.name || subjectId,
        count: info.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // 7. Device types, browsers, operating systems
    const totalDeviceVisits = Object.values(data.deviceCounts).reduce((a, b) => a + b, 0) || 1;
    const deviceTypes = Object.entries(data.deviceCounts)
      .map(([type, count]) => ({
        type,
        count,
        percentage: Math.round((count / totalDeviceVisits) * 100),
      }))
      .sort((a, b) => b.count - a.count);

    const totalBrowserVisits = Object.values(data.browserCounts).reduce((a, b) => a + b, 0) || 1;
    const browsers = Object.entries(data.browserCounts)
      .map(([name, count]) => ({
        name,
        count,
        percentage: Math.round((count / totalBrowserVisits) * 100),
      }))
      .sort((a, b) => b.count - a.count);

    const totalOsVisits = Object.values(data.osCounts).reduce((a, b) => a + b, 0) || 1;
    const operatingSystems = Object.entries(data.osCounts)
      .map(([name, count]) => ({
        name,
        count,
        percentage: Math.round((count / totalOsVisits) * 100),
      }))
      .sort((a, b) => b.count - a.count);

    // 8. Recent visitor sessions
    const recentSessions = Object.values(data.sessions)
      .sort((a, b) => b.lastActiveAt - a.lastActiveAt)
      .slice(0, 25);

    return {
      totalPageViews,
      estimatedUniqueVisitors,
      todayVisitors,
      activeVisitors5Min,
      stats7Days,
      stats30Days,
      mostVisitedPages,
      mostVisitedSubjects,
      deviceTypes,
      browsers,
      operatingSystems,
      recentSessions,
      recentPageViews: data.recentPageViews,
      lastUpdated: data.lastUpdated,
    };
  }

  /**
   * Helper to construct daily analytics for past N days.
   */
  private generateDailyStats(data: StoredAnalyticsData, daysCount: number): DailyAnalytics[] {
    const list: DailyAnalytics[] = [];
    const now = new Date();

    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${day}`;

      const entry = data.daily[dateKey];
      list.push({
        date: dateKey,
        pageViews: entry ? entry.pageViews : 0,
        uniqueVisitors: entry ? entry.uniqueVisitors.length : 0,
      });
    }

    return list;
  }

  /**
   * Syncs summary data to Firebase RTDB under /settings/analytics_data if write is allowed.
   */
  public async syncWithFirebase(): Promise<void> {
    try {
      if (!database) return;
      const summary = this.getAnalyticsSummary();
      const analyticsRef = ref(database, 'settings/analytics_data');

      // Save lightweight summary (omitting detailed sessions to keep payload small and fast)
      await set(analyticsRef, {
        totalPageViews: summary.totalPageViews,
        estimatedUniqueVisitors: summary.estimatedUniqueVisitors,
        todayVisitors: summary.todayVisitors,
        activeVisitors5Min: summary.activeVisitors5Min,
        mostVisitedPages: summary.mostVisitedPages.slice(0, 5),
        mostVisitedSubjects: summary.mostVisitedSubjects.slice(0, 5),
        lastUpdated: Date.now(),
      });
    } catch {
      // If permission denied or offline, ignore gracefully
    }
  }

  /**
   * Clears local analytics cache.
   */
  public resetAnalytics(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  }
}

export const analyticsService = new AnalyticsService();
