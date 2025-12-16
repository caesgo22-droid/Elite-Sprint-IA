
import * as React from 'react';
import { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { findAthleteByEmail, fetchUserData, saveUserProfile, getPlanHistory } from '../services/firebase';
import { Users, Plus, Search, ChevronRight, UserCircle2, Briefcase, Eye, LogOut, Activity, AlertTriangle, BatteryCharging } from 'lucide-react';
import { UserProfile } from '../types';
import { calculateACWR } from '../utils/loadCalculator';

export const CoachDashboard: React.FC = () => {
  const { user, userProfile, updateProfile, viewingAthleteId, switchAthlete, t } = useApp();
  const [emailQuery, setEmailQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [rosterData, setRosterData] = useState<{uid: string, profile: UserProfile, risk: 'High' | 'Low' | 'Optimal', lastPain?: number}[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(false);

  // Fetch full profiles AND ANALYTICS for the roster list
  useEffect(() => {
      const loadRoster = async () => {
          if (!userProfile.roster || userProfile.roster.length === 0) {
              setRosterData([]); // Clear if empty
              return;
          }
          setLoadingRoster(true);
          const profiles = [];
          
          for (const uid of userProfile.roster) {
              const data = await fetchUserData(uid);
              const planHistory = await getPlanHistory(uid);
              
              let risk: 'High' | 'Low' | 'Optimal' = 'Optimal';
              let pain = 0;

              // Calculate basic risk metric for the dashboard
              if (data.currentPlan) {
                  const acwr = calculateACWR([data.currentPlan as any, ...planHistory as any]);
                  if (acwr.status === 'Alto Riesgo') risk = 'High';
                  if (acwr.status === 'Carga Baja') risk = 'Low';
                  
                  // Check last completed session for pain
                  const lastSession = data.currentPlan.sessions.find(s => s.feedback?.completed);
                  if (lastSession?.feedback?.painLevel) {
                      pain = lastSession.feedback.painLevel;
                      if (pain > 4) risk = 'High'; // Override risk if pain is high
                  }
              }

              if (data.profile) {
                  profiles.push({ 
                      uid, 
                      profile: data.profile as UserProfile,
                      risk,
                      lastPain: pain
                  });
              }
          }
          setRosterData(profiles);
          setLoadingRoster(false);
      };
      
      if (!viewingAthleteId) {
        loadRoster();
      }
  }, [userProfile.roster, viewingAthleteId]);

  const handleAddAthlete = async () => {
      if (!emailQuery.trim()) return;
      setSearching(true);
      
      const cleanEmail = emailQuery.trim().toLowerCase();
      const athlete = await findAthleteByEmail(cleanEmail);
      
      if (athlete) {
          if (userProfile.roster?.includes(athlete.uid)) {
              alert("Este atleta ya está en tu roster.");
          } else {
              const newRoster = [...(userProfile.roster || []), athlete.uid];
              updateProfile({ ...userProfile, roster: newRoster });
              setEmailQuery('');
              alert(`Atleta agregado exitosamente: ${athlete.profile?.name || 'Usuario'}`);
          }
      } else {
          alert("No se encontró usuario con ese email.\n\nCONSEJOS:\n1. Asegúrate que el atleta se haya registrado y entrado al menos una vez.\n2. Verifica mayúsculas/minúsculas (el sistema prefiere minúsculas).\n3. Si usó Google, debe haber completado el registro inicial.");
      }
      setSearching(false);
  };

  const handleSelectAthlete = (uid: string) => {
      switchAthlete(uid);
  };

  if (viewingAthleteId) {
      return (
          <div className="p-6 text-center space-y-6">
              <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8">
                  <Eye className="w-16 h-16 text-cyan-400 mx-auto mb-4"/>
                  <h2 className="text-xl font-bold text-white mb-2">Modo Observador Activo</h2>
                  <p className="text-slate-400 text-sm mb-6">
                      Estás viendo los datos de <span className="text-cyan-400 font-bold">{userProfile.name}</span>. 
                      Cualquier cambio que hagas afectará su plan real.
                  </p>
                  <button 
                    onClick={() => switchAthlete(null)}
                    className="bg-red-900/50 hover:bg-red-900 text-red-100 border border-red-500/50 px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 mx-auto w-full max-w-xs transition-colors"
                  >
                      <LogOut size={20}/> Salir al Panel de Coach
                  </button>
              </div>
          </div>
      );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      
      {/* Header */}
      <div className="bg-gradient-to-br from-indigo-900 to-slate-900 p-6 rounded-2xl border border-indigo-500/30 relative overflow-hidden shadow-2xl">
          <div className="relative z-10">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Briefcase className="text-indigo-400" /> {t.staff.title}
              </h2>
              <p className="text-indigo-200 text-sm mt-1">{t.staff.subtitle}</p>
          </div>
          <Users className="absolute -right-4 -bottom-4 text-indigo-900/50 w-32 h-32"/>
      </div>

      {/* Add Athlete */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h3 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2"><Plus size={12}/> {t.staff.add}</h3>
          <div className="flex gap-2">
              <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 text-slate-500" size={16}/>
                  <input 
                    type="email" 
                    placeholder={t.staff.searchPlaceholder}
                    value={emailQuery}
                    onChange={(e) => setEmailQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddAthlete()}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:border-indigo-500 outline-none"
                  />
              </div>
              <button 
                onClick={handleAddAthlete}
                disabled={searching || !emailQuery}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 rounded-lg font-bold text-xs disabled:opacity-50"
              >
                  {searching ? '...' : 'Agregar'}
              </button>
          </div>
      </div>

      {/* Squad Pulse Roster */}
      <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1 flex justify-between items-center">
              <span>{t.staff.pulseTitle}</span>
              <span className="bg-slate-800 text-[10px] px-2 py-0.5 rounded">{rosterData.length}</span>
          </h3>
          
          {loadingRoster ? (
              <div className="text-center py-8 text-slate-500 text-xs">{t.staff.loading}</div>
          ) : rosterData.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-slate-800 rounded-xl">
                  <Users className="mx-auto text-slate-600 mb-2"/>
                  <p className="text-slate-500 text-sm">{t.staff.noAthletes}</p>
              </div>
          ) : (
              <div className="grid gap-3">
                  {rosterData.map((data) => (
                      <div 
                        key={data.uid}
                        onClick={() => handleSelectAthlete(data.uid)}
                        className={`bg-slate-900 border rounded-xl p-3 flex justify-between items-center cursor-pointer transition-all hover:bg-slate-800 group ${data.risk === 'High' ? 'border-red-900/50 shadow-[0_0_15px_-3px_rgba(239,68,68,0.2)]' : 'border-slate-800'}`}
                      >
                          <div className="flex items-center gap-3">
                              <div className="relative">
                                  <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
                                      <UserCircle2 className="text-slate-400 group-hover:text-indigo-400 transition-colors"/>
                                  </div>
                                  {/* Status Dot */}
                                  <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-slate-900 flex items-center justify-center ${data.risk === 'High' ? 'bg-red-500' : data.risk === 'Low' ? 'bg-yellow-500' : 'bg-emerald-500'}`}>
                                      <Activity size={8} className="text-black fill-current"/>
                                  </div>
                              </div>
                              <div>
                                  <div className="font-bold text-white text-sm">{data.profile?.name || 'Sin Nombre'}</div>
                                  <div className="text-[10px] text-slate-500 flex gap-2 items-center">
                                      <span>{data.profile?.events?.[0] || 'Sprint'}</span>
                                      {data.risk === 'High' && <span className="text-red-400 font-bold flex items-center gap-1">• {t.staff.highRisk}</span>}
                                      {data.lastPain > 0 && <span className="text-orange-400 font-bold flex items-center gap-1">• {t.staff.painAlert} ({data.lastPain}/10)</span>}
                                  </div>
                              </div>
                          </div>
                          
                          <ChevronRight className="text-slate-600 group-hover:text-white transition-colors"/>
                      </div>
                  ))}
              </div>
          )}
      </div>
    </div>
  );
};
