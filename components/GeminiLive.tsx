
import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { useApp } from '../contexts/AppContext';
import { EliteLiveService } from '../services/liveService';
import { Mic, PhoneOff, Radio, Globe, Zap, Headphones, Activity } from 'lucide-react';
import { hasApiKey } from '../services/geminiService';

const getApiKey = () => {
  if (typeof process !== 'undefined' && process.env && process.env.API_KEY) return process.env.API_KEY;
  if (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_GEMINI_API_KEY) return (import.meta as any).env.VITE_GEMINI_API_KEY;
  return "";
}

export const GeminiLive: React.FC = () => {
  const { userProfile, currentPlan, acwrStats, updateSession, addLog } = useApp();
  const [isActive, setIsActive] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [status, setStatus] = useState("Staff Offline");
  const liveService = useRef<EliteLiveService | null>(null);
  
  // Clean up on unmount
  useEffect(() => {
      return () => {
          if (liveService.current) {
              liveService.current.stop();
              liveService.current = null;
          }
      };
  }, []);

  const handleToggle = async () => {
      if (isActive) {
          liveService.current?.stop();
          liveService.current = null;
          setIsActive(false);
          setAudioLevel(0);
          setStatus("Staff Offline");
      } else {
          const key = getApiKey();
          if (!key) {
              alert("⚠️ API Key no encontrada. Configura VITE_GEMINI_API_KEY.");
              return;
          }

          liveService.current = new EliteLiveService(key);
          setIsActive(true); 
          setStatus("Estableciendo enlace seguro...");
          
          await liveService.current.startSession(
              userProfile,
              currentPlan,
              acwrStats,
              (level) => setAudioLevel(level * 5), 
              (newStatus) => setStatus(newStatus),
              async (name, args) => {
                  if (name === 'modify_session') {
                      updateSession(args.day, { 
                          focus: args.newFocus, 
                          intensity: args.intensity,
                          coachNotes: `[VOZ] Modificado: ${args.newFocus}`
                      });
                      return { success: true, message: "Sesión actualizada." };
                  }
                  if (name === 'log_rpe') {
                      const today = new Date().toISOString().split('T')[0];
                      addLog({
                          id: Date.now().toString(),
                          date: today,
                          event: 'Therapy',
                          type: 'Recovery',
                          location: 'Voz',
                          time: 0,
                          notes: `RPE Reportado por Voz: ${args.rpe}. Nota: ${args.notes || ''}`
                      });
                      return { success: true };
                  }
                  return { success: false, message: "Herramienta desconocida" };
              }
          );
      }
  };

  const bars = Array.from({ length: 20 });

  return (
    <div className="h-[calc(100dvh-140px)] flex flex-col items-center justify-center p-6 relative overflow-hidden bg-slate-950">
        
        {/* Background Ambient */}
        <div className={`absolute inset-0 transition-opacity duration-1000 ${isActive ? 'opacity-100' : 'opacity-10'}`}>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-yellow-500/10 rounded-full blur-[100px] animate-pulse-slow"></div>
            <div 
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] bg-cyan-600/20 rounded-full blur-[60px] transition-transform duration-75" 
                style={{ transform: `scale(${1 + Math.min(audioLevel, 1.5)}) translate(-50%, -50%)` }}
            ></div>
        </div>

        <div className="z-10 flex flex-col items-center space-y-10 w-full max-w-sm">
            
            {/* Status Header */}
            <div className="text-center space-y-3">
                <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all ${isActive ? 'bg-emerald-900/30 border-emerald-500 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-slate-900 border-slate-700 text-slate-500'}`}>
                    {isActive ? <Radio size={10} className="animate-pulse"/> : <Globe size={10}/>}
                    {status}
                </div>
                <div>
                    <h2 className="text-3xl font-black text-white tracking-tighter">ELITE STAFF VOICE</h2>
                    <p className="text-xs text-yellow-500 font-bold uppercase tracking-widest mt-1">Nivel V Intelligence • Real-Time</p>
                </div>
            </div>

            {/* Main Interaction Orb */}
            <div className="relative group">
                {/* Active Ring */}
                <div className={`absolute inset-0 rounded-full border-2 border-yellow-500/50 transition-all duration-75 opacity-0 ${isActive ? 'opacity-100' : ''}`} style={{ transform: `scale(${1 + audioLevel * 0.8})` }}></div>
                <div className={`absolute inset-0 rounded-full border border-cyan-500/30 transition-all duration-500 opacity-0 ${isActive ? 'opacity-100 animate-ping' : ''}`} style={{ animationDuration: '3s' }}></div>
                
                <button 
                    onClick={handleToggle}
                    className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl relative z-20 border-4 ${isActive ? 'bg-slate-900 border-yellow-500 shadow-yellow-900/20 scale-110' : 'bg-slate-900 hover:bg-slate-800 border-slate-700 hover:border-slate-500'}`}
                >
                    {isActive ? (
                         <div className="relative w-full h-full flex items-center justify-center rounded-full overflow-hidden">
                             <div className="absolute inset-0 bg-gradient-to-tr from-yellow-500/20 to-cyan-500/20 animate-spin-slow"></div>
                             <Headphones size={40} className="text-white relative z-10"/>
                         </div>
                    ) : (
                        <Mic size={40} className="text-slate-400 group-hover:text-white transition-colors"/>
                    )}
                </button>
            </div>

            {/* Waveform Visualizer */}
            <div className="h-16 flex items-end justify-center gap-1 w-full max-w-[200px]">
                {bars.map((_, i) => (
                    <div 
                        key={i} 
                        className={`w-1 rounded-full transition-all duration-75 ${isActive ? 'bg-gradient-to-t from-cyan-500 to-yellow-400' : 'bg-slate-800'}`}
                        style={{ 
                            height: isActive ? `${Math.max(10, Math.random() * 100 * audioLevel * (i % 2 === 0 ? 1.5 : 0.7))}%` : '4px',
                            opacity: isActive ? 0.6 + (audioLevel * 0.4) : 0.3
                        }}
                    ></div>
                ))}
            </div>

            {/* Interaction Hint */}
            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl w-full text-center backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2">
                {isActive ? (
                    <div className="space-y-1">
                        <p className="text-xs text-emerald-400 font-bold uppercase animate-pulse">Enlace de Voz Activo</p>
                        <p className="text-[10px] text-slate-400">Habla libremente. El staff te escucha.</p>
                        <p className="text-[10px] text-slate-500 pt-2 border-t border-slate-800 mt-2">Toca el botón central para finalizar.</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                         <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center justify-center gap-2"><Zap size={12}/> Comandos de Voz</p>
                         <div className="space-y-1 text-sm text-slate-300 font-medium">
                            <p>"Analiza mi carga (ACWR)."</p>
                            <p>"Cambia la sesión de hoy."</p>
                            <p>"Registra un RPE de 8."</p>
                         </div>
                    </div>
                )}
            </div>

        </div>
    </div>
  );
};
