import * as React from 'react';
import { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { findAthleteByEmail, fetchUserData, getPlanHistory, getAnalysisHistory, getStaffBriefings, addStaffBriefing, addBriefingReply } from '../services/firebase';
import { Users, Plus, Search, UserCircle2, Briefcase, Eye, LogOut, Activity, ArrowRight, AlertCircle, Microscope, Zap, Trophy, History, CalendarCheck, Maximize2, Dumbbell } from 'lucide-react';
import { UserProfile, StaffBriefing, StaffReply } from '../types';
import { calculateACWR } from '../utils/loadCalculator';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Cell, LabelList } from 'recharts';
import TaskManager from './TaskManager';

const CoachDashboard: React.FC = () => {
    const { adminProfile, user, userProfile, updateRoster, viewingAthleteId, switchAthlete, t, updateProfile } = useApp();
    const navigate = useNavigate(); // Hook for navigation
    const [emailQuery, setEmailQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const [rosterData, setRosterData] = useState<{ uid: string, profile: UserProfile, risk: 'High' | 'Low' | 'Optimal', acwrRatio: number, pendingReviews: number, lastActive: string }[]>([]);
    const [loadingRoster, setLoadingRoster] = useState(false);
    const photoInputRef = React.useRef<HTMLInputElement>(null);

    // Staff Round Table State
    const [briefings, setBriefings] = useState<StaffBriefing[]>([]);
    const [newBriefing, setNewBriefing] = useState('');
    const [showBriefingForm, setShowBriefingForm] = useState(false);
    const [selectedType, setSelectedType] = useState<'Strategy' | 'Physical' | 'Psychology' | 'Technique' | 'General'>('Strategy');
    const [replyContent, setReplyContent] = useState<{ [key: string]: string }>({});

    useEffect(() => {
        if (viewingAthleteId) {
            getStaffBriefings(viewingAthleteId).then((data: any[]) => setBriefings(data));
        }
    }, [viewingAthleteId]);

    const handlePostBriefing = async () => {
        if (!newBriefing.trim()) return;
        const brief: StaffBriefing = {
            id: Date.now().toString(),
            athleteId: viewingAthleteId!,
            authorId: adminProfile.uid || 'admin',
            authorName: adminProfile.name || 'Staff',
            role: adminProfile.role || 'Coach', // Fallback
            content: newBriefing,
            type: selectedType,
            timestamp: new Date().toISOString(),
            replies: []
        };
        await addStaffBriefing(viewingAthleteId!, brief);
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

        await addBriefingReply(viewingAthleteId!, briefingId, reply);

        // Optimistic update
        const updated = briefings.map(b => b.id === briefingId ? { ...b, replies: [...(b.replies || []), reply] } : b);
        setBriefings(updated);
        setReplyContent({ ...replyContent, [briefingId]: '' });
    };

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
                let acwrRatio = 0;
                if (data.currentPlan) {
                    const acwr = calculateACWR([data.currentPlan as any, ...pHist as any]);
                    acwrRatio = acwr.ratio;
                    if (acwr.status === 'Alto Riesgo') risk = 'High';
                    else if (acwr.status === 'Carga Baja') risk = 'Low';
                }

                // Only count pending reviews from last 14 days
                const fourteenDaysAgo = Date.now() - (14 * 24 * 60 * 60 * 1000);
                const pendingReviews = aHist.filter((a: any) => {
                    const savedAt = a.savedAt ? new Date(a.savedAt).getTime() : 0;
                    return a.reviewStatus === 'Pending' && savedAt > fourteenDaysAgo;
                }).length;
                const lastLog = data.logs && data.logs.length > 0 ? data.logs[data.logs.length - 1] : null;
                const lastActive = lastLog ? lastLog.date : 'Inactivo';

                if (data.profile) profiles.push({ uid, profile: data.profile as UserProfile, risk, acwrRatio, pendingReviews, lastActive });
            }
            setRosterData(profiles);
            setLoadingRoster(false);
        };
        loadRoster();
    }, [adminProfile.roster]);


    const handleAddAthlete = async () => {
        if (!emailQuery.trim()) return;
        setSearching(false); // Reset search state
        setSearching(true);
        const athlete = await findAthleteByEmail(emailQuery.trim().toLowerCase());
        if (athlete) {
            if (adminProfile.roster?.includes(athlete.uid)) alert("Ya en roster.");
            else updateRoster([...(adminProfile.roster || []), athlete.uid]);
            setEmailQuery('');
        } else alert("No encontrado.");
        setSearching(false);
    };

    // Helper for safe string rendering
    const safeStr = (val: any, fallback: string = '--'): string => {
        if (typeof val === 'string') return val;
        if (typeof val === 'number') return String(val);
        if (val && typeof val === 'object') return 'Data Error';
        return fallback;
    };


    if (viewingAthleteId) {

        const currentAthlete = rosterData.find(r => r.uid === viewingAthleteId);
        const profile = currentAthlete?.profile || userProfile; // Fallback to userProfile if not found in roster

        // Safety check: if profile not loaded yet AND we don't have a fallback, show loading state
        if (!profile || !currentAthlete) {
            return (
                <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 flex items-center justify-center">
                    <div className="text-center">
                        <div className="text-slate-500 text-sm uppercase tracking-widest mb-4">Sincronizando Atleta...</div>
                        <div className="animate-spin h-8 w-8 border-2 border-cyan-500 border-t-transparent rounded-full mx-auto"></div>
                    </div>
                </div>
            );
        }

        const nextComp = profile.competitions && profile.competitions.length > 0 ? profile.competitions[0] : null;

        // PB Data for Chart
        const pbData = [
            { name: '100m', time: parseFloat(profile.pbs?.['100m']?.time || '0') },
            { name: '200m', time: parseFloat(profile.pbs?.['200m']?.time || '0') },
            { name: '400m', time: parseFloat(profile.pbs?.['400m']?.time || '0') },
        ].filter(d => d.time > 0);

        // Macrocycle Simulation (8 weeks)
        const macroData = [
            { week: 'W1', intensity: 70, fatigue: 40 },
            { week: 'W2', intensity: 80, fatigue: 55 },
            { week: 'W3', intensity: 90, fatigue: 75 },
            { week: 'W4', intensity: 60, fatigue: 30 }, // Recovery
            { week: 'W5', intensity: 85, fatigue: 60 },
            { week: 'W6', intensity: 95, fatigue: 80 },
            { week: 'W7', intensity: 100, fatigue: 90 }, // Peak
            { week: 'W8', intensity: 50, fatigue: 20 }, // Tap
        ];

        return (
            <div className="space-y-6 animate-in fade-in duration-300">
                {/* EXECUTIVE SUMMARY HEADER */}
                <div className="bg-indigo-950 border border-indigo-500/30 rounded-[2rem] p-6 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-6 opacity-10">
                        <Activity size={150} className="text-indigo-400" />
                    </div>
                    <button onClick={() => switchAthlete(null)} className="absolute top-6 left-6 p-2 bg-indigo-900/50 rounded-full text-indigo-300 hover:text-white transition-colors z-20">
                        <ArrowRight className="rotate-180" size={20} />
                    </button>

                    <div className="mt-8 relative z-10 flex flex-col md:flex-row items-center gap-6">
                        <div className="relative group/avatar">
                            <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-indigo-500 via-purple-600 to-indigo-900 shadow-xl flex items-center justify-center border-4 border-slate-900 shrink-0 overflow-hidden">
                                {profile?.photoURL ? (
                                    <img src={profile.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <UserCircle2 className="text-white" size={48} />
                                )}
                            </div>
                            <button
                                onClick={() => photoInputRef.current?.click()}
                                className="absolute -bottom-1 -right-1 bg-slate-900 border border-slate-700 p-1.5 rounded-xl text-indigo-400 hover:text-white transition-all shadow-lg md:hidden group-hover/avatar:block"
                            >
                                <Plus size={14} />
                            </button>
                            <input
                                type="file"
                                ref={photoInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file && profile) {
                                        const reader = new FileReader();
                                        reader.onloadend = () => {
                                            updateProfile({ ...profile, photoURL: reader.result as string });
                                        };
                                        reader.readAsDataURL(file);
                                    }
                                }}
                            />
                        </div>
                        <div className="text-center md:text-left">
                            <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
                                <h2 className="text-3xl font-black text-white uppercase tracking-tighter">
                                    {safeStr(profile?.name || 'Atleta')}
                                </h2>
                                {currentAthlete?.risk === 'High' && <AlertCircle className="text-red-500 animate-pulse" size={24} />}
                            </div>
                            <div className="flex flex-wrap justify-center md:justify-start gap-2 mb-4">
                                <span className="px-3 py-1 bg-indigo-500/20 rounded-lg text-indigo-200 text-xs font-bold uppercase border border-indigo-500/30">
                                    {profile?.events?.join(', ') || 'Sprint'}
                                </span>
                                <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase border ${currentAthlete?.risk === 'High' ? 'bg-red-500/20 text-red-200 border-red-500/30' :
                                    currentAthlete?.risk === 'Low' ? 'bg-blue-500/20 text-blue-200 border-blue-500/30' :
                                        'bg-green-500/20 text-green-200 border-green-500/30'
                                    }`}>
                                    ACWR: {currentAthlete?.acwrRatio?.toFixed(2) || '0.00'} {currentAthlete?.risk === 'High' ? 'CRÍTICO' : currentAthlete?.risk === 'Low' ? 'BAJO' : 'ÓPTIMO'}
                                </span>
                            </div>

                            {/* ATHLETE QUICK SPECS */}
                            <div className="flex flex-wrap justify-center md:justify-start gap-4">
                                <div className="flex items-center gap-1.5">
                                    <CalendarCheck className="text-slate-500" size={14} />
                                    <span className="text-[10px] font-bold text-slate-300 uppercase">{profile?.age || 20} AÑOS</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Maximize2 className="text-slate-500" size={14} />
                                    <span className="text-[10px] font-bold text-slate-300 uppercase">{profile?.height || '--'} CM</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Dumbbell className="text-slate-500" size={14} />
                                    <span className="text-[10px] font-bold text-slate-300 uppercase">{profile?.weight || '--'} KG</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Zap className="text-emerald-400" size={14} />
                                    <span className="text-[10px] font-bold text-slate-300 uppercase">{[...new Set(profile?.trainingDays || [])].length} DÍAS/SEM</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* EXECUTIVE METRICS GRID */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-8 relative z-10">
                        <div className="bg-slate-900/50 border border-slate-700/50 p-4 rounded-2xl">
                            <div className="text-[9px] text-slate-400 font-bold uppercase mb-1">Próxima Competencia</div>
                            <div className="text-sm font-black text-white truncate">{nextComp ? safeStr(nextComp.name) : 'No Asignada'}</div>
                            <div className="text-[10px] text-indigo-400 font-bold mt-1">{nextComp ? safeStr(nextComp.date) : '--'}</div>
                        </div>
                        <div className="bg-slate-900/50 border border-slate-700/50 p-4 rounded-2xl relative overflow-hidden group">
                            <div className="text-[9px] text-slate-400 font-bold uppercase mb-1">Status Médico</div>
                            <div className={`text-sm font-black ${profile?.injuries?.some(i => i.status === 'Activa') ? 'text-red-400' : 'text-emerald-400'}`}>
                                {profile?.injuries?.filter(i => i.status === 'Activa').length || 0} Activas
                            </div>
                            <div className="mt-2 space-y-1">
                                {profile?.injuries?.filter(i => i.status === 'Activa').map((inj, idx) => (
                                    <div key={idx} className="text-[9px] leading-tight flex flex-col">
                                        <span className="text-slate-200 font-bold uppercase truncate">{inj.type} {inj.grade ? `• G${inj.grade}` : ''}</span>
                                        {inj.description && <span className="text-slate-500 italic text-[8px] truncate">{inj.description}</span>}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="bg-slate-900/50 border border-slate-700/50 p-4 rounded-2xl">
                            <div className="text-[9px] text-slate-400 font-bold uppercase mb-1">Enfoque Actual</div>
                            <div className="text-sm font-black text-white">Pre-Competitivo</div>
                            <div className="text-[10px] text-emerald-400 font-bold mt-1">Semana 4/12</div>
                        </div>
                        <div className="bg-slate-900/50 border border-slate-700/50 p-4 rounded-2xl">
                            <div className="text-[9px] text-slate-400 font-bold uppercase mb-1">Última Actividad</div>
                            <div className="text-sm font-black text-white">{safeStr(currentAthlete?.lastActive, 'Inactivo')}</div>
                            <div className="text-[10px] text-slate-500 font-bold mt-1">{currentAthlete?.lastActive !== 'Inactivo' ? 'Reciente' : 'Sin data'}</div>
                        </div>
                    </div>
                </div>

                {/* VISUAL ANALYTICS SECTION */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* PB CHART */}
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-lg font-black text-white uppercase tracking-tighter">Récords Personales</h3>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Mejores Tiempos (s)</p>
                            </div>
                            <Activity className="text-yellow-500" size={24} />
                        </div>
                        <div className="h-48 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={pbData} layout="vertical" margin={{ left: -20, right: 30 }}>
                                    <defs>
                                        <linearGradient id="colorPB" x1="0" y1="0" x2="1" y2="0">
                                            <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.9} />
                                            <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.1} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                                    <XAxis type="number" hide domain={[0, 'auto']} />
                                    <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={9} fontWeight="900" width={50} axisLine={false} tickLine={false} />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                                        contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '10px' }}
                                        itemStyle={{ color: '#22d3ee', fontWeight: 'bold' }}
                                    />
                                    <Bar dataKey="time" radius={[0, 6, 6, 0]} barSize={28} fill="url(#colorPB)">
                                        <LabelList dataKey="time" position="right" fill="#22d3ee" fontSize={10} fontWeight="900" offset={10} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* MACROCYCLE CHART */}
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-lg font-black text-white uppercase tracking-tighter">Macrociclo (8 Semanas)</h3>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Carga & Fatiga Estimada</p>
                            </div>
                            <Zap className="text-indigo-400" size={24} />
                        </div>
                        <div className="h-48 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={macroData}>
                                    <defs>
                                        <linearGradient id="colorInt" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.2} />
                                            <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                    <XAxis dataKey="week" stroke="#475569" fontSize={9} fontWeight="900" axisLine={false} tickLine={false} />
                                    <YAxis hide domain={[0, 120]} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '12px' }}
                                        labelStyle={{ color: '#94a3b8', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' }}
                                    />
                                    {/* Load as a solid cyan line with area */}
                                    <Area
                                        type="monotone"
                                        dataKey="intensity"
                                        name="Carga"
                                        stroke="#22d3ee"
                                        fillOpacity={1}
                                        fill="url(#colorInt)"
                                        strokeWidth={4}
                                        animationDuration={1500}
                                    />
                                    {/* Fatigue as a red dashed line WITHOUT area, but maybe a light one if preferred. The instruction says "area roja punteada" which might mean dashed line and area. */}
                                    <Area
                                        type="monotone"
                                        dataKey="fatigue"
                                        name="Fatiga"
                                        stroke="#ef4444"
                                        strokeDasharray="6 4"
                                        fill="#ef4444"
                                        fillOpacity={0.05}
                                        strokeWidth={4}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* QUICK ACTIONS ROW */}
                <div className="grid grid-cols-3 gap-3 mt-6">
                    <button onClick={() => navigate('/plan')} className="bg-emerald-900/20 hover:bg-emerald-900/40 border border-emerald-500/30 p-4 rounded-2xl flex flex-col items-center gap-2 group transition-all">
                        <Activity className="text-emerald-400 group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-black text-emerald-100 uppercase">Gestionar Plan</span>
                    </button>
                    <button onClick={() => navigate('/video?history=true')} className="bg-purple-900/20 hover:bg-purple-900/40 border border-purple-500/30 p-4 rounded-2xl flex flex-col items-center gap-2 group transition-all relative">
                        <History className="text-purple-400 group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-black text-purple-100 uppercase">Historial Bio</span>
                        {currentAthlete?.pendingReviews ? (
                            <span className="absolute top-2 right-2 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full animate-bounce">
                                {currentAthlete.pendingReviews}
                            </span>
                        ) : null}
                    </button>
                    <button onClick={() => navigate('/')} className="bg-indigo-900/20 hover:bg-indigo-900/40 border border-indigo-500/30 p-4 rounded-2xl flex flex-col items-center gap-2 group transition-all">
                        <Briefcase className="text-indigo-400 group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-black text-indigo-100 uppercase">Full Profile</span>
                    </button>
                </div>

                {/* PENDING NOTIFICATION */}
                {currentAthlete?.pendingReviews ? (
                    <div onClick={() => navigate('/video?history=true&filter=pending')} className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl flex items-center justify-between cursor-pointer hover:bg-red-500/20 transition-colors mt-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-red-500/20 rounded-lg text-red-400"><Eye size={20} /></div>
                            <div>
                                <div className="text-sm font-black text-white text-left">Videos por Revisar</div>
                                <div className="text-[10px] text-red-300 font-bold uppercase text-left">{currentAthlete.pendingReviews} Nuevos análisis requieren tu feedback.</div>
                            </div>
                        </div>
                        <ArrowRight className="text-red-400" size={16} />
                    </div>
                ) : null}

                {/* STAFF ROUND TABLE SECTION */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 relative overflow-hidden mt-6">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-lg font-black text-white flex items-center gap-2 uppercase tracking-tighter">
                                <Users className="text-cyan-400" size={20} /> Mesa Redonda
                            </h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Sincronización de Staff</p>
                        </div>
                        <button onClick={() => setShowBriefingForm(!showBriefingForm)} className="bg-cyan-600 hover:bg-cyan-500 text-white p-2 rounded-xl transition-colors">
                            <Plus size={20} />
                        </button>
                    </div>

                    {showBriefingForm && (
                        <div className="bg-slate-800 p-4 rounded-2xl mb-6 animate-in slide-in-from-top-4">
                            <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
                                {['Strategy', 'Physical', 'Technique', 'Psychology'].map(type => (
                                    <button
                                        key={type}
                                        onClick={() => setSelectedType(type as any)}
                                        className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase border transition-all ${selectedType === type ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300' : 'border-slate-700 text-slate-500 hover:border-slate-600'}`}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>
                            <textarea
                                value={newBriefing}
                                onChange={e => setNewBriefing(e.target.value)}
                                placeholder="Comparte estrategia, objetivos o adjunta links..."
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none h-24 resize-none mb-3"
                            />
                            <div className="flex justify-end">
                                <button onClick={handlePostBriefing} className="bg-cyan-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-cyan-500">
                                    Publicar Briefing
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="space-y-4 max-h-[500px] overflow-y-auto scrollbar-hide">
                        {briefings.length === 0 ? (
                            <div className="text-center py-8 text-slate-600 text-xs italic">
                                No hay briefings de staff aún. Inicia la conversación.
                            </div>
                        ) : briefings.map(brief => (
                            <div key={brief.id} className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-900 to-slate-900 border border-cyan-500/30 flex items-center justify-center text-xs font-bold text-cyan-400">
                                            {safeStr(brief.authorName).charAt(0)}
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-white">{safeStr(brief.authorName)}</div>
                                            <div className="text-[10px] text-cyan-400 uppercase font-black tracking-wider">{safeStr(brief.role)} • {safeStr(brief.type)}</div>
                                        </div>
                                    </div>
                                    <div className="text-[10px] text-slate-500">
                                        {brief.timestamp ? new Date(brief.timestamp).toLocaleDateString() : '--/--/--'}
                                    </div>
                                </div>

                                <p className="text-sm text-slate-300 leading-relaxed mb-4 whitespace-pre-wrap">{safeStr(brief.content)}</p>

                                {brief.replies && brief.replies.length > 0 && (
                                    <div className="space-y-3 pl-4 border-l-2 border-slate-700 mb-4">
                                        {brief.replies.map(reply => (
                                            <div key={reply.id} className="text-xs">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-bold text-slate-200">{safeStr(reply.authorName)}</span>
                                                    <span className="text-[9px] text-slate-500 uppercase">{safeStr(reply.role)}</span>
                                                </div>
                                                <p className="text-slate-400">{safeStr(reply.content)}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Complementar estrategia..."
                                        value={replyContent[brief.id] || ''}
                                        onChange={e => setReplyContent({ ...replyContent, [brief.id]: e.target.value })}
                                        onKeyDown={e => e.key === 'Enter' && handleReply(brief.id)}
                                        className="flex-1 bg-slate-900 rounded-lg border border-slate-700 px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-slate-500 outline-none"
                                    />
                                    <button onClick={() => handleReply(brief.id)} className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg">
                                        <ArrowRight size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
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
                                <div className="font-bold text-white text-sm group-hover:text-indigo-300 transition-colors">{safeStr(data.profile?.name)}</div>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[10px] text-slate-500 uppercase font-black">
                                        {data.profile?.events?.slice(0, 2).join(' / ') || 'SPRINT'} {data.profile?.events?.length > 2 ? '...' : ''}
                                    </span>
                                    <span className="w-1 h-1 bg-slate-700 rounded-full"></span>
                                    <span className={`text-[10px] font-bold ${data.risk === 'High' ? 'text-red-400' : data.risk === 'Low' ? 'text-blue-400' : 'text-green-400'
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
                                <div className="text-[9px] text-slate-500 font-bold uppercase">Último Log</div>
                                <div className="text-xs font-black text-white">{data.lastActive}</div>
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