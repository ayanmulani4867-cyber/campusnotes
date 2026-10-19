import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { analyticsService } from '../services/analyticsService';

/**
 * Lightweight, privacy-respecting visitor tracking hook.
 * Records route transitions and keeps active visitor heartbeat up to date.
 */
export function useVisitorTracker(): void {
  const location = useLocation();
  const { admin, isAuthenticated } = useAuth();

  // Track page view on path change
  useEffect(() => {
    const path = location.pathname;
    const title = document.title;

    // Extract subjectId if viewing a subject page
    let subjectId: string | undefined;
    const subjectMatch = path.match(/^\/subjects\/([^/]+)/);
    if (subjectMatch) {
      subjectId = subjectMatch[1];
    }

    analyticsService.trackPageView(
      path,
      title,
      subjectId,
      undefined,
      isAuthenticated && admin ? { email: admin.email, isAuthorizedAdmin: true } : null
    );
  }, [location.pathname, location.search, admin, isAuthenticated]);

  // Periodic heartbeat (every 60 seconds) to update active visitor window
  useEffect(() => {
    const interval = setInterval(() => {
      analyticsService.updateHeartbeat();
    }, 60000);

    return () => clearInterval(interval);
  }, []);
}
