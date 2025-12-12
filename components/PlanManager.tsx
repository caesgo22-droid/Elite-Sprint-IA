
import * as React from 'react';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { generateTrainingPlan } from '../services/geminiService';
import { Loader2, Zap, Dumbbell, Play, UserCog, X, CheckSquare, Target, Layers, Brain, History, ChevronRight, Share, HeartPulse, Info, Download, Stethoscope, Calendar, Plus, Wrench, BatteryCharging, MessageCircle, MessageSquare, Table2 } from 'lucide-react';
import { TrainingSession, UserProfile, Injury } from '../types';
import { calculateACWR } from '../utils/loadCalculator';
import { getPlanHistory } from '../services/firebase';
import { calculateRecovery } from '../utils/recoveryEngine';

// Helper for Video Links
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

// Helper Tooltip Button
const InfoButton = ({ title, text, onClick }: { title: string, text: string, onClick: (t: string, x: string) => void }) => ( 
    <button type="button" onClick={(e) => { e.stopPropagation(); onClick(title, text); }} className="text-slate-500 hover:text-cyan-400 ml-1 inline-flex align-middle">
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

    // WHATSAPP SHARE BUTTON FOR INDIVIDUAL SESSION
    const shareSession = (e: React.MouseEvent) => {
        e.stopPropagation();
        const text = `*ELITE SPRINT AI - Sesión (${session.day})*\n\n*Enfoque:* ${session.focus}\n*Rutina:* ${session.trackRoutine.join(', ')}\n*Intensidad:* ${session.intensity}\n${session.coachNotes ? `*Nota Coach:* ${session.coachNotes}` : ''}`;
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
            
            {/* COACH NOTE SECTION (Communication Logic) */}
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

export const PlanManager: React.FC = () => {
  const { user, userProfile, updateProfile, currentPlan, setPlan, updateSession, lastAnalysis } = useApp();
  const [searchParams] = useSearchParams();
  
  const [loading, setLoading] = useState(false);
  const [showProfileConfig, setShowProfileConfig] = useState(false);
  const [showMacroModal, setShowMacroModal] = useState(false);
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

  const isStaff = userProfile.role === 'staff';

  // ... (Keep existing UseEffects and Helper Functions same as before) ...
  // Initialize: Check for ?edit=true param or missing name
  useEffect(() => {
      const isEditing = searchParams.get('edit') === 'true';
      const isNewUser = !userProfile.name || userProfile.name === 'Atleta';
      
      if (isEditing || isNewUser) {
          setShowProfileConfig(true);
      }
  }, [searchParams, userProfile.name]);

  useEffect(() => {
    const fetchHistory = async () => {
       if(user) {
           const history = await getPlanHistory(user.uid);
           setPlanHistoryState(history);
           const allPlans = currentPlan ? [currentPlan, ...history] : history;
           const stats = calculateACWR(allPlans);
           setAcwr({ ratio: stats.ratio, status: stats.status });
       }
    };
    fetchHistory();
  }, [user, currentPlan]);

  const handleSaveProfile = () => { 
      updateProfile(tempProfile); 
      setShowProfileConfig(false); 
      if (!tempProfile.events.includes(focusEvent)) setFocusEvent(tempProfile.events[0]);
      if (window.history.pushState) {
          const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + '#/plan';
          window.history.pushState({path:newUrl},'',newUrl);
      }
  };
  
  const handleGenerate = async () => { 
      setLoading(true); 
      const plan = await generateTrainingPlan(userProfile, { fatigue, sleep, soreness, stress, hydration }, new Date().toLocaleDateString('es-ES'), focusEvent, acwr || undefined); 
      if (plan) {
          setPlan(plan); 
      } else {
          alert("Error crítico al generar el plan. Verifica tu conexión."); 
      }
      setLoading(false); 
  };
  
  const sharePlan = async () => { 
      if(!currentPlan) return; 
      const text = `PLAN ELITE - ${currentPlan.phase}\n${currentPlan.weeklyGoal}`; 
      navigator.clipboard.writeText(text); 
      alert("Copiado al portapapeles"); 
  };

  const shareToWhatsapp = () => {
      if(!currentPlan) return;
      const text = `*ELITE SPRINT AI - MICRO-CICLO*\n\n*Fase:* ${currentPlan.phase}\n*Objetivo:* ${currentPlan.weeklyGoal}\n\nGenerado por Elite Sprint Coach AI.`;
      const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
  };

  const updateSessionNote = (day: string, note: string) => {
      updateSession(day, { coachNotes: note });
  };

  // Profile Helpers (Same as before)
  const toggleEventSelection = (e: string) => { const current = tempProfile.events || []; if (current.includes(e)) setTempProfile({ ...tempProfile, events: current.filter(ev => ev !== e) }); else setTempProfile({ ...tempProfile, events: [...current, e] }); };
  const toggleTrainingDay = (day: string) => { const current = tempProfile.trainingDays || []; if (current.includes(day)) setTempProfile({ ...tempProfile, trainingDays: current.filter(d => d !== day) }); else setTempProfile({ ...tempProfile, trainingDays: [...current, day] }); };
  const addInjury = () => { setTempProfile({ ...tempProfile, injuries: [...(tempProfile.injuries || []), { type: 'Muscular', location: 'Isquios', severity: 'Leve', status: 'Activa' }] }); };
  const updateInjury = (index: number, field: keyof Injury, value: string) => { const updated = [...(tempProfile.injuries || [])]; updated[index] = { ...updated[index], [field]: value }; setTempProfile({ ...tempProfile, injuries: updated }); };
  const removeInjury = (index: number) => { setTempProfile({ ...tempProfile, injuries: tempProfile.injuries?.filter((_, i) => i !== index) }); };
  const showTooltip = (title: string, text: string) => { setActiveTooltip({title, text}); };
  const updatePB = (event: '100m'|'200m'|'400m', field: 'time'|'date', value: string) => {
      const newPBs = { ...tempProfile.pbs, [event]: { ...tempProfile.pbs[event], [field]: value } };
      setTempProfile({ ...tempProfile, pbs: newPBs });
  };

  const handleExportHistory = () => {
      if(planHistoryState.length === 0) return;
      const csv = "Fase,Objetivo,Fecha\n" + planHistoryState.map(p => `${p.phase},"${p.weeklyGoal}",${new Date(p.createdAt).toLocaleDateString()}`).join("\n");
      const link = document.createElement("a"); link.href = "data:text/csv;charset=utf-8," + encodeURI(csv); link.download = "training_plans.csv"; link.click();
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
        const weight = (userProfile.weight && userProfile.weight > 0) ? userProfile.weight : 70;
        const rec = calculateRecovery(sessionFeedbackModal.intensity, dur, weight, rpe);
        setViewingRecovery(rec);
        setSessionFeedbackModal(null); 
    };
    return ( 
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSessionFeedbackModal(null)}> 
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}> 
                <div className="flex justify-between"><h3 className="font-bold text-white">Feedback Diario</h3><button onClick={() => setSessionFeedbackModal(null)}><X/></button></div> 
                <div><div className="flex justify-between items-center mb-1"><label className="text-xs font-bold text-slate-400">RPE (1-10)</label></div><input type="range" min="1" max="10" value={rpe} onChange={e => setRpe(parseInt(e.target.value))} className="w-full accent-cyan-500"/></div> 
                <div><div className="flex justify-between items-center mb-1"><label className="text-xs font-bold text-slate-400">Dolor (0-10)</label></div><input type="range" min="0" max="10" value={pain} onChange={e => setPain(parseInt(e.target.value))} className="w-full accent-red-500"/></div> 
                <div><label className="text-xs font-bold text-slate-400 mb-1 flex items-center gap-1">Duración (min)</label><input type="number" value={dur} onChange={e => setDur(parseInt(e.target.value))} className="w-full bg-slate-950 p-3 rounded-lg border border-slate-800 text-white text-sm"/></div> 
                <div><label className="text-xs font-bold text-slate-400 mb-1 flex items-center gap-1">Superficie</label><select value={srf} onChange={e => setSrf(e.target.value as any)} className="w-full bg-slate-950 p-3 rounded-lg border border-slate-800 text-white text-sm"><option value="Track">Pista</option><option value="Grass">Césped</option><option value="Gym">Gimnasio</option><option value="Road">Asfalto</option></select></div> 
                <div><label className="text-xs font-bold text-slate-400 block mb-1">Notas</label><textarea value={nts} onChange={e => setNts(e.target.value)} className="w-full bg-slate-950 p-3 rounded-lg border border-slate-800 text-white text-sm h-20"/></div> 
                <button onClick={save} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-colors">Guardar Sesión</button> 
            </div> 
        </div> 
    );
  };

  const handleInjectDrills = () => {
    if (!lastAnalysis || !currentPlan) return;
    const drills = lastAnalysis.correctiveDrills;
    if (drills.length === 0) return;
    if (window.confirm(`¿Inyectar drills correctivos?`)) {
        const updatedSessions = currentPlan.sessions.map(s => {
            if (!s.feedback?.completed) {
                const newRoutine = [...drills, ...s.trackRoutine.filter(d => !drills.includes(d))];
                return { ...s, trackRoutine: newRoutine };
            }
            return s;
        });
        setPlan({ ...currentPlan, sessions: updatedSessions });
        alert("Plan actualizado.");
    }
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

  // --- PROFILE CONFIG RENDER ---
  if (showProfileConfig) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500 pb-10">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Perfil Holístico</h2>
            <button onClick={() => { setShowProfileConfig(false); if (searchParams.get('edit')) { window.history.back(); } }} className="p-2 bg-slate-800 rounded-full"><X/></button>
        </div>
        
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* ... (Existing Profile Sections) ... */}
          <section className="space-y-4">
             <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-2"><UserCog size={14}/> Identidad Atlética</h3>
             <div><label className="text-xs text-slate-400 block mb-1">Nombre</label><input type="text" value={tempProfile.name} onChange={e => setTempProfile({...tempProfile, name: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white" /></div>
             {/* ... (Rest of fields) ... */}
             <div className="grid grid-cols-2 gap-3">
                 <div>
                     <label className="text-xs text-slate-400 block mb-1">Edad</label>
                     <input type="number" value={tempProfile.age} onChange={e => setTempProfile({...tempProfile, age: parseInt(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white" />
                 </div>
                 <div>
                     <label className="text-xs text-slate-400 block mb-1">Altura (cm)</label>
                     <input type="number" value={tempProfile.height || ''} onChange={e => setTempProfile({...tempProfile, height: parseInt(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white" />
                 </div>
                 <div>
                     <label className="text-xs text-slate-400 block mb-1">Peso (kg)</label>
                     <input type="number" value={tempProfile.weight || ''} onChange={e => setTempProfile({...tempProfile, weight: parseInt(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white" />
                 </div>
                 <div>
                     <label className="text-xs text-slate-400 block mb-1">Años Exp.</label>
                     <input type="number" value={tempProfile.yearsExperience || ''} onChange={e => setTempProfile({...tempProfile, yearsExperience: parseInt(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white" />
                 </div>
             </div>
             
             <div>
                 <label className="text-xs text-slate-400 block mb-1">Nivel de Experiencia</label>
                 <select value={tempProfile.experienceLevel} onChange={e => setTempProfile({...tempProfile, experienceLevel: e.target.value as any})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white">
                     <option value="Beginner">Principiante (Inicio)</option>
                     <option value="Intermediate">Intermedio (Regional)</option>
                     <option value="Advanced">Avanzado (Nacional)</option>
                     <option value="Elite">Élite (Internacional)</option>
                 </select>
             </div>
          </section>

          <section className="space-y-4 pt-4 border-t border-slate-800">
             <div className="flex justify-between items-center">
                 <h3 className="text-sm font-bold text-red-400 uppercase tracking-wider flex items-center gap-2"><Stethoscope size={14}/> Lesiones</h3>
                 <button onClick={addInjury} className="text-xs bg-slate-800 hover:bg-slate-700 text-white px-2 py-1 rounded flex items-center gap-1 transition-colors"><Plus size={12}/> Agregar</button>
             </div>
             {(!tempProfile.injuries || tempProfile.injuries.length === 0) && <p className="text-xs text-slate-500 italic">Sin lesiones activas.</p>}
             <div className="space-y-3">
                 {tempProfile.injuries?.map((inj, idx) => (
                     <div key={idx} className="bg-slate-950 p-3 rounded-lg border border-slate-700 relative">
                         <button onClick={() => removeInjury(idx)} className="absolute top-2 right-2 text-slate-600 hover:text-red-400"><X size={14}/></button>
                         <div className="grid grid-cols-2 gap-2 mb-2">
                             <div><label className="text-[10px] text-slate-500 block">Ubicación</label><input type="text" value={inj.location} onChange={e => updateInjury(idx, 'location', e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white"/></div>
                             <div><label className="text-[10px] text-slate-500 block">Tipo</label><input type="text" value={inj.type} onChange={e => updateInjury(idx, 'type', e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white"/></div>
                         </div>
                     </div>
                 ))}
             </div>
          </section>

          <section className="space-y-4 pt-4 border-t border-slate-800">
             <h3 className="text-sm font-bold text-pink-400 uppercase tracking-wider flex items-center gap-2"><HeartPulse size={14}/> Biometría Avanzada</h3>
             <div className="grid grid-cols-2 gap-3">
                 <div>
                     <label className="text-xs text-slate-400 flex items-center mb-1">HR Reposo</label>
                     <input type="number" placeholder="bpm" value={tempProfile.restingHR || ''} onChange={e => setTempProfile({...tempProfile, restingHR: parseInt(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white" />
                 </div>
                 <div>
                     <label className="text-xs text-slate-400 flex items-center mb-1">HRV (ms)</label>
                     <input type="number" placeholder="ms" value={tempProfile.hrv || ''} onChange={e => setTempProfile({...tempProfile, hrv: parseInt(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white" />
                 </div>
             </div>
             <div><label className="text-xs text-slate-400 block mb-1">Condiciones Médicas</label><textarea placeholder="Asma, Diabetes, etc..." value={tempProfile.medicalConditions || ''} onChange={e => setTempProfile({...tempProfile, medicalConditions: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white h-20" /></div>
          </section>

          <section className="space-y-4 pt-4 border-t border-slate-800">
              <h3 className="text-sm font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2"><Calendar size={14}/> Disponibilidad</h3>
              <div>
                  <label className="text-xs text-slate-500 block mb-2">Días de Entrenamiento</label>
                  <div className="flex flex-wrap gap-2">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                          <button 
                            key={day} 
                            onClick={() => toggleTrainingDay(day)}
                            className={`w-8 h-8 rounded-full text-xs font-bold flex items-center justify-center transition-colors ${tempProfile.trainingDays.includes(day) ? 'bg-blue-600 text-white' : 'bg-slate-950 text-slate-600 border border-slate-800'}`}
                          >
                              {day.charAt(0)}
                          </button>
                      ))}
                  </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                  <div>
                      <label className="text-xs text-slate-500 block mb-1">Horas/Día</label>
                      <input type="number" value={tempProfile.hoursPerDay} onChange={e => setTempProfile({...tempProfile, hoursPerDay: parseInt(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm text-white"/>
                  </div>
                  <div>
                      <label className="text-xs text-slate-500 block mb-1">Horario Pref.</label>
                      <select value={tempProfile.preferredTime} onChange={e => setTempProfile({...tempProfile, preferredTime: e.target.value as any})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm text-white">
                          <option value="Morning">Mañana</option>
                          <option value="Afternoon">Tarde</option>
                          <option value="Evening">Noche</option>
                      </select>
                  </div>
              </div>
          </section>

          <section className="space-y-4 pt-4 border-t border-slate-800">
              <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2"><Target size={14}/> Eventos & Marcas (PBs)</h3>
              <div className="flex gap-2 mb-2">
                  {['100m', '200m', '400m'].map(e => (
                      <button key={e} onClick={() => toggleEventSelection(e)} className={`flex-1 py-2 rounded-lg border text-xs font-bold ${tempProfile.events.includes(e) ? 'bg-cyan-600 border-cyan-500 text-white' : 'bg-slate-950 border-slate-700 text-slate-500'}`}>{e}</button>
                  ))}
              </div>
              <div className="space-y-2">
                  {(['100m', '200m', '400m'] as const).map(ev => tempProfile.events.includes(ev) && (
                      <div key={ev} className="grid grid-cols-2 gap-2 bg-slate-950 p-2 rounded border border-slate-800">
                          <div>
                              <label className="text-[10px] text-slate-500 block uppercase">PB {ev}</label>
                              <input type="text" placeholder="10.50" value={tempProfile.pbs[ev]?.time || ''} onChange={e => updatePB(ev, 'time', e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white font-mono"/>
                          </div>
                          <div>
                              <label className="text-[10px] text-slate-500 block uppercase">Fecha</label>
                              <input type="date" value={tempProfile.pbs[ev]?.date || ''} onChange={e => updatePB(ev, 'date', e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"/>
                          </div>
                      </div>
                  ))}
              </div>
          </section>

          <button onClick={handleSaveProfile} className="w-full bg-cyan-600 text-white font-bold py-4 rounded-xl mt-4 shadow-lg shadow-cyan-900/20">Guardar Perfil</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-16">
      <div className="flex justify-between items-end border-b border-slate-800/50 pb-4">
        <div><h2 className="text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-100 to-slate-400">Microciclo</h2><p className="text-slate-500 text-sm font-medium mt-1">Nivel V World Athletics</p></div>
        <div className="flex gap-2">
            <button onClick={() => setShowProfileConfig(true)} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full text-slate-300"><UserCog size={18} /></button>
        </div>
      </div>

      {!currentPlan ? (
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="text-center"><h3 className="text-lg font-bold text-white">Biomarcadores Diarios</h3><p className="text-slate-400 text-xs mt-1">El Consejo de Expertos analizará tu estado.</p></div>
          {acwr && ( <div className="space-y-2"> <div className="flex justify-between text-xs text-slate-400 uppercase font-bold tracking-wider items-center"> <span>ACWR <InfoButton title="ACWR" text="Acute:Chronic Workload Ratio." onClick={showTooltip}/></span> <span>{acwr.ratio}</span> </div> <div className="h-4 bg-slate-800 rounded-full overflow-hidden relative"> <div className={`h-full transition-all duration-500 ${acwr.status === 'Alto Riesgo' ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(acwr.ratio * 50, 100)}%` }} /> </div> </div> )}
          
          <div className="space-y-4 max-w-sm mx-auto pt-4 border-t border-slate-800">
            <BiomarkerSlider label="Fatiga" value={fatigue} setter={setFatigue} color="cyan" minLabel="Fresco" maxLabel="Exhausto" />
            <BiomarkerSlider label="Sueño" value={sleep} setter={setSleep} color="indigo" minLabel="Pésimo" maxLabel="Excelente" />
            <BiomarkerSlider label="Dolor" value={soreness} setter={setSoreness} color="red" minLabel="Sin Dolor" maxLabel="Incapacitante" />
            <BiomarkerSlider label="Estrés" value={stress} setter={setStress} color="yellow" minLabel="Zen" maxLabel="Ansioso" />
            <BiomarkerSlider label="Hidratación" value={hydration} setter={setHydration} color="blue" minLabel="Deshidratado" maxLabel="Óptima" />
          </div>

          <button onClick={handleGenerate} disabled={loading} className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-3 shadow-lg shadow-cyan-900/20 active:scale-95"> {loading ? <Loader2 className="animate-spin" /> : <Zap fill="currentColor" />} {loading ? 'Consultando Expertos...' : 'Generar Plan Elite'} </button>
          
          {planHistoryState.length > 0 && (
              <div className="mt-8 pt-6 border-t border-slate-800">
                  <div className="flex justify-between items-center mb-3">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2"><History size={12}/> Planes Anteriores</h4>
                      <button onClick={handleExportHistory} className="text-slate-400 hover:text-white"><Download size={14}/></button>
                  </div>
                  <div className="space-y-2">
                      {planHistoryState.slice(0, 3).map((p: any) => ( <div key={p.id} onClick={() => setPlan(p)} className="p-3 bg-slate-900 border border-slate-800 rounded-lg flex justify-between items-center cursor-pointer hover:bg-slate-800"> <div><div className="text-sm font-bold text-slate-300">{p.phase}</div><div className="text-xs text-slate-500">{new Date(p.createdAt).toLocaleDateString()}</div></div> <ChevronRight size={16} className="text-slate-600"/> </div> ))}
                  </div>
              </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
           <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 rounded-2xl border border-slate-700 relative overflow-hidden shadow-2xl">
             <div className="relative z-10">
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2"><span className="inline-flex items-center gap-1 px-2 py-1 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded text-[10px] font-bold uppercase tracking-widest"><Layers size={10} /> {currentPlan.phase}</span></div>
                    <div className="flex gap-2">
                        <button onClick={() => setShowMacroModal(true)} className="bg-slate-700/50 hover:bg-slate-600 text-xs px-3 py-1.5 rounded-full flex items-center gap-1 border border-slate-600"><Brain size={12} className="text-purple-400"/> Lógica</button>
                        <button onClick={() => setShowPlanTable(true)} className="bg-slate-700/50 hover:bg-slate-600 text-xs px-3 py-1.5 rounded-full flex items-center gap-1 border border-slate-600" title="Ver Tabla Visual"><Table2 size={12} className="text-cyan-400"/> Tabla</button>
                        {/* FORCE WHATSAPP BUTTON VISIBILITY */}
                        <button onClick={shareToWhatsapp} className="bg-emerald-600 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1 shadow-lg shadow-emerald-900/20 hover:bg-emerald-500 transition-colors" title="Enviar por WhatsApp"><MessageCircle size={14}/></button>
                    </div>
                </div>
               <div className="flex items-center gap-2 mb-2"><Target size={18} className="text-emerald-400" /><h3 className="text-xl font-bold text-white">Objetivo Semanal</h3></div>
               <p className="text-sm text-slate-300 leading-relaxed max-w-lg mb-3 pl-7">{currentPlan.weeklyGoal}</p>
               
               {lastAnalysis && lastAnalysis.criticalErrors.length > 0 && (
                   <button onClick={handleInjectDrills} className="mt-3 bg-red-900/30 border border-red-500/30 hover:bg-red-900/50 text-red-300 px-4 py-2 rounded-lg flex items-center gap-2 text-xs font-bold transition-all w-full justify-center">
                       <Wrench size={14}/> Inyectar Drills Correctivos ({lastAnalysis.criticalErrors.length} errores)
                   </button>
               )}

               <button onClick={() => { if(window.confirm("¿Descartar?")) setPlan(null as any); }} className="mt-4 text-xs text-slate-500 underline decoration-slate-700 hover:text-red-400 block mx-auto">Reiniciar Ciclo</button>
             </div>
           </div>
           
           <div className="space-y-3 pb-8">
               {currentPlan.sessions.map((session: TrainingSession, idx: number) => (
                   <SessionCard key={idx} session={session} expandedDay={expandedDay} setExpandedDay={setExpandedDay} setSessionFeedbackModal={setSessionFeedbackModal} onShowRecovery={handleCalculateRecovery} isStaff={isStaff} updateSessionNote={updateSessionNote} />
               ))}
           </div>
        </div>
      )}
      
      {showMacroModal && currentPlan?.rationale && ( <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowMacroModal(false)}> <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm"> <h3 className="text-xl font-bold text-white mb-4">Estrategia Técnica</h3> <p className="text-slate-300 text-sm leading-relaxed">{currentPlan.rationale}</p> </div> </div> )}
      
      {/* PLAN TABLE MODAL */}
      {showPlanTable && currentPlan && (
          <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-2 backdrop-blur-sm" onClick={() => setShowPlanTable(false)}>
              <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-3xl overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                  <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800">
                      <div><h3 className="font-bold text-white text-lg">Microciclo Elite</h3><p className="text-xs text-slate-400">{currentPlan.phase} - {new Date(currentPlan.createdAt).toLocaleDateString()}</p></div>
                      <button onClick={() => setShowPlanTable(false)}><X className="text-slate-400 hover:text-white"/></button>
                  </div>
                  <div className="overflow-y-auto p-0">
                      <div className="min-w-full inline-block align-middle">
                          <div className="border rounded-lg overflow-hidden">
                              <table className="min-w-full divide-y divide-slate-700">
                                  <thead className="bg-slate-950">
                                      <tr>
                                          <th scope="col" className="px-3 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Día</th>
                                          <th scope="col" className="px-3 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Enfoque</th>
                                          <th scope="col" className="px-3 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Detalle</th>
                                          <th scope="col" className="px-3 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Vol</th>
                                      </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-800 bg-slate-900">
                                      {currentPlan.sessions.map((s, idx) => (
                                          <tr key={idx} className={idx % 2 === 0 ? 'bg-slate-900' : 'bg-slate-800/50'}>
                                              <td className="px-3 py-3 whitespace-nowrap text-xs font-bold text-white">{s.day.substring(0,3)}</td>
                                              <td className="px-3 py-3 whitespace-nowrap text-xs text-cyan-400 font-medium">{s.focus}</td>
                                              <td className="px-3 py-3 text-xs text-slate-300">
                                                  <ul className="list-disc pl-3 space-y-1">
                                                      {s.trackRoutine.slice(0,3).map((d, i) => <li key={i}>{d.split(':')[0]}</li>)}
                                                  </ul>
                                              </td>
                                              <td className="px-3 py-3 whitespace-nowrap text-xs">
                                                  <span className={`px-2 py-1 rounded ${s.intensity === 'Max' ? 'bg-red-900/50 text-red-300' : 'bg-green-900/50 text-green-300'}`}>{s.intensity}</span>
                                              </td>
                                          </tr>
                                      ))}
                                  </tbody>
                              </table>
                          </div>
                      </div>
                  </div>
                  <div className="p-3 bg-slate-950 border-t border-slate-700 text-center">
                      <p className="text-[10px] text-slate-500 mb-2">Captura pantalla para compartir</p>
                      <button onClick={() => setShowPlanTable(false)} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-2 rounded text-sm">Cerrar</button>
                  </div>
              </div>
          </div>
      )}

      {sessionFeedbackModal && <FeedbackModal />}
      {viewingRecovery && (<div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4 backdrop-blur-md animate-in zoom-in-95 duration-300"><div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-6 w-full max-w-sm shadow-2xl relative overflow-hidden"><div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-cyan-500"></div><div className="flex justify-between items-start mb-4"><div><h3 className="font-bold text-xl text-white flex items-center gap-2"><BatteryCharging className="text-emerald-400"/> Fuel & Recovery</h3></div><button onClick={() => setViewingRecovery(null)}><X className="text-slate-400 hover:text-white"/></button></div><div className="space-y-4"><div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800"><div className="text-xs text-slate-500 font-bold uppercase mb-2">Nutrición</div><div className="grid grid-cols-3 gap-2 text-center"><div className="bg-slate-900 p-2 rounded-lg border border-slate-800"><div className="text-lg font-bold text-white">{viewingRecovery.nutrition.carbs}</div><div className="text-[10px] text-slate-400">Carbs</div></div><div className="bg-slate-900 p-2 rounded-lg border border-slate-800"><div className="text-lg font-bold text-white">{viewingRecovery.nutrition.protein}</div><div className="text-[10px] text-slate-400">Proteína</div></div><div className="bg-slate-900 p-2 rounded-lg border border-slate-800"><div className="text-lg font-bold text-white">{viewingRecovery.nutrition.hydration}</div><div className="text-[10px] text-slate-400">Agua</div></div></div></div><div><div className="text-xs text-slate-500 font-bold uppercase mb-2">Protocolos</div><ul className="space-y-2">{viewingRecovery.protocols.map((p: string, i: number) => (<li key={i} className="flex items-center gap-2 text-sm text-slate-300 bg-slate-800/50 p-2 rounded-lg"><CheckSquare size={14} className="text-cyan-500"/> {p}</li>))}</ul></div></div><button onClick={() => setViewingRecovery(null)} className="w-full mt-6 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-colors">Entendido</button></div></div>)}
      {activeTooltip && ( <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm" onClick={() => setActiveTooltip(null)}> <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}> <h4 className="font-bold text-white mb-2">{activeTooltip.title}</h4> <p className="text-sm text-slate-300 leading-relaxed">{activeTooltip.text}</p> <button onClick={() => setActiveTooltip(null)} className="mt-4 w-full bg-slate-800 text-slate-300 py-2 rounded-lg text-sm font-bold">Entendido</button> </div> </div> )}
    </div>
  );
};
