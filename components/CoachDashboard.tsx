import * as React from 'react';
import { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { findAthleteByEmail, fetchUserData, getPlanHistory } from '../services/firebase';
import { Users, Plus, Search, UserCircle2, Briefcase, Eye, LogOut, Activity, ArrowRight } from 'lucide-react';
import { UserProfile } from '../types';
import { calculateACWR } from '../utils/loadCalculator';

const CoachDashboard: React.FC = () => {
  const { adminProfile, user, updateRoster, viewingAthleteId, switchAthlete, t } = useApp();
  const [emailQuery, setEmailQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [rosterData, setRosterData] = useState<{uid: string, profile: UserProfile, risk: 'High' | 'Low' | 'Optimal', lastPain?: number}[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(false);

  useEffect(() => {
      const loadRoster = async () => {
          if (!adminProfile.roster || adminProfile.roster.length === 0) {
              setRosterData([]);
              return;
          }
          setLoadingRoster(true);
          const profiles = [];
          for (const uid of adminProfile.roster) {
              const data = await fetchUserData(uid);
              const pHist = await getPlanHistory(uid);
              let risk: 'High' | 'Low' | 'Optimal' = 'Optimal';
              if (data.currentPlan) {
                  const acwr = calculateACWR([data.currentPlan as any, ...pHist as any]);
                  if (acwr.status === 'Alto Riesgo') risk = 'High';
                  else if (acwr.status === 'Carga Baja') risk = 'Low';
              }
              if (data.profile) profiles.push({ uid, profile: data.profile as UserProfile, risk });
          }
          setRosterData(profiles);
          setLoadingRoster(false);
      };
      loadRoster();
  }, [adminProfile.roster]);

  const handleAddAthlete = async () => {
      if (!emailQuery.trim()) return;
      setSearching(true);
      const athlete = await findAthleteByEmail(emailQuery.trim().toLowerCase());
      if (athlete) {
          if (adminProfile.roster?.includes(athlete.uid)) alert("Ya en roster.");
          else updateRoster([...(adminProfile.roster || []), athlete.uid]);
          setEmailQuery('');
      } else alert("No encontrado.");
      setSearching(false);
  };

  if (viewingAthleteId) {
      return (
          <div className="p-6 text-center space-y-6">
              <div className="bg-indigo-900/30 border border-indigo-500/50 rounded-3xl p-8">
                  <Eye className="w-16 h-16 text-indigo-400 mx-auto mb-4"/>
                  <h2 className="text-2xl font-bold text-white mb-8">Monitor Activo</h2>
                  <button onClick={() => switchAthlete(null)} className="bg-white text-indigo-900 px-6 py-4 rounded-xl font-bold flex items-center justify-center gap-2 w-full">
                      <LogOut size={20}/> Volver
                  </button>
              </div>
          </div>
      );
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="bg-indigo-900 p-6 rounded-2xl border border-indigo-500/30">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2"><Briefcase /> {t.staff.title}</h2>
      </div>
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex gap-2">
          <input type="email" placeholder={t.staff.searchPlaceholder} value={emailQuery} onChange={e => setEmailQuery(e.target.value)} className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white" />
          <button onClick={handleAddAthlete} disabled={searching} className="bg-indigo-600 text-white px-4 rounded-lg font-bold">Agregar</button>
      </div>
      <div className="space-y-3">
          {rosterData.map(data => (
              <div key={data.uid} onClick={() => switchAthlete(data.uid)} className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex justify-between items-center cursor-pointer">
                  <div className="flex items-center gap-3">
                      <UserCircle2 className="text-slate-400" />
                      <div className="font-bold text-white">{data.profile?.name}</div>
                  </div>
                  <ArrowRight className="text-slate-600" />
              </div>
          ))}
      </div>
    </div>
  );
};

export default CoachDashboard;