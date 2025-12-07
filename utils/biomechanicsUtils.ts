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