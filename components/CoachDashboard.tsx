
import * as React from 'react';
import { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { findAthleteByEmail, fetchUserData, saveUserProfile } from '../services/firebase';
import { Users, Plus, Search, ChevronRight, UserCircle2, Briefcase, Eye, LogOut } from 'lucide-react';
import { UserProfile } from '../types';

export const CoachDashboard: React.FC = () => {
  const { user, userProfile, updateProfile, viewingAthleteId, switchAthlete } = useApp();
  const [emailQuery, setEmailQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [rosterData, setRosterData] = useState<{uid: string, profile: UserProfile}[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(false);

  // Fetch full profiles for the roster list
  useEffect(() => {
      const loadRoster = async () => {
          if (!userProfile.roster || userProfile.roster.length === 0) return;
          setLoadingRoster(true);
          const profiles = [];
          for (const uid of userProfile.roster) {
              const data = await fetchUserData(uid);
              if (data.profile) profiles.push({ uid, profile: data.profile as UserProfile });
          }
          setRosterData(profiles);
          setLoadingRoster(false);
      };
      
      // Only load roster if we are currently looking at the Coach Profile (not an athlete view)
      if (!viewingAthleteId) {
        loadRoster();
      }
  }, [userProfile.roster, viewingAthleteId]);

  const handleAddAthlete = async () => {
      if (!emailQuery.trim()) return;
      setSearching(true);
      const athlete = await findAthleteByEmail(emailQuery.trim());
      
      if (athlete) {
          if (userProfile.roster?.includes(athlete.uid)) {
              alert("Este atleta ya está en tu roster.");
          } else {
              const newRoster = [...(userProfile.roster || []), athlete.uid];
              updateProfile({ ...userProfile, roster: newRoster });
              setEmailQuery('');
              alert(`Atleta agregado: ${athlete.profile?.name || 'Usuario'}`);
          }
      } else {
          alert("No se encontró usuario con ese email. Asegúrate de que el atleta se haya registrado primero.");
      }
      setSearching(false);
  };

  const handleSelectAthlete = (uid: string) => {
      switchAthlete(uid);
  };

  // If viewing an athlete, this component shouldn't technically be visible in full, 
  // but if navigated to, it acts as the "Exit" door.
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
                  <Briefcase className="text-indigo-400" /> Panel de Staff
              </h2>
              <p className="text-indigo-200 text-sm mt-1">Gestión de Roster & Alto Rendimiento</p>
          </div>
          <Users className="absolute -right-4 -bottom-4 text-indigo-900/50 w-32 h-32"/>
      </div>

      {/* Add Athlete */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h3 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2"><Plus size={12}/> Agregar Atleta</h3>
          <div className="flex gap-2">
              <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 text-slate-500" size={16}/>
                  <input 
                    type="email" 
                    placeholder="email.atleta@ejemplo.com" 
                    value={emailQuery}
                    onChange={(e) => setEmailQuery(e.target.value)}
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

      {/* Roster List */}
      <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Tu Roster ({rosterData.length})</h3>
          
          {loadingRoster ? (
              <div className="text-center py-8 text-slate-500 text-xs">Cargando atletas...</div>
          ) : rosterData.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-slate-800 rounded-xl">
                  <Users className="mx-auto text-slate-600 mb-2"/>
                  <p className="text-slate-500 text-sm">No tienes atletas asignados.</p>
              </div>
          ) : (
              rosterData.map((athlete) => (
                  <div 
                    key={athlete.uid}
                    onClick={() => handleSelectAthlete(athlete.uid)}
                    className="bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl p-4 flex justify-between items-center cursor-pointer transition-all group"
                  >
                      <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
                              <UserCircle2 className="text-slate-400 group-hover:text-indigo-400 transition-colors"/>
                          </div>
                          <div>
                              <div className="font-bold text-white text-sm">{athlete.profile?.name || 'Sin Nombre'}</div>
                              <div className="text-xs text-slate-500 flex gap-2">
                                  <span>{athlete.profile?.events?.[0] || 'Sprint'}</span>
                                  <span>•</span>
                                  <span>{athlete.profile?.experienceLevel || 'N/A'}</span>
                              </div>
                          </div>
                      </div>
                      <ChevronRight className="text-slate-600 group-hover:text-white transition-colors"/>
                  </div>
              ))
          )}
      </div>
    </div>
  );
};
