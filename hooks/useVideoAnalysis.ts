import { useState, useRef, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { analyzeTechnique } from '../services/geminiService';
import { useToasts } from '../contexts/ToastContext';

export const useVideoAnalysis = () => {
    const { userProfile, updateAnalysisHistory, lastAnalysis, setLastAnalysis } = useApp();
    const { showToast } = useToasts();

    const [analyzing, setAnalyzing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [feedback, setFeedback] = useState<any | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // MediaPipe State (kept here or passed from component)
    // Ideally, MediaPipe instance management stays in the component due to DOM ref dependency,
    // but the *analysis logic* moves here.

    const runAnalysis = async (
        event: string,
        videoUrl: string | null,
        advancedMetrics: { gct: number; stiffness: number; asymmetry: number; }
    ) => {
        setAnalyzing(true);
        setProgress(10);
        setErrorMsg(null);
        setFeedback(null);

        try {
            // Simulate progression steps for UX
            const progInterval = setInterval(() => {
                setProgress(prev => Math.min(prev + 10, 90));
            }, 500);

            const result = await analyzeTechnique(userProfile, event, advancedMetrics); // Pass metrics

            clearInterval(progInterval);
            setProgress(100);

            if (result) {
                // Enrich result with metadata
                const analysisRecord = {
                    ...result,
                    id: Date.now().toString(),
                    date: new Date().toLocaleDateString(),
                    videoUrl: videoUrl, // Persist video reference
                    advancedMetrics // Save the raw metrics too
                };

                setFeedback(analysisRecord);
                setLastAnalysis(analysisRecord);
                updateAnalysisHistory(analysisRecord);
                showToast("Análisis biomecánico completado", "success");
            } else {
                setErrorMsg("No se pudo completar el análisis. Intente nuevamente.");
                showToast("Error en el análisis", "error");
            }
        } catch (e) {
            console.error(e);
            setErrorMsg("Error de conexión con el motor de IA.");
        } finally {
            setAnalyzing(false);
        }
    };

    const resetAnalysis = () => {
        setFeedback(null);
        setProgress(0);
        setErrorMsg(null);
    };

    return {
        analyzing,
        progress,
        feedback,
        errorMsg,
        runAnalysis,
        resetAnalysis
    };
};
