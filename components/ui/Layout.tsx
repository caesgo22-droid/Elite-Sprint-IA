
import * as React from 'react';
import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, Calendar, Activity, MessageSquare, Video, Users, ShieldCheck, Briefcase, Eye, User, LogOut, RefreshCw, ChevronDown } from 'lucide-react';
import { TechnicalWhitepaper } from '../TechnicalWhitepaper';
import { useApp } from '../../contexts/AppContext';
import { auth } from '../../services/firebase';
import { signOut } from 'firebase/auth';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [showScience, setShowScience] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { userProfile, updateProfile, viewingAthleteId, switchAthlete } = useApp();
  const navigate = useNavigate();

  // Navigation Logic based on Role
  const navItems = [
    { to: '/', icon: Home, label: 'Inicio' },
    { to: '/plan', icon: Calendar, label: 'Plan' },
    { to: '/video', icon: Video, label: 'Análisis' },
    { to: '/tracker', icon: Activity, label: 'Stats' },
    { 
        to: userProfile.role === 'staff' || viewingAthleteId ? '/coach-dashboard' : '/staff', 
        icon: userProfile.role === 'staff' || viewingAthleteId ? Briefcase : Users, 
        label: userProfile.role === 'staff' || viewingAthleteId ? 'Roster' : 'Staff' 
    },
    { to: '/chat', icon: MessageSquare, label: 'Coach' },
  ];

  const handleLogout = async () => {
    await signOut(auth);
    window.location.reload();
  };

  const toggleRole = () => {
    const newRole = userProfile.role === 'staff' ? 'athlete' : 'staff';
    updateProfile({ ...userProfile, role: newRole });
    setShowUserMenu(false);
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col font-sans selection:bg-cyan-450 selection:text-slate-950">
      
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 p-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-tighter bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
            ELITE SPRINT AI
          </h1>
          {viewingAthleteId && (
              <div className="flex items-center gap-1 bg-indigo-900/50 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/30 animate-pulse">
                  <Eye size={10}/>
                  <span className="text-[9px] font-bold uppercase">Obs. Mode</span>
              </div>
          )}
        </div>
        
        <div className="flex items-center gap-3">
            {/* Science Button */}
            <button 
            onClick={() => setShowScience(true)}
            className="text-slate-500 hover:text-cyan-400 transition-colors p-2 rounded-full hover:bg-slate-800/50"
            title="Fundamentación Técnica"
            >
            <ShieldCheck size={20} strokeWidth={1.5} />
            </button>

            {/* User Menu Trigger */}
            <div className="relative">
                <button 
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 pr-3 pl-1 py-1 rounded-full border border-slate-700 transition-colors"
                >
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-xs font-bold text-white">
                        {userProfile.name ? userProfile.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <ChevronDown size={14} className="text-slate-400"/>
                </button>

                {/* Dropdown Menu */}
                {showUserMenu && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)}></div>
                        <div className="absolute right-0 top-12 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-in slide-in-from-top-2 fade-in duration-200">
                            <div className="p-3 border-b border-slate-800">
                                <p className="text-sm font-bold text-white truncate">{userProfile.name}</p>
                                <p className="text-xs text-slate-500 truncate">{userProfile.email || 'Usuario'}</p>
                                <div className="mt-2 flex items-center gap-2">
                                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${userProfile.role === 'staff' ? 'bg-purple-900/30 text-purple-400' : 'bg-cyan-900/30 text-cyan-400'}`}>
                                        {userProfile.role}
                                    </span>
                                </div>
                            </div>
                            
                            <div className="p-1">
                                <button onClick={toggleRole} className="w-full text-left px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 rounded-lg flex items-center gap-2 transition-colors">
                                    <RefreshCw size={14}/> Cambiar Rol a {userProfile.role === 'staff' ? 'Atleta' : 'Staff'}
                                </button>
                                <button onClick={() => { setShowUserMenu(false); navigate('/plan?edit=true'); }} className="w-full text-left px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 rounded-lg flex items-center gap-2 transition-colors">
                                    <User size={14}/> Editar Perfil
                                </button>
                                <div className="h-px bg-slate-800 my-1"></div>
                                <button onClick={handleLogout} className="w-full text-left px-3 py-2 text-xs font-bold text-red-400 hover:bg-red-900/20 rounded-lg flex items-center gap-2 transition-colors">
                                    <LogOut size={14}/> Cerrar Sesión
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
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
