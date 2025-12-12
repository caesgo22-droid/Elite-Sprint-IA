
import * as React from 'react';
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Calendar, Activity, MessageSquare, Video, Users, ShieldCheck, Briefcase, Eye } from 'lucide-react';
import { TechnicalWhitepaper } from '../TechnicalWhitepaper';
// IMPORTANTE: La ruta debe subir dos niveles (../../) porque este archivo esta en components/ui/
import { useApp } from '../../contexts/AppContext';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [showScience, setShowScience] = useState(false);
  const { userProfile, viewingAthleteId, switchAthlete } = useApp();

  // Navigation Logic based on Role
  const isStaff = userProfile.role === 'staff' && !viewingAthleteId; // "Real" staff dashboard view

  const navItems = [
    { to: '/', icon: Home, label: 'Inicio' },
    { to: '/plan', icon: Calendar, label: 'Plan' },
    { to: '/video', icon: Video, label: 'Análisis' },
    { to: '/tracker', icon: Activity, label: 'Stats' },
    // If Staff: Show 'Roster' instead of 'Staff contact list'
    { 
        to: userProfile.role === 'staff' || viewingAthleteId ? '/coach-dashboard' : '/staff', 
        icon: userProfile.role === 'staff' || viewingAthleteId ? Briefcase : Users, 
        label: userProfile.role === 'staff' || viewingAthleteId ? 'Roster' : 'Staff' 
    },
    { to: '/chat', icon: MessageSquare, label: 'Coach' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col font-sans selection:bg-cyan-450 selection:text-slate-950">
      
      {/* Header */}
      <header className="sticky top-0 z-20 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 p-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-tighter bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
            ELITE SPRINT AI
          </h1>
          <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">v2.1.2</span>
          {viewingAthleteId && (
              <div className="flex items-center gap-1 bg-indigo-900/50 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/30 animate-pulse">
                  <Eye size={10}/>
                  <span className="text-[9px] font-bold uppercase">Obs. Mode</span>
              </div>
          )}
        </div>
        
        {/* Science/Technical Button - Low Prominence */}
        <button 
          onClick={() => setShowScience(true)}
          className="text-slate-500 hover:text-cyan-400 transition-colors p-2 rounded-full hover:bg-slate-800/50"
          title="Fundamentación Técnica"
        >
          <ShieldCheck size={20} strokeWidth={1.5} />
        </button>
      </header>

      {/* Viewing Banner */}
      {viewingAthleteId && (
          <div className="bg-indigo-600 text-white text-xs font-bold text-center py-1 flex items-center justify-center gap-2">
              <Eye size={12}/> VISTA PREVIA: {userProfile.name}
              <button onClick={() => switchAthlete(null)} className="underline opacity-80 hover:opacity-100 ml-2">Salir</button>
          </div>
      )}

      {/* Main Content */}
      <main className="flex-1 p-4 pb-24 overflow-y-auto max-w-2xl mx-auto w-full">
        {children}
      </main>

      {/* Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-slate-900/90 backdrop-blur-lg border-t border-slate-800 pb-safe">
        <div className="flex justify-around items-center h-16 max-w-2xl mx-auto px-1">
          {navItems.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              className={({ isActive }) => `
                flex flex-col items-center justify-center w-full h-full transition-all duration-200
                ${isActive ? 'text-cyan-400 scale-110' : 'text-slate-500 hover:text-slate-300'}
              `}
            >
              <item.icon size={18} />
              <span className="text-[9px] mt-1 font-medium">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Science Modal Overlay */}
      {showScience && <TechnicalWhitepaper onClose={() => setShowScience(false)} />}
    </div>
  );
};
