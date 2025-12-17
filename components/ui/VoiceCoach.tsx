
import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { useApp } from '../contexts/AppContext';
import { EliteLiveService } from '../services/liveService';
import { Mic, PhoneOff, Activity, Radio, Volume2, Globe } from 'lucide-react';
import { hasApiKey } from '../services/geminiService';

const getApiKey = () => {
  if (typeof process !== 'undefined' && process.env && process.env.API_KEY) return process.env.API_KEY;
  if (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_GEMINI_API_KEY) return (import.meta as any).env.VITE_GEMINI_API_KEY;
  return "";
}

export const VoiceCoach: React.FC = () => {
  const { userProfile, currentPlan, acwrStats, updateSession, addLog } = useApp();
  const [isActive, setIsActive] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [status, setStatus] = useState("Listo para conectar");
  const liveService = useRef<EliteLiveService | null>(null);
  
  useEffect(() => {
      return () => {
          if (liveService.current) liveService.current.stop();
      };
  }, []);

  const handleToggle = async () => {
      if (isActive) {
          liveService.current?.stop();
          liveService.current = null;
          setIsActive(false);
          setAudioLevel(0);
          setStatus("Desconectado");
      } else {
          if (!hasApiKey) {
              alert("⚠️ API Key no encontrada. Configura VITE_GEMINI_API_KEY.");
              return;
          }
          const key = getApiKey();
          if(!key) return;

          liveService.current = new EliteLiveService(key);
          setIsActive(true); // Set UI immediately
          
          await liveService.current.startSession(
              userProfile,
              currentPlan,
              acwrStats,
              (level) => setAudioLevel(level * 5), // Amplify for visual effect
              (newStatus) => setStatus(newStatus),
              async (name, args) => {
                  // --- TOOL EXECUTION LOGIC ---
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
                          event: 'Therapy', // Placeholder event type
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

  // Visualizer bars
  const bars = Array.from({ length: 20 });

  return (
    <div className="h-[calc(100dvh-140px)] flex flex-col items-center justify-center p-6 relative overflow-hidden">
        
        {/* Background Ambient */}
        <div className={`absolute inset-0 transition-opacity duration-1000 ${isActive ? 'opacity-100' : 'opacity-10'}`}>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-cyan-500/20 rounded-full blur-[100px] animate-pulse-slow"></div>
            <div 
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] bg-blue-600/30 rounded-full blur-[60px] transition-transform duration-75" 
                style={{ transform: `scale(${1 + Math.min(audioLevel, 1.5)}) translate(-50%, -50%)` }}
            ></div>
        </div>

        <div className="z-10 flex flex-col items-center space-y-10 w-full max-w-sm">
            
            {/* Status Header */}
            <div className="text-center space-y-2">
                <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border transition-all ${isActive ? 'bg-red-900/30 border-red-500 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.4)]' : 'bg-slate-900 border-slate-700 text-slate-500'}`}>
                    {isActive ? <Radio size={12} className="animate-pulse"/> : <Globe size={12}/>}
                    {status}
                </div>
                <h2 className="text-4xl font-black text-white tracking-tighter">GEMINI LIVE</h2>
                <p className="text-xs text-slate-400 font-mono">NATIVE AUDIO • 24kHz • LOW LATENCY</p>
            </div>

            {/* Main Interaction Orb */}
            <div className="relative group">
                {/* Active Ring */}
                <div className={`absolute inset-0 rounded-full border-2 border-cyan-500/50 transition-all duration-75 opacity-0 ${isActive ? 'opacity-100' : ''}`} style={{ transform: `scale(${1 + audioLevel * 0.8})` }}></div>
                
                <button 
                    onClick={handleToggle}
                    className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl relative z-20 border-4 ${isActive ? 'bg-red-600 hover:bg-red-500 border-red-400 shadow-red-900/50 scale-110' : 'bg-slate-800 hover:bg-slate-700 border-slate-600 hover:border-cyan-500'}`}
                >
                    {isActive ? <PhoneOff size={40} className="text-white"/> : <Mic size={40} className="text-slate-300 group-hover:text-white"/>}
                </button>
            </div>

            {/* Waveform Visualizer */}
            <div className="h-16 flex items-end justify-center gap-1 w-full max-w-[200px]">
                {bars.map((_, i) => (
                    <div 
                        key={i} 
                        className={`w-1.5 rounded-full transition-all duration-75 ${isActive ? 'bg-cyan-400' : 'bg-slate-800'}`}
                        style={{ 
                            height: isActive ? `${Math.max(15, Math.random() * 100 * audioLevel * (i % 2 === 0 ? 1.5 : 0.7))}%` : '4px',
                            opacity: isActive ? 0.6 + (audioLevel * 0.4) : 0.3
                        }}
                    ></div>
                ))}
            </div>

            {/* Hint Card */}
            {!isActive && (
                <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl w-full text-center backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2">
                    <p className="text-[10px] text-slate-500 mb-2 font-bold uppercase tracking-widest">Capacidades Omni-Conscientes</p>
                    <div className="space-y-2 text-sm text-slate-300 font-medium">
                        <p>"Analiza mi ACWR actual."</p>
                        <p>"Cambia el entreno de hoy por algo suave."</p>
                        <p>"Registra un RPE de 8 para la sesión."</p>
                    </div>
                </div>
            )}

        </div>
    </div>
  );
};
