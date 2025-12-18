
import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
// Fix: removed non-existent hasApiKey import from services
import { analyzeTechnique } from '../services/geminiService';
import { LocalExpert } from '../services/localExpert';
import { ElitePhysicsEngine, AdvancedMetrics, calculateAngle } from '../utils/biomechanicsUtils';
import { BiomechanicalAnalysis, KineticMetrics } from '../types';
import { Loader2, AlertTriangle, CheckCircle, History, ScanLine, UploadCloud, Play, Video, Share, Info, UserCircle2, GraduationCap, FileText, MessageCircle, Activity, LocateFixed, Eye, X, Table2, MousePointerClick, Maximize2, UserCog, Wrench, Megaphone, SplitSquareHorizontal, WifiOff, Sparkles, RefreshCw, Pause, Key } from 'lucide-react';
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

const getAIStudio = () => (window as any).aistudio;

const VideoAnalyzer: React.FC = () => {
  const { saveAnalysis, analysisHistory, userProfile, updateAnalysis } = useApp();
  const [sessionAnalyses, setSessionAnalyses] = useState<BiomechanicalAnalysis[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [isVideo, setIsVideo] = useState(false);
  const [viewHistory, setViewHistory] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [poseLandmarker, setPoseLandmarker] = useState<PoseLandmarker | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [displayData, setDisplayData] = useState<any>(null);
  const [displayAdvanced, setDisplayAdvanced] = useState<AdvancedMetrics>({ strideLength: '-', velocity: '-' });
  const [comLocation, setComLocation] = useState<{x:number, y:number} | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [frameCache, setFrameCache] = useState<any[]>([]); 
  const [analysisMode, setAnalysisMode] = useState<'Personal' | 'External'>('Personal');
  const [syncingId, setSyncingId] = useState<string | null>(null);
  // Fix: added local state for key tracking
  const [hasKey, setHasKey] = useState<boolean>(true);

  const physicsEngine = useRef<ElitePhysicsEngine>(new ElitePhysicsEngine());
  const isMounted = useRef(true);
  const lastVideoTimestamp = useRef<number>(-1);
  const isScanning = useRef<boolean>(false);
  const requestRef = useRef<number>(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
    
    // Fix: check for selected API key on component mount
    const checkKey = async () => {
      const aistudio = getAIStudio();
      if (aistudio) {
        const selected = await aistudio.hasSelectedApiKey();
        setHasKey(selected);
      }
    };

    initMediaPipe();
    checkKey();
    return () => { isMounted.current = false; cancelAnimationFrame(requestRef.current); };
  }, []);

  const handleOpenKey = async () => {
      const aistudio = getAIStudio();
      if (aistudio) {
        await aistudio.openSelectKey();
        // Fix: assume success after triggering key selection per guidelines
        setHasKey(true);
      }
  };

  const handleAutoCapture = async () => {
    if(!previewUrl || !videoRef.current) return;
    setLoading(true);
    isScanning.current = true;
    setStatusMessage("Escaneando Puntos de Control...");
    
    try {
        const video = videoRef.current;
        const duration = video.duration;
        const scanSteps = 20; 
        const tempHistory: any[] = [];

        for (let i = 0; i <= scanSteps; i++) {
            const time = (duration / scanSteps) * i;
            video.currentTime = time;
            await new Promise(r => setTimeout(r, 100)); 
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

        setStatusMessage("Razonamiento Nivel V...");
        
        let analysis: BiomechanicalAnalysis;
        try {
            const result = await analyzeTechnique([capturedImageBase64], bestFrame.mechanics, bestFrame.advanced, analysisMode);
            if (!result) throw new Error("Gemini Null");
            analysis = { ...result, id: Date.now().toString(), type: 'Single', thumbnail: `data:image/jpeg;base64,${capturedImageBase64}`, kinetics: { comVelocity: bestFrame.advanced.velocity, forceApplicationIndex: bestFrame.advanced.forceFactor, verticalOscillation: bestFrame.advanced.verticalOscillation }, timestamp: bestFrame.timestamp / 1000 };
        } catch (e) {
            analysis = { ...LocalExpert.analyze(bestFrame.mechanics, bestFrame.advanced, { comVelocity: bestFrame.advanced.velocity, forceApplicationIndex: bestFrame.advanced.forceFactor, verticalOscillation: bestFrame.advanced.verticalOscillation }), thumbnail: `data:image/jpeg;base64,${capturedImageBase64}`, timestamp: bestFrame.timestamp / 1000 };
        }

        setSessionAnalyses(prev => [analysis, ...prev]);
        if (analysisMode === 'Personal') saveAnalysis(analysis);

    } catch(e) { 
        console.error(e);
        alert("Error en captura. Asegúrate de tener luz y contraste.");
    } finally { setLoading(false); isScanning.current = false; }
  };

  const handleFile = (file: File) => {
    if (file) {
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
        setIsVideo(file.type.startsWith('video/'));
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-16">
       <div className="flex justify-between items-end border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-2xl font-bold">Bio-Mecánica</h2>
            <p className="text-slate-400 text-sm">Laboratorio Nivel V</p>
          </div>
          <div className="flex gap-2">
            {/* Fix: use local hasKey state instead of non-existent hasApiKey function */}
            {!hasKey && (
                <button onClick={handleOpenKey} className="bg-red-900/20 border border-red-500/50 text-red-400 px-3 py-1.5 rounded-full text-[10px] font-black uppercase animate-pulse flex items-center gap-1">
                    <Key size={12}/> Configurar Key
                </button>
            )}
            <button onClick={() => setViewHistory(!viewHistory)} className="text-xs bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700"><History size={12} className="inline mr-1"/> Historial</button>
          </div>
       </div>

       {/* UI Principal (Mismo diseño, pero con lógica de Key) */}
       {!previewUrl ? (
           <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-slate-700 rounded-2xl aspect-video flex flex-col items-center justify-center cursor-pointer hover:bg-slate-900/50 transition-all">
               <input type="file" ref={fileInputRef} hidden onChange={(e) => handleFile(e.target.files![0])} />
               <UploadCloud size={48} className="text-slate-500 mb-4" />
               <span className="font-bold text-slate-300">Subir Video de Sprint</span>
           </div>
       ) : (
           <div className="space-y-6">
                <div className="relative rounded-2xl overflow-hidden bg-black aspect-video border border-slate-800 shadow-2xl">
                    <video ref={videoRef} src={previewUrl} className="w-full h-full object-contain" muted playsInline />
                    <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />
                </div>

                <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 flex gap-3 sticky bottom-20 z-10">
                    <button onClick={handleAutoCapture} disabled={loading} className="flex-1 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 text-sm shadow-xl active:scale-95 transition-all">
                        {loading ? <Loader2 className="animate-spin" /> : <ScanLine />} {loading ? statusMessage : '⚡ Auditoría Técnica Pro'}
                    </button>
                    <button onClick={() => setPreviewUrl(null)} className="p-3 bg-slate-800 rounded-lg text-slate-300"><UploadCloud size={20}/></button>
                </div>

                {sessionAnalyses.map(analysis => (
                    <div key={analysis.id} className="bg-slate-900 border border-slate-700 p-5 rounded-2xl space-y-4 animate-in slide-in-from-bottom-4">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="font-bold text-lg text-white">{analysis.phaseDetected}</h3>
                                <div className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-1">Auditado por Gemini Pro</div>
                            </div>
                            <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-lg font-bold text-sm">{analysis.score}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                             <div className="bg-slate-950 p-2 rounded text-center">
                                 <div className="text-[9px] text-slate-500 uppercase font-bold">Velocidad</div>
                                 <div className="text-sm font-mono text-white">{analysis.kinetics?.comVelocity || '--'}</div>
                             </div>
                             <div className="bg-slate-950 p-2 rounded text-center">
                                 <div className="text-[9px] text-slate-500 uppercase font-bold">GCT</div>
                                 <div className="text-sm font-mono text-white">{analysis.groundContactTimeEstimate || '--'}</div>
                             </div>
                             <div className="bg-slate-950 p-2 rounded text-center">
                                 <div className="text-[9px] text-slate-500 uppercase font-bold">Eficiencia</div>
                                 <div className="text-sm font-mono text-white">{analysis.kinetics?.forceApplicationIndex || '--'}</div>
                             </div>
                        </div>
                    </div>
                ))}
           </div>
       )}
    </div>
  );
};

export default VideoAnalyzer;
