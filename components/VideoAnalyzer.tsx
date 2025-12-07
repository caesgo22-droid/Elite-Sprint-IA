import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { analyzeTechnique } from '../services/geminiService';
import { calculateSprintMechanics } from '../utils/biomechanicsUtils';
import { BiomechanicalAnalysis } from '../types';
import { Loader2, AlertTriangle, CheckCircle, History, ScanLine, UploadCloud, Play, Download, Share, Zap } from 'lucide-react';
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

const VideoAnalyzer: React.FC = () => {
  const { saveAnalysis, analysisHistory } = useApp();
  const [sessionAnalyses, setSessionAnalyses] = useState<BiomechanicalAnalysis[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [isVideo, setIsVideo] = useState(false);
  const [viewHistory, setViewHistory] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [poseLandmarker, setPoseLandmarker] = useState<PoseLandmarker | null>(null);
  const [measuredData, setMeasuredData] = useState<any>(null);

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
          
          if(ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.lineWidth = 4;
              // Skeleton connections
              const connections = [[11,13],[13,15], [12,14],[14,16], [11,12], [23,24], [23,25],[25,27], [24,26],[26,28], [11,23], [12,24]];
              connections.forEach(([i, j]) => {
                  if(landmarks[i] && landmarks[j]) {
                      ctx.beginPath();
                      ctx.moveTo(landmarks[i].x * canvas.width, landmarks[i].y * canvas.height);
                      ctx.lineTo(landmarks[j].x * canvas.width, landmarks[j].y * canvas.height);
                      ctx.strokeStyle = "#00ff00"; // Green Skeleton
                      ctx.stroke();
                  }
              });
              [11,12,23,24,25,26,27,28].forEach(i => {
                  ctx.beginPath();
                  ctx.fillStyle = "#ff0000";
                  ctx.arc(landmarks[i].x * canvas.width, landmarks[i].y * canvas.height, 6, 0, 2*Math.PI);
                  ctx.fill();
              });
          }

          const mechanics = calculateSprintMechanics(landmarks);
          if(mechanics) setMeasuredData(mechanics);
      }
  };

  const handleAutoSequence = async () => {
    if(!previewUrl || !videoRef.current) return;
    setLoading(true);
    setStatusMessage("Escaneando Secuencia (Inicio - MaxV - Fin)...");
    
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
        
        setStatusMessage("Consultando al Consejo de Expertos...");
        const result = await analyzeTechnique(capturedImages, measuredData);
        
        if(result) {
             const analysis = { ...result, id: Date.now().toString(), type: 'Sequence' as const, thumbnail: `data:image/webp;base64,${capturedImages[1]}` };
             setSessionAnalyses(prev => [analysis, ...prev]);
             saveAnalysis(analysis);
        }

    } catch(e) { console.error(e); } finally { setLoading(false); }
  };

  const shareAnalysis = async (analysis: BiomechanicalAnalysis) => {
      const text = `ANÁLISIS ELITE SPRINT AI\nFase: ${analysis.phaseDetected}\nScore: ${analysis.score}/100\nErrores: ${analysis.criticalErrors.join(', ')}\nCorrecciones: ${analysis.correctiveDrills.join(', ')}`;
      try { await navigator.clipboard.writeText(text); alert("Reporte copiado."); } catch(e) { console.error(e); }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-16">
       <div className="flex justify-between items-end border-b border-slate-800 pb-4">
          <div><h2 className="text-2xl font-bold">Bio-Mecánica</h2><p className="text-slate-400 text-sm">Hawk-Eye Vision (MediaPipe)</p></div>
          <button onClick={() => setViewHistory(!viewHistory)} className="text-xs bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700 hover:text-cyan-400"><History size={12} className="inline mr-1"/> Historial</button>
       </div>

       {viewHistory ? (
           <div className="space-y-3">
               {analysisHistory.map((item, i) => (
                   <div key={i} className="bg-slate-900 p-3 rounded-xl flex gap-4 cursor-pointer hover:bg-slate-800 border border-slate-800 transition-colors" onClick={() => { setSessionAnalyses([item]); setPreviewUrl(item.thumbnail || null); setIsVideo(false); setViewHistory(false); }}>
                       {item.thumbnail && <img src={item.thumbnail} className="w-20 h-14 object-cover rounded-lg bg-black" />}
                       <div>
                           <div className="font-bold text-white text-sm">{item.phaseDetected}</div>
                           <div className="flex gap-2 mt-1"><span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400">{new Date(item.savedAt || "").toLocaleDateString()}</span><span className={`text-[10px] px-2 py-0.5 rounded font-bold ${item.score > 80 ? 'text-emerald-400 bg-emerald-900/20' : 'text-yellow-400 bg-yellow-900/20'}`}>Score: {item.score}</span></div>
                       </div>
                   </div>
               ))}
           </div>
       ) : (
           <>
            {!previewUrl ? (
                <div 
                    onClick={() => fileInputRef.current?.click()} 
                    onDragOver={handleDragOver} 
                    onDragLeave={() => setIsDragging(false)} 
                    onDrop={handleDrop} 
                    className={`border-2 border-dashed rounded-2xl aspect-video flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ${isDragging ? 'border-cyan-400 bg-cyan-900/20 scale-105' : 'border-slate-700 hover:border-slate-500 hover:bg-slate-900/50'}`}
                >
                    <input type="file" accept="video/*,image/*" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
                    <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4"><UploadCloud size={32} className={`transition-colors ${isDragging ? 'text-cyan-400' : 'text-slate-400'}`} /></div>
                    <span className="font-bold text-slate-300 text-lg">Subir o Arrastrar Video</span>
                    <p className="text-slate-500 text-xs mt-2">Soporta Slow-Mo 240fps</p>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="relative rounded-2xl overflow-hidden bg-black max-h-[60vh] mx-auto shadow-2xl border border-slate-800 ring-1 ring-white/10">
                        {isVideo ? (
                            <video ref={videoRef} src={previewUrl} className="w-full h-auto" playsInline muted controls={false} onLoadedData={() => detectPose()} onSeeked={() => detectPose()} />
                        ) : <img src={previewUrl} className="w-full h-full object-contain" />}
                        <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-80" />
                        
                        {/* DESKTOP HUD */}
                        {measuredData && (
                            <div className="hidden md:grid absolute bottom-4 left-4 right-4 grid-cols-2 gap-2 pointer-events-none">
                                <div className="bg-slate-950/80 backdrop-blur p-2 rounded-lg border border-slate-700">
                                    <div className="text-[10px] text-slate-400 font-bold uppercase">Rodilla (Recobro)</div>
                                    <div className={`text-sm font-mono font-bold ${measuredData.knee.color}`}>{measuredData.knee.value}</div>
                                    <div className="text-[9px] text-white/70">{measuredData.knee.feedback}</div>
                                </div>
                                <div className="bg-slate-900/80 backdrop-blur p-2 rounded-lg border border-slate-700">
                                    <div className="text-[10px] text-slate-400 font-bold uppercase">Cadera (Extensión)</div>
                                    <div className={`text-sm font-mono font-bold ${measuredData.hip.color}`}>{measuredData.hip.value}</div>
                                    <div className="text-[9px] text-white/70">{measuredData.hip.feedback}</div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* MOBILE HUD (Below Video) */}
                    {measuredData && (
                        <div className="md:hidden grid grid-cols-2 gap-2 animate-in fade-in">
                            <div className="bg-slate-900 p-3 rounded-xl border border-slate-700">
                                <div className="text-[10px] text-slate-400 font-bold uppercase">Rodilla</div>
                                <div className={`text-xl font-bold ${measuredData.knee.color}`}>{measuredData.knee.value}</div>
                                <div className="text-[10px] text-slate-300">{measuredData.knee.feedback}</div>
                            </div>
                            <div className="bg-slate-900 p-3 rounded-xl border border-slate-700">
                                <div className="text-[10px] text-slate-400 font-bold uppercase">Cadera</div>
                                <div className={`text-xl font-bold ${measuredData.hip.color}`}>{measuredData.hip.value}</div>
                                <div className="text-[10px] text-slate-300">{measuredData.hip.feedback}</div>
                            </div>
                        </div>
                    )}
                    
                    <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 flex gap-3 backdrop-blur-sm sticky bottom-20 z-10 shadow-lg">
                        <button onClick={handleAutoSequence} disabled={loading || !poseLandmarker} className="flex-1 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 text-sm shadow-lg shadow-cyan-900/20 active:scale-95 transition-all">
                            {loading ? <Loader2 className="animate-spin" /> : <ScanLine />} {loading ? statusMessage : '✨ Auto-Análisis Biomecánico'}
                        </button>
                        <a href={previewUrl} download="analysis.mp4" className="p-3 bg-slate-800 rounded-lg text-slate-300 hover:text-white border border-slate-700"><Download size={20}/></a>
                    </div>
                    
                    {sessionAnalyses.map((analysis) => (
                        <div key={analysis.id} className="bg-slate-900/90 border border-slate-700 p-5 rounded-2xl space-y-4 animate-in slide-in-from-bottom-4">
                            <div className="flex justify-between items-start border-b border-slate-800 pb-3">
                                <div><h3 className="font-bold text-xl text-white tracking-tight">{analysis.phaseDetected}</h3><span className="text-xs text-slate-500 uppercase tracking-widest">{analysis.type === 'Sequence' ? 'Análisis de Secuencia' : 'Frame Único'}</span></div>
                                <div className="flex gap-2"><span className={`px-3 py-1 rounded-lg text-sm font-bold ${analysis.score > 80 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{analysis.score}</span><button onClick={() => shareAnalysis(analysis)} className="p-1.5 bg-slate-800 rounded hover:text-cyan-400 transition-colors"><Share size={16}/></button></div>
                            </div>
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
    </div>
  );
};

export default VideoAnalyzer;