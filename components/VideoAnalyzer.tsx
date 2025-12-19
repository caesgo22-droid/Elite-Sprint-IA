import * as React from 'react';
import { useState, useRef, useEffect, useMemo } from 'react';
import { useApp } from '../contexts/AppContext';
import { analyzeTechnique } from '../services/geminiService';
import { LocalExpert } from '../services/localExpert';
import { ElitePhysicsEngine } from '../utils/biomechanicsUtils';
import { TrainingSession, UserProfile, Injury, BiomechanicalAnalysis } from '../types';
import { Loader2, ScanLine, UploadCloud, History, Key, Info, X, ShieldCheck, Microscope, AlertCircle, Zap, Play, Edit3, CheckCheck } from 'lucide-react';
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

const getAIStudio = () => (window as any).aistudio;

const VideoAnalyzer: React.FC = () => {
    const { saveAnalysis, userProfile, updateAnalysis, analysisHistory } = useApp();
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

    const toggleSelection = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id)
                ? prev.filter(i => i !== id)
                : prev.length < 2 ? [...prev, id] : prev
        );
    };

    const comparedAnalyses = useMemo(() => {
        return analysisHistory.filter(a => selectedIds.includes(a.id));
    }, [analysisHistory, selectedIds]);

    const physicsEngine = useRef<ElitePhysicsEngine>(new ElitePhysicsEngine());
    const fileInputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const overlayRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const initMediaPipe = async () => {
            try {
                const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/wasm");
                const landmarker = await PoseLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task`,
                        delegate: "GPU"
                    },
                    runningMode: "IMAGE",
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

    const handleAutoCapture = async () => {
        if (!previewUrl || !videoRef.current || !poseLandmarker) return;
        setLoading(true);
        setCapturedFrames([]);
        setDegradedMode(false);
        setStatusMessage("Inicializando Scan...");
        physicsEngine.current.reset();

        try {
            const video = videoRef.current;
            const duration = video.duration;
            const scanSteps = 12;
            const tempHistory: any[] = [];
            const frames: string[] = [];

            for (let i = 0; i <= scanSteps; i++) {
                const time = (duration / scanSteps) * i;
                video.currentTime = time;

                await new Promise((resolve) => {
                    const onSeeked = () => {
                        video.removeEventListener('seeked', onSeeked);
                        resolve(true);
                    };
                    video.addEventListener('seeked', onSeeked);
                });

                await new Promise(r => setTimeout(r, 50));
                const result = poseLandmarker.detect(video);

                if (result?.landmarks?.[0]) {
                    let landmarks = result.landmarks[0];

                    // SIMPLE KEYPOINT SMOOTHING (Anti-Jitter)
                    if (tempHistory.length > 0) {
                        const prev = tempHistory[tempHistory.length - 1].landmarks;
                        landmarks = landmarks.map((curr: any, idx: number) => ({
                            ...curr,
                            x: (curr.x + prev[idx].x) / 2,
                            y: (curr.y + prev[idx].y) / 2,
                            z: (curr.z + prev[idx].z) / 2,
                        }));
                    }

                    const com = physicsEngine.current.calculateCenterOfMass(landmarks);
                    const mechanics = physicsEngine.current.calculateSprintMechanics(landmarks);
                    const advanced = physicsEngine.current.estimateStrideParams(landmarks, userProfile.height || 175, time * 1000, com);

                    tempHistory.push({ landmarks, mechanics, advanced, com, timestamp: time * 1000 });

                    const canvas = document.createElement('canvas');
                    canvas.width = 160; canvas.height = 90;
                    canvas.getContext('2d')?.drawImage(video, 0, 0, 160, 90);
                    frames.push(canvas.toDataURL('image/jpeg', 0.5));
                }
                setStatusMessage(`Escaneando: ${Math.round((i / scanSteps) * 100)}%`);
            }

            if (tempHistory.length === 0) throw new Error("Atleta no detectado.");
            setCapturedFrames(frames);

            // 1. Detect 3 Key Phases
            const { touchdownFrame, maxFlexionFrame, toeOffFrame } = physicsEngine.current.detectSprintPhases(tempHistory);

            // Default to middle frame if detection fails usually never happens if tempHistory > 0
            const phases = [
                touchdownFrame || tempHistory[0],
                maxFlexionFrame || tempHistory[Math.floor(tempHistory.length / 2)],
                toeOffFrame || tempHistory[tempHistory.length - 1]
            ];

            // 2. Generate Filmstrip (Stitch 3 frames)
            const filmstripCanvas = document.createElement('canvas');
            filmstripCanvas.width = video.videoWidth * 3;
            filmstripCanvas.height = video.videoHeight;
            const ctx = filmstripCanvas.getContext('2d');

            if (ctx) {
                // Draw phases side-by-side
                for (let k = 0; k < 3; k++) {
                    // Seek video to exact phase time to get high-res frame
                    video.currentTime = phases[k].timestamp / 1000;
                    await new Promise(r => setTimeout(r, 150)); // Wait for seek
                    ctx.drawImage(video, k * video.videoWidth, 0, video.videoWidth, video.videoHeight);

                    // Add label overlay
                    ctx.fillStyle = "rgba(0,0,0,0.5)";
                    ctx.fillRect(k * video.videoWidth, 0, 150, 40);
                    ctx.fillStyle = "white";
                    ctx.font = "bold 20px Arial";
                    ctx.fillText(["CONTACTO", "MAX FLEXION", "DESPEGUE"][k], (k * video.videoWidth) + 10, 30);
                }
            }

            const isMaster = analysisMode === 'External';
            const filmstripBase64 = filmstripCanvas.toDataURL('image/jpeg', 0.8).split(',')[1];

            // For MASTER AUDIT, we send a sequence of frames to analyze temporal flow
            let payload: string[] = [filmstripBase64];
            if (isMaster && ctx) {
                // Collect 5 key frames: TD, Intermediate, MF, Intermediate, TO
                const masterP = [
                    phases[0],
                    tempHistory[Math.floor((tempHistory.indexOf(phases[0]) + tempHistory.indexOf(phases[1])) / 2)] || phases[0],
                    phases[1],
                    tempHistory[Math.floor((tempHistory.indexOf(phases[1]) + tempHistory.indexOf(phases[2])) / 2)] || phases[1],
                    phases[2]
                ];

                const masterFrames: string[] = [];
                for (const frame of masterP) {
                    video.currentTime = (frame as any).timestamp / 1000;
                    await new Promise(r => setTimeout(r, 100));
                    ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
                    masterFrames.push(filmstripCanvas.toDataURL('image/jpeg', 0.6).split(',')[1]);
                }
                payload = masterFrames;
            }

            const primaryFrame = phases[2]; // Use Toe-Off data for metrics

            setStatusMessage(isMaster ? "Auditoría Master Professional..." : "Analizando Técnica...");

            let analysis: BiomechanicalAnalysis | null = null;
            try {
                // Send SEQUENCE (Master) or FILMSTRIP (Flash)
                const aiResult = await analyzeTechnique(payload, primaryFrame.mechanics, primaryFrame.advanced, analysisMode);
                if (!aiResult) throw new Error("IA offline o requiere configuración.");

                analysis = {
                    ...aiResult,
                    id: Date.now().toString(),
                    type: isMaster ? 'MasterAudit' : 'Filmstrip',
                    category: analysisMode,
                    thumbnail: `data:image/jpeg;base64,${filmstripBase64}`,
                    kinetics: {
                        comVelocity: primaryFrame.advanced.velocity,
                        forceApplicationIndex: primaryFrame.advanced.forceFactor,
                        verticalOscillation: primaryFrame.advanced.verticalOscillation,
                        groundContactTime: primaryFrame.advanced.groundContactTime,
                        airTime: primaryFrame.advanced.airTime,
                        strideFreq: primaryFrame.advanced.frequency
                    },
                    timestamp: primaryFrame.timestamp / 1000,
                    reviewStatus: userProfile.role === 'athlete' ? 'Pending' : 'Reviewed'
                };
            } catch (e: any) {
                console.warn("Fallo en IA remota:", e.message);
                setDegradedMode(true);

                // Si el error es de "no encontrado", abrir selector
                if (e.message?.includes("not found")) {
                    handleOpenKey();
                }

                // OFFLINE FALLBACK: Use Local Expert logic
                const offlinePhases = {
                    touchdown: phases[0],
                    flexion: phases[1],
                    extension: phases[2]
                };

                const localResult = LocalExpert.analyze(offlinePhases, primaryFrame.advanced, {
                    comVelocity: primaryFrame.advanced.velocity,
                    forceApplicationIndex: primaryFrame.advanced.forceFactor,
                    verticalOscillation: primaryFrame.advanced.verticalOscillation,
                    groundContactTime: primaryFrame.advanced.groundContactTime,
                    airTime: primaryFrame.advanced.airTime,
                    strideFreq: primaryFrame.advanced.frequency
                });

                analysis = {
                    ...localResult,
                    id: Date.now().toString(),
                    type: 'Filmstrip',
                    thumbnail: `data:image/jpeg;base64,${filmstripBase64}`,
                    timestamp: primaryFrame.timestamp / 1000,
                    category: analysisMode,
                    reviewStatus: userProfile.role === 'athlete' ? 'Pending' : 'Reviewed'
                };
            }
            if (analysis) {
                setSessionAnalyses(prev => [analysis as BiomechanicalAnalysis, ...prev]);
                saveAnalysis(analysis as BiomechanicalAnalysis);
            }
        } catch (e: any) {
            console.error("Critical Analysis Error:", e);
            setStatusMessage("Error en el análisis.");
            alert(e.message || "Fallo en el análisis.");
        } finally {
            setLoading(false);
        }
    };

    const drawSkeleton = (landmarks: any[]) => {
        if (!overlayRef.current || !videoRef.current) return;
        const ctx = overlayRef.current.getContext('2d');
        if (!ctx) return;

        const video = videoRef.current;
        const canvas = overlayRef.current;

        // Match canvas to video's visual size
        const displayWidth = video.clientWidth;
        const displayHeight = video.clientHeight;

        if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
            canvas.width = displayWidth;
            canvas.height = displayHeight;
        }

        ctx.clearRect(0, 0, displayWidth, displayHeight);

        // MediaPipe Pose Connections
        const connections = [
            [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], // Upper
            [11, 23], [12, 24], [23, 24], // Torso
            [23, 25], [25, 27], [24, 26], [26, 28], // Legs
            [27, 31], [28, 32], [27, 29], [28, 30] // Feet
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
        landmarks.forEach((p, i) => {
            if (p.visibility > 0.5) {
                ctx.beginPath();
                ctx.arc(p.x * displayWidth, p.y * displayHeight, 4, 0, 2 * Math.PI);
                ctx.fill();
            }
        });
    };

    useEffect(() => {
        if (!videoRef.current || !showSkeleton || !poseLandmarker) return;

        let frameId: number;
        const process = () => {
            if (videoRef.current && !videoRef.current.paused) {
                const result = poseLandmarker.detect(videoRef.current);
                if (result?.landmarks?.[0]) {
                    drawSkeleton(result.landmarks[0]);
                }
            }
            frameId = requestAnimationFrame(process);
        };
        process();
        return () => cancelAnimationFrame(frameId);
    }, [showSkeleton, previewUrl, poseLandmarker]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20 px-2">
            <div className="flex justify-between items-end border-b border-slate-800 pb-4">
                <div>
                    <h2 className="text-xl font-black text-white uppercase tracking-tight">Laboratorio Bio</h2>
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">Video Audit v2.2 Pro</p>
                </div>
                <div className="flex gap-2">
                    {!hasKey && (
                        <button onClick={handleOpenKey} className="bg-red-500/10 border border-red-500/30 text-red-500 px-3 py-1.5 rounded-full text-[9px] font-black uppercase flex items-center gap-1">
                            <Key size={10} /> Configurar Key
                        </button>
                    )}
                    <button onClick={() => setViewHistory(!viewHistory)} className={`text-[9px] font-black uppercase tracking-widest px-4 py-2 rounded-full border transition-all \${viewHistory ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}>
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
                        IA de pago no disponible. Usando motor biomecánico local (LocalExpert).
                    </p>
                </div>
            )}

            {!previewUrl ? (
                <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-slate-700 rounded-[2.5rem] aspect-video flex flex-col items-center justify-center cursor-pointer hover:bg-slate-900/50 transition-all group overflow-hidden relative">
                    <input type="file" ref={fileInputRef} hidden onChange={(e) => setPreviewUrl(URL.createObjectURL(e.target.files![0]))} accept="video/*" />
                    <UploadCloud size={36} className="text-slate-500 group-hover:text-cyan-400 mb-4" />
                    <span className="font-black text-slate-300 uppercase tracking-widest text-xs">Cargar Sprint</span>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="relative rounded-[2rem] overflow-hidden bg-black aspect-video border border-slate-800 shadow-2xl group">
                        <video ref={videoRef} src={previewUrl} className="w-full h-full object-contain" muted playsInline />
                        <canvas ref={overlayRef} className="absolute inset-0 pointer-events-none w-full h-full" />

                        <div className="absolute top-4 right-4 flex gap-2">
                            <button onClick={() => setShowSkeleton(!showSkeleton)} className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all ${showSkeleton ? 'bg-cyan-500 border-cyan-400 text-white' : 'bg-black/60 border-white/20 text-white/60'}`}>
                                <Zap size={10} className="inline mr-1" /> Overly {showSkeleton ? 'ON' : 'OFF'}
                            </button>
                        </div>

                        {capturedFrames.length > 0 && (
                            <div className="absolute bottom-4 left-4 right-4 flex gap-1 overflow-x-auto p-2 bg-black/60 backdrop-blur-md rounded-xl border border-white/10">
                                {capturedFrames.map((f, i) => <img key={i} src={f} className="h-10 rounded border border-white/10 shrink-0" />)}
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-900 rounded-3xl border border-slate-800 shadow-lg">
                        <button onClick={() => setAnalysisMode('Personal')} className={`py-4 rounded-2xl flex flex-col items-center gap-1 transition-all ${analysisMode === 'Personal' ? 'bg-slate-800 border border-slate-700 text-white shadow-md' : 'text-slate-500'}`}>
                            <Info size={16} />
                            <span className="text-[10px] font-black uppercase tracking-widest">Didáctico</span>
                            <span className="text-[8px] opacity-40 font-bold">(Rápido/Flash)</span>
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
                            {loading ? statusMessage : 'Analizar Técnica'}
                        </button>
                        <button onClick={() => setPreviewUrl(null)} className="p-5 bg-slate-800 rounded-2xl text-slate-400 hover:text-white border border-slate-700"><X size={20} /></button>
                    </div>

                    <div className="space-y-4">
                        {sessionAnalyses.map(analysis => (
                            <div key={analysis.id} className="bg-slate-900 border border-slate-700 p-6 rounded-[2rem] space-y-6 animate-in slide-in-from-bottom-4 shadow-2xl overflow-hidden">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className={`font-black text-2xl tracking-tighter uppercase ${analysis.category === 'External' ? 'text-indigo-400' : 'text-white'}`}>{analysis.phaseDetected}</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Microscope size={12} className="text-slate-500" />
                                            <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Motor: {analysis.coachNotes?.includes("OFFLINE") ? 'Local' : (analysis.category === 'External' ? 'Deep Pro' : 'Flash')}</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-3xl font-black text-emerald-400 tracking-tighter">{analysis.score}</div>
                                        <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Score</div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                    <MetricBox label="VEL (m/s)" value={analysis.kinetics?.comVelocity?.toString().split(' ')[0] || '--'} />
                                    <MetricBox label="GCT (sec)" value={analysis.groundContactTimeEstimate || '--'} />
                                    <MetricBox label="EFF" value={`${analysis.kinetics?.forceApplicationIndex || '--'}%`} />
                                </div>

                                {(analysis as any).jointAngles && (
                                    <div className="bg-black/40 rounded-2xl p-4 border border-slate-800/50 space-y-3">
                                        <h4 className="text-[10px] font-black text-cyan-400 uppercase tracking-widest flex items-center gap-2"><ScanLine size={12} /> Biomecánica de Élite</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="flex justify-between items-center border-b border-slate-800/50 pb-1">
                                                <span className="text-[10px] text-slate-500 uppercase font-bold">Rodilla (Ext)</span>
                                                <span className="text-xs font-black text-white">{(analysis as any).jointAngles.kneeExtension || '--'}</span>
                                            </div>
                                            <div className="flex justify-between items-center border-b border-slate-800/50 pb-1">
                                                <span className="text-[10px] text-slate-500 uppercase font-bold">Cadera (Flex)</span>
                                                <span className="text-xs font-black text-white">{(analysis as any).jointAngles.hipFlexion || '--'}</span>
                                            </div>
                                            <div className="flex justify-between items-center border-b border-slate-800/50 pb-1">
                                                <span className="text-[10px] text-slate-500 uppercase font-bold">Shin Angle</span>
                                                <span className="text-xs font-black text-white">{(analysis as any).jointAngles.shinAngle || '--'}</span>
                                            </div>
                                            <div className="flex justify-between items-center border-b border-slate-800/50 pb-1">
                                                <span className="text-[10px] text-slate-500 uppercase font-bold">Osc. Vertical</span>
                                                <span className="text-xs font-black text-white">{analysis.kinetics?.verticalOscillation || '--'}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2"><ShieldCheck size={12} /> Successes</h4>
                                        <ul className="space-y-1">
                                            {(analysis as any).successes?.map((s: string, i: number) => (
                                                <li key={i} className="text-[11px] text-slate-300 flex items-start gap-2">
                                                    <div className="w-1 h-1 bg-emerald-500 rounded-full mt-1.5 shrink-0" />
                                                    {s}
                                                </li>
                                            )) || <li className="text-[11px] text-slate-600 italic">No detectado.</li>}
                                        </ul>
                                    </div>
                                    <div className="space-y-2">
                                        <h4 className="text-[10px] font-black text-red-400 uppercase tracking-widest flex items-center gap-2"><AlertCircle size={12} /> Weaknesses</h4>
                                        <ul className="space-y-1">
                                            {(analysis as any).weaknesses?.map((w: string, i: number) => (
                                                <li key={i} className="text-[11px] text-slate-300 flex items-start gap-2">
                                                    <div className="w-1 h-1 bg-red-500 rounded-full mt-1.5 shrink-0" />
                                                    {w}
                                                </li>
                                            )) || (analysis as any).criticalErrors?.map((w: string, i: number) => (
                                                <li key={i} className="text-[11px] text-slate-300 flex items-start gap-2">
                                                    <div className="w-1 h-1 bg-red-500 rounded-full mt-1.5 shrink-0" />
                                                    {w}
                                                </li>
                                            )) || <li className="text-[11px] text-slate-600 italic">No detectado.</li>}
                                        </ul>
                                    </div>
                                </div>

                                {(analysis as any).correctiveDrills && (analysis as any).correctiveDrills.length > 0 && (
                                    <div className="space-y-3 pt-4 border-t border-slate-800">
                                        <h4 className="text-[10px] font-black text-purple-400 uppercase tracking-widest flex items-center gap-2"><Microscope size={12} /> Plan de Corrección</h4>
                                        <div className="grid gap-2">
                                            {(analysis as any).correctiveDrills.map((drill: any, idx: number) => (
                                                <div key={idx} className="bg-slate-950 p-3 rounded-2xl border border-slate-800/50 flex justify-between items-center group/drill">
                                                    <div className="flex-1">
                                                        <div className="text-xs font-bold text-white uppercase tracking-tight">{typeof drill === 'string' ? drill : drill.name}</div>
                                                        {drill.reason && <p className="text-[10px] text-slate-500 leading-tight mt-0.5 line-clamp-1 group-hover/drill:line-clamp-none transition-all">{drill.reason}</p>}
                                                    </div>
                                                    <a
                                                        href={`https://www.youtube.com/results?search_query=track+and+field+drill+${(drill.videoKeywords || (typeof drill === 'string' ? drill : drill.name)).replace(/\s/g, '+')}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-2 bg-slate-800 rounded-full text-slate-500 hover:text-red-500 transition-colors"
                                                    >
                                                        <Play size={12} fill="currentColor" />
                                                    </a>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-3">
                                    <div className="flex flex-wrap gap-2 justify-center">
                                        {analysis.coachShouts.map((s, i) => (
                                            <span key={i} className="text-[10px] bg-slate-950 border border-slate-800 px-4 py-2 rounded-full text-slate-200 font-black italic shadow-inner">"{s}"</span>
                                        ))}
                                    </div>
                                </div>

                                {userProfile.role === 'staff' && (
                                    <div className="mt-6 pt-6 border-t border-indigo-500/30 bg-indigo-900/10 -mx-4 px-4 pb-4 rounded-b-3xl">
                                        <div className="flex items-center justify-between mb-4">
                                            <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                                                <Edit3 size={12} /> Zona de Feedback Staff
                                            </h4>
                                            {analysis.reviewStatus === 'Reviewed' && (
                                                <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold border border-emerald-500/30 flex items-center gap-1">
                                                    <CheckCheck size={10} /> REVISADO
                                                </span>
                                            )}
                                        </div>
                                        <textarea
                                            placeholder="Añade notas técnicas para el atleta..."
                                            value={analysis.coachNotes || ""}
                                            onChange={(e) => updateAnalysis(analysis.id, { coachNotes: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all h-20"
                                        />
                                        <button
                                            onClick={() => updateAnalysis(analysis.id, { reviewStatus: 'Reviewed' })}
                                            className={`w-full mt-3 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all \${
                                                analysis.reviewStatus === 'Reviewed' 
                                                ? 'bg-slate-800 text-slate-400 cursor-default' 
                                                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                                            }`}
                                        >
                                            {analysis.reviewStatus === 'Reviewed' ? 'Review Guardada' : 'Marcar como Revisado'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* COMPARISON MODAL */}
            {comparisonMode && comparedAnalyses.length === 2 && (
                <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-xl p-4 overflow-y-auto">
                    <div className="max-w-4xl mx-auto space-y-6 pt-10 pb-20">
                        <div className="flex justify-between items-center bg-slate-900 p-6 rounded-3xl border border-slate-800">
                            <div>
                                <h2 className="text-xl font-black text-white uppercase tracking-tighter">Comparativa Técnica</h2>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Evolución Biomecánica</p>
                            </div>
                            <button onClick={() => setComparisonMode(false)} className="p-3 bg-slate-800 rounded-2xl text-white"><X size={20} /></button>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {comparedAnalyses.map((item, idx) => (
                                <div key={item.id} className="bg-slate-900 rounded-3xl border border-slate-800 p-4 space-y-4">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-indigo-400 bg-indigo-500/10 self-start px-3 py-1 rounded-full border border-indigo-500/20 mb-2">
                                        {idx === 0 ? 'Fase Inicial' : 'Fase Final'}
                                    </div>
                                    <img src={item.thumbnail} className="w-full aspect-video object-cover rounded-2xl border border-slate-800" />
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-black text-white uppercase">{item.phaseDetected}</span>
                                        <span className="text-2xl font-black text-emerald-400">{item.score}</span>
                                    </div>
                                    <div className="space-y-2 border-t border-slate-800 pt-4">
                                        <div className="flex justify-between items-center text-[10px]">
                                            <span className="text-slate-500 uppercase font-bold">Velocidad</span>
                                            <span className="text-white font-black">{item.kinetics?.comVelocity || '--'}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-[10px]">
                                            <span className="text-slate-500 uppercase font-bold">GCT</span>
                                            <span className="text-white font-black">{item.groundContactTimeEstimate || '--'}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-[10px]">
                                            <span className="text-slate-500 uppercase font-bold">Eficiencia</span>
                                            <span className="text-white font-black">{item.kinetics?.forceApplicationIndex || '--'}%</span>
                                        </div>
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
                    <div className="max-w-xl mx-auto space-y-4 pt-10 pb-24">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Historial Bio</h2>
                            <button onClick={() => setViewHistory(false)} className="p-2 bg-slate-800 rounded-full text-white"><X size={18} /></button>
                        </div>
                        {analysisHistory.length === 0 ? (
                            <div className="text-center py-20 text-slate-500 uppercase text-[10px] font-bold">No hay registros previos.</div>
                        ) : analysisHistory.map(item => (
                            <div
                                key={item.id}
                                onClick={() => toggleSelection(item.id)}
                                className={`group bg-slate-900 border transition-all rounded-3xl p-4 flex items-center justify-between cursor-pointer \${
                                selectedIds.includes(item.id) ? 'border-indigo-500 bg-indigo-900/10' : 'border-slate-800 hover:border-slate-700'
                              }`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="relative">
                                        <img src={item.thumbnail} className="w-16 h-10 object-cover rounded-lg border border-slate-800" />
                                        {selectedIds.includes(item.id) && (
                                            <div className="absolute -top-2 -right-2 bg-indigo-500 text-white rounded-full p-1 border-2 border-slate-950">
                                                <ShieldCheck size={10} />
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-left">
                                        <div className="text-xs font-black text-white uppercase">{item.phaseDetected}</div>
                                        <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">{new Date(item.id).toLocaleDateString()}</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-lg font-black text-emerald-400">{item.score}</div>
                                    <div className="text-[8px] text-slate-600 font-bold uppercase">SCORE</div>
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