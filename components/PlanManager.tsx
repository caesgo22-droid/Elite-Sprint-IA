
import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../contexts/AppContext';
import { generateTrainingPlan } from '../services/geminiService';
import { Loader2, Zap, Dumbbell, Play, Activity, AlertTriangle, UserCog, X, CheckSquare, Target, Layers, Brain, History, ChevronRight, Share, Clock, Stethoscope, HeartPulse, Info, Download, Users, Wrench, ExternalLink } from 'lucide-react';
import { TrainingSession, UserProfile, Injury, Coach } from '../types';
import { calculateACWR } from '../utils/loadCalculator';
import { getPlanHistory } from '../services/firebase';

// Helper for Video Links
const DrillItem = ({ name, colorClass }: { name: string, colorClass: string }) => (
    <li className="flex items-center justify-between group text-sm text-slate-300">
        <div className="flex items-start gap-3">
            <span className={`flex-shrink-0 w-1.5 h-1.5 mt-2 rounded-full ${colorClass}`}></span>
            <span>{name}</span>
        </div>
        <a 
            href={`https://www.youtube.com/results?search_query=track+and+field+drill+${name.replace(/\s/g, '+')}`} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"
            title="Ver video de referencia"
        >
            <Play size={12} fill="currentColor" />
        </a>
    </li>
);

// Helper Tooltip Button
const InfoButton = ({ title, text, onClick }: { title: string, text: string, onClick: (t: string, x: string) => void }) => ( 
    <button type="button" onClick={(e) => { e.stopPropagation(); onClick(title, text); }} className="text-slate-500 hover:text-cyan-400 ml-1 inline-flex align-middle">
        <Info size={12} />
    </button> 
);

const SessionCard = React.memo(({ session, expandedDay, setExpandedDay, setSessionFeedbackModal }: any) => {
    const isExpanded = expandedDay === session.day;
    const isDone = session.feedback?.completed;
    const intensityColor = session.intensity === 'Max' ? 'text-red-400 border-red-900/50 bg-red-900/20' : session.intensity === 'High' ? 'text-orange-400 border-orange-900/50 bg-orange-900/20' : session.intensity === 'Medium' ? 'text-yellow-400 border-yellow-900/50 bg-yellow-900/20' : 'text-emerald-400 border-emerald-900/50 bg-emerald-900/20';
    
    return (
      <div onClick={() => setExpandedDay(isExpanded ? null : session.day)} className={`bg-slate-900/40 border rounded-xl overflow-hidden transition-all duration-300 ${isDone ? 'border-emerald-900/40' : 'border-slate-800'} ${isExpanded ? 'ring-1 ring-cyan-500/50 bg-slate-800/60' : 'hover:bg-slate-800/40'}`}>
        <div className="p-4 flex justify-between items-center cursor-pointer select-none">
          <div className="flex items-center gap-4">
             <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center font-bold text-sm bg-slate-800 border border-slate-700 ${isDone ? 'text-emerald-400 border-emerald-900/50' : 'text-slate-200'}`}> {isDone ? <CheckSquare size={18} /> : <span className="text-[10px] text-slate-400 uppercase leading-none">{session.day.substring(0, 3)}</span>} </div>
             <div> <h4 className={`font-bold text-lg tracking-tight ${isDone ? 'text-slate-400 line-through' : 'text-slate-100'}`}>{session.focus}</h4> <div className="flex items-center gap-2 mt-1"><span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wide ${intensityColor}`}>{session.intensity}</span></div> </div>
          </div>
          <ChevronRight size={20} className={`transition-transform ${isExpanded ? 'rotate-90 text-cyan-400' : 'text-slate-500'}`} />
        </div>
        {isExpanded && (
          <div className="px-5 pb-5 space-y-5 border-t border-slate-700/50 pt-4 animate-in slide-in-from-top-2">
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
            <div className="pt-2 border-t border-slate-800"> <button onClick={(e) => { e.stopPropagation(); setSessionFeedbackModal(session); }} className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2"> <CheckSquare size={16}/> {isDone ? 'Ver/Editar Feedback' : 'Registrar Feedback'} </button> </div>
          </div>
        )}
      </div>
    );
});

