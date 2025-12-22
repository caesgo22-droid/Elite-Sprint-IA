
import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { useApp } from '../contexts/AppContext';
import { EliteLiveService } from '../services/liveService';
import { Mic, Radio, Headphones, X, Zap, Activity, Key, AlertCircle, Info, Clock } from 'lucide-react';
import { getEnv } from '../utils/env';

const getAIStudio = () => (window as any).aistudio;

export const GeminiLive: React.FC = () => {
  const { userProfile, currentPlan, acwrStats, updateSession, lastAnalysis, planHistory, logs } = useApp();
  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState("Voz Inactiva");
  const [level, setLevel] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [errorType, setErrorType] = useState<'quota' | 'billing' | 'generic' | null>(null);
  const liveService = useRef<EliteLiveService | null>(null);

  useEffect(() => {
    const config = getAIStudio();
    const envKey = getEnv("GEMINI_API_KEY") || getEnv("VITE_GEMINI_API_KEY") || getEnv("API_KEY");
    const finalKey = config?.apiKey || envKey;

    setHasKey(!!finalKey);

    if (finalKey && !liveService.current) {
      liveService.current = new EliteLiveService(finalKey);
    }
  }, []);

  const startSession = async () => {
    setIsActive(true);
    setStatus("Conectando...");
    setErrorType(null);

    try {
      if (!liveService.current) throw new Error("Servicio de voz no inicializado");

      await liveService.current.startSession(
        userProfile,
        currentPlan,
        acwrStats,
        lastAnalysis,
        planHistory || [], // Pass History
        logs || [],        // Pass Logs
        (l, m) => {
          setLevel(l * 10);
          setIsSpeaking(m);
        },
        (s) => setStatus(s),
        async (name, args) => {
          if (name === "modify_session") {
            updateSession("Hoy", { focus: args.newFocus, intensity: args.newIntensity });
            return "ok";
          }
          return "error";
        }
      );
    } catch (error: any) {
      console.error("Live Session Error:", error);
      setIsActive(false);
      const errMsg = error?.message?.toLowerCase() || "";
      if (errMsg.includes("429") || errMsg.includes("quota")) {
        setStatus("Cuota Agotada");
        setErrorType('quota');
      } else if (errMsg.includes("not found") || errMsg.includes("billing")) {
        setStatus("Requiere Plan de Pago");
        setErrorType('billing');
        setHasKey(false);
      } else {
        setStatus("Error de Conexión");
        setErrorType('generic');
      }
    }
  };

  const stopSession = () => {
    liveService.current?.stop();
    setIsActive(false);
    setStatus("Voz Inactiva");
    setLevel(0);
  };

  const handleSelectKey = () => {
    getAIStudio()?.requestKeySelection?.();
  };

  return (
    <div className="h-[calc(100dvh-160px)] flex flex-col items-center justify-center relative bg-slate-950 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl p-6">
      <div className={`absolute inset-0 transition-opacity duration-1000 \${isActive ? 'opacity-20' : 'opacity-5'}`}>
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-gradient-to-br from-cyan-500 via-blue-900 to-purple-900 blur-3xl \${isActive ? 'animate-pulse' : ''}`}></div>
      </div>

      <div className="z-10 flex flex-col items-center gap-8 w-full max-w-sm">
        <div className="text-center">
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border mb-4 transition-colors \${isActive ? 'bg-cyan-900/30 border-cyan-500 text-cyan-400' : 'bg-slate-900 border-slate-700 text-slate-500'}`}>
            {isActive ? <Radio size={12} className="animate-pulse" /> : <Mic size={12} />}
            {status}
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight uppercase">Coach de Voz Elite</h2>
          <p className="text-xs text-slate-500 mt-1">Inteligencia Nativa Gemini 2.0</p>
        </div>

        <div className="relative">
          <div className={`absolute inset-0 rounded-full border-2 border-cyan-500/30 transition-transform duration-75 \${isActive ? '' : 'hidden'}`} style={{ transform: `scale(\${1 + level * 2})` }}></div>
          <button
            onClick={isActive ? stopSession : startSession}
            disabled={(errorType === 'billing' || errorType === 'quota') && !hasKey && !isActive}
            className={`w-40 h-40 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl relative z-20 border-4 \${isActive ? 'bg-slate-900 border-cyan-500 scale-110' : errorType === 'quota' ? 'bg-slate-900 border-orange-500/50' : 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:shadow-cyan-500/20'}`}
          >
            {isActive ? (
              <div className="flex flex-col items-center gap-1">
                <Headphones size={48} className={isSpeaking ? 'text-cyan-400' : 'text-slate-400'} />
                <span className="text-[10px] font-bold text-cyan-500 animate-pulse">{isSpeaking ? 'HABLANDO' : 'ESCUCHANDO'}</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Mic size={48} className={errorType === 'quota' ? 'text-orange-500' : errorType === 'billing' ? 'text-red-900' : 'text-slate-600'} />
                {errorType === 'quota' && <span className="text-[10px] text-orange-500 font-bold uppercase tracking-tighter">Límite Diario</span>}
              </div>
            )}
          </button>
        </div>

        {errorType === 'quota' && !isActive && (
          <div className="bg-orange-900/20 border border-orange-500/30 rounded-2xl p-4 w-full animate-in slide-in-from-bottom-2">
            <div className="flex gap-3">
              <Clock className="text-orange-500 shrink-0" size={20} />
              <div className="space-y-2">
                <h4 className="text-sm font-bold text-white">Límite Diario Excedido</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Has agotado las solicitudes gratuitas de hoy para tu proyecto <span className="text-white font-bold">Sprint AICoach</span>.
                </p>
                <div className="flex gap-2 pt-2">
                  <a href="https://aistudio.google.com/app/apikey" target="_blank" className="flex-1 bg-orange-600 text-white text-[10px] font-black uppercase py-2 rounded-lg text-center">Ver en AI Studio</a>
                  <button onClick={handleSelectKey} className="flex-1 bg-slate-800 text-slate-300 text-[10px] font-bold py-2 rounded-lg text-center">Cambiar Key</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {errorType === 'billing' && !isActive && (
          <div className="bg-red-900/20 border border-red-500/30 rounded-2xl p-4 w-full animate-in slide-in-from-bottom-2">
            <div className="flex gap-3">
              <AlertCircle className="text-red-500 shrink-0" size={20} />
              <div className="space-y-2">
                <h4 className="text-sm font-bold text-white">Requiere Plan de Pago</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Para usar la Voz Nativa necesitas una clave con facturación activa.
                </p>
                <button onClick={handleSelectKey} className="w-full bg-red-600 text-white text-[10px] font-black uppercase py-2 rounded-lg flex items-center justify-center gap-1 mt-2">
                  <Key size={12} /> Configurar Clave
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Removed Latency/Motor boxes for a cleaner look */}
      </div>
    </div>
  );
};

export default GeminiLive;
