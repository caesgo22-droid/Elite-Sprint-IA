

import { TrainingPlan, LoadStats, PerformanceLog } from "../types";

/**
 * Calculates the Acute:Chronic Workload Ratio (ACWR)
 * Logic: Load = RPE * Duration (mins)
 */
export const calculateACWR = (historyPlans: TrainingPlan[], logs: PerformanceLog[] = []): LoadStats => {
    // 1. Extract all completed sessions with feedback AND valid timestamp from Plans
    // Complexity: O(Sessions)
    const planSessions = historyPlans.flatMap(p => p.sessions)
        .filter(s => s.feedback && s.feedback.completed && s.feedback.timestamp && !isNaN(new Date(s.feedback.timestamp).getTime()))
        .map(s => ({
            dateStr: new Date(s.feedback!.timestamp!).toDateString(),
            load: (s.feedback?.rpe || 0) * (s.feedback?.duration || 0)
        }));

    // 2. Extract load from Performance Logs
    const logSessions = logs
        .filter(l => l.date && !isNaN(new Date(l.date).getTime()) && (l.event === 'Therapy' || l.type === 'Training'))
        .map(l => ({
            dateStr: new Date(l.date).toDateString(),
            load: 0 // Explicitly 0 as per current Type definition
        }));

    // 3. Aggregate Daily Loads into a Map - O(N)
    const dailyLoadMap = new Map<string, number>();

    [...planSessions, ...logSessions].forEach(session => {
        const current = dailyLoadMap.get(session.dateStr) || 0;
        dailyLoadMap.set(session.dateStr, current + session.load);
    });

    const today = new Date();

    // Helper to get average load efficiently - O(Window Size)
    // No filtering inside loop
    const getAverageLoad = (days: number) => {
        let totalLoad = 0;
        for (let i = 0; i < days; i++) {
            const targetDate = new Date();
            targetDate.setDate(today.getDate() - i);
            const dateStr = targetDate.toDateString();
            totalLoad += dailyLoadMap.get(dateStr) || 0;
        }
        return totalLoad / days;
    };

    // 4. Calculate Loads
    const chronicLoadRaw = getAverageLoad(28);
    const acuteLoad = getAverageLoad(7);

    // Cold start adjustment
    let chronicLoad = chronicLoadRaw;
    let isColdStart = false;

    // Check unique days with activity to detect cold start
    const uniqueDays = dailyLoadMap.size;

    if (uniqueDays < 14 && chronicLoadRaw < (acuteLoad * 0.5)) {
        chronicLoad = Math.max(chronicLoadRaw, acuteLoad / 1.1);
        isColdStart = true;
    }

    let ratio = chronicLoad === 0 ? (acuteLoad > 0 ? 1.5 : 0) : acuteLoad / chronicLoad;

    let status: 'Óptimo' | 'Alto Riesgo' | 'Carga Baja' = 'Óptimo';

    if (isColdStart && ratio > 1.3) {
        status = 'Óptimo';
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