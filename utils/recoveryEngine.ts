
export interface WellnessData {
    sleepQuality: number; // 1-10
    sleepHours: number;
    fatigue: number; // 1-10 (RPE-like, 10 is exhausted)
    soreness: number; // 1-10
    stress: number; // 1-10
    mood: number; // 1-10
}

export interface RecoveryProtocol {
    id: string;
    title: string;
    description: string;
    durationMin: number;
    type: 'Active' | 'Passive' | 'Cold' | 'Heat' | 'Manual';
    priority: 'High' | 'Medium' | 'Low';
}

export interface DailyPrescription {
    readinessScore: number; // 0-100
    status: 'Optimal' | 'Good' | 'Fair' | 'Poor';
    protocols: RecoveryProtocol[];
    coachNote: string;
}

/**
 * Calculates a daily readiness score (0-100) based on wellness inputs.
 * Higher score = Better readiness.
 */
export const calculateReadiness = (data: WellnessData, acwrRatio: number = 1.0): number => {
    // 1. Sleep Score (30%)
    // Ideal: 8-10h, Quality 8-10
    const sleepScore = Math.min(100, (data.sleepHours / 9) * 100) * 0.5 + (data.sleepQuality * 10) * 0.5;

    // 2. Physical State (40%)
    // Fatigue & Soreness are negative metrics (10 = bad)
    const rawPhysical = ((10 - data.fatigue) + (10 - data.soreness)) / 2; // 0-10 scale
    const physicalScore = rawPhysical * 10;

    // 3. Mental State (20%)
    // Stress is negative, Mood is positive
    const rawMental = ((10 - data.stress) + data.mood) / 2;
    const mentalScore = rawMental * 10;

    // 4. Load Penalty (10%)
    // If ACWR is > 1.3 or < 0.8, penalty applies
    let loadPenalty = 0;
    if (acwrRatio > 1.3) loadPenalty = 20;
    else if (acwrRatio < 0.8) loadPenalty = 10;

    // Weighted Sum
    let readiness = (sleepScore * 0.3) + (physicalScore * 0.4) + (mentalScore * 0.3) - loadPenalty;

    return Math.max(0, Math.min(100, Math.round(readiness)));
};

/**
 * Generates a recovery prescription based on the readiness score and specific symptoms.
 */
export const generatePrescription = (readiness: number, data: WellnessData): DailyPrescription => {
    let status: DailyPrescription['status'] = 'Optimal';
    let protocols: RecoveryProtocol[] = [];
    let note = "You are ready to smash it!";

    if (readiness >= 90) {
        status = 'Optimal';
        protocols.push({ id: 'act-1', title: 'Light Mobility', description: '5 min dynamic flow to maintain range of motion.', durationMin: 5, type: 'Active', priority: 'Low' });
        protocols.push({ id: 'pas-1', title: 'Mental Viz', description: 'Visualize your race plan.', durationMin: 10, type: 'Passive', priority: 'Medium' });
    } else if (readiness >= 70) {
        status = 'Good';
        note = "Good to go. Maintain focus on sleep.";
        protocols.push({ id: 'act-2', title: 'Foam Rolling', description: 'Focus on calves and quads.', durationMin: 10, type: 'Manual', priority: 'Medium' });
    } else if (readiness >= 50) {
        status = 'Fair';
        note = "Accumulating fatigue. Prioritize recovery tonight.";
        protocols.push({ id: 'cold-1', title: 'Contrast Bath', description: '1 min hot / 1 min cold x 5 rounds.', durationMin: 12, type: 'Cold', priority: 'High' });
        protocols.push({ id: 'pas-2', title: 'Nap', description: '20-30 min power nap.', durationMin: 20, type: 'Passive', priority: 'High' });
    } else {
        status = 'Poor';
        note = "RED FLAG. High risk state. Reduce intensity significantly.";
        protocols.push({ id: 'pas-3', title: 'Deep Sleep Focus', description: 'Aim for 9h+ sleep. No screens 1h before bed.', durationMin: 540, type: 'Passive', priority: 'High' });
        protocols.push({ id: 'cold-2', title: 'Ice Bath', description: '10-12 min at 10-12°C.', durationMin: 12, type: 'Cold', priority: 'High' });
        protocols.push({ id: 'act-3', title: 'Walk / Flush', description: 'Very low intensity walk to flush lactate.', durationMin: 15, type: 'Active', priority: 'Medium' });
    }

    // Symptom specific logic overrides
    if (data.soreness >= 7) {
        protocols.unshift({ id: 'spec-1', title: 'Compression Boots', description: '30 min session.', durationMin: 30, type: 'Passive', priority: 'High' });
    }
    if (data.stress >= 7) {
        protocols.push({ id: 'spec-2', title: 'Breathwork', description: 'Box breathing 4-4-4-4 for 5 mins.', durationMin: 5, type: 'Passive', priority: 'High' });
    }

    return { readinessScore: readiness, status, protocols, coachNote: note };
};

/**
 * Calculates post-session recovery protocols based on session intensity and duration.
 */
export const calculateRecovery = (intensity: string, durationMin: number, weightKg: number, rpe: number) => {
    const isHighIntensity = ['High', 'Max'].includes(intensity) || rpe >= 8;

    // Nutrition Logic
    const nutrition = {
        carbs: isHighIntensity ? `${(weightKg * 1.2).toFixed(0)}g` : `${(weightKg * 0.8).toFixed(0)}g`,
        protein: `${(weightKg * 0.4).toFixed(0)}g`,
        hydration: `${(durationMin * 10 + 500)}ml`,
        notes: isHighIntensity
            ? "Priorizar carbohidratos de alto IG post-esfuerzo."
            : "Mantener hidratación constante y proteína moderada."
    };

    // Protocols Logic
    const protocols = [];
    if (isHighIntensity) {
        protocols.push("Baño de Hielo (10 min @ 10°C)");
        protocols.push("Masaje con Foam Roller (Zonas de carga)");
        protocols.push("Compresión Neumática (30 min)");
    } else {
        protocols.push("Movilidad Articular Suave");
        protocols.push("Estiramiento Estático (20s por grupo)");
        protocols.push("Ducha de contraste");
    }

    if (rpe >= 9) {
        protocols.unshift("REPOSO TOTAL / Siesta de 20 min");
    }

    return {
        sessionType: intensity,
        nutrition,
        protocols
    };
};