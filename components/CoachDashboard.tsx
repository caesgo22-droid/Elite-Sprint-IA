import * as React from 'react';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../contexts/AppContext';
import { findAthleteByEmail, fetchUserData, getPlanHistory, getAnalysisHistory, getStaffBriefings, addStaffBriefing, addBriefingReply } from '../services/firebase';
import { Users, Plus, Search, UserCircle2, Briefcase, Eye, LogOut, Activity, ArrowLeft, AlertCircle, Microscope, Zap, Trophy, History, CalendarCheck, Maximize2, Dumbbell } from 'lucide-react';
import { UserProfile, StaffBriefing, StaffReply } from '../types';
import { calculateACWR } from '../utils/loadCalculator';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Cell, LabelList, ReferenceLine, ComposedChart } from 'recharts';
import TaskManager from './TaskManager';

const CoachDashboard: React.FC = () => {
    const { adminProfile, updateRoster, viewingAthleteId, switchAthlete, t } = useApp();
    const navigate = useNavigate();
    const [emailQuery, setEmailQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const [rosterData, setRosterData] = useState<{ uid: string, profile: UserProfile, risk: 'High' | 'Low' | 'Optimal', acwrRatio: number, pendingReviews: number, lastActive: string }[]>([]);
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
                try {
                    const data = await fetchUserData(uid);
                    const pHist = await getPlanHistory(uid);
                    const aHist = await getAnalysisHistory(uid);

                    let risk: 'High' | 'Low' | 'Optimal' = 'Optimal';
                    let acwrRatio = 0;
                    if (data.currentPlan) {
                        const acwr = calculateACWR([data.currentPlan as any, ...pHist as any]);
                        acwrRatio = acwr.ratio;
                        if (acwr.status === 'Alto Riesgo') risk = 'High';
                        else if (acwr.status === 'Carga Baja') risk = 'Low';
                    }

                    const fourteenDaysAgo = Date.now() - (14 * 24 * 60 * 60 * 1000);
                    const pendingReviews = aHist.filter((a: any) => {
                        const savedAt = a.savedAt ? new Date(a.savedAt).getTime() : 0;
                        return a.reviewStatus === 'Pending' && savedAt > fourteenDaysAgo;
                    }).length;

                    const lastLog = data.logs && data.logs.length > 0 ? data.logs[data.logs.length - 1] : null;
                    const lastActive = lastLog ? lastLog.date : 'Inactivo';

                    if (data.profile) {
                        profiles.push({ uid, profile: data.profile as UserProfile, risk, acwrRatio, pendingReviews, lastActive });
                    }
                } catch (e) {
                    console.error("Error loading roster item:", uid, e);
                }
            }
            setRosterData(profiles);
            setLoadingRoster(false);
        };
        loadRoster();
    }, [adminProfile.roster, viewingAthleteId]); // Reload roster on return from athlete view to sync deletions

    const handleAddAthlete = async () => {
        if (!emailQuery.trim()) return;
        setSearching(true);
        try {
            const athlete = await findAthleteByEmail(emailQuery.trim().toLowerCase());
            if (athlete) {
                if (adminProfile.roster?.includes(athlete.uid)) alert("Ya en roster.");
                else updateRoster([...(adminProfile.roster || []), athlete.uid]);
                setEmailQuery('');
            } else alert("No encontrado.");
        } catch (e) {
            console.error("Search error:", e);
        }
        setSearching(false);
    };

    if (viewingAthleteId) {
        const athleteData = rosterData.find(r => r.uid === viewingAthleteId);
        return (
            <AthleteProfileDetail
                uid={viewingAthleteId}
                athleteRef={athleteData}
                switchAthlete={switchAthlete}
                adminProfile={adminProfile}
                t={t}
                navigate={navigate}
            />
        );
    }

    return (
        <div className="space-y-6 pb-20">
            <div className="bg-indigo-950 p-6 rounded-3xl border border-indigo-500/30 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-10">
                    <Users size={100} className="text-indigo-400" />
                </div>
                <div className="relative z-10">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-2xl font-black text-white flex items-center gap-2 uppercase tracking-tighter"><Briefcase className="text-indigo-400" /> {t.staff.title}</h2>
                            <p className="text-[10px] text-indigo-300 mt-1 opacity-80 uppercase font-bold tracking-widest">Global Status • Elite Monitoring</p>
                        </div>
                        <div className="bg-indigo-500/20 px-3 py-1 rounded-full text-[10px] font-bold text-indigo-200 border border-indigo-500/30 backdrop-blur-md">
                            {rosterData.length} ATLETAS
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-3xl p-4 flex gap-2 items-center shadow-lg sticky top-0 z-20">
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
                                <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-slate-900 ${data.risk === 'High' ? 'bg-red-500' : data.risk === 'Low' ? 'bg-blue-500' : 'bg-green-500'
                                    }`} title={`Riesgo: ${data.risk}`}></div>
                            </div>
                            <div>
                                <div className="font-bold text-white text-sm group-hover:text-indigo-300 transition-colors">{data.profile?.name || 'Atleta'}</div>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[10px] text-slate-500 uppercase font-black">
                                        {data.profile?.events?.slice(0, 2).join(' / ') || 'SPRINT'}
                                    </span>
                                    <span className="w-1 h-1 bg-slate-700 rounded-full"></span>
                                    <span className={`text-[10px] font-bold ${data.risk === 'High' ? 'text-red-400' : data.risk === 'Low' ? 'text-blue-400' : 'text-green-400'}`}>
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
                                <div className="text-[9px] text-slate-500 font-bold uppercase">Último Log</div>
                                <div className="text-xs font-black text-white">{data.lastActive}</div>
                            </div>
                            <ArrowLeft className="text-slate-700 group-hover:text-indigo-500 group-hover:-translate-x-1 transition-all rotate-180" size={20} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const AthleteProfileDetail: React.FC<{
    uid: string;
    athleteRef: any;
    switchAthlete: (id: string | null) => void;
    adminProfile: UserProfile;
    t: any;
    navigate: any;
}> = ({ uid, athleteRef, switchAthlete, adminProfile, t, navigate }) => {
    const { userProfile, currentPlan, planHistory, logs, acwrStats, updateProfile } = useApp();
    const [briefings, setBriefings] = useState<StaffBriefing[]>([]);
    const [newBriefing, setNewBriefing] = useState('');
    const [showBriefingForm, setShowBriefingForm] = useState(false);
    const [replyContent, setReplyContent] = useState<Record<string, string>>({});
    const photoInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        getStaffBriefings(uid).then(setBriefings);
    }, [uid]);

    const handlePostBriefing = async () => {
        if (!newBriefing.trim()) return;
        const brief: StaffBriefing = {
            id: Date.now().toString(),
            athleteId: uid,
            authorId: adminProfile.uid || 'admin',
            authorName: adminProfile.name || 'Staff',
            role: adminProfile.role || 'Coach',
            content: newBriefing,
            type: 'General',
            timestamp: new Date().toISOString(),
            replies: []
        };
        await addStaffBriefing(uid, brief);
        setBriefings([brief, ...briefings]);
        setNewBriefing('');
        setShowBriefingForm(false);
    };

    const handleReply = async (briefingId: string) => {
        const content = replyContent[briefingId];
        if (!content?.trim()) return;
        const reply: StaffReply = {
            id: Date.now().toString(),
            authorName: adminProfile.name || 'Staff',
            role: adminProfile.role || 'Coach',
            content: content,
            timestamp: new Date().toISOString()
        };
        await addBriefingReply(uid, briefingId, reply);
        setBriefings(briefings.map(b => b.id === briefingId ? { ...b, replies: [...(b.replies || []), reply] } : b));
        setReplyContent({ ...replyContent, [briefingId]: '' });
    };

    const profile = athleteRef?.profile || userProfile;
    if (!profile) return null;

    const pbData = [
        { name: '100m', time: parseFloat(profile.pbs?.['100m']?.time || '0') },
        { name: '200m', time: parseFloat(profile.pbs?.['200m']?.time || '0') },
        { name: '400m', time: parseFloat(profile.pbs?.['400m']?.time || '0') },
    ].filter(d => d.time > 0);

    const macroData = useMemo(() => {
        const history = [...(planHistory || [])]
            .filter(p => p.createdAt)
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        const recent = history.slice(-3);
        const calcLoad = (plan: any) => {
            let load = 0;
            if (plan?.sessions) {
                plan.sessions.forEach((s: any) => {
                    const factor = s.intensity === 'Max' ? 5 : s.intensity === 'High' ? 4 : s.intensity === 'Medium' ? 3 : 1;
                    load += factor * 10;
                });
            }
            return load;
        };
        const data: any[] = [];
        recent.forEach((p, i) => {
            data.push({
                name: `Sem ${-1 * (recent.length - i)}`,
                realLoad: calcLoad(p),
                isCurrent: false,
                weekStart: new Date(p.createdAt)
            });
        });
        const cLoad = currentPlan ? calcLoad(currentPlan) : 0;
        data.push({ name: 'ACTUAL', realLoad: cLoad, isCurrent: true, weekStart: new Date() });
        let lastLoad = cLoad || 150;
        for (let i = 1; i <= 3; i++) {
            lastLoad *= 1.02;
            const d = new Date();
            d.setDate(d.getDate() + (i * 7));
            data.push({ name: `Sem +${i}`, projectedLoad: Math.round(lastLoad), isCurrent: false, weekStart: d });
        }
        return data;
    }, [planHistory, currentPlan]);

    const milestones = useMemo(() => {
        const marks: { week: string; type: string; label: string }[] = [];
        profile.injuries?.forEach(inj => {
            if (!inj.diagnosedDate) return;
            const dLine = new Date(inj.diagnosedDate);
            macroData.forEach(d => {
                const start = new Date(d.weekStart);
                const end = new Date(start);
                end.setDate(end.getDate() + 7);
                if (dLine >= start && dLine < end) {
                    marks.push({ week: d.name, type: 'injury', label: `🔴 ${inj.type}` });
                }
            });
        });
        profile.competitions?.forEach(comp => {
            if (!comp.date) return;
            const dLine = new Date(comp.date);
            macroData.forEach(d => {
                const start = new Date(d.weekStart);
                const end = new Date(start);
                end.setDate(end.getDate() + 7);
                if (dLine >= start && dLine < end) {
                    marks.push({ week: d.name, type: 'comp', label: `🏆 ${comp.name}` });
                }
            });
        });
        logs?.filter(l => l.event === 'Therapy').forEach(log => {
            const dLine = new Date(log.date);
            macroData.forEach(d => {
                const start = new Date(d.weekStart);
                const end = new Date(start);
                end.setDate(end.getDate() + 7);
                if (dLine >= start && dLine < end) {
                    if (!marks.some(m => m.week === d.name && m.type === 'therapy')) {
                        marks.push({ week: d.name, type: 'therapy', label: '💊' });
                    }
                }
            });
        });
        return marks;
    }, [macroData, profile.injuries, profile.competitions, logs]);

    const trainingDaysCount = useMemo(() => {
        const days = profile.trainingDays || [];
        // Normalizer map to prevent duplicates between different languages/abbreviations
        const normalizer: Record<string, string> = {
            'lun': 'mon', 'lunes': 'mon', 'mon': 'mon', 'monday': 'mon',
            'mar': 'tue', 'martes': 'tue', 'tue': 'tue', 'tuesday': 'tue',
            'mie': 'wed', 'miercoles': 'wed', 'wed': 'wed', 'wednesday': 'wed',
            'jue': 'thu', 'jueves': 'thu', 'thu': 'thu', 'thursday': 'thu',
            'vie': 'fri', 'viernes': 'fri', 'fri': 'fri', 'friday': 'fri',
            'sab': 'sat', 'sabado': 'sat', 'sat': 'sat', 'saturday': 'sat',
            'dom': 'sun', 'domingo': 'sun', 'sun': 'sun', 'sunday': 'sun'
        };
        const uniqueNormalized = new Set(
            days.map(d => normalizer[d.toLowerCase().trim()] || d.toLowerCase().trim())
        );
        return uniqueNormalized.size;
    }, [profile.trainingDays]);

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-indigo-950 border border-indigo-500/30 rounded-[2rem] p-6 shadow-2xl relative overflow-hidden">
                <button onClick={() => switchAthlete(null)} className="absolute top-6 left-6 p-2 bg-indigo-900/50 rounded-full text-indigo-300 hover:text-white transition-colors z-20">
                    <ArrowLeft size={20} />
                </button>
                <div className="mt-8 relative z-10 flex flex-col md:flex-row items-center gap-6">
                    <div className="w-24 h-24 rounded-[2rem] bg-indigo-900 border-4 border-slate-900 shadow-xl overflow-hidden shrink-0">
                        {profile.photoURL ? <img src={profile.photoURL} className="w-full h-full object-cover" /> : <UserCircle2 className="text-white m-auto" size={48} />}
                    </div>
                    <div className="text-center md:text-left">
                        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-2">
                            <h2 className="text-4xl font-black text-white uppercase tracking-tighter">{profile.name || 'Invitado'}</h2>
                            <div className="flex gap-2 flex-wrap justify-center md:justify-start">
                                <span className={`px-3 py-1 bg-indigo-500/20 rounded-full text-[9px] font-black border border-indigo-500/30 uppercase ${acwrStats.status === 'Alto Riesgo' ? 'text-red-400 border-red-500/30' :
                                    acwrStats.status === 'Carga Baja' ? 'text-blue-400 border-blue-500/30' : 'text-indigo-300'
                                    }`}>
                                    ACWR: {acwrStats.ratio.toFixed(2)} {acwrStats.status.toUpperCase()}
                                </span>
                            </div>
                        </div>
                        <div className="flex flex-wrap justify-center md:justify-start gap-4 text-[10px] font-bold text-slate-300 uppercase">
                            <span className="flex items-center gap-1"><CalendarCheck size={12} /> {profile.age || 20} AÑOS</span>
                            <span className="flex items-center gap-1"><Maximize2 size={12} /> {profile.height || '--'} CM</span>
                            <span className="flex items-center gap-1"><Dumbbell size={12} /> {profile.weight || '--'} KG</span>
                            <span className="flex items-center gap-1 text-emerald-400"><Zap size={12} /> {trainingDaysCount} DÍAS/SEM</span>
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-8 relative z-10">
                    <div className="text-[9px] text-slate-400 font-bold uppercase mb-1">Próx. COMPETENCIA</div>
                    <div className="text-xs font-black text-white uppercase truncate">{profile.competitions?.[0] ? profile.competitions[0].name : 'No programada'}</div>
                    <div className="text-[9px] text-yellow-500 font-bold mt-1 uppercase">{profile.competitions?.[0] ? profile.competitions[0].date : '-'}</div>
                    <div className="bg-slate-900/50 border border-slate-700/50 p-4 rounded-2xl">
                        <div className="text-[9px] text-slate-400 font-bold uppercase mb-1">LESIONES ACTIVAS</div>
                        <div className="text-xs font-black text-red-400">{profile.injuries?.filter(i => i.status === 'Activa').length || 0} Reportadas</div>
                        <div className="mt-1 flex flex-wrap gap-1">
                            {profile.injuries?.filter(i => i.status === 'Activa').slice(0, 2).map((inj, i) => (
                                <span key={i} className="text-[8px] text-slate-300 bg-red-500/10 px-1 rounded truncate">{inj.type}</span>
                            ))}
                        </div>
                    </div>
                    <div className="bg-slate-900/50 border border-slate-700/50 p-4 rounded-2xl">
                        <div className="text-[9px] text-slate-400 font-bold uppercase mb-1">ENFOQUE ACTUAL</div>
                        <div className="text-xs font-black text-white">{currentPlan?.phase || 'Plan General'}</div>
                        <div className="text-[9px] text-emerald-400 font-bold mt-1">Sincronizado</div>
                    </div>
                    <div className="bg-slate-900/50 border border-slate-700/50 p-4 rounded-2xl">
                        <div className="text-[9px] text-slate-400 font-bold uppercase mb-1">ÚLTIMO REGISTRO</div>
                        <div className="text-xs font-black text-white">{athleteRef?.lastActive || 'Inactivo'}</div>
                        <div className="text-[9px] text-slate-500 font-bold mt-1 uppercase">Sincronizado</div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
                    <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-4">Récords Personales</h3>
                    <div className="h-48 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={pbData} layout="vertical" margin={{ left: -20, right: 30 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={10} fontWeight="900" width={50} axisLine={false} tickLine={false} />
                                <Tooltip contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '12px' }} />
                                <Bar dataKey="time" radius={[0, 6, 6, 0]} fill="#06b6d4">
                                    <LabelList dataKey="time" position="right" fill="#22d3ee" fontSize={10} fontWeight="900" offset={10} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-black text-white uppercase tracking-tighter">Macrociclo (8 Semanas)</h3>
                        <div className="flex gap-2 text-[8px] font-bold uppercase">
                            <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 bg-cyan-500 rounded-full"></div> Real</span>
                            <span className="flex items-center gap-1">🔴 Lesión</span>
                            <span className="flex items-center gap-1">💊 Ter</span>
                        </div>
                    </div>
                    <div className="h-48 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={macroData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                <XAxis dataKey="name" stroke="#475569" fontSize={9} fontWeight="900" axisLine={false} tickLine={false} />
                                <YAxis hide domain={[0, 'auto']} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '12px' }}
                                    formatter={(value: any, name: string, props: any) => {
                                        const weekMarks = milestones.filter(m => m.week === props.payload.name);
                                        return [`${value} ${weekMarks.map(m => m.label).join(' ')}`, name === 'realLoad' ? 'Carga' : 'Futuro'];
                                    }}
                                />
                                <Area type="monotone" dataKey="realLoad" stroke="#22d3ee" strokeWidth={4} fill="#22d3ee" fillOpacity={0.1} />
                                <Area type="monotone" dataKey="projectedLoad" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" fill="transparent" />
                                <ReferenceLine x="ACTUAL" stroke="#22d3ee" strokeDasharray="3 3" />
                                {milestones.filter(m => m.type === 'injury').map((m, i) => (
                                    <ReferenceLine key={i} x={m.week} stroke="#ef4444" strokeWidth={2} />
                                ))}
                                {milestones.filter(m => m.type === 'therapy').map((m, i) => (
                                    <ReferenceLine key={i} x={m.week} stroke="#3b82f6" strokeWidth={1} strokeDasharray="2 2" />
                                ))}
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-black text-white uppercase tracking-tighter">Bitácora de Staff</h3>
                    <button onClick={() => setShowBriefingForm(!showBriefingForm)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest text-white">
                        <Plus size={14} /> Nueva Nota
                    </button>
                </div>
                {showBriefingForm && (
                    <div className="mb-6 bg-slate-800/50 p-4 rounded-2xl border border-indigo-500/20">
                        <textarea value={newBriefing} onChange={e => setNewBriefing(e.target.value)} placeholder="Notas internas sobre el atleta..." className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white focus:border-indigo-500 outline-none h-24 mb-3" />
                        <div className="flex justify-end gap-2 text-[10px] font-black uppercase">
                            <button onClick={() => setShowBriefingForm(false)} className="text-slate-400 px-4 py-2">Cancelar</button>
                            <button onClick={handlePostBriefing} className="bg-indigo-600 text-white px-4 py-2 rounded-xl">Publicar</button>
                        </div>
                    </div>
                )}
                <div className="space-y-4">
                    {briefings.map(b => (
                        <div key={b.id} className="bg-slate-800 border border-slate-700 p-4 rounded-2xl">
                            <div className="flex justify-between items-center text-[8px] font-black uppercase text-slate-500 mb-2">
                                <span>{b.role} • {b.authorName}</span>
                                <span>{new Date(b.timestamp).toLocaleDateString()}</span>
                            </div>
                            <p className="text-xs text-white mb-4">{b.content}</p>
                            <div className="space-y-2 ml-4 border-l-2 border-slate-700 pl-4">
                                {b.replies?.map(r => (
                                    <div key={r.id}>
                                        <div className="text-[8px] font-black text-indigo-400">{r.authorName} <span className="text-slate-600 ml-1">{new Date(r.timestamp).toLocaleTimeString()}</span></div>
                                        <div className="text-[10px] text-slate-300">{r.content}</div>
                                    </div>
                                ))}
                                <div className="flex gap-2 mt-2">
                                    <input value={replyContent[b.id] || ''} onChange={e => setReplyContent({ ...replyContent, [b.id]: e.target.value })} placeholder="Respuesta rápida..." className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[9px] text-white outline-none focus:border-indigo-500" />
                                    <button onClick={() => handleReply(b.id)} className="bg-slate-700 text-white px-2 rounded text-[8px] font-black">OK</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default CoachDashboard;