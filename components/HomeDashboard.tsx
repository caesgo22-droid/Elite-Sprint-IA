
import * as React from 'react';
import { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { BrainCircuit, Activity, RefreshCw, Key, ShieldCheck, ArrowRight, CalendarCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { generateNexusInsight } from '../services/geminiService';
import { AthletePassport } from './AthletePassport';

const getAIStudio = () => (window as any).aistudio;

export const HomeDashboard: React.FC = () => {
  const { userProfile, currentPlan, logs, lastAnalysis, acwrStats, nexusInsight, setNexusInsight, t } = useApp();
  const navigate = useNavigate();
  
  const [loadingNexus, setLoadingNexus] = useState(false);
  const [errorStatus, setErrorStatus] = useState<'none' | 'key_missing' | 'error'>('none');
  const [readiness] = useState({ fatigue: 5, sleep: 7, soreness: 3, stress: 4 });

  const fetchNexus = async (force: boolean = false) => {
      if (nexusInsight && !force) return;
      if (logs.length > 2 || lastAnalysis) {
          setLoadingNexus(true);
          setErrorStatus('none');
          try {
              const insight = await generateNexusInsight(logs, readiness, lastAnalysis, acwrStats);
              if (insight) setNexusInsight(insight);
          } catch (error: any) {
              console.error("Nexus Failed:", error);
              if (error.message === "KEY_REQUIRED") {
                  setErrorStatus('key_missing');
                  const aistudio = getAIStudio();
                  if (aistudio) aistudio.openSelectKey();
              } else {
                  setErrorStatus('error');
              }
          } finally {
              setLoadingNexus(false);
          }
      }
  };

  useEffect(() => {
      fetchNexus();
  }, [logs.length, lastAnalysis, acwrStats?.ratio]);

  const handleOpenKey = async () => {
      const aistudio = getAIStudio();
      if (aistudio) {
          await aistudio.openSelectKey();
          setErrorStatus('none');
          fetchNexus(true);
      }
  };

  const todaysSession = (() => {
      if (!currentPlan) return null;
      const days = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
      const todayIndex = new Date().getDay();
      const targetSpanish = days[todayIndex].toLowerCase(); 
      return currentPlan.sessions.find(s => s.day.toLowerCase().includes(targetSpanish.slice(0,3)));
  })();

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      <div className="mb-8"><AthletePassport /></div>

      {/* Nexus Elite Card - Pro Tier */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 p-2">
              <div className="flex items-center gap-1 bg-purple-500/10 border border-purple-500/30 px-2 py-0.5 rounded-full">
                  <span className="flex h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse"></span>
                  <span className="text-[8px] font-black text-purple-400 uppercase tracking-widest">Motor Pro Deep Thinking</span>
              </div>
          </div>

          <div className="flex justify-between items-start mb-3 relative z-10">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <BrainCircuit className="text-purple-400" /> Nexus Elite
                </h2>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Análisis Multimodal World Athletics</p>
              </div>
              <button 
                onClick={() => fetchNexus(true)}
                disabled={loadingNexus}
                className="p-2 bg-slate-800 border border-slate-700 rounded-full text-slate-400 hover:text-purple-400 transition-all group"
              >
                <RefreshCw size={14} className={loadingNexus ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'} />
              </button>
          </div>
          
          {errorStatus === 'key_missing' ? (
              <div className="py-6 text-center space-y-3 bg-red-950/10 rounded-xl border border-red-900/20">
                  <div className="w-12 h-12 bg-red-900/20 border border-red-500/30 rounded-full flex items-center justify-center mx-auto text-red-500">
                      <Key size={20}/>
                  </div>
                  <div className="px-4 text-center">
                      <p className="text-xs text-slate-200 font-bold">Validación de Pago Fallida</p>
                      <p className="text-[10px] text-slate-500 mt-1">Tu proyecto está en nivel de pago pero la llave no ha sido seleccionada en esta sesión.</p>
                  </div>
                  <button onClick={handleOpenKey} className="bg-white text-slate-900 text-[10px] font-black px-6 py-2 rounded-lg transition-colors hover:bg-slate-200 shadow-lg uppercase tracking-tighter">
                      Vincular Llave de Pago Ahora
                  </button>
              </div>
          ) : loadingNexus ? (
              <div className="h-32 flex flex-col items-center justify-center gap-3">
                <Activity className="animate-pulse text-purple-500" size={32} />
                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest animate-pulse text-center">
                    Razonamiento Profundo (Thinking: 32K)...<br/>
                    <span className="font-normal text-slate-600 mt-1 block italic">(Correlacionando Biomecánica y Fisiología)</span>
                </p>
              </div>
          ) : nexusInsight ? (
              <div className="relative z-10 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter ${nexusInsight.status === 'Peak' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' : 'bg-blue-500/20 text-blue-400 border border-blue-500/50'}`}>
                        {nexusInsight.status}
                    </span>
                    <div className="h-px bg-slate-800 flex-1"></div>
                  </div>
                  <h3 className="text-lg font-black text-white leading-tight">"{nexusInsight.headline}"</h3>
                  <p className="text-sm text-slate-400 leading-relaxed border-l-2 border-purple-500 pl-3">{nexusInsight.analysis}</p>
                  <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 flex gap-3 items-start">
                    <ShieldCheck size={16} className="text-purple-400 shrink-0 mt-0.5"/>
                    <p className="text-xs text-purple-200 font-medium italic">{nexusInsight.recommendation}</p>
                  </div>
              </div>
          ) : (
              <div className="text-xs text-slate-500 text-center py-8 bg-slate-950/50 rounded-xl border border-dashed border-slate-800">
                Registra actividad para activar la auditoría Pro de 32k tokens.
              </div>
          )}
      </div>

      {/* Sesión de Hoy */}
      <div className="bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden flex flex-col">
        <div className="bg-slate-800/50 p-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <CalendarCheck size={18} className="text-cyan-400" />
            <h3 className="font-bold text-lg">Sesión Programada</h3>
          </div>
          {todaysSession && <span className="px-2 py-1 bg-cyan-900/30 text-cyan-400 rounded text-[10px] font-bold border border-cyan-500/30 uppercase">{todaysSession.intensity}</span>}
        </div>
        <div className="p-5">
          {todaysSession ? (
            <div className="space-y-4">
              <div>
                <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest block mb-1">Enfoque Técnico</span>
                <p className="text-xl font-black text-white">{todaysSession.focus}</p>
              </div>
              <ul className="space-y-2">
                {todaysSession.trackRoutine.slice(0,3).map((drill, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-slate-300">
                    <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full"></div>
                    {drill}
                  </li>
                ))}
              </ul>
              <button onClick={() => navigate('/plan')} className="w-full mt-4 bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 border border-slate-700">
                Ver Detalles <ArrowRight size={16}/>
              </button>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-slate-500 text-sm mb-4">No hay entrenamiento hoy.</p>
              <button onClick={() => navigate('/plan')} className="bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-2 rounded-xl text-xs font-bold transition-all">Generar Plan</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
