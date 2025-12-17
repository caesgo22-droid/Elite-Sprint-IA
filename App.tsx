import * as React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './contexts/AppContext';
import { Layout } from './components/ui/Layout';
import { HomeDashboard } from './components/HomeDashboard';
import { PlanManager } from './components/PlanManager';
import VideoAnalyzer from './components/VideoAnalyzer';
import { LiveCoach } from './components/LiveCoach';
import PerformanceTracker from './components/PerformanceTracker';
import { StaffHub } from './components/StaffHub'; 
import { CoachDashboard } from './components/CoachDashboard';
import { AuthScreen } from './components/AuthScreen';
import { GeminiLive } from './components/GeminiLive';
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
          <Route path="/live" element={<GeminiLive />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
};

// Error Boundary Component to prevent White Screen of Death
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
          <h1 className="text-2xl font-bold text-red-500 mb-2">Algo salió mal.</h1>
          <p className="text-slate-400 mb-4">La aplicación ha encontrado un error crítico.</p>
          <button onClick={() => window.location.reload()} className="bg-cyan-600 px-4 py-2 rounded-lg font-bold">Recargar App</button>
        </div>
      );
    }

    return this.props.children;
  }
}

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ErrorBoundary>
  );
};

export default App;