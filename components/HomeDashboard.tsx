

import * as React from 'react';
import { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { Zap, TrendingUp, CalendarCheck, CheckSquare, X, BatteryCharging, ArrowRight, BrainCircuit, Sparkles, Activity, Clock, MapPin, Info, MessageCircle, HeartPulse, Stethoscope, AlertTriangle, UserCog, Calendar, Save, ChevronLeft, ScanLine } from 'lucide-react';
import { useHistory } from 'react-router-dom';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { calculateRecovery } from '../utils/recoveryEngine';
import { generateNexusInsight } from '../services/geminiService';
import { NexusInsight } from '../types';
import { AthletePassport } from './AthletePassport';

export const HomeDashboard: React.FC = () => {
  const { userProfile, currentPlan, logs, updateSession, lastAnalysis, acwrStats, nexusInsight, setNexusInsight, addLog, t, language } = useApp();
  const history = useHistory();
  
  const [showFeedbackModal, setShowFeedbackModal] = useState<any>(null);
  const [showSundayPrompt, setShowSundayPrompt] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState<{title: string, text: string} | null>(null);
  const [recoveryPlan, setRecoveryPlan] = useState<any>(null);
  
  // Therapy Modal State
  const [showTherapyModal, setShowTherapyModal] = useState(false);
  const [therapyStep, setTherapyStep] = useState<'select' | 'details'>('select');
  const [selectedTherapy, setSelectedTherapy] = useState('');
  const [therapyDate, setTherapyDate] = useState(new Date().toISOString().split('T')[0]);
  const [therapyNote, setTherapyNote] = useState('');
  
  // Nexus Local Loading State
  const [loadingNexus, setLoadingNexus] = useState(false);

  // Biomarkers State
  const [readiness, setReadiness] = useState({ fatigue: 5, sleep: 7, soreness: 3, stress: 4 });

  useEffect(() => {
    const today = new Date();
    if (today.getDay() === 0) setShowSundayPrompt(true);
  }, []);

  // Generate Nexus Insight
  useEffect(() => {
      const fetchNexus = async () => {
          if (nexusInsight) return;

          if (logs.length > 0 || lastAnalysis || acwrStats) {
              setLoadingNexus(true);
              const insight = await generateNexusInsight(logs, readiness, lastAnalysis, acwrStats, language); // Pass language
              if (insight) setNexusInsight(insight);
              setLoadingNexus(false);
          }
      };
      fetchNexus();
  }, [logs.length, lastAnalysis, acwrStats?.ratio, nexusInsight, language]); // Re-run if language changes

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

  const [rpe, setRpe] = useState(5);
  const [painLevel, setPainLevel] = useState(0); 
  const [duration, setDuration] = useState(60); 
  const [surface, setSurface] = useState('Track');
  const [fbNotes, setFbNotes] = useState("");

  const submitFeedback = () => {
    if(!showFeedbackModal) return;
    updateSession(showFeedbackModal.day, {
        feedback: { completed: true, rpe, painLevel, duration, surface: surface as any, notes: fbNotes, timestamp: new Date().toISOString() }
    });
    const weight = (userProfile.weight && userProfile.weight > 0) ? userProfile.weight : 70; 
    const rec = calculateRecovery(showFeedbackModal.intensity, duration, weight, rpe);
    setRecoveryPlan(rec);
    setShowFeedbackModal(null);
    setFbNotes(""); setRpe(5); setPainLevel(0); setDuration(60);
  };

  const handleShowRecovery = () => {
      if (!todaysSession || !todaysSession.feedback) return;
      const weight = (userProfile.weight && userProfile.weight > 0) ? userProfile.weight : 70;
      const rec = calculateRecovery(todaysSession.intensity, todaysSession.feedback.duration || 60, weight, todaysSession.feedback.rpe || 5);
      setRecoveryPlan(rec);
  };

  const shareDailySession = () => {
      if(!todaysSession) return;
      const text = `*ELITE SPRINT AI - Sesión de Hoy (${dayNameES})*\n\n*Enfoque:* ${todaysSession.focus}\n*Rutina:* ${todaysSession.trackRoutine.join(', ')}\n*Intensidad:* ${todaysSession.intensity}`;
      const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
  };

  // --- THERAPY FLOW ---
  const handleSelectTherapy = (type: string) => {
      setSelectedTherapy(type);
      setTherapyStep('details');
  };

  const handleSaveTherapy = () => {
      // 1. Log the event
      addLog({
          id: Date.now().toString(),
          date: therapyDate,
          event: 'Therapy',
          type: 'Recovery',
          location: 'Clínica / Casa',
          time: 0,
          notes: `${selectedTherapy}: ${therapyNote}`
      });

      // 2. Reduce Readiness Stress/Soreness (Simulated impact)
      setReadiness(prev => ({
          ...prev,
          soreness: Math.max(1, prev.soreness - 2),
          fatigue: Math.max(1, prev.fatigue - 1)
      }));

      // Reset & Close
      setShowTherapyModal(false);
      setTherapyStep('select');
      setTherapyNote('');
      setTherapyDate(new Date().toISOString().split('T')[0]);
      alert("✅ Sesión registrada en el historial. ACWR ajustado.");
  };

  const InfoButton = ({ title, text }: { title: string, text: string }) => (
      <button 
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActiveTooltip({ title, text }); }} 
        className="text-cyan-400 hover:text-cyan-300 ml-2 inline-flex items-center justify-center bg-slate-800 rounded-full w-4 h-4"
      >
          <Info size={10} />
      </button>
  );

  const getNexusStatusES = (status: string) => {
      switch(status) {
          case 'Peak': return 'Pico de Forma';
          case 'Warning': return 'Alerta';
          case 'Recovery': return 'Recuperación';
          case 'Neutral': return 'Neutral';
          default: return status;
      }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      
      {/* PASSPORT (NEW) */}
      <div className="mb-8">
          <AthletePassport />
      </div>

      {/* HEADER: ELITE NEXUS */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden shadow-2xl">
          <div className="flex justify-between items-start mb-3 relative z-10">
              <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <BrainCircuit className="text-purple-400" /> Nexus Elite
                  </h2>
                  <p className="text-xs text-slate-400">{t.dashboard.nexusTitle}</p>
              </div>
              {nexusInsight && (
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      nexusInsight.status === 'Peak' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' :
                      nexusInsight.status === 'Warning' ? 'bg-red-500/20 text-red-400 border border-red-500/50' :
                      nexusInsight.status === 'Recovery' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50' :
                      'bg-slate-700 text-slate-300'
                  }`}>
                      {getNexusStatusES(nexusInsight.status)}
                  </span>
              )}
          </div>
          
          {loadingNexus ? (
              <div className="h-20 flex items-center justify-center text-slate-500 text-xs animate-pulse">
                  {t.dashboard.nexusLoading}
              </div>
          ) : nexusInsight ? (
              <div className="relative z-10 space-y-2">
                  <h3 className="text-lg font-bold text-slate-200 leading-tight">"{nexusInsight.headline}"</h3>
                  <p className="text-sm text-slate-400 leading-relaxed border-l-2 border-purple-500 pl-3">{nexusInsight.analysis}</p>
                  <div className="mt-3 bg-purple-900/20 p-3 rounded-lg border border-purple-900/50 flex gap-3 items-start">
                      <Sparkles size={16} className="text-purple-400 shrink-0 mt-0.5"/>
                      <p className="text-xs text-purple-200 font-medium">{nexusInsight.recommendation}</p>
                  </div>
              </div>
          ) : (
              <div className="text-xs text-slate-500 text-center py-4">
                  Registra entrenamientos y videos para activar el Nexus.
              </div>
          )}
          
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-purple-600/10 rounded-full blur-3xl pointer-events-none"></div>
      </div>

      {showSundayPrompt && (
          <div className="bg-gradient-to-r from-cyan-900 to-blue-900 p-4 rounded-xl border border-cyan-500/30 flex items-center justify-between shadow-lg">
              <div><h3 className="text-white font-bold text-sm">{t.dashboard.sundayPrompt}</h3></div>
              <button onClick={() => history.push('/plan')} className="bg-white text-cyan-900 text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1">{t.dashboard.planBtn} <ArrowRight size={12}/></button>
          </div>
      )}

      {/* QUICK ACTIONS ROW */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          <button onClick={() => { setShowTherapyModal(true); setTherapyStep('select'); }} className="flex items-center gap-2 px-4 py-3 bg-slate-900/80 border border-slate-800 rounded-xl hover:bg-slate-800 transition-all shrink-0">
              <Stethoscope size={16} className="text-emerald-400" />
              <div className="text-left">
                  <div className="text-xs font-bold text-white">{t.dashboard.quickAction}</div>
                  <div className="text-[9px] text-emerald-400">{t.dashboard.quickActionSub}</div>
              </div>
          </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div onClick={() => history.push('/tracker')} className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800 flex flex-col justify-between relative overflow-hidden cursor-pointer hover:bg-slate-900/80 transition-colors">
          <div className="flex items-center gap-2 text-emerald-400 mb-2 z-10"><TrendingUp size={18} /><span className="text-xs font-semibold uppercase">{t.dashboard.progress}</span></div>
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
          <div className="flex items-center gap-2 text-cyan-400 mb-2"><Zap size={18} /><span className="text-xs font-semibold uppercase">{t.dashboard.phase}</span></div>
          <span className="text-lg font-bold leading-tight">{currentPlan?.phase || "Base"}</span>
        </div>
      </div>

      <div className="bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden flex flex-col max-h-[500px]">
        <div className="bg-slate-800/50 p-4 flex items-center justify-between border-b border-slate-800 shrink-0 sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <CalendarCheck size={18} className="text-cyan-400" />
            <h3 className="font-semibold text-lg">{t.dashboard.today}</h3>
          </div>
          <div className="flex gap-2">
             {todaysSession && (
                 <button onClick={shareDailySession} className="bg-emerald-600 text-white px-3 py-1.5 rounded-full flex items-center gap-1 shadow-lg shadow-emerald-900/20 hover:bg-emerald-500 transition-colors" title="Compartir Sesión">
                    <MessageCircle size={14}/> 
                 </button>
             )}
             {todaysSession && <span className={`px-2 py-1 rounded text-xs font-bold uppercase flex items-center ${todaysSession.intensity === 'Max' ? 'bg-red-500/20 text-red-400' : todaysSession.intensity === 'High' ? 'bg-orange-500/20 text-orange-400' : 'bg-green-500/20 text-green-400'}`}>{todaysSession.intensity}</span>}
          </div>
        </div>
        <div className="p-5 overflow-y-auto">
          {todaysSession ? (
            <div className="space-y-5">
              
              {/* COACH NOTE ALERT */}
              {todaysSession.coachNotes && (
                  <div className="bg-blue-900/20 border-l-4 border-blue-500 p-3 rounded-r-lg animate-in slide-in-from-left-2">
                      <h4 className="text-xs font-bold text-blue-400 uppercase flex items-center gap-1 mb-1"><UserCog size={12}/> Instrucción del Staff</h4>
                      <p className="text-sm text-white font-medium italic">"{todaysSession.coachNotes}"</p>
                  </div>
              )}

              <div><span className="text-slate-400 text-xs uppercase tracking-wider block mb-1">{t.dashboard.focus}</span><p className="text-xl font-medium text-white">{todaysSession.focus}</p></div>
              
              {/* KPI TÉCNICO DIARIO */}
              {todaysSession.biomechanicsKpi && (
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-start gap-2">
                      <ScanLine size={16} className="text-cyan-400 mt-0.5 shrink-0"/>
                      <div>
                          <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider block">{t.dashboard.bioFocus}</span>
                          <p className="text-sm text-white font-medium">"{todaysSession.biomechanicsKpi}"</p>
                      </div>
                  </div>
              )}

              <div><span className="text-slate-400 text-xs uppercase tracking-wider block mb-2 flex items-center gap-2"><Zap size={12} /> {t.dashboard.routine}</span><ul className="space-y-2">{todaysSession.trackRoutine.map((drill, idx) => (<li key={idx} className="flex items-start gap-2 text-sm text-slate-300"><span className="w-1.5 h-1.5 mt-1.5 rounded-full bg-cyan-500 shrink-0"></span>{drill}</li>))}</ul></div>
              <div className="pt-2 border-t border-slate-800 mt-2">
                 {todaysSession.feedback?.completed ? (
                     <div className="space-y-2">
                         <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold bg-emerald-900/20 p-2 rounded-lg justify-center"><CheckSquare size={16} /> {t.dashboard.sessionDone} ({todaysSession.feedback.rpe}/10)</div>
                         <button onClick={handleShowRecovery} className="w-full bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors"><BatteryCharging size={14}/> {t.dashboard.viewRecovery}</button>
                     </div>
                 ) : (
                     <button onClick={() => setShowFeedbackModal(todaysSession)} className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"><CheckSquare size={16} /> {t.dashboard.markDone}</button>
                 )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8"><p className="text-slate-400 mb-4">{t.dashboard.noSession}</p><button onClick={() => history.push('/plan')} className="bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-2 rounded-full text-sm font-semibold">{t.dashboard.genPlan}</button></div>
          )}
        </div>
      </div>

      {showTherapyModal && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm animate-in zoom-in-95">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-white flex items-center gap-2">
                          {therapyStep === 'details' && <button onClick={() => setTherapyStep('select')} className="text-slate-400 hover:text-white mr-1"><ChevronLeft size={18}/></button>}
                          <Stethoscope size={18} className="text-emerald-400"/> 
                          {therapyStep === 'select' ? 'Nueva Terapia' : 'Detalles Sesión'}
                      </h3>
                      <button onClick={() => setShowTherapyModal(false)}><X className="text-slate-400"/></button>
                  </div>
                  
                  {therapyStep === 'select' ? (
                      <>
                        <p className="text-xs text-slate-400 mb-4">Selecciona el tipo de recuperación para registrar en la bitácora.</p>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => handleSelectTherapy('Fisioterapia')} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-4 rounded-xl flex flex-col items-center gap-2 transition-colors group">
                                <HeartPulse size={24} className="text-red-400 group-hover:scale-110 transition-transform"/>
                                <span className="text-xs font-bold text-white">Fisioterapia</span>
                            </button>
                            <button onClick={() => handleSelectTherapy('Masaje')} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-4 rounded-xl flex flex-col items-center gap-2 transition-colors group">
                                <Activity size={24} className="text-cyan-400 group-hover:scale-110 transition-transform"/>
                                <span className="text-xs font-bold text-white">Masaje</span>
                            </button>
                            <button onClick={() => handleSelectTherapy('Crioterapia')} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-4 rounded-xl flex flex-col items-center gap-2 transition-colors group">
                                <div className="text-2xl group-hover:scale-110 transition-transform">❄️</div>
                                <span className="text-xs font-bold text-white">Hielo / Crio</span>
                            </button>
                            <button onClick={() => handleSelectTherapy('Descanso Activo')} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-4 rounded-xl flex flex-col items-center gap-2 transition-colors group">
                                <div className="text-2xl group-hover:scale-110 transition-transform">🧘</div>
                                <span className="text-xs font-bold text-white">Descanso Activo</span>
                            </button>
                        </div>
                      </>
                  ) : (
                      <div className="space-y-4 animate-in slide-in-from-right-4">
                          <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700 text-center">
                              <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">{selectedTherapy}</span>
                          </div>
                          
                          <div>
                              <label className="text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1"><Calendar size={12}/> Fecha</label>
                              <input type="date" value={therapyDate} onChange={e => setTherapyDate(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white text-sm outline-none focus:border-emerald-500"/>
                          </div>

                          <div>
                              <label className="text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1"><UserCog size={12}/> Nota Clínica / Detalles</label>
                              <textarea 
                                  value={therapyNote} 
                                  onChange={e => setTherapyNote(e.target.value)} 
                                  placeholder="Ej: Punción seca en isquios, descarga de gemelos..."
                                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white text-sm h-24 resize-none outline-none focus:border-emerald-500"
                              />
                          </div>

                          <button onClick={handleSaveTherapy} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20">
                              <Save size={16}/> Guardar Registro
                          </button>
                      </div>
                  )}
              </div>
          </div>
      )}

      {showFeedbackModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm">
                <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-white">Feedback Diario</h3><button onClick={() => setShowFeedbackModal(null)}><X className="text-slate-400"/></button></div>
                <div className="space-y-4">
                    <div>
                        <div className="flex justify-between text-xs text-slate-400 font-bold mb-1">
                            <span className="flex items-center">RPE <InfoButton title="RPE" text="1 (Muy Suave) - 10 (Fallo)."/></span>
                            <span className="text-cyan-400">{rpe}/10</span>
                        </div>
                        <input type="range" min="1" max="10" value={rpe} onChange={e => setRpe(parseInt(e.target.value))} className="w-full accent-cyan-500"/>
                        <div className="flex justify-between text-[10px] text-slate-500 font-bold uppercase"><span>Min (1)</span><span>Max (10)</span></div>
                    </div>
                    <div>
                        <div className="flex justify-between text-xs text-slate-400 font-bold mb-1">
                            <span className="flex items-center gap-1"><Activity size={12}/> Dolor</span>
                            <span className="text-red-400">{painLevel}/10</span>
                        </div>
                        <input type="range" min="0" max="10" value={painLevel} onChange={e => setPainLevel(parseInt(e.target.value))} className="w-full accent-red-500"/>
                        <div className="flex justify-between text-[10px] text-slate-500 font-bold uppercase"><span>Nada (0)</span><span>Extremo (10)</span></div>
                    </div>
                    <div><label className="text-xs text-slate-400 font-bold mb-1 flex items-center gap-1"><Clock size={12}/> Duración (Minutos)</label><input type="number" value={duration} onChange={e => setDuration(parseInt(e.target.value))} className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-sm text-white"/></div>
                    <div><label className="text-xs text-slate-400 font-bold mb-1 flex items-center gap-1"><MapPin size={12}/> Superficie</label><select value={surface} onChange={e => setSurface(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-sm text-white"><option value="Track">Pista</option><option value="Grass">Césped</option><option value="Road">Asfalto</option></select></div>
                    <button onClick={submitFeedback} className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl shadow-lg">Guardar y Calcular Recuperación</button>
                </div>
            </div>
        </div>
      )}

      {recoveryPlan && (
          <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4 backdrop-blur-md animate-in zoom-in-95 duration-300">
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
                      </div>
                      <div>
                          <div className="text-xs text-slate-500 font-bold uppercase mb-2">Acciones de Recuperación</div>
                          <ul className="space-y-2">{recoveryPlan.protocols.map((p: string, i: number) => (<li key={i} className="flex items-center gap-2 text-sm text-slate-300 bg-slate-800/50 p-2 rounded-lg"><CheckSquare size={14} className="text-cyan-500"/> {p}</li>))}</ul>
                      </div>
                  </div>
                  <button onClick={() => setRecoveryPlan(null)} className="w-full mt-6 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-colors">Entendido</button>
              </div>
          </div>
      )}

      {activeTooltip && ( <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm" onClick={() => setActiveTooltip(null)}> <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}> <h4 className="font-bold text-white mb-2">{activeTooltip.title}</h4> <p className="text-sm text-slate-300 leading-relaxed">{activeTooltip.text}</p> <button onClick={() => setActiveTooltip(null)} className="mt-4 w-full bg-slate-800 text-slate-300 py-2 rounded-lg text-sm font-bold">Entendido</button> </div> </div> )}
    </div>
  );
};