
import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { analyzeTechnique, hasApiKey } from '../services/geminiService';
import { ElitePhysicsEngine, AdvancedMetrics, calculateAngle } from '../utils/biomechanicsUtils';
import { BiomechanicalAnalysis, KineticMetrics } from '../types';
import { Loader2, AlertTriangle, CheckCircle, History, ScanLine, UploadCloud, Play, Video, Share, Info, UserCircle2, GraduationCap, FileText, MessageCircle, Activity, LocateFixed, Eye, X, Table2, MousePointerClick, Maximize2 } from 'lucide-react';
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

const VideoAnalyzer: React.FC = () => {
  const { saveAnalysis, analysisHistory, userProfile } = useApp();
  const [sessionAnalyses, setSessionAnalyses] = useState<BiomechanicalAnalysis[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [isVideo, setIsVideo] = useState(false);
  const [viewHistory, setViewHistory] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [poseLandmarker, setPoseLandmarker] = useState<PoseLandmarker | null>(null);
  
  // DATA STATE
  const [displayData, setDisplayData] = useState<any>(null);
  const [displayAdvanced, setDisplayAdvanced] = useState<AdvancedMetrics>({ strideLength: '-', velocity: '-' });
  const [comLocation, setComLocation] = useState<{x:number, y:number} | null>(null);
  
  // FRAME PERFECT STATE
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [frameCache, setFrameCache] = useState<any[]>([]); // Stores landmarks for every scanned frame
  
  const [analysisMode, setAnalysisMode] = useState<'Personal' | 'External'>('Personal');
  const [activeTooltip, setActiveTooltip] = useState<{title: string, text: string} | null>(null);
  const [showReportModal, setShowReportModal] = useState<BiomechanicalAnalysis | null>(null);

  const physicsEngine = useRef<ElitePhysicsEngine>(new ElitePhysicsEngine());
  const isMounted = useRef(true);
  
  // CRITICAL FIX: Track timestamps to prevent MediaPipe crash on seek
  const lastVideoTimestamp = useRef<number>(-1);
  const isScanning = useRef<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    isMounted.current = true;
    const initMediaPipe = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/wasm");
        if (!isMounted.current) return;
        
        // UPGRADE: Using FULL model instead of LITE for better detection at distance
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task`, delegate: "GPU" },
          runningMode: "VIDEO", numPoses: 1
        });
        
        if (isMounted.current) {
            setPoseLandmarker(landmarker);
        } else {
            landmarker.close();
        }
      } catch (error) { console.error("MediaPipe Error:", error); }
    };
    initMediaPipe();
    
    return () => { isMounted.current = false; };
  }, []);

  const handleFile = (file: File) => {
    if (file) {
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
        setSessionAnalyses([]);
        setIsVideo(file.type.startsWith('video/'));
        setDisplayData(null);
        setDisplayAdvanced({ strideLength: '-', velocity: '-' });
        setComLocation(null);
        setFrameCache([]); // Reset cache
        lastVideoTimestamp.current = -1; // Reset timestamp tracker
        physicsEngine.current.reset();
        setTimeout(() => { if(videoRef.current) { videoRef.current.load(); } }, 500);
    }
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); };
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]); };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };

  // --- CORE DETECTION LOGIC (Returns data, doesn't just set state) ---
  const performDetection = (video: HTMLVideoElement, timestamp: number) => {
      if (!poseLandmarker) return null;
      
      try {
          // STRICT SAFETY CHECK: If timestamp goes backwards, ABORT immediately.
          // This prevents "Packet timestamp mismatch" crash in MediaPipe.
          if (timestamp <= lastVideoTimestamp.current) {
             return null; 
          }
          lastVideoTimestamp.current = timestamp;

          const result = poseLandmarker.detectForVideo(video, timestamp);
          
          if (result.landmarks && result.landmarks.length > 0) {
              const landmarks = result.landmarks[0];
              
              // 1. Calculate CoM
              const com = physicsEngine.current.calculateCenterOfMass(landmarks);
              setComLocation(com);
              
              // 2. Calculate Mechanics
              const mechanics = physicsEngine.current.calculateSprintMechanics(landmarks);
              setDisplayData(mechanics);

              // 3. Calculate Advanced Metrics (now with GCT state)
              const advanced = physicsEngine.current.estimateStrideParams(landmarks, userProfile.height || 175, timestamp, com);
              setDisplayAdvanced(advanced);

              // RETURN DATA FOR API USE
              return { landmarks, mechanics, advanced, com, timestamp };
          }
      } catch (e) {
          console.warn("MediaPipe Detection Glitch (Ignored):", e);
          // Force reset tracking on error to be safe
          try { lastVideoTimestamp.current = -1; } catch(err) {}
      }
      return null;
  };

  const drawSkeleton = (landmarks: any, com: any) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const drawLine = (i: number, j: number, color: string, width: number) => {
          if(landmarks[i] && landmarks[j]) {
              ctx.beginPath();
              ctx.moveTo(landmarks[i].x * canvas.width, landmarks[i].y * canvas.height);
              ctx.lineTo(landmarks[j].x * canvas.width, landmarks[j].y * canvas.height);
              ctx.strokeStyle = color;
              ctx.lineWidth = width;
              ctx.stroke();
          }
      }

      // Draw Angle Arc Helper
      const drawAngleVisual = (p1: any, p2: any, p3: any, label: string, colorCode: string) => {
          if (!p1 || !p2 || !p3) return;
          const radius = 20;
          const ax = p2.x * canvas.width;
          const ay = p2.y * canvas.height;
          const startAngle = Math.atan2(p1.y - p2.y, p1.x - p2.x);
          const endAngle = Math.atan2(p3.y - p2.y, p3.x - p2.x);
          
          ctx.beginPath();
          ctx.arc(ax, ay, radius, startAngle, endAngle, false); // Arc depends on vector direction
          ctx.strokeStyle = colorCode === 'green' ? '#10b981' : colorCode === 'yellow' ? '#facc15' : '#ef4444';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Label
          ctx.fillStyle = "rgba(0,0,0,0.7)";
          ctx.fillRect(ax + 10, ay - 20, 35, 14);
          ctx.fillStyle = "white";
          ctx.font = "bold 10px monospace";
          ctx.fillText(label, ax + 12, ay - 10);
      };
      
      const RIGHT_SIDE = "#00e5ff"; const LEFT_SIDE = "#ff007f"; const TRUNK = "#ffffff";

      // Limbs
      drawLine(12, 14, RIGHT_SIDE, 3); drawLine(14, 16, RIGHT_SIDE, 3);
      drawLine(24, 26, RIGHT_SIDE, 4); drawLine(26, 28, RIGHT_SIDE, 4);
      drawLine(11, 13, LEFT_SIDE, 3); drawLine(13, 15, LEFT_SIDE, 3);
      drawLine(23, 25, LEFT_SIDE, 4); drawLine(25, 27, LEFT_SIDE, 4);
      drawLine(11, 12, TRUNK, 3); drawLine(23, 24, TRUNK, 3);
      drawLine(11, 23, TRUNK, 3); drawLine(12, 24, TRUNK, 3);

      // CoM
      if (com) {
          const cx = com.x * canvas.width;
          const cy = com.y * canvas.height;
          ctx.beginPath(); ctx.fillStyle = "#ffff00"; ctx.arc(cx, cy, 6, 0, 2*Math.PI); ctx.fill();
          ctx.beginPath(); ctx.strokeStyle = "#ffff00"; ctx.setLineDash([5, 5]); ctx.lineWidth = 1;
          ctx.moveTo(cx, cy); ctx.lineTo(cx, canvas.height); ctx.stroke(); ctx.setLineDash([]);
      }

      // AUGMENTED REALITY ANGLES
      if(landmarks[23] && landmarks[25] && landmarks[27]) {
          const angle = calculateAngle(landmarks[23], landmarks[25], landmarks[27]);
          const color = angle < 60 ? 'green' : 'yellow';
          drawAngleVisual(landmarks[23], landmarks[25], landmarks[27], `${angle}°`, color);
      }
      if(landmarks[11] && landmarks[23] && landmarks[25]) {
          const angle = calculateAngle(landmarks[11], landmarks[23], landmarks[25]);
          const color = angle > 165 ? 'green' : 'yellow';
          drawAngleVisual(landmarks[11], landmarks[23], landmarks[25], `${angle}°`, color);
      }
  };

  const processFrame = (time: number) => {
      if(!videoRef.current || !canvasRef.current) return;
      
      // If we have cached data for this roughly this time, use it
      const cached = frameCache.find(f => Math.abs(f.timestamp - time) < 0.05); // 50ms tolerance
      
      if (cached) {
          drawSkeleton(cached.landmarks, cached.com);
          setDisplayData(cached.mechanics);
          setDisplayAdvanced(cached.advanced);
      } else {
          // New detection
          const data = performDetection(videoRef.current, time * 1000);
          if (data) {
              drawSkeleton(data.landmarks, data.com);
              setFrameCache(prev => [...prev, { ...data, timestamp: time }]);
          }
      }
  };

  const handleTimeUpdate = () => {
      // Prevent conflicts if Auto-Scan is running
      if (isScanning.current) return;

      if(videoRef.current) {
          setCurrentTime(videoRef.current.currentTime);
          if(!videoRef.current.paused) processFrame(videoRef.current.currentTime);
      }
  };

  const handleManualScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
      const time = parseFloat(e.target.value);
      if(videoRef.current) {
          videoRef.current.pause();
          videoRef.current.currentTime = time;
          setCurrentTime(time);
          // Reset safe timestamp for manual jumps
          lastVideoTimestamp.current = -1; 
          setTimeout(() => processFrame(time), 50); 
      }
  };

  const handleLoadedMetadata = () => {
      if(videoRef.current) {
          setVideoDuration(videoRef.current.duration);
          canvasRef.current!.width = videoRef.current.videoWidth;
          canvasRef.current!.height = videoRef.current.videoHeight;
      }
  };

  const handleVerifyAnalysis = (analysis: BiomechanicalAnalysis) => {
      if (videoRef.current && analysis.timestamp) {
          videoRef.current.currentTime = analysis.timestamp;
          videoRef.current.pause();
          lastVideoTimestamp.current = -1; // Reset for jump
          setTimeout(() => processFrame(analysis.timestamp!), 200);
      } else {
          alert("Este análisis antiguo no tiene marca de tiempo guardada.");
      }
  };

  const handleAutoCapture = async () => {
    if(!previewUrl || !videoRef.current) return;
    setLoading(true);
    isScanning.current = true; // Block handleTimeUpdate
    setStatusMessage("Detección de Contacto (GCT)...");
    
    // Reset tracker for scan
    lastVideoTimestamp.current = -1;

    try {
        const video = videoRef.current;
        video.pause();
        const duration = video.duration;
        
        // INCREASED PRECISION: 25 steps for better detection
        const scanSteps = 25; 
        const tempHistory: any[] = [];

        // 1. SCAN PHASE
        for (let i = 0; i <= scanSteps; i++) {
            const time = (duration / scanSteps) * i;
            video.currentTime = time;
            // Wait for seek to complete (basic buffer)
            await new Promise(r => setTimeout(r, 150)); 
            const data = performDetection(video, time * 1000);
            if(data) tempHistory.push(data);
        }

        // 2. LOGIC PHASE
        setStatusMessage("Analizando Puntos Críticos...");
        const { maxFlexionFrame, maxExtensionFrame } = physicsEngine.current.detectSprintPhases(tempHistory);
        // Robust Fallback: If no perfect phase found, use the frame with highest velocity or just middle frame
        const bestFrame = maxExtensionFrame || maxFlexionFrame || tempHistory.sort((a,b) => (b.advanced?.velocity || 0) - (a.advanced?.velocity || 0))[0] || tempHistory[Math.floor(tempHistory.length/2)];
        
        if (!bestFrame) {
            alert("No se detectó un cuerpo claro en el video. Intenta con un video con mejor iluminación o ángulo.");
            setLoading(false);
            isScanning.current = false;
            return;
        }

        // Jump to best frame
        video.currentTime = bestFrame.timestamp / 1000;
        await new Promise(r => setTimeout(r, 300));
        drawSkeleton(bestFrame.landmarks, bestFrame.com); 

        // 3. CAPTURE PHASE
        const canvas = document.createElement('canvas');
        const MAX_DIMENSION = 640;
        const scale = Math.min(1, MAX_DIMENSION / Math.max(video.videoWidth, video.videoHeight));
        canvas.width = video.videoWidth * scale;
        canvas.height = video.videoHeight * scale;
        const ctx = canvas.getContext('2d');
        let capturedImageBase64 = "";
        
        if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            capturedImageBase64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
        }

        setStatusMessage("Consultando Motor de Física...");
        
        // Populate Kinetics accurately from the Physics Engine data
        const kinetics: KineticMetrics = {
            verticalOscillation: bestFrame.advanced?.verticalOscillation || "N/A",
            forceApplicationIndex: bestFrame.advanced?.forceFactor || 0,
            comVelocity: bestFrame.advanced?.velocity || "N/A",
            groundContactTime: bestFrame.advanced?.groundContactTime,
            airTime: bestFrame.advanced?.airTime,
            strideFreq: bestFrame.advanced?.frequency
        };

        const result = await analyzeTechnique([capturedImageBase64], bestFrame.mechanics, bestFrame.advanced, analysisMode);
        
        if(result) {
             const analysis: BiomechanicalAnalysis = { 
                 ...result, 
                 id: Date.now().toString(), 
                 type: 'Single', 
                 thumbnail: `data:image/jpeg;base64,${capturedImageBase64}`, 
                 kinetics: kinetics,
                 timestamp: bestFrame.timestamp / 1000 
             };
             setSessionAnalyses(prev => [analysis, ...prev]);
             if (analysisMode === 'Personal') saveAnalysis(analysis);
        } else {
            alert("No se pudo obtener una respuesta de la IA. \n\nCausa probable: Falta la API Key de Gemini en el servidor (Vercel).");
        }

    } catch(e: any) { 
        console.error("Auto-Capture error:", e);
        if (e.message === "QUOTA_EXCEEDED" || e.message?.includes("429")) {
            alert("⚠️ Límite de cuota de IA excedido (Error 429).\n\nHas alcanzado el límite gratuito de Gemini por minuto/día. Intenta de nuevo en unos momentos.");
        } else if (e.message === "API_KEY_MISSING") {
             alert("Error: Falta la API Key en el servidor.");
        } else {
             alert("Error técnico al procesar el video. Verifica tu conexión.");
        }
    } finally { 
        setLoading(false); 
        isScanning.current = false; // Unblock
    }
  };

  const copyAnalysis = async (analysis: BiomechanicalAnalysis) => {
      const text = `ANÁLISIS ELITE SPRINT AI\nFase: ${analysis.phaseDetected}\nScore: ${analysis.score}/100\nErrores: ${analysis.criticalErrors.join(', ')}\nCorrecciones: ${analysis.correctiveDrills.join(', ')}`;
      try { await navigator.clipboard.writeText(text); alert("Reporte copiado."); } catch(e) { console.error(e); }
  };

  const shareAnalysisWhatsapp = (analysis: BiomechanicalAnalysis) => {
    const text = `*ANÁLISIS BIOMECÁNICO*\n\n*Fase:* ${analysis.phaseDetected}\n*Score:* ${analysis.score}/100\n*Errores:* ${analysis.criticalErrors.join(', ')}\n\nGenerado por Elite Sprint AI.`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const InfoButton = ({ title, text }: { title: string, text: string }) => (
      <button onClick={(e) => { e.stopPropagation(); setActiveTooltip({ title, text }); }} className="text-slate-400 hover:text-white ml-1 inline-flex pointer-events-auto"><Info size={10} /></button>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-16">
       <div className="flex justify-between items-end border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-2xl font-bold">Bio-Mecánica</h2>
            <p className="text-slate-400 text-sm">Laboratorio de Precisión</p>
          </div>
          <div className="flex gap-2">
            {!hasApiKey && (
                <div className="bg-red-900/20 border border-red-500/50 text-red-400 px-3 py-1.5 rounded-full text-xs font-bold animate-pulse flex items-center gap-1">
                    <AlertTriangle size={12}/> API Key Missing
                </div>
            )}
            <button onClick={() => setViewHistory(!viewHistory)} className="text-xs bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700 hover:text-cyan-400"><History size={12} className="inline mr-1"/> Historial</button>
          </div>
       </div>

       {viewHistory ? (
           <div className="space-y-3">
               {analysisHistory.filter(h => h.category === 'Personal' || !h.category).map((item, i) => (
                   <div key={i} className="bg-slate-900 p-3 rounded-xl flex gap-4 cursor-pointer hover:bg-slate-800 border border-slate-800 transition-colors" onClick={() => { setSessionAnalyses([item]); setPreviewUrl(item.thumbnail || null); setIsVideo(false); setViewHistory(false); setAnalysisMode(item.category || 'Personal'); }}>
                       {item.thumbnail && <img src={item.thumbnail} className="w-20 h-14 object-cover rounded-lg bg-black" />}
                       <div>
                           <div className="font-bold text-white text-sm">{item.phaseDetected}</div>
                           <div className="flex gap-2 mt-1"><span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400">{new Date(item.savedAt || "").toLocaleDateString()}</span><span className={`text-[10px] px-2 py-0.5 rounded font-bold ${item.score > 80 ? 'text-emerald-400 bg-emerald-900/20' : 'text-yellow-400 bg-yellow-900/20'}`}>Score: {item.score}</span></div>
                       </div>
                   </div>
               ))}
               {analysisHistory.length === 0 && <div className="text-center text-slate-500 text-sm py-4">No hay análisis guardados.</div>}
           </div>
       ) : (
           <>
            {!previewUrl && (
                <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 mb-4">
                    <button onClick={() => setAnalysisMode('Personal')} className={`flex-1 py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${analysisMode === 'Personal' ? 'bg-cyan-900/40 text-cyan-400 border border-cyan-500/50' : 'text-slate-500 hover:text-slate-300'}`}>
                        <UserCircle2 size={18}/> Mi Análisis <span className="hidden sm:inline">(Personal)</span>
                    </button>
                    <button onClick={() => setAnalysisMode('External')} className={`flex-1 py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${analysisMode === 'External' ? 'bg-purple-900/40 text-purple-400 border border-purple-500/50' : 'text-slate-500 hover:text-slate-300'}`}>
                        <GraduationCap size={18}/> Referencia <span className="hidden sm:inline">(Didáctico)</span>
                    </button>
                </div>
            )}

            {!previewUrl ? (
                <div 
                    onClick={() => fileInputRef.current?.click()} 
                    onDragOver={handleDragOver} 
                    onDragLeave={() => setIsDragging(false)} 
                    onDrop={handleDrop} 
                    className={`border-2 border-dashed rounded-2xl aspect-video flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ${isDragging ? 'border-cyan-400 bg-cyan-900/20 scale-105' : 'border-slate-700 hover:border-slate-500 hover:bg-slate-900/50'}`}
                >
                    <input type="file" accept="video/*,image/*" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
                    <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
                        <UploadCloud size={32} className={`transition-colors ${isDragging ? 'text-cyan-400' : 'text-slate-400'}`} />
                    </div>
                    <span className="font-bold text-slate-300 text-lg">Subir Video</span>
                    <p className="text-slate-500 text-xs mt-2">Soporta Slow-Mo 120/240fps</p>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="relative rounded-2xl overflow-hidden bg-black max-h-[65vh] mx-auto shadow-2xl border border-slate-800 ring-1 ring-white/10 flex flex-col items-center bg-contain">
                        {isVideo ? (
                            <video 
                                ref={videoRef} 
                                src={previewUrl} 
                                className="w-full h-auto max-h-[60vh]" 
                                playsInline 
                                muted 
                                onLoadedMetadata={handleLoadedMetadata}
                                onTimeUpdate={handleTimeUpdate}
                            />
                        ) : <img src={previewUrl} className="w-full h-full object-contain" />}
                        <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-90" />
                        
                        {/* Interactive Scrubber Layer */}
                        {isVideo && (
                            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent">
                                <input 
                                    type="range" 
                                    min="0" 
                                    max={videoDuration} 
                                    step="0.01" 
                                    value={currentTime} 
                                    onChange={handleManualScrub}
                                    className="w-full accent-cyan-500 cursor-pointer h-2 bg-white/20 rounded-lg appearance-none"
                                />
                                <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
                                    <span>{currentTime.toFixed(2)}s</span>
                                    <span>{videoDuration.toFixed(2)}s</span>
                                </div>
                            </div>
                        )}

                        {/* DESKTOP HUD */}
                        {displayData && (
                            <div className="hidden md:grid absolute top-4 right-4 gap-2 pointer-events-none">
                                <div className="bg-slate-950/80 backdrop-blur p-2 rounded-lg border border-slate-700 pointer-events-auto w-24">
                                    <div className="text-[10px] text-slate-400 font-bold uppercase">Rodilla</div>
                                    <div className={`text-sm font-mono font-bold ${displayData.knee.color}`}>{displayData.knee.value}</div>
                                </div>
                                <div className="bg-slate-950/80 backdrop-blur p-2 rounded-lg border border-slate-700 pointer-events-auto w-24">
                                    <div className="text-[10px] text-slate-400 font-bold uppercase">GCT (s)</div>
                                    <div className="text-sm font-mono font-bold text-cyan-400">{displayAdvanced.groundContactTime || '-'}</div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* MOBILE HUD - COMPACT ELITE */}
                    {displayData && (
                        <div className="grid grid-cols-4 gap-2 animate-in fade-in">
                            <div className="bg-slate-900 p-2 rounded-xl border border-slate-700 text-center">
                                <div className="text-[9px] text-slate-400 font-bold uppercase">Rodilla</div>
                                <div className={`text-sm font-bold ${displayData.knee.color}`}>{displayData.knee.value}</div>
                            </div>
                            <div className="bg-slate-900 p-2 rounded-xl border border-slate-700 text-center">
                                <div className="text-[9px] text-cyan-400 font-bold uppercase">Velocidad</div>
                                <div className="text-sm font-bold text-white font-mono">{displayAdvanced.velocity}</div>
                            </div>
                            <div className="bg-slate-900 p-2 rounded-xl border border-slate-700 text-center relative overflow-hidden">
                                <div className="text-[9px] text-purple-400 font-bold uppercase">GCT (s)</div>
                                <div className="text-sm font-bold text-white font-mono z-10 relative">{displayAdvanced.groundContactTime || '-'}</div>
                                {displayAdvanced.groundContactTime && parseFloat(displayAdvanced.groundContactTime) < 0.110 && <div className="absolute inset-0 bg-emerald-500/10 animate-pulse"></div>}
                            </div>
                            <div className="bg-slate-900 p-2 rounded-xl border border-slate-700 text-center">
                                <div className="text-[9px] text-orange-400 font-bold uppercase">Freq</div>
                                <div className="text-sm font-bold text-white font-mono">{displayAdvanced.frequency || '-'}</div>
                            </div>
                        </div>
                    )}
                    
                    <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 flex flex-col gap-3 backdrop-blur-sm sticky bottom-20 z-10 shadow-lg">
                        <div className="flex gap-2">
                            <button onClick={handleAutoCapture} disabled={loading || !poseLandmarker} className={`flex-1 bg-gradient-to-r ${analysisMode === 'Personal' ? 'from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500' : 'from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500'} text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 text-sm shadow-lg active:scale-95 transition-all`}>
                                {loading ? <Loader2 className="animate-spin" /> : <ScanLine />} {loading ? statusMessage : '⚡ Detectar Biomecánica'}
                            </button>
                            
                            <button onClick={() => { 
                                if(videoRef.current) { 
                                    if(videoRef.current.paused) videoRef.current.play(); else videoRef.current.pause(); 
                                } 
                            }} className="p-3 bg-slate-800 rounded-lg text-slate-300 hover:text-white border border-slate-700 flex-1 flex items-center justify-center gap-2 font-bold text-xs">
                                <Play size={16}/> Play/Pause
                            </button>

                            <button onClick={() => {setSessionAnalyses([]); setPreviewUrl(null); setDisplayData(null); setDisplayAdvanced({ strideLength: '-', velocity: '-' }); setComLocation(null);}} className="p-3 bg-slate-800 rounded-lg text-slate-300 hover:text-white border border-slate-700" title="Nuevo Video"><UploadCloud size={20}/></button>
                        </div>
                    </div>
                    
                    {sessionAnalyses.map((analysis) => (
                        <div key={analysis.id} className={`bg-slate-900/90 border p-5 rounded-2xl space-y-4 animate-in slide-in-from-bottom-4 ${analysis.category === 'External' ? 'border-purple-500/30' : 'border-slate-700'}`}>
                            <div className="flex justify-between items-start border-b border-slate-800 pb-3">
                                <div>
                                    <h3 className="font-bold text-xl text-white tracking-tight">{analysis.phaseDetected}</h3>
                                    <span className="text-xs text-slate-500 uppercase tracking-widest">{analysis.type === 'Sequence' ? 'Kinograma Completo' : 'Smart Capture'}</span>
                                </div>
                                <div className="flex gap-2">
                                    <span className={`px-3 py-1 rounded-lg text-sm font-bold ${analysis.score > 80 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{analysis.score}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={() => handleVerifyAnalysis(analysis)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs py-2 rounded-lg font-bold border border-slate-600 flex items-center justify-center gap-1">
                                    <Eye size={14} className="text-cyan-400"/> 📍 Ir al Frame
                                </button>
                                <button onClick={() => setShowReportModal(analysis)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs py-2 rounded-lg font-bold border border-slate-600 flex items-center justify-center gap-1">
                                    <Table2 size={14} className="text-purple-400"/> 📑 Reporte Completo
                                </button>
                            </div>
                            
                            {/* KINETICS CARD with Tooltips and Null Handling */}
                            {analysis.kinetics && (
                                <div className="grid grid-cols-3 gap-2 bg-slate-950/50 p-2 rounded-lg border border-slate-800 relative">
                                    <div className="text-center">
                                        <div className="text-[10px] text-slate-500 uppercase font-bold flex items-center justify-center gap-1">
                                            Oscilación <InfoButton title="Oscilación Vertical" text="Desplazamiento del Centro de Masa. Menos es más eficiente."/>
                                        </div>
                                        <div className="text-sm font-mono text-white">{analysis.kinetics.verticalOscillation !== '-' ? analysis.kinetics.verticalOscillation : <span className="text-slate-600">--</span>}</div>
                                    </div>
                                    <div className="text-center border-l border-slate-800">
                                        <div className="text-[10px] text-slate-500 uppercase font-bold flex items-center justify-center gap-1">
                                            GCT <InfoButton title="Ground Contact Time" text="Tiempo de contacto. Elite < 0.10s. Si está vacío, video muy corto."/>
                                        </div>
                                        <div className={`text-sm font-mono font-bold ${analysis.kinetics.groundContactTime && parseFloat(analysis.kinetics.groundContactTime) < 0.12 ? 'text-emerald-400' : 'text-white'}`}>
                                            {analysis.kinetics.groundContactTime || <span className="text-slate-600 font-normal">Calc...</span>}
                                        </div>
                                    </div>
                                    <div className="text-center border-l border-slate-800">
                                        <div className="text-[10px] text-slate-500 uppercase font-bold flex items-center justify-center gap-1">
                                            Force Eff. <InfoButton title="Force Efficiency" text="Índice de aplicación de fuerza horizontal (0-100)."/>
                                        </div>
                                        <div className="text-sm font-mono text-white">
                                            {analysis.kinetics.forceApplicationIndex > 0 ? `${analysis.kinetics.forceApplicationIndex}/100` : <span className="text-slate-600">--</span>}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {analysis.criticalErrors.length > 0 && (<div className="bg-red-900/10 border-l-4 border-red-500 p-3 rounded-r-lg"><h4 className="text-xs font-bold text-red-400 uppercase mb-2 flex items-center gap-2"><AlertTriangle size={12}/> Errores Críticos</h4><ul className="space-y-1">{analysis.criticalErrors.map((err, i) => <li key={i} className="text-sm text-slate-300">• {err}</li>)}</ul></div>)}
                            
                            <div>
                                <h4 className="text-xs font-bold text-emerald-400 uppercase mb-2 flex items-center gap-2"><CheckCircle size={12}/> Correcciones & Drills</h4>
                                <div className="flex flex-wrap gap-2">{analysis.correctiveDrills.map((drill, i) => (<a key={i} href={`https://www.youtube.com/results?search_query=track+and+field+drill+${drill.replace(/\s/g, '+')}`} target="_blank" rel="noopener noreferrer" className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-400 text-xs px-3 py-1.5 rounded-full flex items-center gap-1 transition-colors"><Play size={10} fill="currentColor"/> {drill}</a>))}</div>
                            </div>
                            
                            <div className="flex gap-2 pt-2 border-t border-slate-800 justify-end">
                                <button onClick={() => shareAnalysisWhatsapp(analysis)} className="text-emerald-400 hover:text-emerald-300 text-xs font-bold flex items-center gap-1"><MessageCircle size={14}/> Enviar WA</button>
                                <button onClick={() => copyAnalysis(analysis)} className="text-slate-400 hover:text-white text-xs font-bold flex items-center gap-1"><Share size={14}/> Copiar Texto</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
           </>
       )}

       {/* REPORT MODAL */}
       {showReportModal && (
           <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in" onClick={() => setShowReportModal(null)}>
               <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
                   <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-4 border-b border-slate-700 flex justify-between items-center">
                       <div>
                           <h3 className="font-bold text-white flex items-center gap-2"><Activity className="text-cyan-400"/> Reporte Biomecánico</h3>
                           <p className="text-[10px] text-slate-400 uppercase tracking-widest">{new Date().toLocaleDateString()} | Elite Sprint AI</p>
                       </div>
                       <button onClick={() => setShowReportModal(null)}><X className="text-slate-400 hover:text-white"/></button>
                   </div>
                   
                   <div className="p-4 space-y-4">
                       {/* Header Stats */}
                       <div className="flex gap-2">
                           <div className="flex-1 bg-slate-950 p-3 rounded-lg border border-slate-800 text-center">
                               <div className="text-[10px] text-slate-500 uppercase font-bold">Score Técnico</div>
                               <div className={`text-2xl font-bold ${showReportModal.score > 80 ? 'text-emerald-400' : 'text-yellow-400'}`}>{showReportModal.score}</div>
                           </div>
                           <div className="flex-1 bg-slate-950 p-3 rounded-lg border border-slate-800 text-center">
                               <div className="text-[10px] text-slate-500 uppercase font-bold">Fase</div>
                               <div className="text-sm font-bold text-white mt-1 leading-tight">{showReportModal.phaseDetected}</div>
                           </div>
                       </div>

                       {/* Data Table */}
                       <div className="border border-slate-700 rounded-lg overflow-hidden">
                           <table className="w-full text-xs text-left">
                               <thead className="bg-slate-950 text-slate-400 font-bold uppercase">
                                   <tr>
                                       <th className="p-2">Métrica</th>
                                       <th className="p-2">Valor</th>
                                       <th className="p-2 text-right">Estado</th>
                                   </tr>
                               </thead>
                               <tbody className="divide-y divide-slate-800 bg-slate-900">
                                   <tr>
                                       <td className="p-2 text-slate-300">GCT (Contacto)</td>
                                       <td className="p-2 font-mono text-cyan-400 font-bold">{showReportModal.kinetics?.groundContactTime || '-'}</td>
                                       <td className="p-2 text-right"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span></td>
                                   </tr>
                                   <tr>
                                       <td className="p-2 text-slate-300">Vuelo</td>
                                       <td className="p-2 font-mono text-white">{showReportModal.kinetics?.airTime || '-'}</td>
                                       <td className="p-2 text-right"><span className="w-2 h-2 rounded-full bg-slate-500 inline-block"></span></td>
                                   </tr>
                                   <tr>
                                       <td className="p-2 text-slate-300">Rodilla (Recobro)</td>
                                       <td className="p-2 font-mono text-white">{showReportModal.jointAngles.knee || '-'}</td>
                                       <td className="p-2 text-right"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span></td>
                                   </tr>
                                   <tr>
                                       <td className="p-2 text-slate-300">Force Index</td>
                                       <td className="p-2 font-mono text-white">{showReportModal.kinetics?.forceApplicationIndex || '-'}</td>
                                       <td className="p-2 text-right"><span className="w-2 h-2 rounded-full bg-cyan-500 inline-block"></span></td>
                                   </tr>
                               </tbody>
                           </table>
                       </div>

                       {/* Coach Notes */}
                       <div>
                           <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Correcciones Prioritarias</h4>
                           <ul className="space-y-1">
                               {showReportModal.criticalErrors.map((err, i) => (
                                   <li key={i} className="text-xs text-red-300 bg-red-900/10 px-2 py-1 rounded border border-red-900/30">• {err}</li>
                               ))}
                           </ul>
                       </div>
                   </div>
                   
                   <div className="bg-slate-950 p-4 border-t border-slate-800 text-center">
                       <p className="text-[10px] text-slate-500 mb-2">Captura esta pantalla para compartir</p>
                       <button onClick={() => setShowReportModal(null)} className="w-full bg-slate-800 text-white font-bold py-2 rounded-lg text-sm">Cerrar</button>
                   </div>
               </div>
           </div>
       )}

       {activeTooltip && (
            <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm" onClick={() => setActiveTooltip(null)}>
                <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
                    <h4 className="font-bold text-white mb-2">{activeTooltip.title}</h4>
                    <p className="text-sm text-slate-300 leading-relaxed">{activeTooltip.text}</p>
                    <button onClick={() => setActiveTooltip(null)} className="mt-4 w-full bg-slate-800 text-slate-300 py-2 rounded-lg text-sm font-bold">Entendido</button>
                </div>
            </div>
       )}
    </div>
  );
};

export default VideoAnalyzer;
