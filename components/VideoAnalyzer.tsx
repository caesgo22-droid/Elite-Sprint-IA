
import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { analyzeTechnique } from '../services/geminiService';
import { LocalExpert } from '../services/localExpert';
import { ElitePhysicsEngine, AdvancedMetrics } from '../utils/biomechanicsUtils';
import { BiomechanicalAnalysis } from '../types';
import { Loader2, ScanLine, UploadCloud, History, Key, Info, X, ShieldCheck, Microscope } from 'lucide-react';
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

  const physicsEngine = useRef<ElitePhysicsEngine>(new ElitePhysicsEngine());
  const isMounted = useRef(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    isMounted.current = true;
    const initMediaPipe = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/wasm");
        if (!isMounted.current) return;
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task`, delegate: "GPU" },
          runningMode: "VIDEO", numPoses: 1
        });
        if (isMounted.current) setPoseLandmarker(landmarker);
      } catch (error) { console.error("MediaPipe Error:", error); }
    };
    
    const checkKey = async () => {
      const aistudio = getAIStudio();
      if (aistudio) {
        const selected = await aistudio.hasSelectedApiKey();
        setHasKey(selected);
      }
    };

    initMediaPipe();
    checkKey();
    return () => { isMounted.current = false; };
  }, []);

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
    setStatusMessage("Escaneando Biomecánica...");
    
    try {
        const video = videoRef.current;
        const duration = video.duration;
        const scanSteps = 15; 
        const tempHistory: any[] = [];

        for (let i = 0; i <= scanSteps; i++) {
            const time = (duration / scanSteps) * i;
            video.currentTime = time;
            await new Promise(r => setTimeout(r, 150)); 
            const result = poseLandmarker?.detectForVideo(video, time * 1000);
            if(result?.landmarks?.[0]) {
                const landmarks = result.landmarks[0];
                const com = physicsEngine.current.calculateCenterOfMass(landmarks);
                const mechanics = physicsEngine.current.calculateSprintMechanics(landmarks);
                const advanced = physicsEngine.current.estimateStrideParams(landmarks, userProfile.height || 175, time * 1000, com);
                tempHistory.push({ landmarks, mechanics, advanced, com, timestamp: time * 1000 });
            }
        }

        const { maxExtensionFrame } = physicsEngine.current.detectSprintPhases(tempHistory);
        const bestFrame = maxExtensionFrame || tempHistory[Math.floor(tempHistory.length/2)];

        if (!bestFrame) throw new Error("No landmarks found");

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(video, 0, 0);
        const capturedImageBase64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

        setStatusMessage(analysisMode === 'External' ? "Auditoría Pro Nivel V..." : "Análisis Didáctico...");
        
        let analysis: BiomechanicalAnalysis;
        try {
            const result = await analyzeTechnique([capturedImageBase64], bestFrame.mechanics, bestFrame.advanced, analysisMode);
            if (!result) throw new Error("Null result");
            analysis = { 
                ...result, 
                id: Date.now().toString(), 
                type: 'Single', 
                category: analysisMode,
                thumbnail: `data:image/jpeg;base64,${capturedImageBase64}`, 
                kinetics: { 
                    comVelocity: bestFrame.advanced.velocity, 
                    forceApplicationIndex: bestFrame.advanced.forceFactor, 
                    verticalOscillation: bestFrame.advanced.verticalOscillation 
                }, 
                timestamp: bestFrame.timestamp / 1000 
            };
        } catch (e: any) {
            if (e.message === "KEY_REQUIRED") {
                handleOpenKey();
                throw e;
            }
            // Fallback to local expert if AI fails
            analysis = { ...LocalExpert.analyze(bestFrame.mechanics, bestFrame.advanced, { comVelocity: bestFrame.advanced.velocity, forceApplicationIndex: bestFrame.advanced.forceFactor, verticalOscillation: bestFrame.advanced.verticalOscillation }), thumbnail: `data:image/jpeg;base64,${capturedImageBase64}`, timestamp: bestFrame.timestamp / 1000, category: analysisMode };
        }

        setSessionAnalyses(prev => [analysis, ...prev]);
        
        // Solo guardar permanentemente si es modo Externo
        if (analysisMode === 'External') {
            saveAnalysis(analysis);
        }

    } catch(e) { 
        console.error(e);
        if (e !== "KEY_REQUIRED") alert("Error en captura técnica.");
    } finally { setLoading(false); }
  };

  const handleFile = (file: File) => {
    if (file) {
        setPreviewUrl(URL.createObjectURL(file));
        setSessionAnalyses([]);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-16">
       <div className="flex justify-between items-end border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-2xl font-bold">Laboratorio Bio</h2>
            <p className="text-slate-400 text-sm">Análisis de Video Nivel V</p>
          </div>
          <div className="flex gap-2">
            {!hasKey && (
                <button onClick={handleOpenKey} className="bg-red-900/20 border border-red-500/50 text-red-400 px-3 py-1.5 rounded-full text-[10px] font-black uppercase animate-pulse flex items-center gap-1">
                    <Key size={12}/> Activar Pago
                </button>
            )}
            <button onClick={() => setViewHistory(!viewHistory)} className="text-xs bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700"><History size={12} className="inline mr-1"/> Historial</button>
          </div>
       </div>

       {!previewUrl ? (
           <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-slate-700 rounded-2xl aspect-video flex flex-col items-center justify-center cursor-pointer hover:bg-slate-900/50 transition-all group">
               <input type="file" ref={fileInputRef} hidden onChange={(e) => handleFile(e.target.files![0])} accept="video/*" />
               <UploadCloud size={48} className="text-slate-500 mb-4 group-hover:text-cyan-400 transition-colors" />
               <span className="font-bold text-slate-300">Cargar Video de Entrenamiento</span>
               <p className="text-[10px] text-slate-500 mt-2 uppercase tracking-widest">Formatos soportados: MP4, MOV</p>
           </div>
       ) : (
           <div className="space-y-6">
                <div className="relative rounded-2xl overflow-hidden bg-black aspect-video border border-slate-800 shadow-2xl">
                    <video ref={videoRef} src={previewUrl} className="w-full h-full object-contain" muted playsInline />
                    <div className="absolute top-4 left-4 flex gap-2">
                        <span className="bg-black/60 backdrop-blur px-2 py-1 rounded border border-white/10 text-[10px] font-mono text-white flex items-center gap-1">
                            <Microscope size={10}/> SCAN_READY
                        </span>
                    </div>
                </div>

                {/* SELECTOR DE MODO */}
                <div className="grid grid-cols-2 gap-3 p-1 bg-slate-900 rounded-xl border border-slate-800">
                    <button 
                        onClick={() => setAnalysisMode('Personal')}
                        className={`py-3 rounded-lg flex flex-col items-center justify-center gap-1 transition-all ${analysisMode === 'Personal' ? 'bg-slate-800 border border-slate-700 text-white shadow-lg' : 'text-slate-500 hover:text-slate-400'}`}
                    >
                        <Info size={16}/>
                        <span className="text-[10px] font-black uppercase tracking-widest">Didáctico</span>
                        <span className="text-[8px] opacity-50 font-medium">(Flash - No Guardar)</span>
                    </button>
                    <button 
                        onClick={() => setAnalysisMode('External')}
                        className={`py-3 rounded-lg flex flex-col items-center justify-center gap-1 transition-all ${analysisMode === 'External' ? 'bg-indigo-900/30 border border-indigo-500/50 text-indigo-400 shadow-lg' : 'text-slate-500 hover:text-slate-400'}`}
                    >
                        <ShieldCheck size={16}/>
                        <span className="text-[10px] font-black uppercase tracking-widest">Externo Pro</span>
                        <span className="text-[8px] opacity-50 font-medium">(Pro - Guardar Historial)</span>
                    </button>
                </div>

                <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 flex gap-3 sticky bottom-20 z-10 backdrop-blur-md">
                    <button onClick={handleAutoCapture} disabled={loading} className={`flex-1 ${analysisMode === 'External' ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-cyan-600 hover:bg-cyan-500'} text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 text-sm shadow-xl active:scale-95 transition-all disabled:opacity-50`}>
                        {loading ? <Loader2 className="animate-spin" /> : <ScanLine />} 
                        {loading ? statusMessage : analysisMode === 'External' ? 'Ejecutar Auditoría Pro' : 'Analizar Técnica'}
                    </button>
                    <button onClick={() => setPreviewUrl(null)} className="p-3 bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors"><X size={20}/></button>
                </div>

                <div className="space-y-4">
                    {sessionAnalyses.map(analysis => (
                        <div key={analysis.id} className="bg-slate-900 border border-slate-700 p-5 rounded-2xl space-y-4 animate-in slide-in-from-bottom-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className={`font-bold text-lg ${analysis.category === 'External' ? 'text-indigo-400' : 'text-white'}`}>{analysis.phaseDetected}</h3>
                                    <div className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-1">
                                        Motor: {analysis.category === 'External' ? 'Gemini 3 Pro' : 'Gemini 3 Flash'}
                                    </div>
                                </div>
                                <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-lg font-bold text-sm border border-emerald-500/30">{analysis.score}</span>
                            </div>
                            
                            <div className="grid grid-cols-3 gap-2">
                                 <MetricBox label="VEL" value={analysis.kinetics?.comVelocity || '--'} />
                                 <MetricBox label="GCT" value={analysis.groundContactTimeEstimate || '--'} />
                                 <MetricBox label="EFF" value={`${analysis.kinetics?.forceApplicationIndex || '--'}%`} />
                            </div>

                            <div className="space-y-2">
                                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Gritos del Coach</h4>
                                <div className="flex flex-wrap gap-2">
                                    {analysis.coachShouts.map((s, i) => (
                                        <span key={i} className="text-xs bg-slate-800 px-3 py-1 rounded-full text-slate-300 font-medium">"{s}"</span>
                                    ))}
                                </div>
                            </div>

                            {analysis.category === 'External' && (
                                <div className="p-3 bg-indigo-900/10 border border-indigo-500/20 rounded-xl">
                                    <p className="text-[11px] text-indigo-300 italic">Este análisis ha sido sincronizado con tu pasaporte de atleta.</p>
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
    <div className="bg-slate-950 p-2 rounded border border-slate-800/50 text-center">
        <div className="text-[9px] text-slate-500 uppercase font-bold tracking-tighter">{label}</div>
        <div className="text-sm font-mono text-white font-bold">{value}</div>
    </div>
);

export default VideoAnalyzer;
