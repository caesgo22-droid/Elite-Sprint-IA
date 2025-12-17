

import * as React from 'react';
import { useState } from 'react';
import { Link, useHistory, useLocation } from 'react-router-dom';
import { Home, Calendar, Activity, MessageSquare, Video, Users, ShieldCheck, Briefcase, Eye, User, LogOut, RefreshCw, ChevronDown, Languages, Mic2 } from 'lucide-react';
import { TechnicalWhitepaper } from '../TechnicalWhitepaper';
import { useApp } from '../../contexts/AppContext';
import { auth } from '../../services/firebase';
import * as firebaseAuth from 'firebase/auth';

const { signOut } = firebaseAuth as any;

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [showScience, setShowScience] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { adminProfile, userProfile, updateProfile, viewingAthleteId, switchAthlete, language, setLanguage, t } = useApp();
  const history = useHistory();
  const location = useLocation();

  // Navigation Logic based on Role (Using Translations)
  // CRITICAL: We check adminProfile.role for navigation permissions, NOT userProfile (which might be the athlete)
  const isStaff = adminProfile.role === 'staff';

  const navItems = [
    { to: '/', icon: Home, label: t.nav.home },
    { to: '/plan', icon: Calendar, label: t.nav.plan },
    { to: '/video', icon: Video, label: t.nav.analysis },
    { to: '/live', icon: Mic2, label: 'Voice' }, // NEW: Voice Route
    { 
        to: isStaff ? '/coach-dashboard' : '/staff', 
        icon: isStaff ? Briefcase : Users, 
        label: isStaff ? t.nav.roster : t.nav.staff 
    },
    { to: '/chat', icon: MessageSquare, label: t.nav.coach },
  ];

  const handleLogout = async () => {
    await signOut(auth);
    window.location.reload();
  };

  const toggleRole = () => {
    const newRole = adminProfile.role === 'staff' ? 'athlete' : 'staff';
    updateProfile({ ...adminProfile, role: newRole });
    setShowUserMenu(false);
    history.push('/');
  };

  const toggleLanguage = () => {
      setLanguage(language === 'es' ? 'en' : 'es');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col font-sans selection:bg-cyan-450 selection:text-slate-950">
      
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 p-4 flex justify-between items-center transition-colors duration-500">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-tighter bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
            ELITE SPRINT AI
          </h1>
        </div>
        
        <div className="flex items-center gap-2">
            {/* Language Toggle */}
            <button 
                onClick={toggleLanguage}
                className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white border border-slate-700 font-bold text-xs"
                title="Cambiar Idioma / Switch Language"
            >
                {language.toUpperCase()}
            </button>

            {/* Science Button */}
            <button 
            onClick={() => setShowScience(true)}
            className="text-slate-500 hover:text-cyan-400 transition-colors p-2 rounded-full hover:bg-slate-800/50"
            title={t.layout.science}
            >
            <ShieldCheck size={20} strokeWidth={1.5} />
            </button>

            {/* User Menu Trigger - DISPLAYS ADMIN IDENTITY */}
            <div className="relative">
                <button 
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className={`flex items-center gap-2 pr-3 pl-1 py-1 rounded-full border transition-colors ${viewingAthleteId ? 'bg-indigo-900/50 border-indigo-500/50' : 'bg-slate-800 border-slate-700 hover:bg-slate-700'}`}
                >
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-xs font-bold text-white">
                        {adminProfile.name ? adminProfile.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <ChevronDown size={14} className="text-slate-400"/>
                </button>

                {/* Dropdown Menu */}
                {showUserMenu && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)}></div>
                        <div className="absolute right-0 top-12 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-in slide-in-from-top-2 fade-in duration-200">
                            <div className="p-3 border-b border-slate-800">
                                <p className="text-sm font-bold text-white truncate">{adminProfile.name}</p>
                                <p className="text-xs text-slate-500 truncate">{adminProfile.email || 'Usuario'}</p>
                                <div className="mt-2 flex items-center gap-2">
                                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${adminProfile.role === 'staff' ? 'bg-purple-900/30 text-purple-400' : 'bg-cyan-900/30 text-cyan-400'}`}>
                                        {adminProfile.role === 'staff' ? t.role.staff : t.role.athlete}
                                    </span>
                                </div>
                            </div>
                            
                            <div className="p-1">
                                <button onClick={toggleRole} className="w-full text-left px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 rounded-lg flex items-center gap-2 transition-colors">
                                    <RefreshCw size={14}/> {t.layout.changeRole} {adminProfile.role === 'staff' ? t.role.athlete : t.role.staff}
                                </button>
                                <button onClick={() => { setShowUserMenu(false); history.push('/plan?edit=true'); }} className="w-full text-left px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 rounded-lg flex items-center gap-2 transition-colors">
                                    <User size={14}/> {t.layout.editProfile}
                                </button>
                                <div className="h-px bg-slate-800 my-1"></div>
                                <button onClick={handleLogout} className="w-full text-left px-3 py-2 text-xs font-bold text-red-400 hover:bg-red-900/20 rounded-lg flex items-center gap-2 transition-colors">
                                    <LogOut size={14}/> {t.layout.logout}
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
      </header>

      {/* DISTINCT VIEWING BANNER - REMOTE CONTROL STYLE */}
      {viewingAthleteId && (
          <div className="bg-indigo-600 shadow-lg relative z-40 animate-in slide-in-from-top-0 duration-300">
              <div className="max-w-2xl mx-auto px-4 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-indigo-500 rounded-lg">
                          <Eye size={16} className="text-white"/>
                      </div>
                      <div className="leading-tight">
                          <p className="text-[10px] text-indigo-200 uppercase font-bold tracking-wider">Visualizando Perfil</p>
                          <p className="text-sm font-bold text-white">{userProfile.name}</p>
                      </div>
                  </div>
                  <button 
                    onClick={() => switchAthlete(null)} 
                    className="bg-white text-indigo-700 hover:bg-indigo-50 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                  >
                      <LogOut size={12}/> {t.layout.exit}
                  </button>
              </div>
          </div>
      )}

      {/* Main Content */}
      <main className={`flex-1 p-4 pb-24 overflow-y-auto max-w-2xl mx-auto w-full transition-all ${viewingAthleteId ? 'border-x border-indigo-900/30 bg-slate-950/50' : ''}`}>
        {children}
      </main>

      {/* Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-slate-900/90 backdrop-blur-lg border-t border-slate-800 pb-safe">
        <div className="flex justify-around items-center h-16 max-w-2xl mx-auto px-1">
          {navItems.map((item) => {
            const isActive = item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.label}
                to={item.to}
                className={`
                  flex flex-col items-center justify-center w-full h-full transition-all duration-200
                  ${isActive ? 'text-cyan-400 scale-110' : 'text-slate-500 hover:text-slate-300'}
                `}
              >
                <item.icon size={18} />
                <span className="text-[9px] mt-1 font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Science Modal Overlay */}
      {showScience && <TechnicalWhitepaper onClose={() => setShowScience(false)} />}
    </div>
  );
};