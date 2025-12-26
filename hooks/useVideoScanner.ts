import { useState, useCallback } from 'react';
import { analyzeTechnique } from '../services/geminiService';
import { useToasts } from '../contexts/ToastContext';
import { BiomechanicalAnalysis } from '../types';

export const useVideoScanner = () => {
    const { showToast } = useToasts();
    const [isScanning, setIsScanning] = useState(false);
    const [progress, setProgress] = useState(0); // 0-100
    const [analysisResult, setAnalysisResult] = useState<BiomechanicalAnalysis | null>(null);

    const performScan = useCallback(async (
        videoElement: HTMLVideoElement,
        analysisMode: string,
        userProfile: any
    ) => {
        if (!videoElement || videoElement.paused) return null;

        setIsScanning(true);
        setProgress(10);
        showToast("Iniciando escaneo biométrico...", "info");

        try {
            // 1. Capture Frames (Simplified for hook - assuming Canvas interaction handles this or passed in)
            // Ideally, we might pass the captured frames or logic here, but for now we follow the service pattern
            // For this specific hook, we are wrapping the SERVICE logic primarily.

            // To properly extract the 'performScan' from VideoAnalyzer efficiently, 
            // we need to handle the frame capture logic which currently resides inside performScan.

            // However, a cleaner separation for this "Scanner" hook is to handle the *API interaction* 
            // given a set of inputs, or manage the state of that interaction.

            // Let's adapt: The actual frame capture logic is deeply tied to the video element and time.
            // We will migrate the *orchestration* here.

            const frames: string[] = [];
            const canvas = document.createElement('canvas');
            canvas.width = videoElement.videoWidth;
            canvas.height = videoElement.videoHeight;
            const ctx = canvas.getContext('2d');

            if (!ctx) throw new Error("Could not create canvas context");

            const duration = videoElement.duration;
            const step = duration > 0 ? duration / 5 : 0.5; // Capture ~5 frames distributed

            setProgress(30);

            // Seek and Capture Loop
            // Note: In a real hook we might want this async seek to be more robust, 
            // but we'll replicate the core logic for now.
            const currentTime = videoElement.currentTime;

            for (let i = 0; i < 5; i++) {
                videoElement.currentTime = i * step;
                await new Promise(r => setTimeout(r, 200)); // Wait for seek
                ctx.drawImage(videoElement, 0, 0);
                frames.push(canvas.toDataURL('image/jpeg', 0.8));
                setProgress(30 + (i * 10)); // Up to ~80%
            }

            // Restore playback position
            videoElement.currentTime = currentTime;

            setProgress(85);
            showToast("Analizando con Gemini Pro Vision...", "info");

            const result = await analyzeTechnique(
                frames,
                null, // bioData (handled by deeper integration later if needed)
                null,
                analysisMode,
                userProfile
            );

            if (result) {
                setAnalysisResult(result);
                setProgress(100);
                showToast("Análisis completado", "success");
                return result;
            } else {
                throw new Error("No result from analysis");
            }

        } catch (error: any) {
            console.error("Scan error:", error);
            showToast(error.message || "Error durante el análisis", "error");
            setProgress(0);
            return null;
        } finally {
            setIsScanning(false);
            // Don't reset progress immediately so user sees 100%
        }
    }, [showToast]);

    const resetScanner = () => {
        setIsScanning(false);
        setProgress(0);
        setAnalysisResult(null);
    };

    return {
        isScanning,
        progress,
        analysisResult,
        performScan,
        resetScanner
    };
};
