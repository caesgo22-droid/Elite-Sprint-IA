import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { generateTrainingPlan } from '../services/geminiService';
import { Loader2, Zap, Dumbbell, Play, UserCog, X, CheckSquare, Target, Layers, Brain, History, ChevronRight, Share, HeartPulse, Info, Download, Stethoscope, Calendar, Plus, Wrench, BatteryCharging, MessageCircle, MessageSquare, Table2, ScanLine, ChevronDown, ChevronUp, Flag, BarChart3, MapPin, Trophy, Trash2, Activity, User } from 'lucide-react';
import { TrainingSession, UserProfile, Injury } from '../types';
import { calculateACWR } from '../utils/loadCalculator';
import { calculateRecovery } from '../utils/recoveryEngine';
import { RaceDayManager } from './RaceDayManager';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Label, ComposedChart, Line } from 'recharts';

const DrillItem: React.FC<{ name: string, colorClass: string }> = ({ name, colorClass }) => (
    <li className="flex items-center justify-between group text-sm text-slate-300 py-1">
        <div className="flex items-start gap-3">
            <span className={`flex-shrink-0 w-1.5 h-1.5 mt-2 rounded-full ${colorClass}`}></span>
            <span>{name}</span>
        </div>
        <a
            href={`https://www.youtube.com/results?search_query=track+and+field+drill+${name.replace(/\s/g, '+')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-500 hover:text-red-500 transition-colors p-2 bg-slate-800/50 rounded-full hover:bg-slate-800 visible"
            title="Ver video de referencia"
        >
            <Play size={14} fill="currentColor" />
        </a>
    </li>
);

const InfoButton = ({ title, text, onClick }: { title: string, text: string, onClick: (t: string, x: string) => void }) => (
    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(title, text); }} className="text-slate-500 hover:text-cyan-400 ml-1 inline-flex align-middle">
        <Info size={12} />
    </button>
);

const SessionCard = React.memo(({ session, expandedDay, setExpandedDay, setSessionFeedbackModal, onShowRecovery, isStaff, updateSessionNote }: any) => {
    const isExpanded = expandedDay === session.day;
    const isDone = session.feedback?.completed;
    const intensityColor = session.intensity === 'Max' ? 'text-red-400 border-red-900/50 bg-red-900/20' : session.intensity === 'High' ? 'text-orange-400 border-orange-900/50 bg-orange-900/20' : session.intensity === 'Medium' ? 'text-yellow-400 border-yellow-900/50 bg-yellow-900/20' : 'text-emerald-400 border-emerald-900/50 bg-emerald-900/20';

    const [note, setNote] = useState(session.coachNotes || "");
    const [isEditingNote, setIsEditingNote] = useState(false);

    const saveNote = (e: any) => {
        e.stopPropagation();
        updateSessionNote(session.day, note);
        setIsEditingNote(false);
    };

    const shareSession = (e: React.MouseEvent) => {
        e.stopPropagation();
        const routine = session.mainSet ? session.mainSet.join(', ') : session.trackRoutine?.join(', ') || 'N/A';
        const text = `*ELITE SPRINT AI - Sesión (${session.day})*\n\n*Enfoque:* ${session.focus}\n*KPI Técnico:* ${session.biomechanicsKpi || 'N/A'}\n*Rutina:* ${routine}\n*Intensidad:* ${session.intensity}\n${session.coachNotes ? `*Nota Coach:* ${session.coachNotes}` : ''}`;
        const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    };

    return (
        <div onClick={() => setExpandedDay(isExpanded ? null : session.day)} className={`bg-slate-900/40 border rounded-xl overflow-hidden transition-all duration-300 ${isDone ? 'border-emerald-900/40' : 'border-slate-800'} ${isExpanded ? 'ring-1 ring-cyan-500/50 bg-slate-800/60' : 'hover:bg-slate-800/40'}`}>
            <div className="p-4 flex justify-between items-center cursor-pointer select-none">
                <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center font-bold text-sm bg-slate-800 border border-slate-700 ${isDone ? 'text-emerald-400 border-emerald-900/50' : 'text-slate-200'}`}> {isDone ? <CheckSquare size={18} /> : <span className="text-[10px] text-slate-400 uppercase leading-none">{session.day.substring(0, 3)}</span>} </div>
                    <div>
                        <h4 className={`font-bold text-lg tracking-tight ${isDone ? 'text-slate-400 line-through' : 'text-slate-100'}`}>{session.focus}</h4>
                        <div className="flex items-center gap-2 mt-1">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wide ${intensityColor}`}>{session.intensity}</span>
                            {session.coachNotes && <span className="text-[10px] bg-blue-900/30 text-blue-300 px-2 py-0.5 rounded border border-blue-500/30 flex items-center gap-1"><MessageSquare size={10} /> Nota</span>}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={shareSession} className="text-emerald-500 bg-emerald-900/20 p-2 rounded-full mr-1 hover:bg-emerald-900/40 z-10 relative">
                        <MessageCircle size={18} />
                    </button>
                    <ChevronRight size={20} className={`transition-transform ${isExpanded ? 'rotate-90 text-cyan-400' : 'text-slate-500'}`} />
                </div>
            </div>
            {isExpanded && (
                <div className="px-5 pb-5 space-y-5 border-t border-slate-700/50 pt-4 animate-in slide-in-from-top-2">
                    {session.biomechanicsKpi && (
                        <div className="flex items-start gap-3 bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                            <ScanLine className="text-cyan-400 mt-0.5 flex-shrink-0" size={16} />
                            <div>
                                <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider block mb-1">KPI Técnico del Día</span>
                                <p className="text-sm text-slate-200 leading-snug font-medium">"{session.biomechanicsKpi}"</p>
                                <div className="flex gap-2 mt-2">
                                    {session.footwear && <span className="text-[8px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded border border-slate-700 font-bold uppercase tracking-widest">👟 {session.footwear === 'Spikes' ? 'Clavos' : 'Planas'}</span>}
                                    {session.wind && <span className="text-[8px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded border border-slate-700 font-bold uppercase tracking-widest">💨 {session.wind === 'Tail' ? 'A favor' : session.wind === 'Head' ? 'En contra' : 'Neutral'}</span>}
                                </div>
                            </div>
                        </div>
                    )}
                    {(isStaff || session.coachNotes) && (
                        <div className="bg-blue-900/10 border-l-2 border-blue-500 pl-3 py-2 rounded-r relative group" onClick={e => e.stopPropagation()}>
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1"><UserCog size={12} /> Instrucción del Staff</span>
                                {isStaff && !isEditingNote && <button onClick={() => setIsEditingNote(true)} className="text-slate-500 hover:text-white"><Wrench size={12} /></button>}
                            </div>
                            {isStaff && isEditingNote ? (
                                <div className="flex gap-2">
                                    <input type="text" value={note} onChange={e => setNote(e.target.value)} className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white" placeholder="Ej: Enfócate en el recobro..." autoFocus />
                                    <button onClick={saveNote} className="bg-blue-600 px-2 rounded text-xs font-bold text-white">OK</button>
                                </div>
                            ) : (
                                <p className="text-sm text-slate-300 italic">{session.coachNotes || (isStaff ? "Añadir nota técnica..." : "")}</p>
                            )}
                        </div>
                    )}
                    {session.warmup && session.warmup.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-2 text-emerald-400 text-[10px] font-bold uppercase tracking-wider"><Zap size={12} /> Calentamiento</div>
                            <ul className="space-y-1">
                                {session.warmup.map((item: string, i: number) => <DrillItem key={i} name={item} colorClass="bg-emerald-500" />)}
                            </ul>
                        </div>
                    )}
                    {session.drills && session.drills.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-2 text-cyan-400 text-[10px] font-bold uppercase tracking-wider"><Activity size={12} /> Técnica / Drills</div>
                            <ul className="space-y-1">
                                {session.drills.map((item: string, i: number) => <DrillItem key={i} name={item} colorClass="bg-cyan-500" />)}
                            </ul>
                        </div>
                    )}
                    {session.mainSet && session.mainSet.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-2 text-orange-400 text-[10px] font-bold uppercase tracking-wider"><Trophy size={12} /> Bloque Principal</div>
                            <ul className="space-y-1 border-l-2 border-orange-500/30 pl-3">
                                {session.mainSet.map((item: string, i: number) => <DrillItem key={i} name={item} colorClass="bg-orange-500" />)}
                            </ul>
                        </div>
                    )}
                    {session.trackRoutine && !session.mainSet && session.trackRoutine.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-3 text-cyan-400 text-xs font-bold uppercase tracking-wider"><Zap size={14} /> Rutina de Pista</div>
                            <ul className="space-y-2">
                                {session.trackRoutine.map((item: string, i: number) => <DrillItem key={i} name={item} colorClass="bg-cyan-500" />)}
                            </ul>
                        </div>
                    )}
                    {session.gymRoutine && session.gymRoutine.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-3 text-purple-400 text-xs font-bold uppercase tracking-wider"><Dumbbell size={14} /> Fuerza / Gym</div>
                            <ul className="space-y-2">
                                {session.gymRoutine.map((item: string, i: number) => <DrillItem key={i} name={item} colorClass="bg-purple-500" />)}
                            </ul>
                        </div>
                    )}
                    {session.cooldown && session.cooldown.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-2 text-blue-400 text-[10px] font-bold uppercase tracking-wider"><BatteryCharging size={12} /> Vuelta a la Calma</div>
                            <ul className="space-y-1">
                                {session.cooldown.map((item: string, i: number) => <DrillItem key={i} name={item} colorClass="bg-blue-500" />)}
                            </ul>
                        </div>
                    )}
                    <div className="pt-2 border-t border-slate-800 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <button onClick={(e) => { e.stopPropagation(); setSessionFeedbackModal(session); }} className={`w-full py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${isDone ? 'bg-slate-800 text-slate-300 hover:text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200 col-span-2'}`}>
                            <CheckSquare size={16} /> {isDone ? 'Editar Feedback' : 'Registrar Sesión'}
                        </button>
                        {isDone && (
                            <button onClick={(e) => { e.stopPropagation(); onShowRecovery(session); }} className="w-full bg-emerald-900/20 border border-emerald-500/30 hover:bg-emerald-900/40 text-emerald-400 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors">
                                <BatteryCharging size={16} /> Recuperación
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
});

const MacrocycleChart = ({ history, currentPlan }: { history: any[], currentPlan: any }) => {
    const data = useMemo(() => {
        const allPlans = [...history].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        const recentHistory = allPlans.slice(-4);
        const calcLoad = (plan: any) => {
            let load = 0;
            if (plan && plan.sessions) {
                plan.sessions.forEach((s: any) => {
                    const factor = s.intensity === 'Max' ? 5 : s.intensity === 'High' ? 4 : s.intensity === 'Medium' ? 3 : 1;
                    load += factor * 10;
                });
            }
            return load;
        };
        const chartData = [];
        recentHistory.forEach((plan, i) => {
            chartData.push({
                name: `Sem ${-1 * (recentHistory.length - i)}`,
                realLoad: calcLoad(plan),
                projectedLoad: null,
                isCurrent: false,
                fullDate: new Date(plan.createdAt).toLocaleDateString()
            });
        });
        const currentLoad = currentPlan ? calcLoad(currentPlan) : 0;
        chartData.push({
            name: 'ACTUAL',
            realLoad: currentLoad,
            projectedLoad: currentLoad,
            isCurrent: true,
            fullDate: 'Esta Semana'
        });
        let lastLoad = currentLoad || 150;
        const phase = currentPlan?.phase || 'General Prep';
        for (let i = 1; i <= 3; i++) {
            let nextLoad = lastLoad;
            if (phase.includes('Specific') || phase.includes('Pre-Comp')) {
                if (i === 3) nextLoad = lastLoad * 0.7;
                else nextLoad = lastLoad * 1.05;
            } else if (phase.includes('Competition') || phase.includes('Tapering')) {
                nextLoad = lastLoad * 0.85;
            } else {
                nextLoad = lastLoad * 1.02;
            }
            chartData.push({
                name: `Sem +${i}`,
                realLoad: null,
                projectedLoad: Math.round(nextLoad),
                isCurrent: false,
                fullDate: 'Proyección'
            });
            lastLoad = nextLoad;
        }
        return chartData;
    }, [history, currentPlan]);

    return (
        <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl mb-6 relative overflow-hidden">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2"><BarChart3 size={14} /> Estructura Macrociclo (8 Semanas)</h3>
                <div className="flex items-center gap-3 text-[9px] font-bold uppercase">
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-cyan-500"></div> Real</div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-slate-500 border border-dashed border-slate-300"></div> Futuro</div>
                </div>
            </div>
            <div className="h-40 w-full" style={{ minHeight: '160px' }}>
                {data.length > 0 && (
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorReal" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                            <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={0} />
                            <YAxis hide domain={['dataMin - 20', 'dataMax + 20']} />
                            <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }} itemStyle={{ fontSize: '12px' }} labelStyle={{ color: '#94a3b8', fontSize: '10px', marginBottom: '4px' }} formatter={(value: any, name: string) => [value, name === 'realLoad' ? 'Carga Real' : 'Proyección']} />
                            <ReferenceLine x="ACTUAL" stroke="#22d3ee" strokeDasharray="3 3" strokeOpacity={0.5} />
                            <Line type="monotone" dataKey="projectedLoad" stroke="#64748b" strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={false} />
                            <Area type="monotone" dataKey="realLoad" stroke="#22d3ee" fillOpacity={1} fill="url(#colorReal)" strokeWidth={3} activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2, fill: '#22d3ee' }} />
                        </ComposedChart>
                    </ResponsiveContainer>
                )}
            </div>
            <div className="flex justify-center mt-2">
                <span className="text-[10px] text-cyan-400 font-bold bg-cyan-900/20 px-3 py-1 rounded-full border border-cyan-500/30 animate-pulse">SEMANA ACTUAL</span>
            </div>
        </div>
    );
};

const PlanManager: React.FC = () => {
    const { user, userProfile, adminProfile, updateProfile, currentPlan, setPlan, updateSession, lastAnalysis, planHistory } = useApp();
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);

    const [loading, setLoading] = useState(false);
    const [showProfileConfig, setShowProfileConfig] = useState(false);
    const [focusEvent, setFocusEvent] = useState(userProfile.events?.[0] || '100m');
    const [fatigue, setFatigue] = useState(5);
    const [sleep, setSleep] = useState(7);
    const [soreness, setSoreness] = useState(3);
    const [stress, setStress] = useState(4);
    const [hydration, setHydration] = useState(7);
    const [restingHR, setRestingHR] = useState(userProfile.restingHR || 60);
    const [hrv, setHrv] = useState(userProfile.hrv || 50);
    const [expandedDay, setExpandedDay] = useState<string | null>(null);
    const [tempProfile, setTempProfile] = useState<UserProfile>(userProfile);
    const [planHistoryState, setPlanHistoryState] = useState<any[]>([]);
    const [acwr, setAcwr] = useState<{ ratio: number, status: string } | null>(null);
    const [sessionFeedbackModal, setSessionFeedbackModal] = useState<TrainingSession | null>(null);
    const [activeTooltip, setActiveTooltip] = useState<{ title: string, text: string } | null>(null);
    const [viewingRecovery, setViewingRecovery] = useState<any>(null);
    const [showPlanTable, setShowPlanTable] = useState(false);
    const [showRationale, setShowRationale] = useState(true);
    const [showRaceDay, setShowRaceDay] = useState(false);
    const [newCompName, setNewCompName] = useState("");
    const [newCompDate, setNewCompDate] = useState("");
    const isStaff = adminProfile.role === 'staff';

    useEffect(() => {
        const isEditing = searchParams.get('edit') === 'true';
        const isNewUser = !userProfile.name || userProfile.name === 'Atleta';
        setTempProfile(userProfile);
        if (isEditing || isNewUser) setShowProfileConfig(true);
    }, [location.search, userProfile]);

    useEffect(() => {
        setPlanHistoryState(planHistory);
        if (currentPlan || planHistory.length > 0) {
            const allPlans = currentPlan ? [currentPlan, ...planHistory] : planHistory;
            const stats = calculateACWR(allPlans);
            setAcwr({ ratio: stats.ratio, status: stats.status });
        }
    }, [planHistory, currentPlan]);

    const handleSaveProfile = () => {
        updateProfile(tempProfile);
        setShowProfileConfig(false);
        if (!tempProfile.events.includes(focusEvent)) setFocusEvent(tempProfile.events[0]);
    };

    const handleGenerate = async () => {
        setLoading(true);
        const plan = await generateTrainingPlan(userProfile, { fatigue, sleep, soreness, stress, hydration, restingHR, hrv }, new Date().toLocaleDateString('es-ES'), focusEvent, acwr || undefined);
        if (plan) setPlan(plan); else alert("Error crítico al generar el plan.");
        setLoading(false);
    };

    const shareToWhatsapp = () => {
        if (!currentPlan) return;
        const text = `*ELITE SPRINT AI - MICRO-CICLO*\n\n*Fase:* ${currentPlan.phase}\n*Objetivo:* ${currentPlan.weeklyGoal}\n\nGenerado por Elite Sprint Coach AI.`;
        const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    };

    const updateSessionNote = (day: string, note: string) => updateSession(day, { coachNotes: note });
    const toggleEventSelection = (e: string) => { const current = tempProfile.events || []; if (current.includes(e)) setTempProfile({ ...tempProfile, events: current.filter(ev => ev !== e) }); else setTempProfile({ ...tempProfile, events: [...current, e] }); };
    const toggleTrainingDay = (day: string) => { const current = tempProfile.trainingDays || []; if (current.includes(day)) setTempProfile({ ...tempProfile, trainingDays: current.filter(d => d !== day) }); else setTempProfile({ ...tempProfile, trainingDays: [...current, day] }); };
    const updateInjury = (index: number, field: keyof Injury, value: string) => { const updated = [...(tempProfile.injuries || [])]; updated[index] = { ...updated[index], [field]: value }; setTempProfile({ ...tempProfile, injuries: updated }); };
    const showTooltip = (title: string, text: string) => setActiveTooltip({ title, text });
    const updatePB = (event: '100m' | '200m' | '400m', field: 'time' | 'date', value: string) => {
        const newPBs = { ...tempProfile.pbs, [event]: { ...tempProfile.pbs[event], [field]: value } };
        setTempProfile({ ...tempProfile, pbs: newPBs });
    };
    const addCompetition = () => {
        if (!newCompName || !newCompDate) return;
        const newComp = { id: Date.now().toString(), name: newCompName, date: newCompDate };
        const currentComps = tempProfile.competitions || [];
        const updated = [...currentComps, newComp].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        setTempProfile({ ...tempProfile, competitions: updated });
        setNewCompName(""); setNewCompDate("");
    };

    const handleCalculateRecovery = (session: TrainingSession) => {
        if (!session.feedback) return;
        const weight = (userProfile.weight && userProfile.weight > 0) ? userProfile.weight : 70;
        const rec = calculateRecovery(session.intensity, session.feedback.duration || 60, weight, session.feedback.rpe || 5);
        setViewingRecovery(rec);
    };

    const FeedbackModal = () => {
        if (!sessionFeedbackModal) return null;
        const [rpe, setRpe] = useState(sessionFeedbackModal.feedback?.rpe || 5);
        const [pain, setPain] = useState(sessionFeedbackModal.feedback?.painLevel || 0);
        const [dur, setDur] = useState(sessionFeedbackModal.feedback?.duration || 60);
        const [srf, setSrf] = useState(sessionFeedbackModal.feedback?.surface || 'Track');
        const [ftw, setFtw] = useState(sessionFeedbackModal.footwear || 'Flats');
        const [wnd, setWnd] = useState(sessionFeedbackModal.wind || 'Neutral');
        const [nts, setNts] = useState(sessionFeedbackModal.feedback?.notes || '');
        const save = () => {
            updateSession(sessionFeedbackModal.day, {
                footwear: ftw as any,
                wind: wnd as any,
                feedback: { completed: true, rpe, painLevel: pain, duration: dur, surface: srf as any, notes: nts, timestamp: new Date().toISOString() }
            });
            setSessionFeedbackModal(null);
        };
        return (
            <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSessionFeedbackModal(null)}>
                <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between"><h3 className="font-bold text-white">Feedback Diario</h3><button onClick={() => setSessionFeedbackModal(null)}><X /></button></div>
                    <div><div className="flex justify-between items-center mb-1"><label className="text-xs font-bold text-slate-400">RPE (1-10)</label></div><input type="range" min="1" max="10" value={rpe} onChange={e => setRpe(parseInt(e.target.value))} className="w-full accent-cyan-500" /></div>
                    <input type="range" min="0" max="10" value={pain} onChange={e => setPain(parseInt(e.target.value))} className="w-full accent-red-500" />

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Calzado</label>
                            <select value={ftw} onChange={e => setFtw(e.target.value as any)} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white">
                                <option value="Flats">Zapatillas</option>
                                <option value="Spikes">Clavos</option>
                                <option value="Other">Otro</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Viento</label>
                            <select value={wnd} onChange={e => setWnd(e.target.value as any)} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white">
                                <option value="Neutral">Neutral</option>
                                <option value="Tail">A favor</option>
                                <option value="Head">En contra</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-400 block mb-1 uppercase tracking-widest">Notas / Molestias</label>
                        <textarea
                            value={nts}
                            onChange={e => setNts(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white h-24 focus:border-cyan-500 outline-none transition-all"
                            placeholder="¿Cómo te sentiste? ¿Alguna molestia o dolor?"
                        />
                    </div>

                    <button onClick={save} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-all active:scale-95 shadow-lg">Guardar Sesión</button>
                </div>
            </div>
        );
    };

    const BiomarkerSlider = ({ label, value, setter, color, minLabel, maxLabel }: any) => (
        <div className="space-y-2">
            <div className="flex justify-between text-xs font-medium text-slate-300">
                <span className="flex items-center gap-1">{label}</span>
                <span className={`text-${color}-400 font-bold`}>{value}/10</span>
            </div>
            <input type="range" min="1" max="10" value={value} onChange={(e) => setter(parseInt(e.target.value))} className={`w-full accent-${color}-500 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer`} />
            <div className="flex justify-between text-[9px] text-slate-500 uppercase tracking-wider font-bold">
                <span>{minLabel}</span>
                <span>{maxLabel}</span>
            </div>
        </div>
    );

    if (showProfileConfig) {
        return (
            <div className="space-y-6 animate-in fade-in duration-500 pb-10">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-black text-white uppercase tracking-tight">Perfil Holístico</h2>
                    <button onClick={() => setShowProfileConfig(false)} className="p-2 bg-slate-800 rounded-full"><X /></button>
                </div>
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-6 max-h-[75vh] overflow-y-auto">
                    <section className="space-y-4">
                        <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-2"><UserCog size={14} /> Identidad Atlética</h3>
                        <div><label className="text-xs text-slate-400 block mb-1">Nombre</label><input type="text" value={tempProfile.name} onChange={e => setTempProfile({ ...tempProfile, name: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white" /></div>
                        <div className="grid grid-cols-2 gap-3">
                            <div><label className="text-xs text-slate-400 block mb-1">Edad</label><input type="number" value={tempProfile.age} onChange={e => setTempProfile({ ...tempProfile, age: parseInt(e.target.value) })} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white" /></div>
                            <div><label className="text-xs text-slate-400 block mb-1">Altura (cm)</label><input type="number" value={tempProfile.height || ''} onChange={e => setTempProfile({ ...tempProfile, height: parseInt(e.target.value) })} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white" /></div>
                            <div><label className="text-xs text-slate-400 block mb-1">Peso (kg)</label><input type="number" value={tempProfile.weight || ''} onChange={e => setTempProfile({ ...tempProfile, weight: parseInt(e.target.value) })} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white" /></div>
                            <div>
                                <label className="text-xs text-slate-400 block mb-1">Nivel</label>
                                <select value={tempProfile.experienceLevel} onChange={e => setTempProfile({ ...tempProfile, experienceLevel: e.target.value as any })} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white">
                                    <option value="Beginner">Principiante</option>
                                    <option value="Intermediate">Intermedio</option>
                                    <option value="Advanced">Avanzado</option>
                                    <option value="Elite">Elite / Pro</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-slate-400 block mb-1">Años de Exp.</label>
                                <input type="number" value={tempProfile.yearsExperience} onChange={e => setTempProfile({ ...tempProfile, yearsExperience: parseInt(e.target.value) })} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white" />
                            </div>
                            <div>
                                <label className="text-xs text-slate-400 block mb-1">Horas/Día</label>
                                <input type="number" value={tempProfile.hoursPerDay || 2} onChange={e => setTempProfile({ ...tempProfile, hoursPerDay: parseInt(e.target.value) })} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white" />
                            </div>
                            <div>
                                <label className="text-xs text-slate-400 block mb-1">Horario Pref.</label>
                                <select value={tempProfile.preferredTime} onChange={e => setTempProfile({ ...tempProfile, preferredTime: e.target.value as any })} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white">
                                    <option value="Morning">Mañana</option>
                                    <option value="Afternoon">Tarde</option>
                                    <option value="Night">Noche</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 block mb-1">Condiciones Médicas / Alergias</label>
                            <textarea value={tempProfile.medicalConditions || ''} onChange={e => setTempProfile({ ...tempProfile, medicalConditions: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white h-20" placeholder="Ej: Asma, Alergia al polen..." />
                        </div>
                    </section>
                    <section className="space-y-4">
                        <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-2"><User size={14} /> Equipo Técnico</h3>
                        <div className="space-y-2">
                            {tempProfile.coaches?.map((coach, idx) => (
                                <div key={idx} className="flex justify-between items-center bg-slate-800/40 p-3 rounded-lg border border-slate-700/50">
                                    <span className="text-xs text-white">{coach}</span>
                                    <button onClick={() => setTempProfile({ ...tempProfile, coaches: tempProfile.coaches.filter((_, i) => i !== idx) })} className="text-red-500"><X size={14} /></button>
                                </div>
                            ))}
                            <div className="flex gap-2">
                                <input type="email" placeholder="Email del Coach" id="newCoachEmail" className="flex-1 bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white" />
                                <button onClick={() => {
                                    const el = document.getElementById('newCoachEmail') as HTMLInputElement;
                                    if (el.value) {
                                        setTempProfile({ ...tempProfile, coaches: [...(tempProfile.coaches || []), el.value] });
                                        el.value = '';
                                    }
                                }} className="bg-indigo-600 p-2 rounded-lg text-white"><Plus size={16} /></button>
                            </div>
                        </div>
                    </section>

                    <section className="space-y-4">
                        <h3 className="text-sm font-bold text-purple-400 uppercase tracking-wider flex items-center gap-2"><Target size={14} /> Especialidades</h3>
                        <div className="flex flex-wrap gap-2">
                            {['100m', '200m', '400m', 'Vallas'].map(event => (
                                <button key={event} onClick={() => toggleEventSelection(event)} className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${tempProfile.events?.includes(event) ? 'bg-purple-600 border-purple-400 text-white' : 'bg-slate-900 border-slate-700 text-slate-400'}`}>
                                    {event}
                                </button>
                            ))}
                        </div>
                    </section>

                    <section className="space-y-4">
                        <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2"><Calendar size={14} /> Días Disponibles</h3>
                        <div className="grid grid-cols-7 gap-1">
                            {['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'].map(day => (
                                <button key={day} onClick={() => toggleTrainingDay(day)} className={`py-3 rounded-lg text-[10px] font-bold border transition-all ${tempProfile.trainingDays?.includes(day) ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-slate-900 border-slate-700 text-slate-500'}`}>
                                    {day}
                                </button>
                            ))}
                        </div>
                    </section>

                    <section className="space-y-4">
                        <h3 className="text-sm font-bold text-orange-400 uppercase tracking-wider flex items-center gap-2"><Trophy size={14} /> Marcas Personales (PB)</h3>
                        <div className="space-y-3">
                            {['100m', '200m', '400m'].map((ev: any) => (
                                <div key={ev} className="flex items-center gap-3">
                                    <div className="w-16 text-xs font-bold text-slate-400 uppercase">{ev}</div>
                                    <input type="text" value={tempProfile.pbs?.[ev as keyof typeof tempProfile.pbs]?.time || ''} onChange={e => updatePB(ev, 'time', e.target.value)} className="flex-1 bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white" placeholder="Tiempo (ej: 10.50)" />
                                    <input type="text" value={tempProfile.pbs?.[ev as keyof typeof tempProfile.pbs]?.date || ''} onChange={e => updatePB(ev, 'date', e.target.value)} className="w-32 bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white" placeholder="Fecha" />
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="space-y-4">
                        <h3 className="text-sm font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2"><MapPin size={14} /> Próximas Competencias</h3>
                        <div className="space-y-2">
                            {tempProfile.competitions?.map((comp, idx) => (
                                <div key={comp.id} className="flex justify-between items-center bg-slate-800/40 p-3 rounded-lg border border-slate-700/50">
                                    <div>
                                        <div className="text-xs font-bold text-white">{comp.name}</div>
                                        <div className="text-[10px] text-slate-400">{comp.date}</div>
                                    </div>
                                    <button onClick={() => setTempProfile({ ...tempProfile, competitions: tempProfile.competitions.filter(c => c.id !== comp.id) })} className="text-red-500 hover:bg-red-500/10 p-1 rounded-full"><Trash2 size={14} /></button>
                                </div>
                            ))}
                            <div className="flex gap-2">
                                <input type="text" value={newCompName} onChange={e => setNewCompName(e.target.value)} placeholder="Evento" className="flex-1 bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white" />
                                <input type="date" value={newCompDate} onChange={e => setNewCompDate(e.target.value)} className="bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white" />
                                <button onClick={addCompetition} className="bg-blue-600 p-2 rounded-lg text-white"><Plus size={16} /></button>
                            </div>
                        </div>
                    </section>

                    <section className="space-y-4">
                        <h3 className="text-sm font-bold text-red-400 uppercase tracking-wider flex items-center gap-2"><History size={14} /> Historial de Lesiones</h3>
                        <div className="space-y-2">
                            {tempProfile.injuries?.map((injury, idx) => (
                                <div key={idx} className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/50 space-y-2">
                                    <div className="flex justify-between items-start">
                                        <input type="text" value={injury.type} onChange={e => updateInjury(idx, 'type', e.target.value)} className="bg-transparent font-bold text-xs text-white outline-none" placeholder="Tipo de lesión" />
                                        <button onClick={() => setTempProfile({ ...tempProfile, injuries: tempProfile.injuries.filter((_, i) => i !== idx) })} className="text-red-500"><X size={14} /></button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 mt-1">
                                        <select value={injury.severity} onChange={e => updateInjury(idx, 'severity', e.target.value)} className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[10px] text-white">
                                            <option value="Leve">Leve</option>
                                            <option value="Moderada">Moderada</option>
                                            <option value="Grave">Grave</option>
                                        </select>
                                        <select value={injury.status} onChange={e => updateInjury(idx, 'status', e.target.value)} className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[10px] text-white">
                                            <option value="Activa">Activa</option>
                                            <option value="Recuperación">En Recuperación</option>
                                            <option value="Resuelta">Resuelta</option>
                                        </select>
                                    </div>
                                </div>
                            ))}
                            <button onClick={() => setTempProfile({ ...tempProfile, injuries: [...(tempProfile.injuries || []), { type: '', location: '', severity: 'Leve', status: 'Activa' }] })} className="w-full py-2 border border-dashed border-slate-700 rounded-lg text-[10px] font-bold text-slate-500 hover:border-slate-500 transition-colors uppercase">
                                + Añadir Lesión
                            </button>
                        </div>
                    </section>
                    <button onClick={handleSaveProfile} className="w-full bg-cyan-600 text-white font-bold py-4 rounded-xl shadow-lg">Guardar Perfil</button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-16">
            <div className="flex justify-between items-end border-b border-slate-800/50 pb-4">
                <div><h2 className="text-2xl font-black text-white uppercase tracking-tight">Microciclo</h2><p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Nivel V World Athletics</p></div>
                <button onClick={() => setShowProfileConfig(true)} className="p-2 bg-slate-800 rounded-full text-slate-300 transition-transform active:scale-90"><UserCog size={18} /></button>
            </div>
            {!currentPlan ? (
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-6">
                    <div className="space-y-4 max-w-sm mx-auto">
                        <BiomarkerSlider label="Fatiga" value={fatigue} setter={setFatigue} color="cyan" minLabel="Fresco" maxLabel="Exhausto" />
                        <BiomarkerSlider label="Sueño" value={sleep} setter={setSleep} color="indigo" minLabel="Pésimo" maxLabel="Excelente" />
                        <BiomarkerSlider label="Dolor Muscular" value={soreness} setter={setSoreness} color="red" minLabel="Ninguno" maxLabel="Intenso" />
                        <BiomarkerSlider label="Estrés" value={stress} setter={setStress} color="orange" minLabel="Bajo" maxLabel="Alto" />
                        <BiomarkerSlider label="Hidratación" value={hydration} setter={setHydration} color="blue" minLabel="Deshidratado" maxLabel="Óptimo" />
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Resting HR (ppm)</label>
                                <input type="number" value={restingHR} onChange={e => setRestingHR(parseInt(e.target.value))} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">HRV (ms)</label>
                                <input type="number" value={hrv} onChange={e => setHrv(parseInt(e.target.value))} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" />
                            </div>
                        </div>
                    </div>
                    <button onClick={handleGenerate} disabled={loading} className="w-full bg-cyan-600 text-white font-bold py-4 rounded-xl"> {loading ? 'Generando...' : 'Generar Plan Elite'} </button>
                </div>
            ) : (
                <div className="space-y-6">
                    <MacrocycleChart history={planHistoryState} currentPlan={currentPlan} />
                    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-700">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-0.5 bg-cyan-900/30 text-cyan-400 border border-cyan-500/20 rounded text-[10px] font-bold uppercase">{currentPlan.phase}</span>
                            <div className="h-px bg-slate-800 flex-1"></div>
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">{currentPlan.weeklyGoal}</h3>
                        {currentPlan.rationale && (
                            <div className="mt-4 p-4 bg-slate-950/50 rounded-xl border border-slate-800/50">
                                <p className="text-xs text-slate-400 leading-relaxed italic"><span className="text-cyan-500 font-bold not-italic font-mono mr-2">LOGICA:</span>{currentPlan.rationale}</p>
                            </div>
                        )}
                    </div>
                    <div className="space-y-3">
                        {currentPlan.sessions.map((session: TrainingSession, idx: number) => (
                            <SessionCard key={idx} session={session} expandedDay={expandedDay} setExpandedDay={setExpandedDay} setSessionFeedbackModal={setSessionFeedbackModal} onShowRecovery={handleCalculateRecovery} isStaff={isStaff} updateSessionNote={updateSessionNote} />
                        ))}
                    </div>
                </div>
            )}
            {sessionFeedbackModal && <FeedbackModal />}
        </div>
    );
};

export default PlanManager;