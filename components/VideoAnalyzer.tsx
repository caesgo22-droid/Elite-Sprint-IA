import * as React from 'react';
import { useState, useRef, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { analyzeTechnique } from '../services/geminiService';
import { LocalExpert } from '../services/localExpert';
import { ElitePhysicsEngine } from '../utils/biomechanicsUtils';
import { captureFrameAtTimestamp } from '../utils/videoProcessing';
import { TrainingSession, UserProfile, BiomechanicalAnalysis } from '../types';
import { Loader2, ScanLine, UploadCloud, History, Key, Info, X, ShieldCheck, AlertCircle, Zap, Columns, RotateCcw, CheckCheck, Images } from 'lucide-react';
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import { AnalysisResultCard } from './AnalysisResultCard';
import { AnalysisHistoryList } from './AnalysisHistoryList';
import { useToasts } from '../contexts/ToastContext';

const getAIStudio = () => (window as any).aistudio;

const VideoAnalyzer: React.FC = () => {
    const { showToast } = useToasts();
    const { saveAnalysis, userProfile, updateAnalysis, analysisHistory, deleteAnalysis, currentPlan, lastAnalysis } = useApp();
    const [sessionAnalyses, setSessionAnalyses] = useState<BiomechanicalAnalysis[]>([]);
    const [loading, setLoading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [statusMessage, setStatusMessage] = useState("");
    const [viewHistory, setViewHistory] = useState(false);
    const [poseLandmarker, setPoseLandmarker] = useState<PoseLandmarker | null>(null);
    const [analysisMode, setAnalysisMode] = useState<'Personal' | 'External'>('Personal');
    const [hasKey, setHasKey] = useState<boolean>(true);
    const [capturedFrames, setCapturedFrames] = useState<string[]>([]);
    const [degradedMode, setDegradedMode] = useState(false);
    const [showSkeleton, setShowSkeleton] = useState(true);
    const [activeAnalysis, setActiveAnalysis] = useState<BiomechanicalAnalysis | null>(null);
    const [comparisonMode, setComparisonMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [videoFingerprint, setVideoFingerprint] = useState<string | null>(null);

    // Refs
    const physicsEngine = useRef<ElitePhysicsEngine>(new ElitePhysicsEngine());
    const fileInputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const overlayRef = useRef<HTMLCanvasElement>(null);
    const compareVideoRef1 = useRef<HTMLVideoElement>(null);
    const compareVideoRef2 = useRef<HTMLVideoElement>(null);
    const isScanning = useRef(false);

    const location = useLocation();

    // -- Initialization & Effects --

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        if (params.get('history') === 'true') {
            setViewHistory(true);
        }
    }, [location]);

    useEffect(() => {
        const initMediaPipe = async () => {
            try {
                const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/wasm");
                const landmarker = await PoseLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task`,
                        delegate: "GPU"
                    },
                    runningMode: "VIDEO",
                    numPoses: 1
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

    const existingAnalysis = useMemo(() => {
        if (!videoFingerprint) return null;
        return analysisHistory.find(a => a.videoFingerprint === videoFingerprint);
    }, [analysisHistory, videoFingerprint]);

    const comparedAnalyses = useMemo(() => {
        return analysisHistory.filter(a => selectedIds.includes(a.id));
    }, [analysisHistory, selectedIds]);

    const toggleSelection = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : prev.length < 2 ? [...prev, id] : prev
        );
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Safety Check: Limit video duration to avoid memory crashes on mobile
            const videoUrl = URL.createObjectURL(file);
            const tempVideo = document.createElement('video');
            tempVideo.preload = 'metadata';
            tempVideo.onloadedmetadata = () => {
                if (tempVideo.duration > 30) {
                    showToast("El video es demasiado largo (>30s). Por favor recórtalo para evitar errores de memoria.", "error");
                    URL.revokeObjectURL(videoUrl);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                    return;
                }
                setPreviewUrl(videoUrl);
                const fingerprint = `${file.name}-${file.size}-${file.lastModified}`;
                setVideoFingerprint(fingerprint);

                // Check for existing analysis immediately
                const existing = analysisHistory.find(a => a.videoFingerprint === fingerprint);

                if (existing) {
                    setActiveAnalysis(existing);
                    showToast("Análisis previo cargado exitosamente.", "success");
                } else {
                    setActiveAnalysis(null);
                }

                setCapturedFrames([]);
                setSessionAnalyses([]);
            };
            tempVideo.onerror = () => {
                showToast("Error al cargar metadatos de video.", "error");
            };
            tempVideo.src = videoUrl;
        }
    };

    // -- Core Analysis Logic --

    const performScan = async (video: HTMLVideoElement): Promise<any[]> => {
        return new Promise(async (resolve, reject) => {
            if (!poseLandmarker) return reject("MediaPipe not ready");

            setStatusMessage("Escanendo Biomecánica...");
            const tempHistory: any[] = [];
            physicsEngine.current.reset();

            // Reset landmarker for new sequence
            try { poseLandmarker.reset(); } catch (e) { }

            const onEnded = () => {
                cleanup();
                resolve(tempHistory);
            };

            const cleanup = () => {
                video.removeEventListener('ended', onEnded);
                video.removeEventListener('pause', onEnded);
                isScanning.current = false;
            };

            video.addEventListener('ended', onEnded);

            // Critical: Wait for data before starting
            if (video.readyState < 2) {
                await new Promise(r => { video.onloadeddata = r; });
            }

            video.currentTime = 0;
            video.playbackRate = 1.0;
            isScanning.current = true;

            await video.play();

            const processFrame = (now: number, metadata?: any) => {
                if (!isScanning.current || video.ended) return;

                // Use the video's presentation time if available (more accurate)
                const timestamp = metadata ? metadata.mediaTime * 1000 : video.currentTime * 1000;

                try {
                    const result = poseLandmarker.detectForVideo(video, timestamp);
                    if (result?.landmarks?.[0]) {
                        const landmarks = result.landmarks[0];
                        const com = physicsEngine.current.calculateCenterOfMass(landmarks);
                        const mechanics = physicsEngine.current.calculateSprintMechanics(landmarks);
                        const advanced = physicsEngine.current.estimateStrideParams(landmarks, userProfile.height || 175, timestamp, com);

                        tempHistory.push({ landmarks, mechanics, advanced, com, timestamp });

                        // Draw live skeleton (Critical: ensure canvas is synced)
                        if (showSkeleton) requestAnimationFrame(() => drawSkeleton(landmarks));
                    }
                } catch (e) {
                    console.warn("Detection error:", e);
                }

                if (isScanning.current && !video.paused && !video.ended) {
                    if ('requestVideoFrameCallback' in video) {
                        (video as any).requestVideoFrameCallback(processFrame);
                    } else {
                        requestAnimationFrame(() => processFrame(performance.now()));
                    }
                } else if (video.paused && !video.ended) {
                    // resumes if paused but not ended
                    requestAnimationFrame(() => processFrame(performance.now()));
                }
            };

            if ('requestVideoFrameCallback' in video) {
                (video as any).requestVideoFrameCallback(processFrame);
            } else {
                requestAnimationFrame(() => processFrame(performance.now()));
            }
        });
    };

    const handleAutoCapture = async () => {
        if (!previewUrl || !videoRef.current || !poseLandmarker) return;

        setLoading(true);
        setDegradedMode(false);
        setCapturedFrames([]);

        try {
            const video = videoRef.current;

            // PHASE 1: SCAN
            // We play the video fully to gather metrics
            const scanHistory = await performScan(video);

            if (scanHistory.length < 3) {
                throw new Error(`Detección insuficiente. Se capturaron ${scanHistory.length} poses. Asegúrate de que el atleta esté visible y en movimiento (mínimo 1-2 segundos).`);
            }

            // PHASE 2: EXTRACT KEY FRAMES
            setStatusMessage("Analizando Ciclo de Carrera (V2.0)...");
            video.pause();

            // Run V2 Detector
            const { touchdownFrame, maxFlexionFrame, toeOffFrame, flightFrame, stats } = physicsEngine.current.detectSprintPhases(scanHistory);

            const phases = [
                touchdownFrame || scanHistory[0],
                maxFlexionFrame || scanHistory[Math.floor(scanHistory.length / 3)],
                toeOffFrame || scanHistory[Math.floor(scanHistory.length * 2 / 3)],
                flightFrame || scanHistory[scanHistory.length - 1]
            ];

            const framesBase64: string[] = [];

            // Capture all 4 High-Res Frames
            const phaseNames = ["Impacto", "Amortiguación", "Despegue", "Vuelo"];
            for (let i = 0; i < phases.length; i++) {
                const timeSec = phases[i].timestamp / 1000;
                setStatusMessage(`Capturando: ${phaseNames[i]}...`);
                const frame = await captureFrameAtTimestamp(video, timeSec);
                framesBase64.push(frame);
            }

            // Inject new V2 Physics Data into the primary frame for AI
            const primaryFrame = phases[2]; // Toe-off usually has best mechanics view
            primaryFrame.advanced.groundContactTime = `${stats.realGCT.toFixed(3)}s`;
            primaryFrame.advanced.frequency = `${(1 / (stats.realGCT * 2.2)).toFixed(1)} Hz`; // Approx Freq based on GCT
            primaryFrame.advanced.forceFactor = Math.round(stats.legStiffness || 80); // Inject Stiffness into Force Factor field

            // Create filmstrip for UI
            setCapturedFrames(framesBase64);

            // Create Master Audit Payload if needed (more frames)
            let payload = framesBase64.map(f => f.split(',')[1]); // Strip prefix for Gemini

            if (analysisMode === 'External') {
                // Add intermediate frames for audit
                // (Simple logic: just use the 3 for now to save tokens/time, or add mid-points if crucial)
                // Keeping it to 3 highly accurate frames is often better than 5 blurry ones.
            }

            // PHASE 3: ANALYZE
            setStatusMessage(analysisMode === 'External' ? "Auditoría Master (Gemini 2.0)..." : "Analizando Técnica...");

            const currentSession = currentPlan?.sessions?.find((s: any) => s.day === new Date().toLocaleDateString('es-ES', { weekday: 'long' }));

            let analysis: BiomechanicalAnalysis | null = null;

            try {
                const aiResult = await analyzeTechnique(
                    payload,
                    primaryFrame.mechanics,
                    primaryFrame.advanced,
                    analysisMode,
                    userProfile,
                    lastAnalysis,
                    currentSession
                );

                if (!aiResult) throw new Error("Sin respuesta de IA");

                analysis = {
                    ...aiResult,
                    id: Date.now().toString(),
                    type: analysisMode === 'External' ? 'MasterAudit' : 'Filmstrip',
                    category: analysisMode,
                    thumbnail: framesBase64[1], // Use middle frame as thumb
                    kinetics: {
                        comVelocity: primaryFrame.advanced.velocity,
                        forceApplicationIndex: primaryFrame.advanced.forceFactor,
                        verticalOscillation: primaryFrame.advanced.verticalOscillation,
                        groundContactTime: primaryFrame.advanced.groundContactTime,
                        airTime: primaryFrame.advanced.airTime,
                        strideFreq: primaryFrame.advanced.frequency
                    },
                    timestamp: primaryFrame.timestamp / 1000,
                    reviewStatus: userProfile.role === 'athlete' ? 'Pending' : 'Reviewed',
                    videoFingerprint: videoFingerprint || undefined
                };

            } catch (e: any) {
                console.warn("AI Fallback:", e);
                setDegradedMode(true);

                // Fallback to LocalExpert
                const localResult = LocalExpert.analyze(
                    { touchdown: phases[0], flexion: phases[1], extension: phases[2] },
                    primaryFrame.advanced,
                    {
                        comVelocity: primaryFrame.advanced.velocity,
                        forceApplicationIndex: primaryFrame.advanced.forceFactor,
                        verticalOscillation: primaryFrame.advanced.verticalOscillation,
                        groundContactTime: primaryFrame.advanced.groundContactTime,
                        airTime: primaryFrame.advanced.airTime,
                        strideFreq: primaryFrame.advanced.frequency
                    }
                );

                analysis = {
                    ...localResult,
                    id: Date.now().toString(),
                    type: 'Filmstrip',
                    thumbnail: framesBase64[1],
                    timestamp: primaryFrame.timestamp / 1000,
                    category: analysisMode,
                    reviewStatus: userProfile.role === 'athlete' ? 'Pending' : 'Reviewed',
                    videoFingerprint: videoFingerprint || undefined
                };
            }

            if (analysis) {
                setSessionAnalyses(prev => [analysis as BiomechanicalAnalysis, ...prev]);
                saveAnalysis(analysis as BiomechanicalAnalysis);
                showToast("Análisis completado", "success");
            }

        } catch (e: any) {
            console.error("Critical Analysis Error:", e);
            setStatusMessage("Error en análisis");
            showToast(e.message || "Error al procesar video", "error");
        } finally {
            setLoading(false);
            isScanning.current = false;
        }
    };

    // -- Drawing Logic --

    const drawSkeleton = (landmarks: any[]) => {
        if (!overlayRef.current || !videoRef.current) return;
        const ctx = overlayRef.current.getContext('2d');
        if (!ctx) return;

        const video = videoRef.current;
        const canvas = overlayRef.current;
        const displayWidth = video.clientWidth;
        const displayHeight = video.clientHeight;

        if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
            canvas.width = displayWidth;
            canvas.height = displayHeight;
        }

        ctx.clearRect(0, 0, displayWidth, displayHeight);

        const connections = [
            [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
            [11, 23], [12, 24], [23, 24],
            [23, 25], [25, 27], [24, 26], [26, 28],
            [27, 31], [28, 32], [27, 29], [28, 30]
        ];

        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';

        connections.forEach(([i, j]) => {
            const p1 = landmarks[i];
            const p2 = landmarks[j];
            if (p1 && p2 && p1.visibility > 0.5 && p2.visibility > 0.5) {
                ctx.beginPath();
                ctx.moveTo(p1.x * displayWidth, p1.y * displayHeight);
                ctx.lineTo(p2.x * displayWidth, p2.y * displayHeight);
                ctx.stroke();
            }
        });

        ctx.fillStyle = '#ff0000';
        landmarks.forEach((p) => {
            if (p.visibility > 0.5) {
                ctx.beginPath();
                ctx.arc(p.x * displayWidth, p.y * displayHeight, 4, 0, 2 * Math.PI);
                ctx.fill();
            }
        });
    };

    // Live overlay effect (only when NOT scanning for analysis)
    // We want the skeleton to appear during scrubbing too
    useEffect(() => {
        if (!videoRef.current || !poseLandmarker) return;

        let animationFrameId: number;
        let lastVideoTime = -1;

        const loop = () => {
            // If we are actively scanning for analysis, let performScan handle the loop/drawing
            if (isScanning.current) {
                animationFrameId = requestAnimationFrame(loop);
                return;
            }

            const video = videoRef.current;
            if (video && showSkeleton) {
                if (video.currentTime !== lastVideoTime) {
                    if (video.currentTime < lastVideoTime) {
                        try { poseLandmarker.reset(); } catch (e) { }
                    }
                    lastVideoTime = video.currentTime;
                    try {
                        // Use timestamp based on performance.now() or video time logic
                        const result = poseLandmarker.detectForVideo(video, performance.now());
                        if (result?.landmarks?.[0]) {
                            drawSkeleton(result.landmarks[0]);
                        } else {
                            const ctx = overlayRef.current?.getContext('2d');
                            ctx?.clearRect(0, 0, overlayRef.current!.width, overlayRef.current!.height);
                        }
                    } catch (e) {
                        // ignore
                    }
                }
            }
            animationFrameId = requestAnimationFrame(loop);
        };

        loop();
        return () => cancelAnimationFrame(animationFrameId);
    }, [showSkeleton, poseLandmarker]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20 px-2">
            <div className="flex justify-between items-end border-b border-slate-800 pb-4">
                <div>
                    <h2 className="text-xl font-black text-white uppercase tracking-tight">Laboratorio Bio</h2>
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">Video Audit v3.0 Elite</p>
                </div>
                <div className="flex gap-2">
                    {!hasKey && (
                        <button onClick={handleOpenKey} className="bg-red-500/10 border border-red-500/30 text-red-500 px-3 py-1.5 rounded-full text-[9px] font-black uppercase flex items-center gap-1">
                            <Key size={10} /> API Key
                        </button>
                    )}
                    <button onClick={() => setViewHistory(!viewHistory)} className={`text-[9px] font-black uppercase tracking-widest px-4 py-2 rounded-full border transition-all ${viewHistory ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}>
                        <History size={12} className="inline mr-1" /> {viewHistory ? 'Cerrar Historial' : 'Historial'}
                    </button>
                    {viewHistory && selectedIds.length === 2 && (
                        <button onClick={() => setComparisonMode(true)} className="text-[9px] font-black uppercase tracking-widest bg-emerald-600 border border-emerald-400 px-4 py-2 rounded-full text-white animate-pulse">
                            Comparar ({selectedIds.length})
                        </button>
                    )}
                </div>
            </div>

            {degradedMode && (
                <div className="bg-amber-900/20 border border-amber-500/30 p-3 rounded-2xl flex items-center gap-3 animate-in slide-in-from-top-2">
                    <AlertCircle className="text-amber-500 shrink-0" size={18} />
                    <p className="text-[10px] text-amber-200 font-bold uppercase leading-tight">
                        IA no responde. Usando análisis LocalExpert.
                    </p>
                </div>
            )}

            {!previewUrl ? (
                <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-slate-700 rounded-[2.5rem] aspect-video flex flex-col items-center justify-center cursor-pointer hover:bg-slate-900/50 transition-all group overflow-hidden relative">
                    <input type="file" ref={fileInputRef} hidden onChange={handleFileChange} accept="video/*" />
                    <UploadCloud size={36} className="text-slate-500 group-hover:text-cyan-400 mb-4" />
                    <span className="font-black text-slate-300 uppercase tracking-widest text-xs">Cargar Sprint</span>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Auto-load handles the existing analysis notification */}
                    <div className="relative rounded-[2rem] overflow-hidden bg-black aspect-video border border-slate-800 shadow-2xl group">
                        <video ref={videoRef} src={previewUrl} className="w-full h-full object-contain" muted playsInline />
                        <canvas ref={overlayRef} className="absolute inset-0 pointer-events-none w-full h-full" />


                        <div className="absolute top-4 right-4 flex gap-2">
                            <div className="relative group/overlay">
                                <button onClick={() => setShowSkeleton(!showSkeleton)} className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all ${showSkeleton ? 'bg-cyan-500 border-cyan-400 text-white' : 'bg-black/60 border-white/20 text-white/60'}`}>
                                    <Zap size={10} className="inline mr-1" /> Overlay {showSkeleton ? 'ON' : 'OFF'}
                                </button>
                            </div>
                        </div>

                        {capturedFrames.length > 0 && (
                            <div className="absolute bottom-4 left-4 right-4 flex gap-1 overflow-x-auto p-2 bg-black/60 backdrop-blur-md rounded-xl border border-white/10 z-20">
                                {capturedFrames.map((f, i) => <img key={i} src={f} className="h-10 rounded border border-white/10 shrink-0" />)}
                            </div>
                        )}

                        {/* Loading Overlay */}
                        {loading && (
                            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-30">
                                <Loader2 size={40} className="text-cyan-400 animate-spin mb-4" />
                                <div className="text-cyan-400 font-black text-lg uppercase tracking-widest">{statusMessage}</div>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-900 rounded-3xl border border-slate-800 shadow-lg">
                        <button onClick={() => setAnalysisMode('Personal')} className={`py-4 rounded-2xl flex flex-col items-center gap-1 transition-all ${analysisMode === 'Personal' ? 'bg-slate-800 border border-slate-700 text-white shadow-md' : 'text-slate-500'}`}>
                            <Info size={16} />
                            <span className="text-[10px] font-black uppercase tracking-widest">Didáctico</span>
                            <span className="text-[8px] opacity-40 font-bold">(Rápido)</span>
                        </button>
                        <button onClick={() => setAnalysisMode('External')} className={`py-4 rounded-2xl flex flex-col items-center gap-1 transition-all ${analysisMode === 'External' ? 'bg-indigo-900/40 border border-indigo-500/50 text-indigo-400 shadow-md' : 'text-slate-500'}`}>
                            <ShieldCheck size={16} />
                            <span className="text-[10px] font-black uppercase tracking-widest">Auditoría Pro</span>
                            <span className="text-[8px] opacity-40 font-bold">(Deep Scan)</span>
                        </button>
                    </div>

                    <div className="bg-slate-900/95 p-4 rounded-3xl border border-slate-800 flex gap-3 sticky bottom-20 z-10 backdrop-blur-xl shadow-2xl">
                        <button onClick={handleAutoCapture} disabled={loading} className={`flex-1 ${analysisMode === 'External' ? 'bg-indigo-600' : 'bg-cyan-600'} text-white font-black py-5 rounded-2xl flex items-center justify-center gap-4 text-sm transition-all shadow-xl disabled:opacity-50 uppercase tracking-widest`}>
                            {loading ? <Loader2 className="animate-spin" /> : <ScanLine />}
                            {loading ? 'Procesando...' : (activeAnalysis ? 'Re-analizar (Forzar)' : 'Analizar Técnica')}
                        </button>
                        <button onClick={() => { setPreviewUrl(null); setActiveAnalysis(null); }} className="p-5 bg-slate-800 rounded-2xl text-slate-400 hover:text-white border border-slate-700"><X size={20} /></button>
                    </div>

                    {[...(activeAnalysis ? [activeAnalysis] : []), ...sessionAnalyses].map(analysis => (
                        <AnalysisResultCard
                            key={analysis.id}
                            analysis={analysis}
                            isHistoryItem={activeAnalysis?.id === analysis.id}
                            userProfile={userProfile}
                            updateAnalysis={updateAnalysis}
                        />
                    ))}
                </div>
            )}

            {/* COMPARISON MODAL */}
            {comparisonMode && comparedAnalyses.length === 2 && (
                <div className="fixed inset-0 z-[100] bg-slate-950/98 backdrop-blur-2xl overflow-y-auto">
                    <div className="max-w-5xl mx-auto min-h-screen flex flex-col pt-10 pb-24 px-4">
                        <div className="flex justify-between items-center bg-slate-900/50 p-6 rounded-[2.5rem] border border-slate-800 mb-6 backdrop-blur-md">
                            <div>
                                <h2 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                                    <Columns className="text-emerald-400" /> Comparativa Pro
                                </h2>
                            </div>
                            <div className="flex items-center gap-4">
                                <button onClick={() => setComparisonMode(false)} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-2xl text-white transition-all"><X size={20} /></button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                            {comparedAnalyses.map((item, idx) => (
                                <div key={item.id} className={`bg-slate-900/40 rounded-[2.5rem] border border-slate-800 p-4 space-y-4 flex flex-col ${idx === 0 ? 'border-l-indigo-500/50' : 'border-l-emerald-500/50'}`}>
                                    <div className="flex justify-between items-center">
                                        <div className={`text-[9px] font-black uppercase tracking-widest self-start px-3 py-1 rounded-full border ${idx === 0 ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                                            {idx === 0 ? 'Anterior' : 'Reciente'} • {new Date(item.savedAt || 0).toLocaleDateString()}
                                        </div>
                                    </div>
                                    <div className="relative rounded-3xl overflow-hidden bg-black aspect-video border border-slate-800 shadow-inner group">
                                        {/* Logic: If we have a direct URL, use it. If the fingerprint matches the current preview, use that. Else default to thumbnail image. */}
                                        {/* Note: We assume 'videoUrl' might exist on analysis in future, or we use current preview if matching. 
                                            For now, comparison is most useful for 'Current vs History'. 
                                            If 'item.id' matches 'activeAnalysis?.id' (current session), we use 'previewUrl'.
                                        */}
                                        {(previewUrl && (item.id === activeAnalysis?.id || item.videoFingerprint === videoFingerprint)) ? (
                                            <video
                                                ref={idx === 0 ? compareVideoRef1 : compareVideoRef2}
                                                src={previewUrl}
                                                className="w-full h-full object-contain"
                                                muted
                                                playsInline
                                                onPlay={() => { if (idx === 0 && compareVideoRef2.current) compareVideoRef2.current.play(); }}
                                                onPause={() => { if (idx === 0 && compareVideoRef2.current) compareVideoRef2.current.pause(); }}
                                            />
                                        ) : (
                                            <div className="w-full h-full relative">
                                                <img src={item.thumbnail} className="w-full h-full object-contain opacity-50" />
                                                <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                                                    <div className="bg-black/50 p-2 rounded-full mb-2">
                                                        <Images size={24} className="text-slate-400" />
                                                    </div>
                                                    <p className="text-[10px] text-slate-300 font-bold uppercase text-center">
                                                        Video original no disponible.<br />Mostrando Key Frame.
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* HISTORY LIST MODAL */}
            {viewHistory && (
                <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md p-6 overflow-y-auto">
                    <AnalysisHistoryList
                        analysisHistory={analysisHistory}
                        selectedIds={selectedIds}
                        toggleSelection={toggleSelection}
                        deleteAnalysis={deleteAnalysis}
                        setActiveAnalysis={setActiveAnalysis}
                        setComparisonMode={setComparisonMode}
                        setViewHistory={setViewHistory}
                        locationSearch={location.search}
                    />
                </div>
            )}
        </div>
    );
};

export default VideoAnalyzer;