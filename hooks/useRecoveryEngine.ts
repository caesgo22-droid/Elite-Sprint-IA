import { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { calculateReadiness, generatePrescription } from '../utils/recoveryEngine';
import { WellnessData, DailyPrescription } from '../types';

export const useRecoveryEngine = () => {
    const { logs, addLog, currentPlan } = useApp();
    const [step, setStep] = useState<'check' | 'plan'>('check');
    const [readiness, setReadiness] = useState<number | null>(null);
    const [prescription, setPrescription] = useState<DailyPrescription | null>(null);

    const [wellnessData, setWellnessData] = useState<WellnessData>({
        sleepHours: 7,
        sleepQuality: 7,
        fatigue: 5,
        soreness: 3,
        stress: 4,
        mood: 7
    });

    const updateWellness = (field: keyof WellnessData, value: number) => {
        setWellnessData(prev => ({ ...prev, [field]: value }));
    };

    const calculateDailyReadiness = () => {
        const score = calculateReadiness(wellnessData, 1.0); // Assume ACWR 1.0 for now, or fetch
        setReadiness(score);
        const plan = generatePrescription(score, wellnessData);
        setPrescription(plan);
        setStep('plan');

        // Log it
        const log = {
            id: Date.now().toString(),
            date: new Date().toISOString(),
            type: 'Wellness',
            event: 'Recovery Check',
            metrics: wellnessData,
            notes: `Readiness: ${score}/100 - ${plan.status}`
        };
        addLog(log);
    };

    const resetRecovery = () => {
        setStep('check');
        setReadiness(null);
        setPrescription(null);
    };

    return {
        step,
        readiness,
        prescription,
        wellnessData,
        updateWellness,
        calculateDailyReadiness,
        resetRecovery
    };
};
