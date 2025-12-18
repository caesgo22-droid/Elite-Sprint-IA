
import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { useApp } from '../contexts/AppContext';
import { EliteLiveService } from '../services/liveService';
import { Mic, Radio, Headphones, X, Zap, Activity } from 'lucide-react';

export const GeminiLive: React.FC = () => {
  const { userProfile, currentPlan, acwrStats, updateSession } = useApp();
  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState("Voz Inactiva");
  const [level, setLevel] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const liveService = useRef<EliteLiveService | null>(null);

  const startSession = async () => {
    const key = process.env.API_KEY;
    if (!key) return alert("API Key no configurada.");

    liveService.current = new EliteLiveService(key);
    setIsActive(true);

    await liveService.current.startSession(
      userProfile,
      currentPlan,
      acwrStats,
      (l, m) => {
        setLevel(l * 10);
        setIsSpeaking(m);
      },
      (s) => setStatus(s),
      async (name, args) => {
        if (name === "modify_session") {
          updateSession("Hoy", { focus: args.newFocus, intensity: args.newIntensity });
          return "OK, sesión actualizada.";
        }
        return "Desconocido";
      }
    );
  };

  const stopSession = () => {
    liveService.current?.stop();
    setIsActive(false);
    setStatus("Voz Inactiva");
    setLevel(0);
  };

  useEffect(() => {
    return () => stopSession();
  }, []);

  return (
    <div className="h-[calc(100dvh-160px)] flex flex-col items-center justify-center relative bg-slate-950 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl">
      
      {/* Fondo Animado */}
      <div className={`absolute inset-0 transition-opacity duration-1000 ${isActive ? 'opacity-20' : 'opacity-5'}`}>
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-gradient-to-br from-cyan-500 via-blue-900 to-purple-900 blur-3xl ${isActive ? 'animate-pulse' : ''}`}></div>
      </div>

      <div className="z-10 flex flex-col items-center gap-12 w-full max-w-xs">
        
        <div className="text-center">
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border mb-4 transition-colors ${isActive ? 'bg-cyan-900/30 border-cyan-500 text-cyan-400' : 'bg-slate-900 border-slate-700 text-slate-500'}`}>
            {isActive ? <Radio size={12} className="animate-pulse"/> : <Mic size={12}/>}
            {status}
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight uppercase">Coach de Voz Elite</h2>
          <p className="text-xs text-slate-500 mt-1">Conectado a tu Biomecánica y Plan</p>
        </div>

        {/* Círculo de Voz Central */}
        <div className="relative">
          {/* Ondas de choque visuales */}
          <div className={`absolute inset-0 rounded-full border-2 border-cyan-500/30 transition-transform duration-75 ${isActive ? '' : 'hidden'}`} style={{ transform: `scale(${1 + level * 2})` }}></div>
          <div className={`absolute inset-0 rounded-full border border-cyan-500/10 transition-transform duration-150 ${isActive ? '' : 'hidden'}`} style={{ transform: `scale(${1 + level * 4})` }}></div>

          <button 
            onClick={isActive ? stopSession : startSession}
            className={`w-40 h-40 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl relative z-20 border-4 ${isActive ? 'bg-slate-900 border-cyan-500 scale-110' : 'bg-slate-900 border-slate-800 hover:border-slate-700'}`}
          >
            {isActive ? (
              <div className="flex flex-col items-center gap-1">
                <Headphones size={48} className={isSpeaking ? 'text-cyan-400' : 'text-slate-400'}/>
                <span className="text-[10px] font-bold text-cyan-500 animate-pulse">{isSpeaking ? 'HABLANDO' : 'ESCUCHANDO'}</span>
              </div>
            ) : (
              <Mic size={48} className="text-slate-600"/>
            )}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 w-full">
          <div className="bg-slate-900/50 p-3 rounded-2xl border border-slate-800 text-center">
            <Zap size={16} className="text-yellow-500 mx-auto mb-1"/>
            <div className="text-[10px] text-slate-500 uppercase font-bold">Respuesta</div>
            <div className="text-xs text-white font-bold">Nativa (No TTS)</div>
          </div>
          <div className="bg-slate-900/50 p-3 rounded-2xl border border-slate-800 text-center">
            <Activity size={16} className="text-emerald-500 mx-auto mb-1"/>
            <div className="text-[10px] text-slate-500 uppercase font-bold">Latencia</div>
            <div className="text-xs text-white font-bold">&lt; 100ms</div>
          </div>
        </div>

        <p className="text-[10px] text-slate-500 text-center leading-relaxed">
          Usa auriculares para evitar el eco. El coach puede ver tu fatiga subjetiva y planes históricos.
        </p>
      </div>

    </div>
  );
};

export default GeminiLive;
