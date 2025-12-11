
import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { analyzeTechnique } from '../services/geminiService';
import { ElitePhysicsEngine, AdvancedMetrics } from '../utils/biomechanicsUtils';
import { BiomechanicalAnalysis, KineticMetrics } from '../types';
import { Loader2, AlertTriangle, CheckCircle, History, ScanLine, UploadCloud, Play, Download, Share, Zap, Info, ToggleLeft, ToggleRight, Ruler, FileText, Video, GraduationCap, UserCircle2, LocateFixed, Activity, MessageCircle } from 'lucide-react';
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
  const [measuredData, setMeasuredData] = useState<any>(null);
  const [advancedMetrics, setAdvancedMetrics] = useState<AdvancedMetrics>({ strideLength: '-', velocity: '-' });
  const [comLocation, setComLocation] = useState<{x:number, y:number} | null>(null);
  
  // NEW: Analysis Mode (Personal vs External/Educational)
  const [analysisMode, setAnalysisMode] = useState<'Personal' | 'External'>('Personal');
  
  // Tooltip State
  const [activeTooltip, setActiveTooltip] = useState<{title: string, text: string} | null>(null);

  // Physics Engine Instance
  const physicsEngine = useRef<ElitePhysicsEngine>(new ElitePhysicsEngine());

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const initMediaPipe = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/wasm");
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`, delegate: "GPU" },
          runningMode: "VIDEO", numPoses: 1
        });
        setPoseLandmarker(landmarker);
      } catch (error) { console.error("MediaPipe Error:", error); }
    };
    initMediaPipe();
  }, []);

  const handleFile = (file: File) => {
    if (file) {
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
        setSessionAnalyses([]);
        setIsVideo(file.type.startsWith('video/'));
        setMeasuredData(null);
        setAdvancedMetrics({ strideLength: '-', velocity: '-' });
        setComLocation(null);
        
        // RESET PHYSICS ENGINE STATE
        physicsEngine.current.reset();
        
        setTimeout(() => { if(videoRef.current) { videoRef.current.load(); videoRef.current.currentTime = 0.1; } }, 500);
    }
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); };
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]); };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };

  const detectPose = async () => {
      if (!poseLandmarker || !videoRef.current || !canvasRef.current) return;
      
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const startTimeMs = performance.now();
      const result = poseLandmarker.detectForVideo(video, startTimeMs);

      if (result.landmarks && result.landmarks.length > 0) {
          const landmarks = result.landmarks[0];
          
          // Use Physics Engine Class
          const com = physicsEngine.current.calculateCenterOfMass(landmarks);
          setComLocation(com);
          
          if(ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.lineWidth = 4;
              
              // Draw Skeleton
              const connections = [[11,13],[13,15], [12,14],[14,16], [11,12], [23,24], [23,25],[25,27], [24,26],[26,28], [11,23], [12,24]];
              connections.forEach(([i, j]) => {
                  if(landmarks[i] && landmarks[j]) {
                      ctx.beginPath();
                      ctx.moveTo(landmarks[i].x * canvas.width, landmarks[i].y * canvas.height);
                      ctx.lineTo(landmarks[j].x * canvas.width, landmarks[j].y * canvas.height);
                      ctx.strokeStyle = "#00ff00aa"; 
                      ctx.stroke();
                  }
              });

              // Draw CoM & Force Vector
              if (com) {
                  const cx = com.x * canvas.width;
                  const cy = com.y * canvas.height;
                  
                  // CoM Dot
                  ctx.beginPath();
                  ctx.fillStyle = "#ffff00"; // Yellow
                  ctx.shadowColor = "#000";
                  ctx.shadowBlur = 10;
                  ctx.arc(cx, cy, 8, 0, 2*Math.PI);
                  ctx.fill();
                  ctx.shadowBlur = 0;

                  // Force Vector (Approximation based on Shin/Trunk)
                  const ankle = landmarks[27]; // Left ankle for demo
                  if (ankle) {
                      const ax = ankle.x * canvas.width;
                      const ay = ankle.y * canvas.height;
                      // Draw line from ground to CoM (Resultant Force Line)
                      ctx.beginPath();
                      ctx.strokeStyle = "#ff00ff"; // Magenta
                      ctx.lineWidth = 3;
                      ctx.setLineDash([5, 5]);
                      ctx.moveTo(ax, ay);
                      ctx.lineTo(cx, cy);
                      ctx.stroke();
                      ctx.setLineDash([]);
                  }
              }
          }

          const mechanics = physicsEngine.current.calculateSprintMechanics(landmarks);
          if(mechanics) setMeasuredData(mechanics);

          // Get Advanced Metrics from Engine
          const advanced = physicsEngine.current.estimateStrideParams(
              landmarks, 
              userProfile.height || 175, 
              startTimeMs,
              com
          );
          
          setAdvancedMetrics(advanced);
      }
  };

  const handleAutoSequence = async () => {
    if(!previewUrl || !videoRef.current) return;
    setLoading(true);
    setStatusMessage(analysisMode === 'Personal' ? "Calculando Física Corporal (CoM/Fuerza)..." : "Analizando Modelo Técnico...");
    
    try {
        const duration = videoRef.current.duration;
        const frames = [duration * 0.2, duration * 0.5, duration * 0.8]; 
        const capturedImages: string[] = [];
        
        for (const time of frames) {
            videoRef.current.currentTime = time;
            await new Promise(r => setTimeout(r, 500)); 
            await detectPose(); 
            
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
            capturedImages.push(canvas.toDataURL('image/webp', 0.8).split(',')[1]);
        }
        
        setStatusMessage("Generando Diagnóstico Cinético...");
        
        // Prepare Kinetic Data
        const bioData = measuredData;
        const kinetics: KineticMetrics = {
            verticalOscillation: advancedMetrics.verticalOscillation || "N/A",
            forceApplicationIndex: advancedMetrics.forceFactor || 0,
            comVelocity: advancedMetrics.velocity
        };

        const result = await analyzeTechnique(capturedImages, bioData, advancedMetrics, analysisMode);
        
        if(result) {
             const analysis: BiomechanicalAnalysis = { 
                 ...result, 
                 id: Date.now().toString(), 
                 type: 'Sequence' as const, 
                 thumbnail: `data:image/webp;base64,${capturedImages[1]}`,
                 kinetics: kinetics
             };
             setSessionAnalyses(prev => [analysis, ...prev]);
             
             if (analysisMode === 'Personal') {
                 saveAnalysis(analysis);
             }
        }

    } catch(e) { console.error(e); } finally { setLoading(false); }
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

  const downloadReport = (analysis: BiomechanicalAnalysis) => {
      const text = `
