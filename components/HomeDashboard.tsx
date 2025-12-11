import * as React from 'react';
import { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { Zap, TrendingUp, CalendarCheck, Trophy, Flag, Plus, Trash2, X, CheckSquare, Dumbbell, Play, ArrowRight, Clock, MapPin, Activity, Info, BatteryCharging } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { calculateRecovery } from '../utils/recoveryEngine'; // IMPORT CRÍTICO

export const HomeDashboard: React.FC = () => {
  const { userProfile, updateCompetitions, currentPlan, logs, updateSession } = useApp();
  const navigate = useNavigate();
  // ... existing state ...
  const [showCompModal, setShowCompModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState<any>(null);
  const [showSundayPrompt, setShowSundayPrompt] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState<{title: string, text: string} | null>(null);
  
  // NEW: Recovery Modal State
  const [recoveryPlan, setRecoveryPlan] = useState<any>(null);

  useEffect(() => {
    const today = new Date();
    if (today.getDay() === 0) setShowSundayPrompt(true);
  }, []);

  // FIX: ROBUST DAY MATCHING LOGIC
  const getTodaySession = () => {
      if (!currentPlan) return null;
      const days = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
      const englishDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const todayIndex = new Date().getDay();
      
      const targetSpanish = days[todayIndex].toLowerCase(); 
      const targetEnglish = englishDays[todayIndex].toLowerCase(); 

      return currentPlan.sessions.find(s => {
          const sDay = s.day.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          return sDay.includes(targetSpanish) || sDay.includes(targetEnglish) || sDay.includes(targetSpanish.slice(0,3));
      });
  };

  const todaysSession = getTodaySession();
  const dayNameES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][new Date().getDay()];

  const chartData = logs.slice(-20).map(l => ({
      date: l.date.substring(5),
      t100: l.event === '100m' ? l.time : null,
      t200: l.event === '200m' ? l.time : null,
      t400: l.event === '400m' ? l.time : null,
  }));

  // Feedback State
  const [rpe, setRpe] = useState(5);
  const [painLevel, setPainLevel] = useState(0); 
  const [duration, setDuration] = useState(60); 
  const [surface, setSurface] = useState('Track');
  const [fbNotes, setFbNotes] = useState("");

  const submitFeedback = () => {
    if(!showFeedbackModal) return;
    
    // 1. Save Session
    updateSession(showFeedbackModal.day, {
        feedback: { completed: true, rpe, painLevel, duration, surface: surface as any, notes: fbNotes, timestamp: new Date().toISOString() }
    });

    // 2. Generate Recovery Plan
    const rec = calculateRecovery(showFeedbackModal.intensity, duration, userProfile.weight || 70, rpe);
    setRecoveryPlan(rec);

    setShowFeedbackModal(null);
    setFbNotes(""); setRpe(5); setPainLevel(0); setDuration(60);
  };

  const InfoButton = ({ title, text }: { title: string, text: string }) => (
      <button onClick={(e) => { e.stopPropagation(); setActiveTooltip({ title, text }); }} className="text-slate-500 hover:text-cyan-400 ml-1 inline-flex p-1"><Info size={14} /></button>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      
      {/* ... Sunday Prompt & Header ... */}
      {showSundayPrompt && (
          <div className="bg-gradient-to-r from-cyan-900 to-blue-900 p-4 rounded-xl border border-cyan-500/30 flex items-center justify-between shadow-lg">
              <div><h3 className="text-white font-bold text-sm">¡Es Domingo!</h3><p className="text-cyan-200 text-xs">Hora de planificar la semana.</p></div>
              <button onClick={() => navigate('/plan')} className="bg-white text-cyan-900 text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1">Planificar <ArrowRight size={12}/></button>
          </div>
      )}

      <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
        <h2 className="text-2xl font-bold mb-2">Hola, {userProfile.name}</h2>
        <p className="text-slate-400 italic text-sm border-l-2 border-cyan-500 pl-3">"Entrena inteligente, corre rápido."</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div onClick={() => navigate('/tracker')} className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800 flex flex-col justify-between relative overflow-hidden cursor-pointer hover:bg-slate-900/80 transition-colors">
          <div className="flex items-center gap-2 text-emerald-400 mb-2 z-10"><TrendingUp size={18} /><span className="text-xs font-semibold uppercase">Progreso</span></div>
          <div className="absolute bottom-2 left-0 right-0 h-12 px-2">
             {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                        <Line type="monotone" dataKey="t100" stroke="#22d3ee" strokeWidth={2} dot={false} connectNulls />
                        <Line type="monotone" dataKey="t200" stroke="#10b981" strokeWidth={2} dot={false} connectNulls />
                        <Line type="monotone" dataKey="t400" stroke="#f59e0b" strokeWidth={2} dot={false} connectNulls />
                    </LineChart>
                </ResponsiveContainer>
             ) : <span className="text-xs text-slate-500 pl-2">Sin datos</span>}
          </div>
        </div>
        <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center gap-2 text-cyan-400 mb-2"><Zap size={18} /><span className="text-xs font-semibold uppercase">Fase</span></div>
          <span className="text-lg font-bold leading-tight">{currentPlan?.phase || "Base"}</span>
        </div>
      </div>

      {/* Plan Card (Today) */}
      <div className="bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden flex flex-col max-h-[500px]">
        <div className="bg-slate-800/50 p-4 flex items-center justify-between border-b border-slate-800 shrink-0 sticky top-0 z-10">
          <div className="flex items-center gap-2"><CalendarCheck size={18} className="text-cyan-400" /><h3 className="font-semibold text-lg">Hoy ({dayNameES})</h3></div>
          {todaysSession && <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${todaysSession.intensity === 'Max' ? 'bg-red-500/20 text-red-400' : todaysSession.intensity === 'High' ? 'bg-orange-500/20 text-orange-400' : 'bg-green-500/20 text-green-400'}`}>{todaysSession.intensity}</span>}
        </div>
        <div className="p-5 overflow-y-auto">
          {todaysSession ? (
            <div className="space-y-5">
              <div><span className="text-slate-400 text-xs uppercase tracking-wider block mb-1">Enfoque Principal</span><p className="text-xl font-medium text-white">{todaysSession.focus}</p></div>
              <div><span className="text-slate-400 text-xs uppercase tracking-wider block mb-2 flex items-center gap-2"><Zap size={12} /> Rutina de Pista</span><ul className="space-y-2">{todaysSession.trackRoutine.map((drill, idx) => (<li key={idx} className="flex items-start gap-2 text-sm text-slate-300"><span className="w-1.5 h-1.5 mt-1.5 rounded-full bg-cyan-500 shrink-0"></span>{drill}</li>))}</ul></div>
              <div className="pt-2 border-t border-slate-800 mt-2">
                 {todaysSession.feedback?.completed ? (
                     <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold bg-emerald-900/20 p-2 rounded-lg justify-center"><CheckSquare size={16} /> Sesión Completada ({todaysSession.feedback.rpe}/10)</div>
                 ) : (
                     <button onClick={() => setShowFeedbackModal(todaysSession)} className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"><CheckSquare size={16} /> Marcar Completada</button>
                 )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8"><p className="text-slate-400 mb-4">No hay sesión asignada para hoy.</p><button onClick={() => navigate('/plan')} className="bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-2 rounded-full text-sm font-semibold">Generar Plan</button></div>
          )}
        </div>
      </div>

      {showFeedbackModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm">
                <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-white">Feedback Diario</h3><button onClick={() => setShowFeedbackModal(null)}><X className="text-slate-400"/></button></div>
                <div className="space-y-4">
                    <div>
                        <div className="flex justify-between text-xs text-slate-400 font-bold mb-1">
                            <span className="flex items-center">RPE <InfoButton title="RPE (Esfuerzo)" text="1=Muy suave (Caminar). 5=Moderado. 10=Esfuerzo Máximo/Fallo."/></span><span className="text-cyan-400">{rpe}/10</span>
                        </div>
                        <input type="range" min="1" max="10" value={rpe} onChange={e => setRpe(parseInt(e.target.value))} className="w-full accent-cyan-500"/>
                        <div className="flex justify-between text-[10px] text-slate-500"><span>1 (Suave)</span><span>10 (Máximo)</span></div>
                    </div>
                    <div>
                        <div className="flex justify-between text-xs text-slate-400 font-bold mb-1">
                            <span className="flex items-center gap-1"><Activity size={12}/> Dolor <InfoButton title="Nivel de Dolor" text="0=Sin dolor. 3=Molestia leve. 10=Incapacitante."/></span><span className="text-red-400">{painLevel}/10</span>
                        </div>
                        <input type="range" min="0" max="10" value={painLevel} onChange={e => setPainLevel(parseInt(e.target.value))} className="w-full accent-red-500"/>
                        <div className="flex justify-between text-[10px] text-slate-500"><span>0 (Nada)</span><span>10 (Extremo)</span></div>
                    </div>
                    <div><label className="text-xs text-slate-400 font-bold mb-1 flex items-center gap-1"><Clock size={12}/> Duración (Minutos)</label><input type="number" value={duration} onChange={e => setDuration(parseInt(e.target.value))} className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-sm text-white"/></div>
                    <div><label className="text-xs text-slate-400 font-bold mb-1 flex items-center gap-1"><MapPin size={12}/> Superficie</label><select value={surface} onChange={e => setSurface(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-sm text-white"><option value="Track">Pista</option><option value="Grass">Césped</option><option value="Road">Asfalto</option></select></div>
                    <button onClick={submitFeedback} className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl shadow-lg">Guardar Sesión</button>
                </div>
            </div>
        </div>
      )}

      {/* NEW: RECOVERY HUB MODAL */}
      {recoveryPlan && (
          <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 backdrop-blur-md animate-in zoom-in-95 duration-300">
              <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-6 w-full max-w-sm shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-cyan-500"></div>
                  <div className="flex justify-between items-start mb-4">
                      <div><h3 className="font-bold text-xl text-white flex items-center gap-2"><BatteryCharging className="text-emerald-400"/> Fuel & Recovery</h3><p className="text-xs text-slate-400 uppercase tracking-widest mt-1">Protocolo Post-Entreno</p></div>
                      <button onClick={() => setRecoveryPlan(null)}><X className="text-slate-400 hover:text-white"/></button>
                  </div>
                  
                  <div className="space-y-4">
                      <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                          <div className="text-xs text-slate-500 font-bold uppercase mb-2">Nutrición Inmediata</div>
                          <div className="grid grid-cols-3 gap-2 text-center">
                              <div className="bg-slate-900 p-2 rounded-lg border border-slate-800"><div className="text-lg font-bold text-white">{recoveryPlan.nutrition.carbs}</div><div className="text-[10px] text-slate-400">Carbs</div></div>
                              <div className="bg-slate-900 p-2 rounded-lg border border-slate-800"><div className="text-lg font-bold text-white">{recoveryPlan.nutrition.protein}</div><div className="text-[10px] text-slate-400">Proteína</div></div>
                              <div className="bg-slate-900 p-2 rounded-lg border border-slate-800"><div className="text-lg font-bold text-white">{recoveryPlan.nutrition.hydration}</div><div className="text-[10px] text-slate-400">Agua</div></div>
                          </div>
                          <p className="text-[10px] text-emerald-400 mt-2 italic">"{recoveryPlan.nutrition.notes}"</p>
                      </div>

                      <div>
                          <div className="text-xs text-slate-500 font-bold uppercase mb-2">Acciones de Recuperación</div>
                          <ul className="space-y-2">
                              {recoveryPlan.protocols.map((p: string, i: number) => (
                                  <li key={i} className="flex items-center gap-2 text-sm text-slate-300 bg-slate-800/50 p-2 rounded-lg"><CheckSquare size={14} className="text-cyan-500"/> {p}</li>
                              ))}
                          </ul>
                      </div>
                  </div>
                  <button onClick={() => setRecoveryPlan(null)} className="w-full mt-6 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-colors">Entendido</button>
              </div>
          </div>
      )}

      {/* Tooltip Modal */}
      {activeTooltip && (
            <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm" onClick={() => setActiveTooltip(null)}>
                <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
                    <h4 className="font-bold text-white mb-2">{activeTooltip.title}</h4>
                    <p className="text-sm text-slate-300 leading-relaxed">{activeTooltip.text}</p>
                    <button onClick={() => setActiveTooltip(null)} className="mt-4 w-full bg-slate-800 text-slate-300 py-2 rounded-lg text-sm font-bold">Entendido</button>
                </div>
            </div>
      )}
    </div>
  );
};