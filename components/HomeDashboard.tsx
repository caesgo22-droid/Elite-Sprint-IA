
import * as React from 'react';
import { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { BrainCircuit, Activity, RefreshCw, Key, ShieldCheck, ArrowRight, CalendarCheck, AlertTriangle, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { generateNexusInsight } from '../services/geminiService';
import { AthletePassport } from './AthletePassport';

const getAIStudio = () => (window as any).aistudio;

export const HomeDashboard: React.FC = () => {
  const { userProfile, currentPlan, logs, lastAnalysis, acwrStats, nexusInsight, setNexusInsight, t } = useApp();
  const navigate = useNavigate();
  const [loadingNexus, setLoadingNexus] = useState(false);
  const [errorStatus, setErrorStatus] = useState<'none' | 'key_missing' | 'error'>('none');

  const fetchNexus = async (force: boolean = false) => {
      if (nexusInsight && !force) return;
      if (logs.length > 0 || lastAnalysis) {
          setLoadingNexus(true);
          setErrorStatus('none');
          try {
              const insight = await generateNexusInsight(logs, { fatigue: 5 }, lastAnalysis, acwrStats);
              if (insight) setNexusInsight(insight);
          } catch (error: any) {
              if (error.message === "KEY_REQUIRED") setErrorStatus('key_missing');
              else setErrorStatus('error');
          } finally { setLoadingNexus(false); }
      }
  };

  useEffect(() => { fetchNexus(); }, [logs.length, lastAnalysis]);

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
      return currentPlan.sessions.find(s => s.day.toLowerCase().includes(days[new Date().getDay()].toLowerCase().slice(0,3)));
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
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      <div className="mb-4"><AthletePassport /></div>

      {/* NEXUS ELITE MONITOR */}
      <div className={`bg-gradient-to-br border rounded-[2rem] p-6 relative overflow-hidden shadow-2xl transition-all duration-700 ${nexusInsight ? getStatusColor(nexusInsight.status) : 'from-slate-900 to-slate-950 border-slate-800'}`}>
          <div className="absolute top-0 right-0 p-4">
              <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
                  <div className={`h-1.5 w-1.5 rounded-full animate-pulse ${nexusInsight?.status === 'Peak' ? 'bg-emerald-400' : 'bg-purple-400'}`}></div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-white/80">Nexus Pro Deep Intelligence</span>
              </div>
          </div>

          <div className="flex justify-between items-start mb-6 relative z-10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/5 rounded-2xl border border-white/10">
                    <BrainCircuit size={24} className={nexusInsight?.status === 'Warning' ? 'text-red-400' : 'text-purple-400'} />
                </div>
                <div>
                    <h2 className="text-xl font-black text-white uppercase tracking-tighter">Status Atleta</h2>
                    <p className="text-[10px] opacity-60 font-bold uppercase tracking-widest">Auditoría Multimodal</p>
                </div>
              </div>
              <button onClick={() => fetchNexus(true)} disabled={loadingNexus} className="p-2 bg-black/20 rounded-full text-white/50 hover:text-white transition-colors">
                <RefreshCw size={16} className={loadingNexus ? 'animate-spin' : ''} />
              </button>
          </div>
          
          {errorStatus === 'key_missing' ? (
              <div className="py-8 text-center space-y-4 bg-black/20 rounded-2xl border border-white/5">
                  <Key size={32} className="mx-auto text-red-400 opacity-50"/>
                  <p className="text-xs text-white/80 font-bold px-8">Nexus Elite requiere un proyecto de pago vinculado para el motor de razonamiento Pro.</p>
                  <button onClick={handleOpenKey} className="bg-white text-slate-950 text-[10px] font-black px-8 py-3 rounded-xl uppercase tracking-widest hover:bg-slate-200 shadow-xl transition-all">Vincular Proyecto Ahora</button>
              </div>
          ) : loadingNexus ? (
              <div className="h-40 flex flex-col items-center justify-center gap-4">
                <div className="relative">
                    <Activity className="animate-pulse text-purple-400" size={48} />
                    <div className="absolute inset-0 bg-purple-500/20 blur-2xl rounded-full"></div>
                </div>
                <p className="text-[10px] text-white/60 uppercase font-black tracking-[0.2em] animate-pulse">Correlacionando Biomecánica...</p>
              </div>
          ) : nexusInsight ? (
              <div className="relative z-10 space-y-4 animate-in slide-in-from-bottom-4">
                  <div className="flex items-center gap-2">
                    <span className="text-3xl font-black text-white tracking-tighter uppercase">{nexusInsight.status}</span>
                    <div className="h-px bg-white/10 flex-1"></div>
                  </div>
                  <h3 className="text-lg font-bold text-white leading-tight">"{nexusInsight.headline}"</h3>
                  <div className="p-4 bg-black/20 rounded-2xl border border-white/5">
                    <p className="text-sm text-white/80 leading-relaxed font-medium">{nexusInsight.analysis}</p>
                  </div>
                  <div className="flex items-start gap-3 bg-white/10 p-4 rounded-2xl border border-white/5">
                    <Zap size={18} className="text-yellow-400 shrink-0 mt-1"/>
                    <p className="text-xs font-bold text-white uppercase tracking-tight">{nexusInsight.recommendation}</p>
                  </div>
              </div>
          ) : (
              <div className="text-center py-12 space-y-3 opacity-40">
                  <AlertTriangle size={32} className="mx-auto"/>
                  <p className="text-xs font-bold uppercase tracking-widest">Datos Insuficientes para Nexus Pro</p>
              </div>
          )}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-500/10 rounded-xl border border-cyan-500/20">
                <CalendarCheck size={20} className="text-cyan-400" />
              </div>
              <h3 className="font-bold text-lg text-white">Próximo Entreno</h3>
          </div>
          <span className="text-[10px] font-black bg-slate-800 px-3 py-1 rounded-full text-slate-400 uppercase tracking-widest">Hoy</span>
        </div>
        
        {todaysSession ? (
          <div className="space-y-4">
            <div>
                <p className="text-2xl font-black text-white leading-tight">{todaysSession.focus}</p>
                <div className="flex gap-2 mt-2">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-bold text-slate-400 uppercase">{todaysSession.intensity} Intensity</span>
                </div>
            </div>
            <button onClick={() => navigate('/plan')} className="w-full bg-slate-800 hover:bg-slate-700 text-white py-4 rounded-2xl text-sm font-black border border-slate-700 flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg">
              Ver Detalles del Plan <ArrowRight size={18}/>
            </button>
          </div>
        ) : (
          <div className="text-center py-8 space-y-4">
            <p className="text-sm text-slate-500 font-medium">No hay sesión programada para hoy.</p>
            <button onClick={() => navigate('/plan')} className="bg-cyan-600 hover:bg-cyan-500 text-white px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-cyan-900/30">Generar Microciclo</button>
          </div>
        )}
      </div>
    </div>
  );
};
