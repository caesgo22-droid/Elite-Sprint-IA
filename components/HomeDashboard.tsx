import * as React from 'react';
import { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { BrainCircuit, Activity, RefreshCw, Key, ShieldCheck, ArrowRight, CalendarCheck, AlertTriangle, Zap, Stethoscope, Plus, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { generateNexusInsight } from '../services/geminiService';
import { AthletePassport } from './AthletePassport';

const getAIStudio = () => (window as any).aistudio;

export const HomeDashboard: React.FC = () => {
  const { userProfile, currentPlan, logs, lastAnalysis, acwrStats, nexusInsight, setNexusInsight, addLog, t } = useApp();
  const navigate = useNavigate();
  const [loadingNexus, setLoadingNexus] = useState(false);
  const [errorStatus, setErrorStatus] = useState<'none' | 'key_missing' | 'error'>('none');
  const [showTherapyModal, setShowTherapyModal] = useState(false);

  const fetchNexus = async (force: boolean = false) => {
      const apiKey = process.env.API_KEY;
      if (!apiKey && !force) {
          // No bloqueamos, pero marcamos estado si es necesario
          return;
      }
      if (nexusInsight && !force) return;
      
      setLoadingNexus(true);
      setErrorStatus('none');
      try {
          const insight = await generateNexusInsight(logs, { fatigue: 5 }, lastAnalysis, acwrStats);
          if (insight) setNexusInsight(insight);
      } catch (error: any) {
          console.error("Nexus Insight Error:", error);
          setErrorStatus('error');
      } finally { setLoadingNexus(false); }
  };

  useEffect(() => {
    fetchNexus();
  }, [logs.length, lastAnalysis]);

  const handleOpenKey = async () => {
      const aistudio = getAIStudio();
      if (aistudio) {
          await aistudio.openSelectKey();
          setErrorStatus('none');
          setTimeout(() => fetchNexus(true), 1000);
      }
  };

  const handleTherapyLog = () => {
      const therapyLog = {
          id: Date.now().toString(),
          date: new Date().toISOString().split('T')[0],
          event: 'Therapy' as any,
          type: 'Recovery' as any,
          location: 'Clínica / Fisioterapia',
          time: 0,
          notes: 'Bitácora de Terapia: Sesión de descarga registrada.'
      };
      addLog(therapyLog);
      setShowTherapyModal(false);
  };

  const todaysSession = (() => {
      if (!currentPlan?.sessions) return null;
      const todayIdx = new Date().getDay();
      const dayMap: Record<number, string[]> = {
          0: ['dom', 'sun', 'sunday', 'domingo'],
          1: ['lun', 'mon', 'monday', 'lunes'],
          2: ['mar', 'tue', 'tuesday', 'martes'],
          3: ['mie', 'wed', 'wednesday', 'miercoles'],
          4: ['jue', 'thu', 'thursday', 'jueves'],
          5: ['vie', 'fri', 'friday', 'viernes'],
          6: ['sab', 'sat', 'saturday', 'sabado']
      };
      const targets = dayMap[todayIdx];
      return currentPlan.sessions.find(s => {
          const sessionDay = s.day.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          return targets.some(target => sessionDay.includes(target));
      });
  })();

  const getStatusColor = (status: string) => {
      switch(status) {
          case 'Peak': return 'from-emerald-600/20 to-emerald-900/40 border-emerald-500/30 text-emerald-400';
          case 'Warning': return 'from-red-600/20 to-red-900/40 border-red-500/30 text-red-400';
          case 'Recovery': return 'from-blue-600/20 to-blue-900/40 border-blue-500/30 text-blue-400';
          default: return 'from-slate-800 to-slate-900 border-slate-700 text-slate-400';
      }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-10 px-2">
      <div className="mb-2"><AthletePassport /></div>

      <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setShowTherapyModal(true)} className="bg-slate-900 border border-slate-800 p-3 rounded-2xl flex items-center gap-3 hover:bg-slate-800 transition-all shadow-md group">
              <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20 group-hover:bg-blue-500/20 transition-colors">
                <Stethoscope size={18} className="text-blue-400" />
              </div>
              <div className="text-left overflow-hidden">
                  <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest truncate">Bitácora</div>
                  <div className="text-[11px] font-bold text-white truncate">Terapia</div>
              </div>
          </button>
          <button onClick={() => navigate('/plan')} className="bg-slate-900 border border-slate-800 p-3 rounded-2xl flex items-center gap-3 hover:bg-slate-800 transition-all shadow-md group">
              <div className="p-2 bg-cyan-500/10 rounded-xl border border-cyan-500/20 group-hover:bg-cyan-500/20 transition-colors">
                <Plus size={18} className="text-cyan-400" />
              </div>
              <div className="text-left overflow-hidden">
                  <div className="text-[10px] font-black text-cyan-400 uppercase tracking-widest truncate">Entreno</div>
                  <div className="text-[11px] font-bold text-white truncate">Nuevo Log</div>
              </div>
          </button>
      </div>

      <div className={`bg-gradient-to-br border rounded-[2rem] p-5 relative overflow-hidden shadow-xl transition-all duration-700 ${nexusInsight ? getStatusColor(nexusInsight.status) : 'from-slate-900 to-slate-950 border-slate-800'}`}>
          <div className="absolute top-0 right-0 p-4">
              <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/10">
                  <div className={`h-1.5 w-1.5 rounded-full animate-pulse ${nexusInsight?.status === 'Peak' ? 'bg-emerald-400' : 'bg-purple-400'}`}></div>
                  <span className="text-[8px] font-black uppercase tracking-widest text-white/80">Nexus Intelligence</span>
              </div>
          </div>

          <div className="flex justify-between items-start mb-4 relative z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/5 rounded-2xl border border-white/10">
                    <BrainCircuit size={20} className={nexusInsight?.status === 'Warning' ? 'text-red-400' : 'text-purple-400'} />
                </div>
                <div>
                    <h2 className="text-lg font-black text-white uppercase tracking-tighter leading-none">Status Atleta</h2>
                </div>
              </div>
              <button onClick={() => fetchNexus(true)} disabled={loadingNexus} className="p-1 bg-black/20 rounded-full text-white/50 hover:text-white transition-colors">
                <RefreshCw size={12} className={loadingNexus ? 'animate-spin' : ''} />
              </button>
          </div>
          
          {loadingNexus ? (
              <div className="h-32 flex flex-col items-center justify-center gap-3">
                <Activity className="animate-pulse text-purple-400" size={32} />
                <p className="text-[9px] text-white/60 uppercase font-black tracking-[0.2em] animate-pulse">Analizando Microciclo...</p>
              </div>
          ) : nexusInsight ? (
              <div className="relative z-10 space-y-3 animate-in slide-in-from-bottom-4">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-black text-white tracking-tighter uppercase">{nexusInsight.status}</span>
                    <div className="h-px bg-white/10 flex-1"></div>
                  </div>
                  <h3 className="text-sm font-bold text-white leading-tight italic">"{nexusInsight.headline}"</h3>
                  <div className="p-3 bg-black/20 rounded-2xl border border-white/5">
                    <p className="text-xs text-white/80 leading-relaxed font-medium line-clamp-3">{nexusInsight.analysis}</p>
                  </div>
              </div>
          ) : (
              <div className="text-center py-10 space-y-4">
                  <AlertTriangle size={24} className="mx-auto text-slate-700"/>
                  <button onClick={() => fetchNexus(true)} className="text-[9px] font-black uppercase tracking-widest text-cyan-400 border border-cyan-500/20 px-4 py-2 rounded-full">Solicitar Auditoría</button>
              </div>
          )}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-5 shadow-xl relative z-10 overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-500/10 rounded-xl border border-cyan-500/20">
                <CalendarCheck size={18} className="text-cyan-400" />
              </div>
              <h3 className="font-bold text-base text-white">Entrenamiento de Hoy</h3>
          </div>
        </div>
        
        {todaysSession ? (
          <div className="space-y-4">
            <div>
                <p className="text-lg font-black text-white leading-tight tracking-tight line-clamp-2 uppercase">{todaysSession.focus}</p>
                <div className="flex gap-2 mt-2">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-[8px] font-bold text-slate-400 uppercase border border-slate-700">{todaysSession.intensity} Intensity</span>
                </div>
            </div>
            <button onClick={() => navigate('/plan')} className="w-full bg-slate-800 hover:bg-slate-700 text-white py-3.5 rounded-2xl text-xs font-black border border-slate-700 flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg">
              Ver Detalles <ArrowRight size={14}/>
            </button>
          </div>
        ) : (
          <div className="text-center py-6 space-y-3">
            <p className="text-xs text-slate-500 font-medium italic">Sin sesión programada para hoy.</p>
            <button onClick={() => navigate('/plan')} className="bg-cyan-600 hover:bg-cyan-500 text-white px-8 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-cyan-900/30">Generar Microciclo</button>
          </div>
        )}
      </div>

      {showTherapyModal && (
          <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center p-6" onClick={() => setShowTherapyModal(false)}>
              <div className="bg-slate-900 border border-blue-500/30 p-8 rounded-[2.5rem] max-w-sm text-center relative shadow-2xl" onClick={e => e.stopPropagation()}>
                  <div className="w-16 h-16 bg-blue-500/10 rounded-3xl border border-blue-500/20 flex items-center justify-center mx-auto mb-4">
                      <Stethoscope size={32} className="text-blue-400" />
                  </div>
                  <h4 className="text-xl font-black text-white mb-2 uppercase tracking-tight">Registro de Terapia</h4>
                  <p className="text-xs text-slate-400 leading-relaxed mb-6">Informa al Nexus sobre tu sesión de descarga para optimizar el cálculo de fatiga.</p>
                  <div className="flex flex-col gap-3">
                      <button onClick={handleTherapyLog} className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-[10px] hover:bg-blue-500 transition-all shadow-xl shadow-blue-900/40">Guardar Sesión</button>
                      <button onClick={() => setShowTherapyModal(false)} className="w-full bg-slate-800 text-slate-400 font-bold py-3 rounded-2xl uppercase tracking-widest text-[10px]">Cerrar</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};