REPORTE DE ANÁLISIS BIOMECÁNICO (${analysis.category.toUpperCase()})
------------------------------------------------
FECHA: ${new Date().toLocaleDateString()}
ATLETA: ${userProfile.name} (Peso: ${userProfile.weight}kg)
FASE DETECTADA: ${analysis.phaseDetected}
PUNTUACIÓN TÉCNICA: ${analysis.score}/100

FISICA & CINÉTICA:
- Velocidad CoM: ${analysis.kinetics?.comVelocity || 'N/A'}
- Oscilación Vertical: ${analysis.kinetics?.verticalOscillation || 'N/A'} (Eficiencia)
- Indice de Fuerza: ${analysis.kinetics?.forceApplicationIndex || 'N/A'}/100

DATOS BIOMECÁNICOS:
- Rodilla: ${analysis.jointAngles?.knee || 'N/A'}
- Cadera: ${analysis.jointAngles?.hip || 'N/A'}
- Torso: ${analysis.jointAngles?.torso || 'N/A'}
- GCT Est.: ${analysis.groundContactTimeEstimate}

ERRORES CRÍTICOS:
${analysis.criticalErrors.map(e => `- ${e}`).join('\n')}

DRILLS CORRECTIVOS:
${analysis.correctiveDrills.map(d => `- ${d}`).join('\n')}

