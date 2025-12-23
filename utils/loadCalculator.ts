

import { TrainingPlan, LoadStats, PerformanceLog } from "../types";

/**
 * Calculates the Acute:Chronic Workload Ratio (ACWR)
 * Logic: Load = RPE * Duration (mins)
 */
export const calculateACWR = (historyPlans: TrainingPlan[], logs: PerformanceLog[] = []): LoadStats => {
    // 1. Extract all completed sessions with feedback AND valid timestamp from Plans
    const planSessions = historyPlans.flatMap(p => p.sessions)
        .filter(s => s.feedback && s.feedback.completed && s.feedback.timestamp && !isNaN(new Date(s.feedback.timestamp).getTime()))
        .map(s => ({
            date: new Date(s.feedback!.timestamp!),
            load: (s.feedback?.rpe || 0) * (s.feedback?.duration || 0)
        }));

    // 2. Extract load from Performance Logs
    // Note: PerformanceLogs (Therapy/Results) do not currently track RPE/Duration (Load).
    // They are passed here for future compatibility or session counting, but currently contribute 0 load.
    const logSessions = logs
        .filter(l => l.date && !isNaN(new Date(l.date).getTime()) && (l.event === 'Therapy' || l.type === 'Training'))
        .map(l => ({
            date: new Date(l.date),
            load: 0 // Explicitly 0 as per current Type definition
        }));

    const allSessions = [...planSessions, ...logSessions];

    // Sort by date descending
    allSessions.sort((a, b) => b.date.getTime() - a.date.getTime());

    const today = new Date();

    // Helper to get load for a specific window
    const getAverageLoad = (days: number) => {
        let totalLoad = 0;

        // Standard rolling average logic: Sum load in window / days
        for (let i = 0; i < days; i++) {
            const targetDate = new Date();
            targetDate.setDate(today.getDate() - i);
            const dateStr = targetDate.toDateString();

            // Find sessions on this date
            const dailySessions = allSessions.filter(s =>
                s.date.toDateString() === dateStr
            );

            // Daily Load SUM
            const dailyLoad = dailySessions.reduce((acc, s) => acc + s.load, 0);
            totalLoad += dailyLoad;
        }

        return totalLoad / days;
    };

    // 3. Chronic Load Calculation with Cold-Start Protection
    // If the athlete has < 14 days of history, we normalize chronic load to avoid artificial spikes.
    // However, ACWR is Acute(7)/Chronic(28). 
    // If sessions exist only in the last 7 days, Chronic load is very low, making Ratio very high.

    // Logic: If active window is very short, be conservative.
    const chronicLoadRaw = getAverageLoad(28);
    const acuteLoad = getAverageLoad(7);

    // Cold start adjustment: if chronic load is very low (e.g. first week), 
    // we assume a "base" chronic load or Cap the ratio.
    let chronicLoad = chronicLoadRaw;
    let isColdStart = false;

    const uniqueDays = new Set(allSessions.map(s => s.date.toDateString())).size;
    if (uniqueDays < 14 && chronicLoadRaw < (acuteLoad * 0.5)) {
        // Assume at least 50% of acute to avoid spikes of 4.0
        chronicLoad = Math.max(chronicLoadRaw, acuteLoad / 1.1);
        isColdStart = true;
    }

    let ratio = chronicLoad === 0 ? (acuteLoad > 0 ? 1.5 : 0) : acuteLoad / chronicLoad;

    let status: 'Óptimo' | 'Alto Riesgo' | 'Carga Baja' = 'Óptimo';

    if (isColdStart && ratio > 1.3) {
        status = 'Óptimo'; // Suppress alert during initial 2 weeks unless extreme
    } else if (ratio > 1.5) {
        status = 'Alto Riesgo';
    } else if (ratio < 0.8 && ratio > 0) {
        status = 'Carga Baja';
    }

    return {
        acuteLoad: Math.round(acuteLoad),
        chronicLoad: Math.round(chronicLoad),
        ratio: parseFloat(ratio.toFixed(2)),
        status
    };
};