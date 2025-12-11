import * as React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './contexts/AppContext';
import { Layout } from './components/ui/Layout';
import { HomeDashboard } from './components/HomeDashboard';
import { PlanManager } from './components/PlanManager';
import VideoAnalyzer from './components/VideoAnalyzer';
import { LiveCoach } from './components/LiveCoach';
import PerformanceTracker from './components/PerformanceTracker';
import { StaffHub } from './components/StaffHub'; // NEW
import { AuthScreen } from './components/AuthScreen';
import { Loader2 } from 'lucide-react';

const AppContent: React.FC = () => {
  const { user, loadingAuth } = useApp();

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-cyan-400" size={48} />
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
          <Route path="/staff" element={<StaffHub />} /> {/* NEW */}
          <Route path="/chat" element={<LiveCoach />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
};

const App: React.FC = () => {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
};

export default App;