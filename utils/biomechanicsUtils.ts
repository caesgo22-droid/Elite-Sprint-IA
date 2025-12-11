
import { Vector2D } from "../types";

// --- TYPES ---
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
    verticalOscillation?: string; // "4cm"
    forceFactor?: number; // Relative force index
}

export interface CoMResult {
    x: number;
    y: number;
}

// --- DEMPSTER'S ANTHROPOMETRIC MODEL CONSTANTS ---
const SEGMENT_WEIGHTS = {
    head: 0.081,
    trunk: 0.497,
    upperArm: 0.028,
    forearm: 0.016,
    hand: 0.006,
    thigh: 0.10,
    shank: 0.0465,
    foot: 0.0145
};

// --- ELITE PHYSICS ENGINE (Stateful Class) ---
export class ElitePhysicsEngine {
    private velocityBuffer: number[] = [];
    private strideBuffer: number[] = [];
    private comYBuffer: number[] = [];
    private prevHipX: number | null = null;
    private prevTime: number | null = null;
    private SMA_WINDOW = 5;

    constructor() {
        this.reset();
    }

    // Critical: Call this when loading a new video to clear old data
    public reset() {
        this.velocityBuffer = [];
        this.strideBuffer = [];
        this.comYBuffer = [];
        this.prevHipX = null;
        this.prevTime = null;
    }

    private addToBuffer(buffer: number[], value: number): number {
        buffer.push(value);
        if (buffer.length > this.SMA_WINDOW) buffer.shift();
        return buffer.reduce((a, b) => a + b, 0) / buffer.length;
    }

    public calculateCenterOfMass(landmarks: any): CoMResult | null {
        if (!landmarks || landmarks.length < 33) return null;

        const mid = (i1: number, i2: number) => ({
            x: (landmarks[i1].x + landmarks[i2].x) / 2,
            y: (landmarks[i1].y + landmarks[i2].y) / 2
        });

        const l = landmarks;
        const head = mid(0, 10);
        const trunk = mid(11, 24);
        const lUpperArm = mid(11, 13); const rUpperArm = mid(12, 14);
        const lForearm = mid(13, 15); const rForearm = mid(14, 16);
        const lThigh = mid(23, 25); const rThigh = mid(24, 26);
        const lShank = mid(25, 27); const rShank = mid(26, 28);
        const lFoot = l[27]; const rFoot = l[28];

        const comX = (head.x * SEGMENT_WEIGHTS.head) + (trunk.x * SEGMENT_WEIGHTS.trunk) +
            (lUpperArm.x * SEGMENT_WEIGHTS.upperArm) + (rUpperArm.x * SEGMENT_WEIGHTS.upperArm) +
            (lForearm.x * SEGMENT_WEIGHTS.forearm) + (rForearm.x * SEGMENT_WEIGHTS.forearm) +
            (lThigh.x * SEGMENT_WEIGHTS.thigh) + (rThigh.x * SEGMENT_WEIGHTS.thigh) +
            (lShank.x * SEGMENT_WEIGHTS.shank) + (rShank.x * SEGMENT_WEIGHTS.shank) +
            (lFoot.x * SEGMENT_WEIGHTS.foot) + (rFoot.x * SEGMENT_WEIGHTS.foot);

        const comY = (head.y * SEGMENT_WEIGHTS.head) + (trunk.y * SEGMENT_WEIGHTS.trunk) +
            (lUpperArm.y * SEGMENT_WEIGHTS.upperArm) + (rUpperArm.y * SEGMENT_WEIGHTS.upperArm) +
            (lForearm.y * SEGMENT_WEIGHTS.forearm) + (rForearm.y * SEGMENT_WEIGHTS.forearm) +
            (lThigh.y * SEGMENT_WEIGHTS.thigh) + (rThigh.y * SEGMENT_WEIGHTS.thigh) +
            (lShank.y * SEGMENT_WEIGHTS.shank) + (rShank.y * SEGMENT_WEIGHTS.shank) +
            (lFoot.y * SEGMENT_WEIGHTS.foot) + (rFoot.y * SEGMENT_WEIGHTS.foot);

        return { x: comX, y: comY };
    }

