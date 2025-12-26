import * as React from 'react';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../../contexts/AppContext';
import { useToasts } from '../../contexts/ToastContext';
import {
    History, Zap, Key, AlertCircle, UploadCloud,
    ShieldCheck, ScanLine, X, Columns, Loader2, Info
} from 'lucide-react';

// Types
import { BiomechanicalAnalysis, VideoAnnotation } from '../../types';

// Components
import AnalysisResultCard from './AnalysisResultCard';
import VideoAnnotationOverlay from './VideoAnnotationOverlay';

// Services & Utils
import { analyzeTechnique } from '../../services/geminiService';
import { LocalExpert } from '../../services/localExpert';
import { ElitePhysicsEngine } from '../../utils/biomechanicsUtils';
import { captureFrameAtTimestamp } from '../../utils/videoProcessing';
import { getVideoAnnotations, addVideoAnnotation } from '../../services/firebase';

// Hooks
import { useMediaPipe } from '../../hooks/useMediaPipe';
import { useVideoScanner } from '../../hooks/useVideoScanner';
import { useSkeletonOverlay } from '../../hooks/useSkeletonOverlay';

const VideoAnalyzer: React.FC = () => {
    const { showToast } = useToasts();
    const {
        saveAnalysis, userProfile, updateAnalysis,
        analysisHistory, deleteAnalysis, currentPlan, lastAnalysis
    } = useApp();

    const location = useLocation();

    // Hooks
    const { poseLandmarker, isReady: mediaPipeReady } = useMediaPipe();
    const {
        isScanning: hookScanning,
        progress: hookProgress,
        performScan: runAIScan,
        resetScanner
    } = useVideoScanner();
    const { drawSkeleton } = useSkeletonOverlay();

    // Local State
    const [loading, setLoading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [statusMessage, setStatusMessage] = useState("");
    const [viewHistory, setViewHistory] = useState(false);
    const [analysisMode, setAnalysisMode] = useState<'Personal' | 'External'>('Personal');
    const [hasKey, setHasKey] = useState<boolean>(true);
    const [capturedFrames, setCapturedFrames] = useState<string[]>([]);
    const [degradedMode, setDegradedMode] = useState(false);
    const [showSkeleton, setShowSkeleton] = useState(true);
    const [activeAnalysis, setActiveAnalysis] = useState<BiomechanicalAnalysis | null>(null);
    const [sessionAnalyses, setSessionAnalyses] = useState<BiomechanicalAnalysis[]>([]);
    const [comparisonMode, setComparisonMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [videoFingerprint, setVideoFingerprint] = useState<string | null>(null);
    const [annotations, setAnnotations] = useState<VideoAnnotation[]>([]);
    const [currentTime, setCurrentTime] = useState(0);

    // Refs
    const physicsEngine = useRef<ElitePhysicsEngine>(new ElitePhysicsEngine());
    const fileInputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const overlayRef = useRef<HTMLCanvasElement>(null);
    const compareVideoRef1 = useRef<HTMLVideoElement>(null);
    const compareVideoRef2 = useRef<HTMLVideoElement>(null);
    const isScanningInternal = useRef(false);

    // Effects
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        if (params.get('history') === 'true') {
            setViewHistory(true);
        }
    }, [location]);

    useEffect(() => {
        const checkKey = async () => {
            const aistudio = (window as any).aistudio;
            if (aistudio) setHasKey(await aistudio.hasSelectedApiKey());
        };
        checkKey();
    }, []);

    const handleOpenKey = async () => {
        const aistudio = (window as any).aistudio;
        if (aistudio) {
            await aistudio.openSelectKey();
            setHasKey(true);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const videoUrl = URL.createObjectURL(file);
            const tempVideo = document.createElement('video');
            tempVideo.preload = 'metadata';
            tempVideo.onloadedmetadata = () => {
                if (tempVideo.duration > 30) {
                    showToast("El video es demasiado largo (>30s).", "error");
                    URL.revokeObjectURL(videoUrl);
                    return;
                }
                setPreviewUrl(videoUrl);
                const fingerprint = `${file.name}-${file.size}-${file.lastModified}`;
                setVideoFingerprint(fingerprint);

                const existing = analysisHistory.find(a => a.videoFingerprint === fingerprint);
                if (existing) {
                    setActiveAnalysis(existing);
                    showToast("Análisis previo cargado", "success");
                } else {
                    setActiveAnalysis(null);
                }
                setCapturedFrames([]);
            };
            tempVideo.src = videoUrl;
        }
    };

    // Scan Implementation (Uses local engine but could be hooked further)
    const performBiomechanicalScan = async (video: HTMLVideoElement): Promise<any[]> => {
        return new Promise(async (resolve, reject) => {
            if (!poseLandmarker) return reject("MediaPipe not ready");

            setStatusMessage("Escanenado Biomecánica...");
            const tempHistory: any[] = [];
            physicsEngine.current.reset();

            const onEnded = () => {
                isScanningInternal.current = false;
                resolve(tempHistory);
            };

            video.addEventListener('ended', onEnded, { once: true });
            video.currentTime = 0;
            isScanningInternal.current = true;

            try { await video.play(); } catch (e) { reject(e); return; }

            const processFrame = () => {
                if (!isScanningInternal.current || video.ended || video.paused) return;

                const result = poseLandmarker.detectForVideo(video, video.currentTime * 1000);
                if (result?.landmarks?.[0]) {
                    const lms = result.landmarks[0];
                    const com = physicsEngine.current.calculateCenterOfMass(lms);
                    const mechanics = physicsEngine.current.calculateSprintMechanics(lms);
                    const advanced = physicsEngine.current.estimateStrideParams(lms, userProfile.height || 175, video.currentTime * 1000, com);

                    tempHistory.push({ landmarks: lms, mechanics, advanced, com, timestamp: video.currentTime * 1000 });

                    // Draw live skeleton
                    if (showSkeleton && overlayRef.current) {
                        const ctx = overlayRef.current.getContext('2d');
                        if (ctx) {
                            drawSkeleton(
                                ctx, [lms], video.videoWidth, video.videoHeight,
                                video.clientWidth, video.clientHeight
                            );
                        }
                    }
                }
                requestAnimationFrame(processFrame);
            };
            processFrame();
        });
    };

    const handleAutoCapture = async () => {
        if (!previewUrl || !videoRef.current || !poseLandmarker) return;

        setLoading(true);
        setStatusMessage("Iniciando Scan...");

        try {
            const video = videoRef.current;
            const scanHistory = await performBiomechanicalScan(video);

            if (scanHistory.length < 5) throw new Error("Detección insuficiente");

            setStatusMessage("Procesando Ciclos...");
            const { touchdownFrame, toeOffFrame, stats } = physicsEngine.current.detectSprintPhases(scanHistory);

            // Capture frames for AI
            const frames: string[] = [];
            const keyFrames = [scanHistory[0], touchdownFrame, toeOffFrame, scanHistory[scanHistory.length - 1]];

            for (const f of keyFrames) {
                const b64 = await captureFrameAtTimestamp(video, f.timestamp / 1000);
                frames.push(b64);
            }
            setCapturedFrames(frames);

            setStatusMessage("Consultando Cerebro IA...");
            const primaryFrame = toeOffFrame || scanHistory[Math.floor(scanHistory.length / 2)];

            const aiResult = await analyzeTechnique(
                frames.map(f => f.split(',')[1]),
                primaryFrame.mechanics,
                primaryFrame.advanced,
                analysisMode,
                userProfile,
                lastAnalysis
            );

            if (aiResult) {
                const analysis: BiomechanicalAnalysis = {
                    ...aiResult,
                    id: Date.now().toString(),
                    type: analysisMode === 'External' ? 'MasterAudit' : 'Filmstrip',
                    category: analysisMode,
                    thumbnail: frames[1],
                    timestamp: primaryFrame.timestamp / 1000,
                    videoFingerprint: videoFingerprint || undefined,
                    kinetics: {
                        comVelocity: primaryFrame.advanced.velocity,
                        forceApplicationIndex: stats.legStiffness,
                        verticalOscillation: primaryFrame.advanced.verticalOscillation,
                        groundContactTime: `${stats.realGCT.toFixed(3)}s`
                    }
                };
                setSessionAnalyses(prev => [analysis, ...prev]);
                saveAnalysis(analysis);
                showToast("Análisis completo", "success");
            }

        } catch (e: any) {
            showToast(e.message, "error");
        } finally {
            setLoading(false);
            setStatusMessage("");
        }
    };

    // UI Effects
    useEffect(() => {
        if (!videoRef.current || isScanningInternal.current) return;

        const loop = () => {
            if (videoRef.current && showSkeleton && overlayRef.current) {
                setCurrentTime(videoRef.current.currentTime);
                const result = poseLandmarker?.detectForVideo(videoRef.current, videoRef.current.currentTime * 1000);
                if (result?.landmarks?.[0]) {
                    const ctx = overlayRef.current.getContext('2d');
                    if (ctx) {
                        drawSkeleton(
                            ctx, [result.landmarks[0]], videoRef.current.videoWidth,
                            videoRef.current.videoHeight, videoRef.current.clientWidth,
                            videoRef.current.clientHeight
                        );
                    }
                }
            }
            requestAnimationFrame(loop);
        };
        const id = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(id);
    }, [showSkeleton, poseLandmarker, drawSkeleton]);

    return (
        <div className="space-y-6 pb-20 px-2 lg:max-w-4xl lg:mx-auto">
            <div className="flex justify-between items-end border-b border-slate-800 pb-4">
                <div>
                    <h2 className="text-xl font-black text-white uppercase tracking-tight">Laboratorio Bio</h2>
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">Elite Architecture v5.0</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setViewHistory(!viewHistory)} className="text-[9px] font-black uppercase tracking-widest px-4 py-2 rounded-full border bg-slate-800 border-slate-700 text-slate-400">
                        <History size={12} className="inline mr-1" /> {viewHistory ? 'Cerrar' : 'Historial'}
                    </button>
                </div>
            </div>

            {!previewUrl && (
                <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-slate-700 rounded-[2.5rem] aspect-video flex flex-col items-center justify-center cursor-pointer hover:bg-slate-900/50 transition-all">
                    <input type="file" ref={fileInputRef} hidden onChange={handleFileChange} accept="video/*" />
                    <UploadCloud size={36} className="text-slate-500 mb-4" />
                    <span className="font-black text-slate-300 uppercase tracking-widest text-xs">Cargar Sprint</span>
                </div>
            )}

            {previewUrl && (
                <div className="space-y-6">
                    <div className="relative rounded-[2rem] overflow-hidden bg-black aspect-video border border-slate-800 shadow-2xl">
                        <video ref={videoRef} src={previewUrl} className="w-full h-full object-contain" muted playsInline controls />
                        <canvas ref={overlayRef} className="absolute inset-0 pointer-events-none w-full h-full" />

                        {loading && (
                            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-30">
                                <Loader2 size={40} className="text-cyan-400 animate-spin mb-4" />
                                <div className="text-cyan-400 font-black text-lg uppercase tracking-widest">{statusMessage}</div>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-900 rounded-3xl border border-slate-800">
                        <button onClick={() => setAnalysisMode('Personal')} className={`py-4 rounded-2xl flex flex-col items-center gap-1 transition-all ${analysisMode === 'Personal' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}>
                            <Info size={16} />
                            <span className="text-[10px] font-black uppercase">Didáctico</span>
                        </button>
                        <button onClick={() => setAnalysisMode('External')} className={`py-4 rounded-2xl flex flex-col items-center gap-1 transition-all ${analysisMode === 'External' ? 'bg-indigo-900/40 text-indigo-400' : 'text-slate-500'}`}>
                            <ShieldCheck size={16} />
                            <span className="text-[10px] font-black uppercase">Auditoría Pro</span>
                        </button>
                    </div>

                    <div className="bg-slate-900/95 p-4 rounded-3xl border border-slate-800 flex gap-3 sticky bottom-20 z-10">
                        <button onClick={handleAutoCapture} disabled={loading || !mediaPipeReady} className="flex-1 bg-cyan-600 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-4 text-sm disabled:opacity-50 uppercase tracking-widest">
                            {loading ? <Loader2 className="animate-spin" /> : <ScanLine />}
                            {loading ? 'Procesando...' : 'Analizar Técnica'}
                        </button>
                        <button onClick={() => setPreviewUrl(null)} className="p-5 bg-slate-800 rounded-2xl text-slate-400"><X size={20} /></button>
                    </div>
                </div>
            )}

            <div className="space-y-4">
                {sessionAnalyses.map(analysis => (
                    <AnalysisResultCard key={analysis.id} analysis={analysis} userProfile={userProfile} updateAnalysis={updateAnalysis} />
                ))}
                {viewHistory && analysisHistory.map(analysis => (
                    <AnalysisResultCard key={analysis.id} analysis={analysis} userProfile={userProfile} updateAnalysis={updateAnalysis} isHistoryItem />
                ))}
            </div>
        </div>
    );
};

export default VideoAnalyzer;