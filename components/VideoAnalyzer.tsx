
import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { analyzeTechnique } from '../services/geminiService';
import { LocalExpert } from '../services/localExpert';
import { ElitePhysicsEngine } from '../utils/biomechanicsUtils';
import { BiomechanicalAnalysis } from '../types';
import { Loader2, ScanLine, UploadCloud, History, Key, Info, X, ShieldCheck, Microscope, Layers } from 'lucide-react';
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

const getAIStudio = () => (window as any).aistudio;

const VideoAnalyzer: React.FC = () => {
  const { saveAnalysis, userProfile } = useApp();
  const [sessionAnalyses, setSessionAnalyses] = useState<BiomechanicalAnalysis[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [viewHistory, setViewHistory] = useState(false);
  const [poseLandmarker, setPoseLandmarker] = useState<PoseLandmarker | null>(null);
  const [analysisMode, setAnalysisMode] = useState<'Personal' | 'External'>('Personal');
  const [hasKey, setHasKey] = useState<boolean>(true);
  const [capturedFrames, setCapturedFrames] = useState<string[]>([]);

  const physicsEngine = useRef<ElitePhysicsEngine>(new ElitePhysicsEngine());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const initMediaPipe = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/wasm");
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task`, delegate: "GPU" },
          runningMode: "VIDEO", numPoses: 1
        });
        setPoseLandmarker(landmarker);
      } catch (error) { console.error("MediaPipe Error:", error); }
    };
    initMediaPipe();
    checkKey();
  }, []);

  const checkKey = async () => {
    const aistudio = getAIStudio();
    if (aistudio) setHasKey(await aistudio.hasSelectedApiKey());
  };

  const handleOpenKey = async () => {
      const aistudio = getAIStudio();
      if (aistudio) {
        await aistudio.openSelectKey();
        setHasKey(true);
      }
  };

  const handleAutoCapture = async () => {
    if(!previewUrl || !videoRef.current) return;
    setLoading(true);
    setCapturedFrames([]);
    setStatusMessage("Escanéo Biomecánico...");
    
    try {
        const video = videoRef.current;
        const duration = video.duration;
        const scanSteps = 12; 
        const tempHistory: any[] = [];
        const frames: string[] = [];

        for (let i = 0; i <= scanSteps; i++) {
            const time = (duration / scanSteps) * i;
            video.currentTime = time;
            await new Promise(r => setTimeout(r, 200)); 
            
            const result = poseLandmarker?.detectForVideo(video, time * 1000);
            if(result?.landmarks?.[0]) {
                const landmarks = result.landmarks[0];
                const com = physicsEngine.current.calculateCenterOfMass(landmarks);
                const mechanics = physicsEngine.current.calculateSprintMechanics(landmarks);
                const advanced = physicsEngine.current.estimateStrideParams(landmarks, userProfile.height || 175, time * 1000, com);
                tempHistory.push({ landmarks, mechanics, advanced, com, timestamp: time * 1000 });
                
                // Generar thumbnail para el frame strip
                const canvas = document.createElement('canvas');
                canvas.width = 160; canvas.height = 90;
                canvas.getContext('2d')?.drawImage(video, 0, 0, 160, 90);
                frames.push(canvas.toDataURL('image/jpeg', 0.5));
            }
        }
        setCapturedFrames(frames);

        const { maxExtensionFrame } = physicsEngine.current.detectSprintPhases(tempHistory);
        const bestFrame = maxExtensionFrame || tempHistory[Math.floor(tempHistory.length/2)];
        if (!bestFrame) throw new Error("No landmarks found");

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        canvas.getContext('2d')?.drawImage(video, 0, 0);
        const capturedImageBase64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

        setStatusMessage(analysisMode === 'External' ? "Auditoría Pro (Deep Thinking)..." : "Analizando...");
        
        let analysis: BiomechanicalAnalysis;
        try {
            const result = await analyzeTechnique([capturedImageBase64], bestFrame.mechanics, bestFrame.advanced, analysisMode);
            if (!result) throw new Error("Null AI");
            
            analysis = { 
                ...result, id: Date.now().toString(), type: 'Single', category: analysisMode,
                thumbnail: `data:image/jpeg;base64,${capturedImageBase64}`, 
                kinetics: { 
                    comVelocity: bestFrame.advanced.velocity, 
                    forceApplicationIndex: bestFrame.advanced.forceFactor, 
                    verticalOscillation: bestFrame.advanced.verticalOscillation,
                    groundContactTime: bestFrame.advanced.groundContactTime,
                    airTime: bestFrame.advanced.airTime,
                    strideFreq: bestFrame.advanced.frequency
                }, 
                timestamp: bestFrame.timestamp / 1000 
            };
        } catch (e: any) {
            if (e.message === "KEY_REQUIRED") { handleOpenKey(); throw e; }
            analysis = { ...LocalExpert.analyze(bestFrame.mechanics, bestFrame.advanced, { comVelocity: bestFrame.advanced.velocity, forceApplicationIndex: bestFrame.advanced.forceFactor, verticalOscillation: bestFrame.advanced.verticalOscillation }), thumbnail: `data:image/jpeg;base64,${capturedImageBase64}`, timestamp: bestFrame.timestamp / 1000, category: analysisMode };
        }

        setSessionAnalyses(prev => [analysis, ...prev]);
        if (analysisMode === 'External') saveAnalysis(analysis);

    } catch(e) { 
        if (e !== "KEY_REQUIRED") alert("Fallo en captura. Asegúrate de que el cuerpo sea visible.");
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
       <div className="flex justify-between items-end border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight">Laboratorio Bio</h2>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">Video Audit v2.0 Elite</p>
          </div>
          <div className="flex gap-2">
            {!hasKey && (
                <button onClick={handleOpenKey} className="bg-red-500/10 border border-red-500/30 text-red-500 px-3 py-1.5 rounded-full text-[9px] font-black uppercase flex items-center gap-1 animate-pulse">
                    <Key size={10}/> Requiere Pago
                </button>
            )}
            <button onClick={() => setViewHistory(!viewHistory)} className="text-[10px] font-black uppercase tracking-widest bg-slate-800 px-4 py-2 rounded-full border border-slate-700 text-slate-400 hover:text-white transition-all"><History size={12} className="inline mr-1"/> Historial</button>
          </div>
       </div>

       {!previewUrl ? (
           <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-slate-700 rounded-[2.5rem] aspect-video flex flex-col items-center justify-center cursor-pointer hover:bg-slate-900/50 transition-all group overflow-hidden relative">
               <div className="absolute inset-0 bg-gradient-to-t from-cyan-500/5 to-transparent"></div>
               <input type="file" ref={fileInputRef} hidden onChange={(e) => setPreviewUrl(URL.createObjectURL(e.target.files![0]))} accept="video/*" />
               <div className="p-6 bg-slate-900 rounded-3xl border border-slate-800 group-hover:scale-110 transition-transform duration-500 shadow-2xl">
                 <UploadCloud size={40} className="text-slate-500 group-hover:text-cyan-400" />
               </div>
               <span className="font-black text-slate-300 uppercase tracking-widest text-xs mt-6">Cargar Sprint</span>
               <p className="text-[9px] text-slate-600 mt-2 font-bold">PROCESADO LOCAL + NUBE</p>
           </div>
       ) : (
           <div className="space-y-6">
                <div className="relative rounded-[2rem] overflow-hidden bg-black aspect-video border border-slate-800 shadow-2xl group">
                    <video ref={videoRef} src={previewUrl} className="w-full h-full object-contain" muted playsInline />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    {capturedFrames.length > 0 && (
                        <div className="absolute bottom-4 left-4 right-4 flex gap-1 overflow-x-auto p-2 bg-black/60 backdrop-blur-md rounded-xl border border-white/10 scrollbar-hide animate-in slide-in-from-bottom-4">
                            {capturedFrames.map((f, i) => (
                                <img key={i} src={f} className="h-10 rounded border border-white/10 shrink-0" />
                            ))}
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl">
                    <button onClick={() => setAnalysisMode('Personal')} className={`py-4 rounded-2xl flex flex-col items-center gap-1 transition-all ${analysisMode === 'Personal' ? 'bg-slate-800 border border-slate-700 text-white shadow-lg' : 'text-slate-500 hover:text-slate-400'}`}>
                        <Info size={16}/>
                        <span className="text-[10px] font-black uppercase tracking-widest">Didáctico</span>
                        <span className="text-[8px] opacity-40 font-bold">(Rápido / Sin Historial)</span>
                    </button>
                    <button onClick={() => setAnalysisMode('External')} className={`py-4 rounded-2xl flex flex-col items-center gap-1 transition-all ${analysisMode === 'External' ? 'bg-indigo-900/40 border border-indigo-500/50 text-indigo-400 shadow-lg' : 'text-slate-500 hover:text-slate-400'}`}>
                        <ShieldCheck size={16}/>
                        <span className="text-[10px] font-black uppercase tracking-widest">Auditoría Pro</span>
                        <span className="text-[8px] opacity-40 font-bold">(Deep Audit / Historial)</span>
                    </button>
                </div>

                <div className="bg-slate-900/95 p-4 rounded-3xl border border-slate-800 flex gap-3 sticky bottom-20 z-10 backdrop-blur-xl shadow-2xl">
                    <button onClick={handleAutoCapture} disabled={loading} className={`flex-1 ${analysisMode === 'External' ? 'bg-indigo-600' : 'bg-cyan-600'} text-white font-black py-5 rounded-2xl flex items-center justify-center gap-4 text-sm transition-all active:scale-[0.98] shadow-xl disabled:opacity-50 uppercase tracking-widest`}>
                        {loading ? <Loader2 className="animate-spin" /> : <ScanLine />} 
                        {loading ? statusMessage : analysisMode === 'External' ? 'Iniciar Auditoría Pro' : 'Analizar Técnica'}
                    </button>
                    <button onClick={() => setPreviewUrl(null)} className="p-5 bg-slate-800 rounded-2xl text-slate-400 hover:text-white border border-slate-700"><X size={20}/></button>
                </div>

                <div className="space-y-4">
                    {sessionAnalyses.map(analysis => (
                        <div key={analysis.id} className="bg-slate-900 border border-slate-700 p-6 rounded-[2rem] space-y-6 animate-in slide-in-from-bottom-4 shadow-2xl relative overflow-hidden">
                            {analysis.category === 'External' && <div className="absolute top-0 right-0 p-3"><ShieldCheck size={14} className="text-indigo-500/50"/></div>}
                            
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className={`font-black text-2xl tracking-tighter uppercase ${analysis.category === 'External' ? 'text-indigo-400' : 'text-white'}`}>{analysis.phaseDetected}</h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Microscope size={12} className="text-slate-500"/>
                                        <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Motor: {analysis.category === 'External' ? 'Deep Pro (3.0)' : 'Flash Native'}</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-3xl font-black text-emerald-400 tracking-tighter">{analysis.score}</div>
                                    <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Score Técnico</div>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-3 gap-3">
                                 <MetricBox label="VEL (m/s)" value={analysis.kinetics?.comVelocity?.split(' ')[0] || '--'} />
                                 <MetricBox label="GCT (sec)" value={analysis.groundContactTimeEstimate || '--'} />
                                 <MetricBox label="EFICIENCIA" value={`${analysis.kinetics?.forceApplicationIndex || '--'}%`} />
                            </div>

                            <div className="space-y-3">
                                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <div className="h-px bg-slate-800 flex-1"></div>
                                    Gritos del Coach
                                    <div className="h-px bg-slate-800 flex-1"></div>
                                </h4>
                                <div className="flex flex-wrap gap-2 justify-center">
                                    {analysis.coachShouts.map((s, i) => (
                                        <span key={i} className="text-[11px] bg-slate-950 border border-slate-800 px-5 py-2.5 rounded-full text-slate-200 font-black italic shadow-inner">"{s}"</span>
                                    ))}
                                </div>
                            </div>

                            {analysis.criticalErrors.length > 0 && (
                                <div className="bg-red-500/5 border border-red-500/20 p-4 rounded-2xl">
                                    <h5 className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-3 flex items-center gap-2"><AlertCircle size={12}/> Errores Críticos</h5>
                                    <ul className="space-y-1.5">
                                        {analysis.criticalErrors.map((e, i) => <li key={i} className="text-xs text-slate-300 font-medium flex items-center gap-2"><div className="w-1 h-1 rounded-full bg-red-500"></div> {e}</li>)}
                                    </ul>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
           </div>
       )}
    </div>
  );
};

const MetricBox = ({ label, value }: { label: string, value: string }) => (
    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800/50 text-center shadow-inner group hover:border-slate-700 transition-colors">
        <div className="text-[9px] text-slate-600 uppercase font-black tracking-widest mb-1 group-hover:text-cyan-500 transition-colors">{label}</div>
        <div className="text-xl font-mono text-white font-black">{value}</div>
    </div>
);

const AlertCircle = (props: any) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
);

export default VideoAnalyzer;