export const PlanManager: React.FC = () => {
  const { user, userProfile, updateProfile, currentPlan, setPlan, updateSession, lastAnalysis } = useApp();
  const [loading, setLoading] = useState(false);
  const [showProfileConfig, setShowProfileConfig] = useState(!userProfile.name || userProfile.name === 'Atleta');
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

  const handleSaveProfile = () => { updateProfile(tempProfile); setShowProfileConfig(false); if (!tempProfile.events.includes(focusEvent)) setFocusEvent(tempProfile.events[0]); };
  const handleGenerate = async () => { setLoading(true); const plan = await generateTrainingPlan(userProfile, { fatigue, sleep, soreness, stress, hydration }, new Date().toLocaleDateString('es-ES'), focusEvent, acwr || undefined); if (plan) setPlan(plan); else alert("Error de generación. Intenta de nuevo."); setLoading(false); };
  const sharePlan = async () => { if(!currentPlan) return; const text = `PLAN ELITE - ${currentPlan.phase}\n${currentPlan.weeklyGoal}`; navigator.clipboard.writeText(text); alert("Copiado"); };
  const toggleEventSelection = (e: string) => { const current = tempProfile.events || []; if (current.includes(e)) setTempProfile({ ...tempProfile, events: current.filter(ev => ev !== e) }); else setTempProfile({ ...tempProfile, events: [...current, e] }); };
  const toggleTrainingDay = (day: string) => { const current = tempProfile.trainingDays || []; if (current.includes(day)) setTempProfile({ ...tempProfile, trainingDays: current.filter(d => d !== day) }); else setTempProfile({ ...tempProfile, trainingDays: [...current, day] }); };
  
  const addInjury = () => { setTempProfile({ ...tempProfile, injuries: [...(tempProfile.injuries || []), { type: 'Muscular', location: 'Isquios', severity: 'Leve', status: 'Activa' }] }); };
  const updateInjury = (index: number, field: keyof Injury, value: string) => { const updated = [...(tempProfile.injuries || [])]; updated[index] = { ...updated[index], [field]: value }; setTempProfile({ ...tempProfile, injuries: updated }); };
  const removeInjury = (index: number) => { setTempProfile({ ...tempProfile, injuries: tempProfile.injuries?.filter((_, i) => i !== index) }); };
  
  const addCoach = () => { const newCoach: Coach = { id: Date.now().toString(), name: '', role: 'Head Coach', email: '', phone: '', notes: '' }; setTempProfile({ ...tempProfile, coaches: [...(tempProfile.coaches || []), newCoach] }); };
  const updateCoach = (index: number, field: keyof Coach, value: string) => { const updated = [...(tempProfile.coaches || [])]; updated[index] = { ...updated[index], [field]: value }; setTempProfile({ ...tempProfile, coaches: updated }); };
  const removeCoach = (index: number) => { setTempProfile({ ...tempProfile, coaches: tempProfile.coaches?.filter((_, i) => i !== index) }); };

  const showTooltip = (title: string, text: string) => { setActiveTooltip({title, text}); };

  const handleExportHistory = () => {
      if(planHistoryState.length === 0) return;
      const csv = "Fase,Objetivo,Fecha\n" + planHistoryState.map(p => `${p.phase},"${p.weeklyGoal}",${new Date(p.createdAt).toLocaleDateString()}`).join("\n");
      const link = document.createElement("a"); link.href = "data:text/csv;charset=utf-8," + encodeURI(csv); link.download = "training_plans.csv"; link.click();
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
        // Trigger recovery modal logic via AppContext updates or specific event if needed, but in this architecture, 
        // HomeDashboard listens to 'completed' status to show recovery button.
        alert("Sesión guardada. Ve a Inicio para ver tu protocolo de recuperación.");
    };
    return ( 
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSessionFeedbackModal(null)}> 
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}> 
                <div className="flex justify-between"><h3 className="font-bold text-white">Feedback Diario</h3><button onClick={() => setSessionFeedbackModal(null)}><X/></button></div> 
                
                <div>
                    <div className="flex justify-between items-center mb-1">
                        <label className="text-xs font-bold text-slate-400">RPE (1-10)</label>
                        <InfoButton title="RPE" text="1 (Muy suave) - 5 (Moderado) - 10 (Fallo total/Vómito)." onClick={showTooltip}/>
                    </div>
                    <div className="flex justify-between text-xs text-cyan-400 font-bold mb-1"><span>Nivel Actual: {rpe}</span></div>
                    <input type="range" min="1" max="10" value={rpe} onChange={e => setRpe(parseInt(e.target.value))} className="w-full accent-cyan-500"/>
                </div> 

                <div>
                    <div className="flex justify-between items-center mb-1">
                        <label className="text-xs font-bold text-slate-400">Dolor (0-10)</label>
                        <InfoButton title="Escala de Dolor" text="0 (Sin dolor) - 3 (Molestia aceptable) - 5 (Altera técnica/PARAR) - 10 (Incapacitante)." onClick={showTooltip}/>
                    </div>
                    <div className="flex justify-between text-xs text-red-400 font-bold mb-1"><span>Nivel Actual: {pain}</span></div>
                    <input type="range" min="0" max="10" value={pain} onChange={e => setPain(parseInt(e.target.value))} className="w-full accent-red-500"/>
                </div> 

                <div><label className="text-xs font-bold text-slate-400 block mb-1">Duración (min)</label><input type="number" value={dur} onChange={e => setDur(parseInt(e.target.value))} className="w-full bg-slate-950 p-3 rounded-lg border border-slate-800 text-white text-sm"/></div> 
                <div><label className="text-xs font-bold text-slate-400 block mb-1">Superficie</label><select value={srf} onChange={e => setSrf(e.target.value as any)} className="w-full bg-slate-950 p-3 rounded-lg border border-slate-800 text-white text-sm"><option value="Track">Pista</option><option value="Grass">Césped</option><option value="Gym">Gimnasio</option><option value="Road">Asfalto</option></select></div> 
                <div><label className="text-xs font-bold text-slate-400 block mb-1">Notas</label><textarea value={nts} onChange={e => setNts(e.target.value)} className="w-full bg-slate-950 p-3 rounded-lg border border-slate-800 text-white text-sm h-20"/></div> 
                
                <button onClick={save} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-colors">Guardar Sesión</button> 
            </div> 
        </div> 
    );
  };

  // --- NEW: INJECT DRILLS LOGIC ---
  const handleInjectDrills = () => {
    if (!lastAnalysis || !currentPlan) return;
    const drills = lastAnalysis.correctiveDrills;
    if (drills.length === 0) return;

    if (window.confirm(`Se detectaron errores (${lastAnalysis.criticalErrors.join(', ')}). ¿Quieres actualizar las rutinas de pista con los drills correctivos recomendados?`)) {
        // Find upcoming sessions (not completed)
        const updatedSessions = currentPlan.sessions.map(s => {
            if (!s.feedback?.completed) {
                // Prepend corrective drills to track routine
                const newRoutine = [...drills, ...s.trackRoutine.filter(d => !drills.includes(d))];
                return { ...s, trackRoutine: newRoutine };
            }
            return s;
        });
        const newPlan = { ...currentPlan, sessions: updatedSessions };
        setPlan(newPlan);
        alert("Plan actualizado con éxito. Revisa tus próximas sesiones.");
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

  // ... (Profile Config Render - Same as before but checking logic) ...
  if (showProfileConfig) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500 pb-10">
        <h2 className="text-2xl font-bold mb-4">Perfil Holístico</h2>
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-6">
          {/* IDENTIDAD */}
          <section className="space-y-4">
             <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-2"><UserCog size={14}/> Identidad Atlética</h3>
             <div><label className="text-xs text-slate-400 block mb-1">Nombre</label><input type="text" value={tempProfile.name} onChange={e => setTempProfile({...tempProfile, name: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white" /></div>
             <div className="grid grid-cols-2 gap-3">
                 <div><label className="text-xs text-slate-400 block mb-1">Edad</label><input type="number" value={tempProfile.age} onChange={e => setTempProfile({...tempProfile, age: parseInt(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white" /></div>
                 <div><label className="text-xs text-slate-400 block mb-1">Años Exp.</label><input type="number" value={tempProfile.yearsExperience} onChange={e => setTempProfile({...tempProfile, yearsExperience: parseInt(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white" /></div>
                 <div><label className="text-xs text-slate-400 block mb-1">Peso (kg)</label><input type="number" value={tempProfile.weight || ''} onChange={e => setTempProfile({...tempProfile, weight: parseInt(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white" /></div>
                 <div><label className="text-xs text-slate-400 block mb-1">Altura (cm)</label><input type="number" value={tempProfile.height || ''} onChange={e => setTempProfile({...tempProfile, height: parseInt(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white" /></div>
             </div>
             <div><label className="text-xs text-slate-400 block mb-1">Nivel</label><select value={tempProfile.experienceLevel} onChange={e => setTempProfile({...tempProfile, experienceLevel: e.target.value as any})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white"><option value="Beginner">Principiante</option><option value="Intermediate">Intermedio</option><option value="Advanced">Avanzado</option><option value="Elite">Élite</option></select></div>
          </section>

          {/* Biometría Cardíaca */}
          <section className="space-y-4 pt-4 border-t border-slate-800">
             <h3 className="text-sm font-bold text-pink-400 uppercase tracking-wider flex items-center gap-2"><HeartPulse size={14}/> Biometría</h3>
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

          {/* Pruebas */}
          <section className="space-y-4 pt-4 border-t border-slate-800">
              <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2"><Target size={14}/> Pruebas</h3>
              <div className="flex gap-2">
                  {['100m', '200m', '400m'].map(e => (
                      <button key={e} onClick={() => toggleEventSelection(e)} className={`flex-1 py-2 rounded-lg border text-xs font-bold ${tempProfile.events.includes(e) ? 'bg-cyan-600 border-cyan-500 text-white' : 'bg-slate-950 border-slate-700 text-slate-500'}`}>{e}</button>
                  ))}
              </div>
          </section>

          <button onClick={handleSaveProfile} className="w-full bg-cyan-600 text-white font-bold py-4 rounded-xl mt-4 shadow-lg shadow-cyan-900/20">Guardar Perfil Completo</button>
        </div>

        {activeTooltip && (
            <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm" onClick={() => setActiveTooltip(null)}>
                <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
                    <h4 className="font-bold text-white mb-2">{activeTooltip.title}</h4>
                    <p className="text-sm text-slate-300 leading-relaxed">{activeTooltip.text}</p>
                    <button onClick={() => setActiveTooltip(null)} className="mt-4 w-full bg-slate-800 text-slate-300 py-2 rounded-lg text-sm font-bold">Entendido</button>
                </div>
            </div>
        )}
      </div>
    );
  }

  // ... (Main Render) ...
  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-16">
      <div className="flex justify-between items-end border-b border-slate-800/50 pb-4">
        <div><h2 className="text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-100 to-slate-400">Microciclo</h2><p className="text-slate-500 text-sm font-medium mt-1">Nivel V World Athletics</p></div>
        <div className="flex gap-2"><button onClick={() => setShowProfileConfig(true)} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full text-slate-300"><UserCog size={18} /></button></div>
      </div>

      {!currentPlan ? (
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="text-center"><h3 className="text-lg font-bold text-white">Biomarcadores Diarios</h3><p className="text-slate-400 text-xs mt-1">El Consejo de Expertos analizará tu estado.</p></div>
          {acwr && ( <div className="space-y-2"> <div className="flex justify-between text-xs text-slate-400 uppercase font-bold tracking-wider items-center"> <span>ACWR <InfoButton title="ACWR" text="Acute:Chronic Workload Ratio." onClick={showTooltip}/></span> <span>{acwr.ratio}</span> </div> <div className="h-4 bg-slate-800 rounded-full overflow-hidden relative"> <div className={`h-full transition-all duration-500 ${acwr.status === 'High Risk' ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(acwr.ratio * 50, 100)}%` }} /> </div> </div> )}
          
          <div className="space-y-4 max-w-sm mx-auto pt-4 border-t border-slate-800">
            {/* UPDATED BIOMARKERS */}
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
                        <button onClick={sharePlan} className="bg-slate-700/50 hover:bg-slate-600 text-xs px-3 py-1.5 rounded-full flex items-center gap-1 border border-slate-600"><Share size={12} className="text-emerald-400"/></button>
                    </div>
                </div>
               <div className="flex items-center gap-2 mb-2"><Target size={18} className="text-emerald-400" /><h3 className="text-xl font-bold text-white">Objetivo Semanal</h3></div>
               <p className="text-sm text-slate-300 leading-relaxed max-w-lg mb-3 pl-7">{currentPlan.weeklyGoal}</p>
               
               {/* NEW: DRILL INJECTION BUTTON */}
               {lastAnalysis && lastAnalysis.criticalErrors.length > 0 && (
                   <button onClick={handleInjectDrills} className="mt-3 bg-red-900/30 border border-red-500/30 hover:bg-red-900/50 text-red-300 px-4 py-2 rounded-lg flex items-center gap-2 text-xs font-bold transition-all w-full justify-center">
                       <Wrench size={14}/> Inyectar Drills Correctivos ({lastAnalysis.criticalErrors.length} errores)
                   </button>
               )}

               <button onClick={() => { if(window.confirm("¿Descartar?")) setPlan(null as any); }} className="mt-4 text-xs text-slate-500 underline decoration-slate-700 hover:text-red-400 block mx-auto">Reiniciar Ciclo</button>
             </div>
           </div>
           <div className="space-y-3 pb-8">{currentPlan.sessions.map((session: TrainingSession, idx: number) => (<SessionCard key={idx} session={session} expandedDay={expandedDay} setExpandedDay={setExpandedDay} setSessionFeedbackModal={setSessionFeedbackModal} />))}</div>
        </div>
      )}
      
      {showMacroModal && currentPlan?.rationale && ( <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowMacroModal(false)}> <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm"> <h3 className="text-xl font-bold text-white mb-4">Estrategia Técnica</h3> <p className="text-slate-300 text-sm leading-relaxed">{currentPlan.rationale}</p> </div> </div> )}
      {sessionFeedbackModal && <FeedbackModal />}
      {activeTooltip && ( <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm" onClick={() => setActiveTooltip(null)}> <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}> <h4 className="font-bold text-white mb-2">{activeTooltip.title}</h4> <p className="text-sm text-slate-300 leading-relaxed">{activeTooltip.text}</p> <button onClick={() => setActiveTooltip(null)} className="mt-4 w-full bg-slate-800 text-slate-300 py-2 rounded-lg text-sm font-bold">Entendido</button> </div> </div> )}
    </div>
  );
};
