import { Vector2D } from "../types";

// Calculates the angle between three points (A, B, C) where B is the vertex
export const calculateAngle = (a: Vector2D, b: Vector2D, c: Vector2D): number => {
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs((radians * 180.0) / Math.PI);
    if (angle > 180.0) angle = 360.0 - angle;
    return Math.round(angle * 10) / 10;
};

interface MetricResult {
    value: string;
    raw: number;
    status: 'Optimal' | 'Acceptable' | 'Poor';
    color: string;
    feedback: string;
}

export interface AdvancedMetrics {
    strideLength: string; // "2.10m"
    velocity: string;     // "10.5 m/s"
}

// Interprets MediaPipe landmarks to get relevant Sprint Mechanics with Semantic Feedback
export const calculateSprintMechanics = (landmarks: any): { knee: MetricResult, hip: MetricResult, torso: MetricResult, shin: MetricResult } | null => {
    const leftHip = landmarks[23];
    const leftKnee = landmarks[25];
    const leftAnkle = landmarks[27];
    const leftShoulder = landmarks[11];
    
    if(!leftHip || !leftKnee || !leftAnkle) return null;

    const lHip: Vector2D = { x: leftHip.x, y: leftHip.y };
    const lKnee: Vector2D = { x: leftKnee.x, y: leftKnee.y };
    const lAnkle: Vector2D = { x: leftAnkle.x, y: leftAnkle.y };
    const lShoulder: Vector2D = { x: leftShoulder.x, y: leftShoulder.y };

    // --- 1. KNEE DRIVE (Flexion) ---
    const kneeRaw = calculateAngle(lHip, lKnee, lAnkle); 
    let kneeStatus: MetricResult['status'] = 'Acceptable';
    let kneeColor = 'text-yellow-400';
    let kneeMsg = 'Rango Medio';
    
    // Elite Range: <60 degrees flexion during recovery (Ralph Mann)
    if (kneeRaw < 60) {
        kneeStatus = 'Optimal';
        kneeColor = 'text-emerald-400';
        kneeMsg = 'Excelente Recobro';
    } else if (kneeRaw > 95) {
        kneeStatus = 'Poor';
        kneeColor = 'text-red-400';
        kneeMsg = 'Recobro Bajo (Arrastre)';
    }

    // --- 2. HIP EXTENSION ---
    const hipRaw = calculateAngle(lShoulder, lHip, lKnee);
    let hipStatus: MetricResult['status'] = 'Acceptable';
    let hipColor = 'text-yellow-400';
    let hipMsg = 'Extensión Media';

    // Elite Range: >170 degrees at toe-off
    if (hipRaw > 165) {
        hipStatus = 'Optimal';
        hipColor = 'text-emerald-400';
        hipMsg = 'Poder Total';
    } else if (hipRaw < 145) {
        hipStatus = 'Poor';
        hipColor = 'text-red-400';
        hipMsg = 'Cadera Sentada (Colapso)';
    }
    
    // --- 3. TORSO ANGLE ---
    const verticalRef: Vector2D = { x: lHip.x, y: lHip.y - 0.5 };
    const torsoRaw = calculateAngle(verticalRef, lHip, lShoulder);
    let torsoStatus: MetricResult['status'] = 'Optimal';
    let torsoColor = 'text-cyan-400'; 
    let torsoMsg = torsoRaw > 25 ? 'Fase Aceleración' : 'Max Velocidad';

    // --- 4. SHIN ANGLE ---
    const shinVector = Math.atan2(lAnkle.y - lKnee.y, lAnkle.x - lKnee.x) * 180 / Math.PI;
    const shinRaw = Math.abs(90 - Math.abs(shinVector)); 

    return {
        knee: { value: `${kneeRaw}°`, raw: kneeRaw, status: kneeStatus, color: kneeColor, feedback: kneeMsg },
        hip: { value: `${hipRaw}°`, raw: hipRaw, status: hipStatus, color: hipColor, feedback: hipMsg },
        torso: { value: `${torsoRaw}°`, raw: torsoRaw, status: torsoStatus, color: torsoColor, feedback: torsoMsg },
        shin: { value: `${shinRaw.toFixed(1)}°`, raw: shinRaw, status: 'Acceptable', color: 'text-slate-300', feedback: 'Ataque' }
    };
};

/**
 * Calculates Scale based on user height and estimates Stride/Velocity
 */
export const estimateStrideParams = (
    landmarks: any, 
    userHeightCm: number,
    prevHipX: number | null,
    prevTime: number | null,
    currentTime: number
): { strideLen: string, velocity: string, currentHipX: number } => {
    
    const nose = landmarks[0];
    const leftAnkle = landmarks[27];
    const rightAnkle = landmarks[28];
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];

    if (!nose || !leftAnkle || !rightAnkle || !leftHip) return { strideLen: '-', velocity: '-', currentHipX: 0 };

    // 1. Calculate Scale (Meters per Normalized Unit)
    // Height in frame = Nose Y to Mid-Ankle Y
    const midAnkleY = (leftAnkle.y + rightAnkle.y) / 2;
    const heightInFrame = Math.abs(midAnkleY - nose.y); // Normalized 0-1
    
    if (heightInFrame < 0.1) return { strideLen: '-', velocity: '-', currentHipX: 0 }; // Too small/far

    const realHeightM = userHeightCm / 100;
    const scale = realHeightM / heightInFrame; // meters per unit

    // 2. Stride Length (Distance betweeen Ankles X)
    const strideDistNorm = Math.abs(leftAnkle.x - rightAnkle.x);
    const strideM = strideDistNorm * scale * 1.8; // Factor 1.8 approximates full stride vs stance width
    
    // 3. Velocity (Hip Displacement)
    const midHipX = (leftHip.x + rightHip.x) / 2;
    let velocityMps = 0;

    if (prevHipX !== null && prevTime !== null) {
        const deltaX = Math.abs(midHipX - prevHipX); // Normalized displacement
        const distM = deltaX * scale;
        const deltaT = (currentTime - prevTime) / 1000; // Seconds
        
        if (deltaT > 0) {
            velocityMps = distM / deltaT;
        }
    }

    // Smoothing output (only show reasonable values)
    const finalV = velocityMps > 0 && velocityMps < 13 ? velocityMps.toFixed(1) : '-';
    
    return {
        strideLen: `${strideM.toFixed(2)}m`,
        velocity: finalV === '-' ? '-' : `${finalV} m/s`,
        currentHipX: midHipX
    };
};