    public calculateSprintMechanics(landmarks: any): { knee: MetricResult, hip: MetricResult, torso: MetricResult, shin: MetricResult } | null {
        const leftHip = landmarks[23];
        const leftKnee = landmarks[25];
        const leftAnkle = landmarks[27];
        const leftShoulder = landmarks[11];
        
        if(!leftHip || !leftKnee || !leftAnkle) return null;

        const lHip: Vector2D = { x: leftHip.x, y: leftHip.y };
        const lKnee: Vector2D = { x: leftKnee.x, y: leftKnee.y };
        const lAnkle: Vector2D = { x: leftAnkle.x, y: leftAnkle.y };
        const lShoulder: Vector2D = { x: leftShoulder.x, y: leftShoulder.y };

        const kneeRaw = calculateAngle(lHip, lKnee, lAnkle); 
        let kneeStatus: MetricResult['status'] = 'Acceptable';
        let kneeColor = 'text-yellow-400';
        let kneeMsg = 'Rango Medio';
        if (kneeRaw < 60) { kneeStatus = 'Optimal'; kneeColor = 'text-emerald-400'; kneeMsg = 'Excelente Recobro'; } 
        else if (kneeRaw > 95) { kneeStatus = 'Poor'; kneeColor = 'text-red-400'; kneeMsg = 'Recobro Bajo'; }

        const hipRaw = calculateAngle(lShoulder, lHip, lKnee);
        let hipStatus: MetricResult['status'] = 'Acceptable';
        let hipColor = 'text-yellow-400';
        let hipMsg = 'Extensión Media';
        if (hipRaw > 165) { hipStatus = 'Optimal'; hipColor = 'text-emerald-400'; hipMsg = 'Poder Total'; } 
        else if (hipRaw < 145) { hipStatus = 'Poor'; hipColor = 'text-red-400'; hipMsg = 'Cadera Sentada'; }
        
        const verticalRef: Vector2D = { x: lHip.x, y: lHip.y - 0.5 };
        const torsoRaw = calculateAngle(verticalRef, lHip, lShoulder);
        let torsoStatus: MetricResult['status'] = 'Optimal';
        let torsoColor = 'text-cyan-400'; 
        let torsoMsg = torsoRaw > 25 ? 'Fase Aceleración' : 'Max Velocidad';

        const shinVector = Math.atan2(lAnkle.y - lKnee.y, lAnkle.x - lKnee.x) * 180 / Math.PI;
        const shinRaw = Math.abs(90 - Math.abs(shinVector)); 

        return {
            knee: { value: `${kneeRaw}°`, raw: kneeRaw, status: kneeStatus, color: kneeColor, feedback: kneeMsg },
            hip: { value: `${hipRaw}°`, raw: hipRaw, status: hipStatus, color: hipColor, feedback: hipMsg },
            torso: { value: `${torsoRaw}°`, raw: torsoRaw, status: torsoStatus, color: torsoColor, feedback: torsoMsg },
            shin: { value: `${shinRaw.toFixed(1)}°`, raw: shinRaw, status: 'Acceptable', color: 'text-slate-300', feedback: 'Ataque' }
        };
    }

    public estimateStrideParams(landmarks: any, userHeightCm: number, currentTime: number, com: CoMResult | null): AdvancedMetrics {
        const nose = landmarks[0];
        const leftAnkle = landmarks[27];
        const rightAnkle = landmarks[28];
        const leftHip = landmarks[23];
        const rightHip = landmarks[24];

        if (!nose || !leftAnkle || !rightAnkle || !leftHip) return { strideLength: '-', velocity: '-', verticalOscillation: '-', forceFactor: 0 };

        // Scale
        const midAnkleY = (leftAnkle.y + rightAnkle.y) / 2;
        const heightInFrame = Math.abs(midAnkleY - nose.y);
        if (heightInFrame < 0.1) return { strideLength: '-', velocity: '-', verticalOscillation: '-', forceFactor: 0 }; 

        const realHeightM = userHeightCm / 100;
        const scale = realHeightM / heightInFrame; 

        // Stride
        const strideDistNorm = Math.abs(leftAnkle.x - rightAnkle.x);
        const strideM = strideDistNorm * scale * 1.8; 
        const smoothedStride = this.addToBuffer(this.strideBuffer, strideM);
        
        // Velocity
        const midHipX = (leftHip.x + rightHip.x) / 2;
        const trackingX = com ? com.x : midHipX;

        let velocityMps = 0;

        // Check if seek occurred (large time jump) to reset velocity calculation
        if (this.prevTime !== null && Math.abs(currentTime - this.prevTime) > 500) {
             this.prevHipX = trackingX;
             this.prevTime = currentTime;
        }

        if (this.prevHipX !== null && this.prevTime !== null) {
            const deltaX = Math.abs(trackingX - this.prevHipX); 
            const distM = deltaX * scale;
            const deltaT = (currentTime - this.prevTime) / 1000;
            
            if (deltaT > 0 && deltaT < 0.2) { 
                velocityMps = distM / deltaT;
            }
        }

        let smoothedVelocity = 0;
        if (velocityMps > 0 && velocityMps < 13) {
            smoothedVelocity = this.addToBuffer(this.velocityBuffer, velocityMps);
        } else {
            smoothedVelocity = this.velocityBuffer.length > 0 ? this.velocityBuffer[this.velocityBuffer.length -1] : 0;
        }

        // Vertical Oscillation
        let oscM = 0;
        if (com) {
            const yM = com.y * scale;
            this.comYBuffer.push(yM);
            if (this.comYBuffer.length > 10) this.comYBuffer.shift();
            
            if (this.comYBuffer.length > 2) {
                const min = Math.min(...this.comYBuffer);
                const max = Math.max(...this.comYBuffer);
                oscM = (max - min) * 100; 
            }
        }

        const forceFactor = Math.min(100, Math.round((smoothedVelocity * smoothedVelocity) / 2)); 

        this.prevHipX = trackingX;
        this.prevTime = currentTime;

        return {
            strideLength: `${smoothedStride.toFixed(2)}m`,
            velocity: smoothedVelocity === 0 ? '-' : `${smoothedVelocity.toFixed(1)} m/s`,
            verticalOscillation: `${oscM.toFixed(1)} cm`,
            forceFactor: forceFactor
        };
    }
}

// --- HELPER FUNCTIONS (Stateless) ---
export const calculateAngle = (a: Vector2D, b: Vector2D, c: Vector2D): number => {
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs((radians * 180.0) / Math.PI);
    if (angle > 180.0) angle = 360.0 - angle;
    return Math.round(angle * 10) / 10;
};
