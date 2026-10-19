import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { Navbar } from './components/common/Navbar';
import { Footer } from './components/common/Footer';
import { RefreshCw } from 'lucide-react';
import { MaintenanceGuard } from './components/common/MaintenanceGuard';
import { ScrollToTop } from './components/common/ScrollToTop';
import { useVisitorTracker } from './utils/useVisitorTracker';

// Eager load HomePage for instant hero first-paint
import { HomePage } from './pages/HomePage';

// Lazy load other views for high-performance chunking & 500-concurrency optimization
const MaterialsPage = lazy(() =>
  import('./pages/MaterialsPage').then((m) => ({ default: m.MaterialsPage }))
);
const MaterialDetailPage = lazy(() =>
  import('./pages/MaterialDetailPage').then((m) => ({ default: m.MaterialDetailPage }))
);
const SubjectsPage = lazy(() =>
  import('./pages/SubjectsPage').then((m) => ({ default: m.SubjectsPage }))
);
const SubjectDetailPage = lazy(() =>
  import('./pages/SubjectDetailPage').then((m) => ({ default: m.SubjectDetailPage }))
);
const CategoryPage = lazy(() =>
  import('./pages/CategoryPage').then((m) => ({ default: m.CategoryPage }))
);
const AboutPage = lazy(() =>
  import('./pages/AboutPage').then((m) => ({ default: m.AboutPage }))
);
const NotFoundPage = lazy(() =>
  import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage }))
);
const AdminLoginPage = lazy(() =>
  import('./pages/admin/AdminLoginPage').then((m) => ({ default: m.AdminLoginPage }))
);
const AdminDashboardPage = lazy(() =>
  import('./pages/admin/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage }))
);
const AdminAuthGuard = lazy(() =>
  import('./components/admin/AdminAuthGuard').then((m) => ({ default: m.AdminAuthGuard }))
);

const PageLoader: React.FC = () => (
  <div className="min-h-[50vh] flex flex-col items-center justify-center p-8 text-center">
    <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mb-3" />
    <p className="text-xs font-semibold text-slate-600">Loading CampusNotes...</p>
  </div>
);

const AppContent: React.FC = () => {
  const location = useLocation();
  const isAdminDashboard = location.pathname.startsWith('/admin/dashboard');

  // Lightweight visitor analytics tracking across all pages
  useVisitorTracker();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans selection:bg-blue-600 selection:text-white w-full max-w-full">
      <ScrollToTop />
      <Navbar />
      <main className="flex-1 flex flex-col w-full max-w-full min-w-0">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<HomePage />} />
            <Route path="/materials" element={<MaterialsPage />} />
            <Route path="/materials/:materialId" element={<MaterialDetailPage />} />
            <Route path="/subjects" element={<SubjectsPage />} />
            <Route path="/subjects/:subjectId" element={<SubjectDetailPage />} />
            <Route path="/category/:categorySlug" element={<CategoryPage />} />
            <Route path="/about" element={<AboutPage />} />

            {/* Admin Routes */}
            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route
              path="/admin/dashboard"
              element={
                <AdminAuthGuard>
                  <AdminDashboardPage />
                </AdminAuthGuard>
              }
            />

            {/* 404 Catch All */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </main>
      {!isAdminDashboard && <Footer />}
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <MaintenanceGuard>
            <AppContent />
          </MaintenanceGuard>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
