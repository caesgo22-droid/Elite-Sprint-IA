import { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { generateTrainingPlan } from '../services/geminiService';
import { calculateRecovery } from '../utils/recoveryEngine';
import { TrainingSession, UserProfile } from '../types';
import { useToasts } from '../contexts/ToastContext';

export interface UseTrainingPlanProps {
    fatigue: number;
    sleep: number;
    soreness: number;
    stress: number;
    hydration: number;
    restingHR: number;
    hrv: number;
    focusEvent: string;
}

export const useTrainingPlan = () => {
    const { userProfile, currentPlan, setPlan, planHistory, updateSession, lastAnalysis, logs } = useApp();
    const { showToast } = useToasts();

    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [viewingRecovery, setViewingRecovery] = useState<any>(null);

    const { acwrStats } = useApp();

    const generatePlan = async (inputs: UseTrainingPlanProps) => {
        setLoading(true);
        setErrorMsg(null);
        try {
            const plan = await generateTrainingPlan(
                userProfile,
                inputs,
                new Date().toLocaleDateString('es-ES'),
                inputs.focusEvent,
                acwrStats || { ratio: 1.0, status: 'Óptimo' },
                lastAnalysis,
                logs
            );

            if (plan) {
                setPlan(plan);
                showToast("Plan generado con éxito", "success");
            } else {
                setErrorMsg("No se pudo generar el plan. Verifique conexión/API.");
                showToast("Error al generar", "error");
            }
        } catch (e) {
            console.error(e);
            setErrorMsg("Error inesperado al generar el plan.");
        } finally {
            setLoading(false);
        }
    };

    const calculateSessionRecovery = (session: TrainingSession) => {
        if (!session.feedback) return;
        const weight = (userProfile.weight && userProfile.weight > 0) ? userProfile.weight : 70;
        const rec = calculateRecovery(session.intensity, session.feedback.duration || 60, weight, session.feedback.rpe || 5);
        setViewingRecovery(rec);
    };

    const closeRecoveryView = () => setViewingRecovery(null);

    return {
        currentPlan,
        planHistory,
        loading,
        errorMsg,
        acwr: acwrStats,
        maxHr: 220 - (userProfile.age || 20), // Simple utility
        viewingRecovery,
        generatePlan,
        calculateSessionRecovery,
        closeRecoveryView,
        updateSession,
        logs
    };
};