COACH CUES (Gritos):
${analysis.coachShouts.join(', ')}
------------------------------------------------
Generated by Elite Sprint Coach AI
      `;
      const element = document.createElement("a");
      const file = new Blob([text], {type: 'text/plain'});
      element.href = URL.createObjectURL(file);
      element.download = `sprint_analysis_${Date.now()}.txt`;
      document.body.appendChild(element);
      element.click();
      setTimeout(() => document.body.removeChild(element), 100);
  };

  const InfoButton = ({ title, text }: { title: string, text: string }) => (
      <button onClick={(e) => { e.stopPropagation(); setActiveTooltip({ title, text }); }} className="text-slate-400 hover:text-white ml-1 inline-flex pointer-events-auto"><Info size={10} /></button>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-16">
       {/* ... (Header) ... */}
       <div className="flex justify-between items-end border-b border-slate-800 pb-4">
          <div><h2 className="text-2xl font-bold">Bio-Mecánica</h2><p className="text-slate-400 text-sm">MediaPipe + Physics Engine (CoM)</p></div>
          <button onClick={() => setViewHistory(!viewHistory)} className="text-xs bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700 hover:text-cyan-400"><History size={12} className="inline mr-1"/> Historial</button>
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
               {analysisHistory.filter(h => h.category === 'Personal' || !h.category).length === 0 && <div className="text-center text-slate-500 text-sm py-4">No hay análisis personales guardados.</div>}
           </div>
       ) : (
           <>
            {/* ANALYSIS MODE SELECTOR */}
            {!previewUrl && (
                <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 mb-4">
                    <button onClick={() => setAnalysisMode('Personal')} className={`flex-1 py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${analysisMode === 'Personal' ? 'bg-cyan-900/40 text-cyan-400 border border-cyan-500/50' : 'text-slate-500 hover:text-slate-300'}`}>
                        <UserCircle2 size={18}/> Mi Análisis (Personal)
                    </button>
                    <button onClick={() => setAnalysisMode('External')} className={`flex-1 py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${analysisMode === 'External' ? 'bg-purple-900/40 text-purple-400 border border-purple-500/50' : 'text-slate-500 hover:text-slate-300'}`}>
                        <GraduationCap size={18}/> Referencia (Didáctico)
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
                    <span className="font-bold text-slate-300 text-lg">Subir Video {analysisMode === 'External' ? 'de Referencia' : 'Personal'}</span>
                    <p className="text-slate-500 text-xs mt-2">Soporta Slow-Mo 240fps</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Mode Indicator Badge */}
                    <div className="flex justify-center">
                        <span className={`px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider border flex items-center gap-2 ${analysisMode === 'Personal' ? 'bg-cyan-900/30 border-cyan-500/50 text-cyan-400' : 'bg-purple-900/30 border-purple-500/50 text-purple-400'}`}>
                            {analysisMode === 'Personal' ? <UserCircle2 size={12}/> : <GraduationCap size={12}/>}
                            Modo: {analysisMode === 'Personal' ? 'Diagnóstico Personal' : 'Análisis Didáctico'}
                        </span>
                    </div>

                    <div className="relative rounded-2xl overflow-hidden bg-black max-h-[60vh] mx-auto shadow-2xl border border-slate-800 ring-1 ring-white/10 flex justify-center items-center bg-contain">
                        {isVideo ? (
                            <video ref={videoRef} src={previewUrl} className="w-full h-auto max-h-[60vh]" playsInline muted controls={false} onLoadedData={() => detectPose()} onSeeked={() => detectPose()} />
                        ) : <img src={previewUrl} className="w-full h-full object-contain" />}
                        <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-80" />
                        
                        {/* Physics Overlay Legend */}
                        <div className="absolute top-2 left-2 bg-black/50 p-1.5 rounded border border-white/20 pointer-events-none">
                            <div className="flex items-center gap-2 mb-1"><span className="w-2 h-2 rounded-full bg-yellow-400 shadow-lg"></span> <span className="text-[9px] text-white">Centro de Masa (CoM)</span></div>
                            <div className="flex items-center gap-2"><span className="w-4 h-0.5 bg-purple-500 rotate-45"></span> <span className="text-[9px] text-white">Vector Fuerza (Est.)</span></div>
                        </div>

                        {/* DESKTOP HUD */}
                        {measuredData && (
                            <div className="hidden md:grid absolute bottom-4 left-4 right-4 grid-cols-5 gap-2 pointer-events-none">
                                <div className="bg-slate-950/80 backdrop-blur p-2 rounded-lg border border-slate-700 pointer-events-auto">
                                    <div className="text-[10px] text-slate-400 font-bold uppercase flex items-center">Rodilla <InfoButton title="Ángulo Rodilla" text="Mide la fase de recobro. <60° indica una mecánica eficiente de 'talón al glúteo'."/></div>
                                    <div className={`text-sm font-mono font-bold ${measuredData.knee.color}`}>{measuredData.knee.value}</div>
                                </div>
                                <div className="bg-slate-950/80 backdrop-blur p-2 rounded-lg border border-slate-700 pointer-events-auto">
                                    <div className="text-[10px] text-slate-400 font-bold uppercase flex items-center">Cadera <InfoButton title="Extensión Cadera" text="Mide la potencia aplicada al suelo. Busca >165° en el despegue."/></div>
                                    <div className={`text-sm font-mono font-bold ${measuredData.hip.color}`}>{measuredData.hip.value}</div>
                                </div>
                                <div className="bg-slate-900/90 backdrop-blur p-2 rounded-lg border border-cyan-900/50 pointer-events-auto">
                                    <div className="text-[10px] text-cyan-400 font-bold uppercase flex items-center">Velocidad</div>
                                    <div className="text-sm font-mono font-bold text-white">{advancedMetrics.velocity}</div>
                                </div>
                                <div className="bg-purple-900/90 backdrop-blur p-2 rounded-lg border border-purple-500/50 pointer-events-auto">
                                    <div className="text-[10px] text-purple-300 font-bold uppercase flex items-center">Oscilación <InfoButton title="Oscilación Vertical (Bounce)" text="Energía desperdiciada hacia arriba. En élite es menor a 4cm."/></div>
                                    <div className="text-sm font-mono font-bold text-white">{advancedMetrics.verticalOscillation || '-'}</div>
                                </div>
                                <div className="bg-slate-900/90 backdrop-blur p-2 rounded-lg border border-cyan-900/50 pointer-events-auto">
                                    <div className="text-[10px] text-cyan-400 font-bold uppercase flex items-center">Zancada <InfoButton title="Largo de Zancada" text="Distancia entre contactos. Aproximadamente 1.2x la altura del atleta."/></div>
                                    <div className="text-sm font-mono font-bold text-white">{advancedMetrics.strideLength}</div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* MOBILE HUD */}
                    {measuredData && (
                        <div className="md:hidden grid grid-cols-3 gap-2 animate-in fade-in">
                            <div className="bg-slate-900 p-2 rounded-xl border border-slate-700 text-center relative pointer-events-auto">
                                <div className="text-[9px] text-slate-400 font-bold uppercase flex justify-center items-center">Rodilla <InfoButton title="Rodilla" text="Recobro eficiente <60°."/></div>
                                <div className={`text-lg font-bold ${measuredData.knee.color}`}>{measuredData.knee.value}</div>
                            </div>
                            <div className="bg-slate-900 p-2 rounded-xl border border-slate-700 text-center relative pointer-events-auto">
                                <div className="text-[9px] text-slate-400 font-bold uppercase flex justify-center items-center">Cadera <InfoButton title="Cadera" text="Extensión completa >165°."/></div>
                                <div className={`text-lg font-bold ${measuredData.hip.color}`}>{measuredData.hip.value}</div>
                            </div>
                            <div className="bg-slate-900 p-2 rounded-xl border border-slate-700 text-center">
                                <div className="text-[9px] text-cyan-400 font-bold uppercase">Velocidad</div>
                                <div className="text-lg font-bold text-white font-mono">{advancedMetrics.velocity}</div>
                            </div>
                            
                            {/* ADVANCED PHYSICS ROW */}
                            <div className="col-span-3 grid grid-cols-2 gap-2 mt-1">
                                <div className="bg-purple-900/20 p-2 rounded-xl border border-purple-500/30 flex justify-between items-center px-3 relative pointer-events-auto">
                                    <div className="text-[9px] text-purple-300 font-bold uppercase flex items-center gap-1"><LocateFixed size={10}/> Bounce <InfoButton title="Bounce" text="Oscilación Vertical."/></div>
                                    <div className="text-lg font-bold text-white font-mono">{advancedMetrics.verticalOscillation || '-'}</div>
                                </div>
                                <div className="bg-purple-900/20 p-2 rounded-xl border border-purple-500/30 flex justify-between items-center px-3 relative pointer-events-auto">
                                    <div className="text-[9px] text-purple-300 font-bold uppercase flex items-center gap-1"><Activity size={10}/> Force Idx <InfoButton title="Force Index" text="Eficiencia aplicación de fuerza (0-100)."/></div>
                                    <div className="text-lg font-bold text-white font-mono">{advancedMetrics.forceFactor || '-'}</div>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {/* Controls */}
                    <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 flex flex-col gap-3 backdrop-blur-sm sticky bottom-20 z-10 shadow-lg">
                        <div className="flex gap-2">
                            <button onClick={handleAutoSequence} disabled={loading || !poseLandmarker} className={`flex-1 bg-gradient-to-r ${analysisMode === 'Personal' ? 'from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500' : 'from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500'} text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 text-sm shadow-lg active:scale-95 transition-all`}>
                                {loading ? <Loader2 className="animate-spin" /> : <ScanLine />} {loading ? statusMessage : '✨ Iniciar Auto-Análisis'}
                            </button>
                            <a href={previewUrl} download="analysis.mp4" className="p-3 bg-slate-800 rounded-lg text-slate-300 hover:text-white border border-slate-700" title="Descargar Video"><Video size={20}/></a>
                        </div>
                        {analysisMode === 'External' && (
                            <p className="text-[10px] text-center text-slate-500">* Modo Didáctico: Este análisis NO se guardará en tu historial personal.</p>
                        )}
                    </div>
                    
                    {/* Results */}
                    {sessionAnalyses.map((analysis) => (
                        <div key={analysis.id} className={`bg-slate-900/90 border p-5 rounded-2xl space-y-4 animate-in slide-in-from-bottom-4 ${analysis.category === 'External' ? 'border-purple-500/30' : 'border-slate-700'}`}>
                            <div className="flex justify-between items-start border-b border-slate-800 pb-3">
                                <div>
                                    <h3 className="font-bold text-xl text-white tracking-tight">{analysis.phaseDetected}</h3>
                                    <span className="text-xs text-slate-500 uppercase tracking-widest">{analysis.type === 'Sequence' ? 'Análisis de Secuencia' : 'Frame Único'}</span>
                                </div>
                                <div className="flex gap-2">
                                    <span className={`px-3 py-1 rounded-lg text-sm font-bold ${analysis.score > 80 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{analysis.score}</span>
                                    <button onClick={() => shareAnalysisWhatsapp(analysis)} className="p-1.5 bg-emerald-900/30 border border-emerald-500/30 rounded text-emerald-400 hover:text-emerald-300 transition-colors" title="Compartir WhatsApp"><MessageCircle size={16}/></button>
                                    <button onClick={() => downloadReport(analysis)} className="p-1.5 bg-slate-800 rounded hover:text-cyan-400 transition-colors" title="Descargar Reporte TXT"><FileText size={16}/></button>
                                    <button onClick={() => copyAnalysis(analysis)} className="p-1.5 bg-slate-800 rounded hover:text-cyan-400 transition-colors" title="Copiar"><Share size={16}/></button>
                                </div>
                            </div>
                            
                            {/* PHYSICS INSIGHT */}
                            {analysis.kinetics && (
                                <div className="grid grid-cols-2 gap-2 bg-slate-950/50 p-2 rounded-lg border border-slate-800">
                                    <div className="text-center">
                                        <div className="text-[10px] text-slate-500 uppercase font-bold">Oscilación Vertical</div>
                                        <div className="text-sm font-mono text-white">{analysis.kinetics.verticalOscillation}</div>
                                    </div>
                                    <div className="text-center border-l border-slate-800">
                                        <div className="text-[10px] text-slate-500 uppercase font-bold">Eficiencia Fuerza</div>
                                        <div className="text-sm font-mono text-white">{analysis.kinetics.forceApplicationIndex}/100</div>
                                    </div>
                                </div>
                            )}

                            {analysis.criticalErrors.length > 0 && (<div className="bg-red-900/10 border-l-4 border-red-500 p-3 rounded-r-lg"><h4 className="text-xs font-bold text-red-400 uppercase mb-2 flex items-center gap-2"><AlertTriangle size={12}/> Errores Críticos</h4><ul className="space-y-1">{analysis.criticalErrors.map((err, i) => <li key={i} className="text-sm text-slate-300">• {err}</li>)}</ul></div>)}
                            <div><h4 className="text-xs font-bold text-emerald-400 uppercase mb-2 flex items-center gap-2"><CheckCircle size={12}/> Correcciones</h4><div className="flex flex-wrap gap-2">{analysis.correctiveDrills.map((drill, i) => (<a key={i} href={`https://www.youtube.com/results?search_query=sprint+drill+${drill.replace(/\s/g, '+')}`} target="_blank" rel="noopener noreferrer" className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-400 text-xs px-3 py-1.5 rounded-full flex items-center gap-1 transition-colors"><Play size={10} fill="currentColor"/> {drill}</a>))}</div></div>
                            {analysis.coachShouts.length > 0 && (<div className="pt-2"><div className="flex flex-wrap gap-3">{analysis.coachShouts.map((s, i) => (<div key={i} className="bg-white text-black font-extrabold text-xs px-4 py-2 rounded-xl rounded-bl-none shadow-lg transform -rotate-1 hover:rotate-0 transition-transform cursor-default border-2 border-slate-300">{s.toUpperCase()}!</div>))}</div></div>)}
                        </div>
                    ))}
                    {sessionAnalyses.length > 0 && (<button onClick={() => {setSessionAnalyses([]); setPreviewUrl(null); setMeasuredData(null);}} className="w-full border border-dashed border-slate-700 text-slate-400 py-4 rounded-xl text-sm hover:bg-slate-900 hover:text-white transition-colors">Analizar Otro Video</button>)}
                </div>
            )}
           </>
       )}

       {/* Floating Tooltip */}
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
