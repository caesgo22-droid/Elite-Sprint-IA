import React, { Component, ErrorInfo, ReactNode } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './contexts/AppContext';
import { ToastProvider } from './contexts/ToastContext';
import { Layout } from './components/ui/Layout';
import HomeDashboard from './components/HomeDashboard';
import PlanManager from './components/PlanManager';
import VideoAnalyzer from './components/VideoAnalyzer';
import { LiveCoach } from './components/LiveCoach';
import PerformanceTracker from './components/PerformanceTracker';
import StaffHub from './components/StaffHub';
import CoachDashboard from './components/CoachDashboard';
import { BioTrendConnect } from './components/BioTrendConnect';
import { AthleteCV } from './components/AthleteCV';
import { DeepRecovery } from './components/DeepRecovery';
import { AuthScreen } from './components/AuthScreen';
import GeminiLive from './components/GeminiLive';
import { Loader2 } from 'lucide-react';

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
    return <AuthScreen />;
  }

  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<HomeDashboard />} />
          <Route path="/plan" element={<PlanManager />} />
          <Route path="/video" element={<VideoAnalyzer />} />
          <Route path="/tracker" element={<PerformanceTracker />} />
          <Route path="/staff" element={<StaffHub />} />
          <Route path="/coach-dashboard" element={<CoachDashboard />} />
          <Route path="/chat" element={<LiveCoach />} />
          <Route path="/trends" element={<BioTrendConnect />} />
          <Route path="/cv" element={<AthleteCV />} />
          <Route path="/recovery" element={<DeepRecovery />} />
          <Route path="/live" element={<GeminiLive />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
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