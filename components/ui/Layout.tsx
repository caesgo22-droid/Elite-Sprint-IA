import * as React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Calendar, Activity, MessageSquare, Video } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const navItems = [
    { to: '/', icon: Home, label: 'Inicio' },
    { to: '/plan', icon: Calendar, label: 'Plan' },
    { to: '/video', icon: Video, label: 'Análisis' },
    { to: '/tracker', icon: Activity, label: 'Stats' },
    { to: '/chat', icon: MessageSquare, label: 'Coach' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col font-sans selection:bg-cyan-450 selection:text-slate-950">
      
      {/* Header */}
      <header className="sticky top-0 z-20 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold tracking-tighter bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
          ELITE SPRINT AI
        </h1>
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 pb-24 overflow-y-auto max-w-2xl mx-auto w-full">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-slate-900/90 backdrop-blur-lg border-t border-slate-800 pb-safe">
        <div className="flex justify-around items-center h-16 max-w-2xl mx-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              className={({ isActive }) => `
                flex flex-col items-center justify-center w-full h-full transition-all duration-200
                ${isActive ? 'text-cyan-400 scale-110' : 'text-slate-500 hover:text-slate-300'}
              `}
            >
              <item.icon size={20} strokeWidth={item.label === 'Inicio' && location.pathname === '/' ? 2.5 : 2} />
              <span className="text-[10px] mt-1 font-medium">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
};