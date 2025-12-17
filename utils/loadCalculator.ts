

import { TrainingPlan, LoadStats } from "../types";

/**
 * Calculates the Acute:Chronic Workload Ratio (ACWR)
 * Logic: Load = RPE * Duration (mins)
 */
export const calculateACWR = (historyPlans: TrainingPlan[]): LoadStats => {
    // 1. Extract all completed sessions with feedback AND valid timestamp
    const allSessions = historyPlans.flatMap(p => p.sessions)
        .filter(s => s.feedback && s.feedback.completed && s.feedback.timestamp && !isNaN(new Date(s.feedback.timestamp).getTime()));

    // Sort by date descending
    allSessions.sort((a, b) => 
        new Date(b.feedback!.timestamp!).getTime() - new Date(a.feedback!.timestamp!).getTime()
    );

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
                new Date(s.feedback!.timestamp!).toDateString() === dateStr
            );

            // Daily Load = Sum of (RPE * Duration) for that day
            const dailyLoad = dailySessions.reduce((acc, s) => {
                const rpe = s.feedback?.rpe || 0;
                const duration = s.feedback?.duration || 0;
                return acc + (rpe * duration);
            }, 0);

            totalLoad += dailyLoad;
        }

        return totalLoad / days;
    };

    const acuteLoad = getAverageLoad(7);
    const chronicLoad = getAverageLoad(28);

    // Avoid division by zero for new users
    let ratio = 0;
    if (chronicLoad === 0) {
        ratio = acuteLoad > 0 ? 1.0 : 0; // If brand new, assume balanced
    } else {
        ratio = acuteLoad / chronicLoad;
    }

    let status: 'Óptimo' | 'Alto Riesgo' | 'Carga Baja' = 'Óptimo';
    if (ratio > 1.5) status = 'Alto Riesgo';
    else if (ratio < 0.8) status = 'Carga Baja';

    return {
        acuteLoad: Math.round(acuteLoad),
        chronicLoad: Math.round(chronicLoad),
        ratio: parseFloat(ratio.toFixed(2)),
        status
    };
};