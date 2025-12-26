import React, { Component, ErrorInfo, ReactNode, lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './contexts/AppContext';
import { ToastProvider } from './contexts/ToastContext';
import { ProtectedRoute } from './components/shared/ProtectedRoute';
import { Layout } from './components/ui/Layout';
import HomeDashboard from './components/dashboard/HomeDashboard'; // Keep eager - critical path
import LoadingFallback from './components/shared/LoadingFallback';
import { Loader2 } from 'lucide-react';

// Lazy load heavy components
const PlanManager = lazy(() => import('./components/planning/PlanManager'));
const VideoAnalyzer = lazy(() => import('./components/analysis/VideoAnalyzer'));
const LiveCoach = lazy(() => import('./components/LiveCoach').then(m => ({ default: m.LiveCoach })));
const PerformanceTracker = lazy(() => import('./components/PerformanceTracker'));
const StaffHub = lazy(() => import('./components/staff/StaffHub'));
const CoachDashboard = lazy(() => import('./components/dashboard/CoachDashboard'));
const BioTrendConnect = lazy(() => import('./components/BioTrendConnect').then(m => ({ default: m.BioTrendConnect })));
const AthleteCV = lazy(() => import('./components/profile/AthleteCV').then(m => ({ default: m.AthleteCV })));
const DeepRecovery = lazy(() => import('./components/DeepRecovery').then(m => ({ default: m.DeepRecovery })));
const AuthScreen = lazy(() => import('./components/auth/AuthScreen').then(m => ({ default: m.AuthScreen })));
const GeminiLive = lazy(() => import('./components/GeminiLive'));

const AppContent: React.FC = () => {
  const { user, loadingAuth } = useApp();

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center flex-col gap-4">
        <Loader2 className="animate-spin text-cyan-400" size={48} />
        <p className="text-slate-500 text-sm">Cargando Elite Sprint AI...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <AuthScreen />
      </Suspense>
    );
  }

  return (
    <HashRouter>
      <Layout>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/" element={<HomeDashboard />} />
            <Route path="/plan" element={<PlanManager />} />
            <Route path="/video" element={<VideoAnalyzer />} />
            <Route path="/tracker" element={<PerformanceTracker />} />

            {/* Staff Protected Routes */}
            <Route path="/staff" element={
              <ProtectedRoute allowedRoles={['staff', 'coach', 'head coach', 'admin', 'athlete']}>
                <StaffHub />
              </ProtectedRoute>
            } />
            <Route path="/coach-dashboard" element={
              <ProtectedRoute allowedRoles={['staff', 'coach', 'head coach', 'admin']}>
                <CoachDashboard />
              </ProtectedRoute>
            } />

            <Route path="/chat" element={<LiveCoach />} />
            <Route path="/trends" element={<BioTrendConnect />} />
            <Route path="/cv" element={<AthleteCV />} />
            <Route path="/recovery" element={<DeepRecovery />} />
            <Route path="/live" element={<GeminiLive />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </Layout>
    </HashRouter>
  );
};

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  public state = { hasError: false, error: null as Error | null };

  constructor(props: { children: ReactNode }) {
    super(props);
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('🔴 ErrorBoundary caught:', error);
    console.error('📍 Component stack:', errorInfo.componentStack);
    // TODO: Send to error tracking service (Sentry, etc.)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md space-y-4">
            <h1 className="text-2xl font-bold text-red-500 mb-2">Algo salió mal</h1>
            <p className="text-slate-400 text-sm">
              La aplicación encontró un error inesperado. Por favor, recarga la página.
            </p>
            {(this as any).state.error && (
              <details className="text-left bg-slate-900 p-4 rounded-lg text-xs text-slate-300 mt-4">
                <summary className="cursor-pointer font-bold mb-2">Detalles técnicos</summary>
                <code className="block whitespace-pre-wrap">{(this as any).state.error.toString()}</code>
              </details>
            )}
            <button
              onClick={() => window.location.reload()}
              className="bg-cyan-600 hover:bg-cyan-500 px-6 py-3 rounded-lg font-bold transition-colors"
            >
              Recargar Aplicación
            </button>
          </div>
        </div>
      );
    }
    return (this as any).props.children;
  }
}

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AppProvider>
          <AppContent />
        </AppProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
};

export default App;