import * as React from 'react';
import { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { findAthleteByEmail, fetchUserData, getPlanHistory, getAnalysisHistory } from '../services/firebase';
import { Users, Plus, Search, UserCircle2, Briefcase, Eye, LogOut, Activity, ArrowRight } from 'lucide-react';
import { UserProfile } from '../types';
import { calculateACWR } from '../utils/loadCalculator';

const CoachDashboard: React.FC = () => {
    const { adminProfile, user, updateRoster, viewingAthleteId, switchAthlete, t } = useApp();
    const [emailQuery, setEmailQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const [rosterData, setRosterData] = useState<{ uid: string, profile: UserProfile, risk: 'High' | 'Low' | 'Optimal', pendingReviews: number }[]>([]);
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
                const aHist = await getAnalysisHistory(uid);

                let risk: 'High' | 'Low' | 'Optimal' = 'Optimal';
                if (data.currentPlan) {
                    const acwr = calculateACWR([data.currentPlan as any, ...pHist as any]);
                    if (acwr.status === 'Alto Riesgo') risk = 'High';
                    else if (acwr.status === 'Carga Baja') risk = 'Low';
                }

                const pendingReviews = aHist.filter((a: any) => a.reviewStatus === 'Pending').length;

                if (data.profile) profiles.push({ uid, profile: data.profile as UserProfile, risk, pendingReviews });
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
                    <Eye className="w-16 h-16 text-indigo-400 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-white mb-8">Monitor Activo</h2>
                    <button onClick={() => switchAthlete(null)} className="bg-white text-indigo-900 px-6 py-4 rounded-xl font-bold flex items-center justify-center gap-2 w-full">
                        <LogOut size={20} /> Volver
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-20">
            <div className="bg-indigo-900 p-6 rounded-3xl border border-indigo-500/30 shadow-2xl">
                <div className="flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-black text-white flex items-center gap-2 uppercase tracking-tighter"><Briefcase className="text-indigo-400" /> {t.staff.title}</h2>
                        <p className="text-xs text-indigo-300 mt-1 opacity-80 uppercase font-bold tracking-widest">Global Status • Elite Monitoring</p>
                    </div>
                    <div className="bg-indigo-800/50 px-3 py-1 rounded-full text-[10px] font-bold text-indigo-200 border border-indigo-500/30">
                        {rosterData.length} ATLETAS
                    </div>
                </div>
            </div>

            <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-3xl p-4 flex gap-2 items-center shadow-lg">
                <Search className="text-slate-500 ml-2" size={18} />
                <input
                    type="email"
                    placeholder={t.staff.searchPlaceholder}
                    value={emailQuery}
                    onChange={e => setEmailQuery(e.target.value)}
                    className="flex-1 bg-transparent border-none focus:ring-0 text-white placeholder-slate-500 text-sm"
                />
                <button
                    onClick={handleAddAthlete}
                    disabled={searching}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-2xl font-black text-[10px] uppercase transition-all shadow-lg active:scale-95 disabled:opacity-50"
                >
                    {searching ? '...' : 'Reclutar'}
                </button>
            </div>

            <div className="grid gap-3">
                {loadingRoster ? (
                    <div className="text-center py-12">
                        <Activity className="animate-spin text-indigo-500 mx-auto mb-2" />
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Sincronizando Roster...</p>
                    </div>
                ) : rosterData.length === 0 ? (
                    <div className="text-center py-12 bg-slate-900/40 rounded-3xl border border-dashed border-slate-800">
                        <Users className="text-slate-700 mx-auto mb-2" size={32} />
                        <p className="text-xs text-slate-500">No hay atletas en tu roster global.</p>
                    </div>
                ) : rosterData.map(data => (
                    <div
                        key={data.uid}
                        onClick={() => switchAthlete(data.uid)}
                        className="group bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-4 flex items-center justify-between cursor-pointer transition-all duration-300 hover:shadow-[0_0_20px_rgba(79,70,229,0.1)] active:scale-[0.98]"
                    >
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-800 to-slate-950 border border-slate-700 flex items-center justify-center overflow-hidden">
                                    <UserCircle2 className="text-slate-500 group-hover:text-indigo-400 transition-colors" size={28} />
                                </div>
                                <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-slate-900 \${
                          data.risk === 'High' ? 'bg-red-500' : data.risk === 'Low' ? 'bg-blue-500' : 'bg-green-500'
                        }`} title={`Riesgo: \${data.risk}`}></div>
                            </div>
                            <div>
                                <div className="font-bold text-white text-sm group-hover:text-indigo-300 transition-colors">{data.profile?.name}</div>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[10px] text-slate-500 uppercase font-black">{data.profile?.events?.[0] || 'SPRINT'}</span>
                                    <span className="w-1 h-1 bg-slate-700 rounded-full"></span>
                                    <span className={`text-[10px] font-bold \${
                              data.risk === 'High' ? 'text-red-400' : data.risk === 'Low' ? 'text-blue-400' : 'text-green-400'
                            }`}>
                                        {data.risk === 'High' ? 'ALTO RIESGO' : data.risk === 'Low' ? 'CARGA BAJA' : 'ÓPTIMO'}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {data.pendingReviews > 0 && (
                                <div className="bg-red-500/10 border border-red-500/50 px-2 py-0.5 rounded-lg flex items-center gap-1 animate-pulse">
                                    <Eye size={10} className="text-red-400" />
                                    <span className="text-[9px] font-black text-red-400">{data.pendingReviews} PENDIENTES</span>
                                </div>
                            )}
                            <div className="text-right hidden sm:block">
                                <div className="text-[9px] text-slate-500 font-bold uppercase">Ready</div>
                                <div className="text-xs font-black text-white">85%</div>
                            </div>
                            <ArrowRight className="text-slate-700 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" size={20} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default CoachDashboard;