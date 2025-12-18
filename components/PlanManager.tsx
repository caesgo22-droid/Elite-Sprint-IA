import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { generateTrainingPlan } from '../services/geminiService';
import { Loader2, Zap, Dumbbell, Play, UserCog, X, CheckSquare, Target, Layers, Brain, History, ChevronRight, Share, HeartPulse, Info, Download, Stethoscope, Calendar, Plus, Wrench, BatteryCharging, MessageCircle, MessageSquare, Table2, ScanLine, ChevronDown, ChevronUp, Flag, BarChart3, MapPin, Trophy, Trash2 } from 'lucide-react';
import { TrainingSession, UserProfile, Injury } from '../types';
import { calculateACWR } from '../utils/loadCalculator';
import { calculateRecovery } from '../utils/recoveryEngine';
import { RaceDayManager } from './RaceDayManager';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Label, ComposedChart, Line } from 'recharts';

const DrillItem = ({ name, colorClass }: { name: string, colorClass: string }) => (
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
        const text = `*ELITE SPRINT AI - Sesión (${session.day})*\n\n*Enfoque:* ${session.focus}\n*KPI Técnico:* ${session.biomechanicsKpi || 'N/A'}\n*Rutina:* ${session.trackRoutine.join(', ')}\n*Intensidad:* ${session.intensity}\n${session.coachNotes ? `*Nota Coach:* ${session.coachNotes}` : ''}`;
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
                     {session.coachNotes && <span className="text-[10px] bg-blue-900/30 text-blue-300 px-2 py-0.5 rounded border border-blue-500/30 flex items-center gap-1"><MessageSquare size={10}/> Nota</span>}
                 </div> 
             </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={shareSession} className="text-emerald-500 bg-emerald-900/20 p-2 rounded-full mr-1 hover:bg-emerald-900/40 z-10 relative">
                <MessageCircle size={18}/>
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
                    </div>
                </div>
            )}
            {(isStaff || session.coachNotes) && (
                <div className="bg-blue-900/10 border-l-2 border-blue-500 pl-3 py-2 rounded-r relative group" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1"><UserCog size={12}/> Instrucción del Staff</span>
                        {isStaff && !isEditingNote && <button onClick={() => setIsEditingNote(true)} className="text-slate-500 hover:text-white"><Wrench size={12}/></button>}
                    </div>
                    {isStaff && isEditingNote ? (
                        <div className="flex gap-2">
                            <input type="text" value={note} onChange={e => setNote(e.target.value)} className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white" placeholder="Ej: Enfócate en el recobro..." autoFocus/>
                            <button onClick={saveNote} className="bg-blue-600 px-2 rounded text-xs font-bold text-white">OK</button>
                        </div>
                    ) : (
                        <p className="text-sm text-slate-300 italic">{session.coachNotes || (isStaff ? "Añadir nota técnica..." : "")}</p>
                    )}
                </div>
            )}
            <div>
                <div className="flex items-center gap-2 mb-3 text-cyan-400 text-xs font-bold uppercase tracking-wider"><Zap size={14} /> Rutina de Pista</div>
                <ul className="space-y-2">
                    {session.trackRoutine.map((item: string, i: number) => <DrillItem key={i} name={item} colorClass="bg-cyan-500" />)}
                </ul>
            </div>
            {session.gymRoutine && session.gymRoutine.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-3 text-purple-400 text-xs font-bold uppercase tracking-wider"><Dumbbell size={14} /> Fuerza</div>
                    <ul className="space-y-2">
                        {session.gymRoutine.map((item: string, i: number) => <DrillItem key={i} name={item} colorClass="bg-purple-500" />)}
                    </ul>
                </div>
            )}
            <div className="pt-2 border-t border-slate-800 grid grid-cols-1 gap-2 sm:grid-cols-2"> 
                <button onClick={(e) => { e.stopPropagation(); setSessionFeedbackModal(session); }} className={`w-full py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${isDone ? 'bg-slate-800 text-slate-300 hover:text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200 col-span-2'}`}> 
                    <CheckSquare size={16}/> {isDone ? 'Editar Feedback' : 'Registrar Sesión'} 
                </button> 
                {isDone && (
                    <button onClick={(e) => { e.stopPropagation(); onShowRecovery(session); }} className="w-full bg-emerald-900/20 border border-emerald-500/30 hover:bg-emerald-900/40 text-emerald-400 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors"> 
                        <BatteryCharging size={16}/> Recuperación
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
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2"><BarChart3 size={14}/> Estructura Macrociclo (8 Semanas)</h3>
                <div className="flex items-center gap-3 text-[9px] font-bold uppercase">
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-cyan-500"></div> Real</div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-slate-500 border border-dashed border-slate-300"></div> Futuro</div>
                </div>
            </div>
            <div className="h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorReal" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis dataKey="name" tick={{fontSize: 9, fill: '#94a3b8'}} axisLine={false} tickLine={false} interval={0} />
                        <YAxis hide domain={['dataMin - 20', 'dataMax + 20']} />
                        <Tooltip contentStyle={{backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px'}} itemStyle={{fontSize: '12px'}} labelStyle={{color: '#94a3b8', fontSize: '10px', marginBottom: '4px'}} formatter={(value: any, name: string) => [value, name === 'realLoad' ? 'Carga Real' : 'Proyección']} />
                        <ReferenceLine x="ACTUAL" stroke="#22d3ee" strokeDasharray="3 3" strokeOpacity={0.5} />
                        <Line type="monotone" dataKey="projectedLoad" stroke="#64748b" strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={false} />
                        <Area type="monotone" dataKey="realLoad" stroke="#22d3ee" fillOpacity={1} fill="url(#colorReal)" strokeWidth={3} activeDot={{r: 6, stroke: '#fff', strokeWidth: 2, fill: '#22d3ee'}} />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
            <div className="flex justify-center mt-2">
                <span className="text-[10px] text-cyan-400 font-bold bg-cyan-900/20 px-3 py-1 rounded-full border border-cyan-500/30 animate-pulse">SEMANA ACTUAL</span>
            </div>
        </div>
    );
};

const PlanManager: React.FC = () => {
  const { user, userProfile, adminProfile, updateProfile, currentPlan, setPlan, updateSession, lastAnalysis } = useApp();
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
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [tempProfile, setTempProfile] = useState<UserProfile>(userProfile);
  const [planHistoryState, setPlanHistoryState] = useState<any[]>([]);
  const [acwr, setAcwr] = useState<{ratio: number, status: string} | null>(null);
  const [sessionFeedbackModal, setSessionFeedbackModal] = useState<TrainingSession | null>(null);
  const [activeTooltip, setActiveTooltip] = useState<{title: string, text: string} | null>(null);
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
      setPlanHistoryState(useApp().planHistory);
      if (currentPlan || useApp().planHistory.length > 0) {
           const allPlans = currentPlan ? [currentPlan, ...useApp().planHistory] : useApp().planHistory;
           const stats = calculateACWR(allPlans);
           setAcwr({ ratio: stats.ratio, status: stats.status });
      }
  }, [useApp().planHistory, currentPlan]);

  const handleSaveProfile = () => { 
      updateProfile(tempProfile); 
      setShowProfileConfig(false); 
      if (!tempProfile.events.includes(focusEvent)) setFocusEvent(tempProfile.events[0]);
  };
  
  const handleGenerate = async () => { 
      setLoading(true); 
      const plan = await generateTrainingPlan(userProfile, { fatigue, sleep, soreness, stress, hydration }, new Date().toLocaleDateString('es-ES'), focusEvent, acwr || undefined); 
      if (plan) setPlan(plan); else alert("Error crítico al generar el plan.");
      setLoading(false); 
  };
  
  const shareToWhatsapp = () => {
      if(!currentPlan) return;
      const text = `*ELITE SPRINT AI - MICRO-CICLO*\n\n*Fase:* ${currentPlan.phase}\n*Objetivo:* ${currentPlan.weeklyGoal}\n\nGenerado por Elite Sprint Coach AI.`;
      const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
  };

  const updateSessionNote = (day: string, note: string) => updateSession(day, { coachNotes: note });
  const toggleEventSelection = (e: string) => { const current = tempProfile.events || []; if (current.includes(e)) setTempProfile({ ...tempProfile, events: current.filter(ev => ev !== e) }); else setTempProfile({ ...tempProfile, events: [...current, e] }); };
  const toggleTrainingDay = (day: string) => { const current = tempProfile.trainingDays || []; if (current.includes(day)) setTempProfile({ ...tempProfile, trainingDays: current.filter(d => d !== day) }); else setTempProfile({ ...tempProfile, trainingDays: [...current, day] }); };
  const updateInjury = (index: number, field: keyof Injury, value: string) => { const updated = [...(tempProfile.injuries || [])]; updated[index] = { ...updated[index], [field]: value }; setTempProfile({ ...tempProfile, injuries: updated }); };
  const showTooltip = (title: string, text: string) => setActiveTooltip({title, text});
  const updatePB = (event: '100m'|'200m'|'400m', field: 'time'|'date', value: string) => {
      const newPBs = { ...tempProfile.pbs, [event]: { ...tempProfile.pbs[event], [field]: value } };
      setTempProfile({ ...tempProfile, pbs: newPBs });
  };
  const addCompetition = () => {
      if(!newCompName || !newCompDate) return;
      const newComp = { id: Date.now().toString(), name: newCompName, date: newCompDate };
      const currentComps = tempProfile.competitions || [];
      const updated = [...currentComps, newComp].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setTempProfile({ ...tempProfile, competitions: updated });
      setNewCompName(""); setNewCompDate("");
  };

  const handleCalculateRecovery = (session: TrainingSession) => {
      if(!session.feedback) return;
      const weight = (userProfile.weight && userProfile.weight > 0) ? userProfile.weight : 70;
      const rec = calculateRecovery(session.intensity, session.feedback.duration || 60, weight, session.feedback.rpe || 5);
      setViewingRecovery(rec);
  };

  const FeedbackModal = () => {
    if(!sessionFeedbackModal) return null;
    const [rpe, setRpe] = useState(sessionFeedbackModal.feedback?.rpe || 5);
    const [pain, setPain] = useState(sessionFeedbackModal.feedback?.painLevel || 0);
    const [dur, setDur] = useState(sessionFeedbackModal.feedback?.duration || 60);
    const [srf, setSrf] = useState(sessionFeedbackModal.feedback?.surface || 'Track');
    const [nts, setNts] = useState(sessionFeedbackModal.feedback?.notes || '');
    const save = () => { 
        updateSession(sessionFeedbackModal.day, { feedback: { completed: true, rpe, painLevel: pain, duration: dur, surface: srf as any, notes: nts, timestamp: new Date().toISOString() } }); 
        setSessionFeedbackModal(null); 
    };
    return ( 
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSessionFeedbackModal(null)}> 
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}> 
                <div className="flex justify-between"><h3 className="font-bold text-white">Feedback Diario</h3><button onClick={() => setSessionFeedbackModal(null)}><X/></button></div> 
                <div><div className="flex justify-between items-center mb-1"><label className="text-xs font-bold text-slate-400">RPE (1-10)</label></div><input type="range" min="1" max="10" value={rpe} onChange={e => setRpe(parseInt(e.target.value))} className="w-full accent-cyan-500"/></div> 
                <div><div className="flex justify-between items-center mb-1"><label className="text-xs font-bold text-slate-400">Dolor (0-10)</label></div><input type="range" min="0" max="10" value={pain} onChange={e => setPain(parseInt(e.target.value))} className="w-full accent-red-500"/></div> 
                <button onClick={save} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl">Guardar Sesión</button> 
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
            <h2 className="text-2xl font-bold">Perfil Holístico</h2>
            <button onClick={() => setShowProfileConfig(false)} className="p-2 bg-slate-800 rounded-full"><X/></button>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          <section className="space-y-4">
             <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-2"><UserCog size={14}/> Identidad Atlética</h3>
             <div><label className="text-xs text-slate-400 block mb-1">Nombre</label><input type="text" value={tempProfile.name} onChange={e => setTempProfile({...tempProfile, name: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white" /></div>
             <div className="grid grid-cols-2 gap-3">
                 <div><label className="text-xs text-slate-400 block mb-1">Edad</label><input type="number" value={tempProfile.age} onChange={e => setTempProfile({...tempProfile, age: parseInt(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white" /></div>
                 <div><label className="text-xs text-slate-400 block mb-1">Altura (cm)</label><input type="number" value={tempProfile.height || ''} onChange={e => setTempProfile({...tempProfile, height: parseInt(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white" /></div>
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
        <div><h2 className="text-3xl font-bold text-white">Microciclo</h2><p className="text-slate-500 text-sm">Nivel V World Athletics</p></div>
        <button onClick={() => setShowProfileConfig(true)} className="p-2 bg-slate-800 rounded-full text-slate-300"><UserCog size={18} /></button>
      </div>
      {!currentPlan ? (
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="space-y-4 max-w-sm mx-auto">
            <BiomarkerSlider label="Fatiga" value={fatigue} setter={setFatigue} color="cyan" minLabel="Fresco" maxLabel="Exhausto" />
            <BiomarkerSlider label="Sueño" value={sleep} setter={setSleep} color="indigo" minLabel="Pésimo" maxLabel="Excelente" />
          </div>
          <button onClick={handleGenerate} disabled={loading} className="w-full bg-cyan-600 text-white font-bold py-4 rounded-xl"> {loading ? 'Generando...' : 'Generar Plan Elite'} </button>
        </div>
      ) : (
        <div className="space-y-6">
           <MacrocycleChart history={planHistoryState} currentPlan={currentPlan} />
           <div className="bg-slate-900 p-6 rounded-2xl border border-slate-700">
               <h3 className="text-xl font-bold text-white mb-2">{currentPlan.phase}</h3>
               <p className="text-sm text-slate-300">{currentPlan.weeklyGoal}</p>
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