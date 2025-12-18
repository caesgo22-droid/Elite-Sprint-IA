import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { analyzeTechnique } from '../services/geminiService';
import { LocalExpert } from '../services/localExpert';
import { ElitePhysicsEngine } from '../utils/biomechanicsUtils';
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
    if (aistudio) {
        const keyExists = await aistudio.hasSelectedApiKey();
        setHasKey(keyExists);
    }
  };

  const handleOpenKey = async () => {
      const aistudio = getAIStudio();
      if (aistudio) {
        await aistudio.openSelectKey();
        setHasKey(true);
      }
  };

  const handleAutoCapture = async () => {
    if(!previewUrl || !videoRef.current || !poseLandmarker) return;
    setLoading(true);
    setCapturedFrames([]);
    setStatusMessage("Inicializando Scan...");
    physicsEngine.current.reset();
    
    try {
        const video = videoRef.current;
        const duration = video.duration;
        const scanSteps = 15; 
        const tempHistory: any[] = [];
        const frames: string[] = [];

        // CRITICAL: Use a synthetic strictly increasing timestamp to avoid MediaPipe Graph errors
        let frameTimestamp = 0;

        for (let i = 0; i <= scanSteps; i++) {
            const time = (duration / scanSteps) * i;
            video.currentTime = time;
            
            // Wait for video frame to be ready and seeked
            await new Promise((resolve) => {
                const onSeeked = () => {
                    video.removeEventListener('seeked', onSeeked);
                    resolve(true);
                };
                video.addEventListener('seeked', onSeeked);
            });

            // Ensure video state is ready
            if (video.readyState < 2) {
                await new Promise(r => setTimeout(r, 100));
            }

            frameTimestamp += 100; // Step by 100ms synthetically to guarantee monotonicity
            
            const result = poseLandmarker.detectForVideo(video, frameTimestamp);
            
            if(result?.landmarks?.[0]) {
                const landmarks = result.landmarks[0];
                const com = physicsEngine.current.calculateCenterOfMass(landmarks);
                const mechanics = physicsEngine.current.calculateSprintMechanics(landmarks);
                const advanced = physicsEngine.current.estimateStrideParams(landmarks, userProfile.height || 175, time * 1000, com);
                
                tempHistory.push({ landmarks, mechanics, advanced, com, timestamp: frameTimestamp });
                
                const canvas = document.createElement('canvas');
                canvas.width = 160; canvas.height = 90;
                canvas.getContext('2d')?.drawImage(video, 0, 0, 160, 90);
                frames.push(canvas.toDataURL('image/jpeg', 0.5));
            }
            setStatusMessage(`Escaneando: ${Math.round((i/scanSteps)*100)}%`);
        }

        if (tempHistory.length === 0) {
            throw new Error("No se detectó el cuerpo del atleta. Asegúrate de que el video tenga buena luz y el atleta esté de cuerpo completo.");
        }

        setCapturedFrames(frames);
        const { maxExtensionFrame } = physicsEngine.current.detectSprintPhases(tempHistory);
        const bestFrame = maxExtensionFrame || tempHistory[Math.floor(tempHistory.length/2)];

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        canvas.getContext('2d')?.drawImage(video, 0, 0);
        const capturedImageBase64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

        setStatusMessage(analysisMode === 'External' ? "Auditoría Gemini Pro..." : "Analizando Técnica...");
        
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

    } catch(e: any) { 
        alert(e.message || "Fallo en el análisis biomecánico.");
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20 px-2">
       <div className="flex justify-between items-end border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-xl font-black text-white uppercase tracking-tight">Laboratorio Bio</h2>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">Video Audit v2.1 Pro</p>
          </div>
          <div className="flex gap-2">
            {!hasKey && (
                <button onClick={handleOpenKey} className="bg-red-500/10 border border-red-500/30 text-red-500 px-3 py-1.5 rounded-full text-[9px] font-black uppercase flex items-center gap-1 animate-pulse">
                    <Key size={10}/> Requiere API
                </button>
            )}
            <button onClick={() => setViewHistory(!viewHistory)} className="text-[9px] font-black uppercase tracking-widest bg-slate-800 px-4 py-2 rounded-full border border-slate-700 text-slate-400 hover:text-white transition-all"><History size={12} className="inline mr-1"/> Historial</button>
          </div>
       </div>

       {!previewUrl ? (
           <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-slate-700 rounded-[2.5rem] aspect-video flex flex-col items-center justify-center cursor-pointer hover:bg-slate-900/50 transition-all group overflow-hidden relative">
               <input type="file" ref={fileInputRef} hidden onChange={(e) => setPreviewUrl(URL.createObjectURL(e.target.files![0]))} accept="video/*" />
               <UploadCloud size={36} className="text-slate-500 group-hover:text-cyan-400 mb-4" />
               <span className="font-black text-slate-300 uppercase tracking-widest text-xs">Cargar Sprint</span>
               <p className="text-[9px] text-slate-600 mt-2 font-bold">MP4 / MOV / AVI</p>
           </div>
       ) : (
           <div className="space-y-6">
                <div className="relative rounded-[2rem] overflow-hidden bg-black aspect-video border border-slate-800 shadow-2xl group">
                    <video ref={videoRef} src={previewUrl} className="w-full h-full object-contain" muted playsInline />
                    {capturedFrames.length > 0 && (
                        <div className="absolute bottom-4 left-4 right-4 flex gap-1 overflow-x-auto p-2 bg-black/60 backdrop-blur-md rounded-xl border border-white/10 animate-in slide-in-from-bottom-2">
                            {capturedFrames.map((f, i) => <img key={i} src={f} className="h-10 rounded border border-white/10 shrink-0" />)}
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-900 rounded-3xl border border-slate-800 shadow-lg">
                    <button onClick={() => setAnalysisMode('Personal')} className={`py-4 rounded-2xl flex flex-col items-center gap-1 transition-all ${analysisMode === 'Personal' ? 'bg-slate-800 border border-slate-700 text-white shadow-md' : 'text-slate-500'}`}>
                        <Info size={16}/>
                        <span className="text-[10px] font-black uppercase tracking-widest">Didáctico</span>
                        <span className="text-[8px] opacity-40 font-bold">(Local Core)</span>
                    </button>
                    <button onClick={() => setAnalysisMode('External')} className={`py-4 rounded-2xl flex flex-col items-center gap-1 transition-all ${analysisMode === 'External' ? 'bg-indigo-900/40 border border-indigo-500/50 text-indigo-400 shadow-md' : 'text-slate-500'}`}>
                        <ShieldCheck size={16}/>
                        <span className="text-[10px] font-black uppercase tracking-widest">Auditoría Pro</span>
                        <span className="text-[8px] opacity-40 font-bold">(Gemini Flash/Pro)</span>
                    </button>
                </div>

                <div className="bg-slate-900/95 p-4 rounded-3xl border border-slate-800 flex gap-3 sticky bottom-20 z-10 backdrop-blur-xl shadow-2xl">
                    <button onClick={handleAutoCapture} disabled={loading} className={`flex-1 ${analysisMode === 'External' ? 'bg-indigo-600' : 'bg-cyan-600'} text-white font-black py-5 rounded-2xl flex items-center justify-center gap-4 text-sm transition-all active:scale-95 shadow-xl disabled:opacity-50 uppercase tracking-widest`}>
                        {loading ? <Loader2 className="animate-spin" /> : <ScanLine />} 
                        {loading ? statusMessage : 'Iniciar Escaneo Técnico'}
                    </button>
                    <button onClick={() => setPreviewUrl(null)} className="p-5 bg-slate-800 rounded-2xl text-slate-400 hover:text-white border border-slate-700"><X size={20}/></button>
                </div>

                <div className="space-y-4">
                    {sessionAnalyses.map(analysis => (
                        <div key={analysis.id} className="bg-slate-900 border border-slate-700 p-6 rounded-[2rem] space-y-6 animate-in slide-in-from-bottom-4 shadow-2xl overflow-hidden">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className={`font-black text-2xl tracking-tighter uppercase ${analysis.category === 'External' ? 'text-indigo-400' : 'text-white'}`}>{analysis.phaseDetected}</h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Microscope size={12} className="text-slate-500"/>
                                        <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Motor: {analysis.category === 'External' ? 'Cloud Gemini' : 'Local Heuristic'}</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-3xl font-black text-emerald-400 tracking-tighter">{analysis.score}</div>
                                    <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Score Técnico</div>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-3 gap-2">
                                 <MetricBox label="VEL (m/s)" value={analysis.kinetics?.comVelocity?.split(' ')[0] || '--'} />
                                 <MetricBox label="GCT (sec)" value={analysis.groundContactTimeEstimate || '--'} />
                                 <MetricBox label="EFICIENCIA" value={`${analysis.kinetics?.forceApplicationIndex || '--'}%`} />
                            </div>

                            <div className="space-y-3">
                                <div className="flex flex-wrap gap-2 justify-center">
                                    {analysis.coachShouts.map((s, i) => (
                                        <span key={i} className="text-[10px] bg-slate-950 border border-slate-800 px-4 py-2 rounded-full text-slate-200 font-black italic shadow-inner">"{s}"</span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
           </div>
       )}
    </div>
  );
};

const MetricBox = ({ label, value }: { label: string, value: string }) => (
    <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800/50 text-center shadow-inner">
        <div className="text-[8px] text-slate-600 uppercase font-black tracking-widest mb-1">{label}</div>
        <div className="text-sm font-mono text-white font-black">{value}</div>
    </div>
);

export default VideoAnalyzer;