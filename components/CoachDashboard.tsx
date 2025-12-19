import * as React from 'react';
import { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { findAthleteByEmail, fetchUserData, getPlanHistory, getAnalysisHistory, getStaffBriefings, addStaffBriefing, addBriefingReply } from '../services/firebase';
import { Users, Plus, Search, UserCircle2, Briefcase, Eye, LogOut, Activity, ArrowRight } from 'lucide-react';
import { UserProfile, StaffBriefing, StaffReply } from '../types';
import { calculateACWR } from '../utils/loadCalculator';
import { useNavigate } from 'react-router-dom';

const CoachDashboard: React.FC = () => {
    const { adminProfile, user, updateRoster, viewingAthleteId, switchAthlete, t } = useApp();
    const navigate = useNavigate(); // Hook for navigation
    const [emailQuery, setEmailQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const [rosterData, setRosterData] = useState<{ uid: string, profile: UserProfile, risk: 'High' | 'Low' | 'Optimal', pendingReviews: number, lastActive: string }[]>([]);
    const [loadingRoster, setLoadingRoster] = useState(false);

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
                if (data.currentPlan) {
                    const acwr = calculateACWR([data.currentPlan as any, ...pHist as any]);
                    if (acwr.status === 'Alto Riesgo') risk = 'High';
                    else if (acwr.status === 'Carga Baja') risk = 'Low';
                }

                const pendingReviews = aHist.filter((a: any) => a.reviewStatus === 'Pending').length;
                const lastLog = data.logs && data.logs.length > 0 ? data.logs[data.logs.length - 1] : null;
                const lastActive = lastLog ? lastLog.date : 'Inactivo';

                if (data.profile) profiles.push({ uid, profile: data.profile as UserProfile, risk, pendingReviews, lastActive });
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
            <div className="space-y-6 animate-in fade-in duration-300">
                <div className="bg-indigo-950 border border-indigo-500/30 rounded-[2rem] p-6 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-6 opacity-20">
                        <Activity size={120} className="text-indigo-400" />
                    </div>
                    <button onClick={() => switchAthlete(null)} className="absolute top-6 left-6 p-2 bg-indigo-900/50 rounded-full text-indigo-300 hover:text-white transition-colors z-20">
                        <ArrowRight className="rotate-180" size={20} />
                    </button>

                    <div className="mt-12 relative z-10 text-center">
                        <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 mx-auto shadow-lg flex items-center justify-center mb-4 border-4 border-slate-900">
                            <UserCircle2 className="text-white" size={48} />
                        </div>
                        <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-1">
                            {rosterData.find(r => r.uid === viewingAthleteId)?.profile.name || 'Atleta'}
                        </h2>
                        <div className="inline-flex items-center gap-2 bg-indigo-500/20 px-3 py-1 rounded-full border border-indigo-500/30">
                            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                            <span className="text-[10px] font-black text-indigo-200 uppercase tracking-widest">Live Monitoring Active</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-8 relative z-10">
                        <button onClick={() => navigate('/')} className="bg-white/10 hover:bg-white/20 border border-white/10 p-4 rounded-2xl text-left transition-all hover:scale-[1.02] group">
                            <Briefcase className="text-indigo-400 mb-2 group-hover:text-white transition-colors" size={24} />
                            <div className="text-xs font-bold text-indigo-200 uppercase">Dashboard</div>
                            <div className="text-sm font-black text-white">Ver Perfil Completo</div>
                        </button>
                        <button onClick={() => navigate('/analysis')} className="bg-white/10 hover:bg-white/20 border border-white/10 p-4 rounded-2xl text-left transition-all hover:scale-[1.02] group">
                            <Eye className="text-purple-400 mb-2 group-hover:text-white transition-colors" size={24} />
                            <div className="text-xs font-bold text-purple-200 uppercase">Análisis</div>
                            <div className="text-sm font-black text-white">Revisar Videos</div>
                        </button>
                        <button onClick={() => navigate('/plan')} className="bg-white/10 hover:bg-white/20 border border-white/10 p-4 rounded-2xl text-left transition-all hover:scale-[1.02] group col-span-2">
                            <Activity className="text-emerald-400 mb-2 group-hover:text-white transition-colors" size={24} />
                            <div className="flex justify-between items-end">
                                <div>
                                    <div className="text-xs font-bold text-emerald-200 uppercase">Planificación</div>
                                    <div className="text-sm font-black text-white">Ajustar Microciclo</div>
                                </div>
                                <ArrowRight className="text-emerald-400" />
                            </div>
                        </button>
                    </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Acciones Pendientes</h3>
                    {rosterData.find(r => r.uid === viewingAthleteId)?.pendingReviews ? (
                        <div onClick={() => navigate('/analysis')} className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl flex items-center justify-between cursor-pointer hover:bg-red-500/20 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-red-500/20 rounded-lg text-red-400"><Eye size={20} /></div>
                                <div>
                                    <div className="text-sm font-black text-white text-left">Videos por Revisar</div>
                                    <div className="text-[10px] text-red-300 font-bold uppercase text-left">{rosterData.find(r => r.uid === viewingAthleteId)?.pendingReviews} Nuevos análisis</div>
                                </div>
                            </div>
                            <ArrowRight className="text-red-400" size={16} />
                        </div>
                    ) : (
                        <div className="text-center py-6 text-slate-600 text-xs italic">No hay acciones pendientes para este atleta.</div>
                    )}
                </div>

                {/* STAFF ROUND TABLE SECTION */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 relative overflow-hidden">
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
                                            {brief.authorName.charAt(0)}
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-white">{brief.authorName}</div>
                                            <div className="text-[10px] text-cyan-400 uppercase font-black tracking-wider">{brief.role} • {brief.type}</div>
                                        </div>
                                    </div>
                                    <div className="text-[10px] text-slate-500">{new Date(brief.timestamp).toLocaleDateString()}</div>
                                </div>

                                <p className="text-sm text-slate-300 leading-relaxed mb-4 whitespace-pre-wrap">{brief.content}</p>

                                {brief.replies && brief.replies.length > 0 && (
                                    <div className="space-y-3 pl-4 border-l-2 border-slate-700 mb-4">
                                        {brief.replies.map(reply => (
                                            <div key={reply.id} className="text-xs">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-bold text-slate-200">{reply.authorName}</span>
                                                    <span className="text-[9px] text-slate-500 uppercase">{reply.role}</span>
                                                </div>
                                                <p className="text-slate-400">{reply.content}</p>
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
                                <div className="font-bold text-white text-sm group-hover:text-indigo-300 transition-colors">{data.profile?.name}</div>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[10px] text-slate-500 uppercase font-black">{data.profile?.events?.[0] || 'SPRINT'}</span>
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