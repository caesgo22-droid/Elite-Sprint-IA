import { TrainingPlan, LoadStats, PerformanceLog } from "../types";

export interface DayStats {
    dateStr: string;
    load: number;
    acute: number;
    chronic: number;
    ratio: number;
}

export interface ACWROutput extends LoadStats {
    history: DayStats[];
    limits: {
        minMsg: string;
        maxMsg: string;
    }
}

/**
 * Calculates the Acute:Chronic Workload Ratio (ACWR) and historical trends.
 * Logic: Load = RPE * Duration (mins)
 */
export const getSessionLoad = (session: any): number => {
    // 1. Actual Load (Prioritize Feedback)
    if (session.feedback?.completed && session.feedback.rpe) {
        const duration = session.feedback.duration || 60;
        return session.feedback.rpe * duration;
    }

    // 2. Planned/Estimated Load
    const intensityMap: Record<string, number> = {
        'Low': 3,
        'Medium': 5,
        'High': 8,
        'Max': 9.5
    };
    const rpeEstimate = intensityMap[session.intensity] || 5;
    const durationEstimate = session.duration || 60; // Default to 60m if not specified

    return rpeEstimate * durationEstimate;
};

export const calculateACWR = (historyPlans: TrainingPlan[], logs: PerformanceLog[] = []): ACWROutput => {
    // 1. Extract and Normalize ALL Daily Loads
    const dailyLoadMap = new Map<string, number>();

    // Helper to add load
    const addLoad = (date: Date, load: number) => {
        if (!date || isNaN(date.getTime())) return;
        const key = date.toDateString();
        dailyLoadMap.set(key, (dailyLoadMap.get(key) || 0) + load);
    };

    // A. From Plans
    historyPlans.forEach(plan => {
        plan.sessions.forEach(session => {
            // Priority 1: Use actual feedback timestamp if available
            if (session.feedback?.completed && session.feedback.timestamp) {
                addLoad(new Date(session.feedback.timestamp), getSessionLoad(session));
            }
            // Priority 2: Use plan creation date as estimate for planned sessions
            // This ensures the chart shows SOMETHING even if no sessions are completed
            else if (plan.createdAt) {
                // Estimate: Distribute sessions across the week starting from plan creation
                // Use a simple heuristic: if session.day exists, map it to a day offset
                const planDate = new Date(plan.createdAt);
                const dayMap: Record<string, number> = {
                    'lun': 0, 'mon': 0, 'monday': 0, 'lunes': 0,
                    'mar': 1, 'tue': 1, 'tuesday': 1, 'martes': 1,
                    'mie': 2, 'wed': 2, 'wednesday': 2, 'miercoles': 2,
                    'jue': 3, 'thu': 3, 'thursday': 3, 'jueves': 3,
                    'vie': 4, 'fri': 4, 'friday': 4, 'viernes': 4,
                    'sab': 5, 'sat': 5, 'saturday': 5, 'sabado': 5,
                    'dom': 6, 'sun': 6, 'sunday': 6, 'domingo': 6
                };

                const sessionDay = session.day?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || '';
                let dayOffset = 0;

                for (const [key, offset] of Object.entries(dayMap)) {
                    if (sessionDay.includes(key)) {
                        dayOffset = offset;
                        break;
                    }
                }

                const estimatedDate = new Date(planDate);
                estimatedDate.setDate(planDate.getDate() + dayOffset);

                // Add as estimated load (will be overwritten by actual feedback if it exists)
                addLoad(estimatedDate, getSessionLoad(session));
            }
        });
    });

    // B. From Logs
    logs.forEach(log => {
        if ((log.event === 'Therapy' || log.type === 'Training') && log.date) {
            const load = (log.rpe && log.duration) ? log.rpe * log.duration : 0;
            addLoad(new Date(log.date), load);
        }
    });

    // 2. Generate Continuous Timeline (Last 28 Days + Today)
    const history: DayStats[] = [];
    const today = new Date();
    // We want to generate history for the chart (e.g. last 6 weeks to show trends)
    // Let's go back 42 days (6 weeks) for the chart, but calculation needs 28 days prior to THAT.
    const chartDays = 42;

    // Determine range
    // Earliest needed data point is Today - ChartDays - 28 days (for chronic of the first chart point)

    // We will compute the stats for every day in the requested chart range
    for (let i = chartDays; i >= 0; i--) {
        const targetDate = new Date();
        targetDate.setDate(today.getDate() - i);
        const targetDateStr = targetDate.toDateString();
        const currentDayLoad = dailyLoadMap.get(targetDateStr) || 0;

        // Calculate Acute (Last 7 days including today)
        let acuteSum = 0;
        for (let j = 0; j < 7; j++) {
            const d = new Date(targetDate);
            d.setDate(d.getDate() - j);
            acuteSum += dailyLoadMap.get(d.toDateString()) || 0;
        }
        const acuteAvg = acuteSum / 7;

        // Calculate Chronic (Last 28 days including today)
        let chronicSum = 0;
        for (let k = 0; k < 28; k++) {
            const d = new Date(targetDate);
            d.setDate(d.getDate() - k);
            chronicSum += dailyLoadMap.get(d.toDateString()) || 0;
        }
        const chronicAvg = chronicSum / 28;

        // Cold Start / Ratio Logic
        let effectiveChronic = chronicAvg;
        // Simple Cold Start: If chronic is tiny but acute is high => ratio explodes.
        // We dampen the ratio if chronic is very low.
        if (effectiveChronic < 100 && acuteAvg > 200) {
            effectiveChronic = acuteAvg / 1.5; // Assume 'safe' max buildup
        }
        if (effectiveChronic === 0) effectiveChronic = 1; // Prevent div/0

        const ratio = acuteAvg / effectiveChronic;

        history.push({
            dateStr: targetDateStr,
            load: currentDayLoad,
            acute: Math.round(acuteAvg),
            chronic: Math.round(chronicAvg), // We keep raw chronic for history
            ratio: parseFloat(ratio.toFixed(2))
        });
    }

    // 3. Current Stats (The last point in history)
    const current = history[history.length - 1];

    // Status Logic
    let status: 'Óptimo' | 'Alto Riesgo' | 'Carga Baja' = 'Óptimo';
    if (current.ratio > 1.5) status = 'Alto Riesgo';
    else if (current.ratio < 0.8) status = 'Carga Baja';
    else if (current.ratio > 1.3) status = 'Alto Riesgo'; // Warning zone

    return {
        acuteLoad: current.acute,
        chronicLoad: current.chronic,
        ratio: current.ratio,
        status,
        history, // Export full history for the chart
        limits: {
            minMsg: "0.8",
            maxMsg: "1.5"
        }
    };
};