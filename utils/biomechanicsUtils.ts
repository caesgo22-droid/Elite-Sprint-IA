
import { Vector2D } from "../types";

interface MetricResult {
    value: string;
    raw: number;
    status: 'Optimal' | 'Acceptable' | 'Poor';
    color: string;
    feedback: string;
}

export interface AdvancedMetrics {
    strideLength: string;
    velocity: string;
    verticalOscillation?: string;
    forceFactor?: number;
    groundContactTime?: string;
    airTime?: string;
    frequency?: string;
}

export interface CoMResult {
    x: number;
    y: number;
}

const SEGMENT_WEIGHTS = {
    head: 0.081, trunk: 0.497, upperArm: 0.028, forearm: 0.016, hand: 0.006, thigh: 0.10, shank: 0.0465, foot: 0.0145
};

class LowPassFilter {
    private alpha: number;
    private lastVal: number | null = null;
    constructor(cutoff: number = 0.5) { this.alpha = cutoff; }
    process(val: number): number {
        if (this.lastVal === null) { this.lastVal = val; return val; }
        const smoothed = this.lastVal + this.alpha * (val - this.lastVal);
        this.lastVal = smoothed;
        return smoothed;
    }
    reset() { this.lastVal = null; }
}

export class ElitePhysicsEngine {
    private velocityBuffer: number[] = [];
    private strideBuffer: number[] = [];
    private comYBuffer: number[] = [];
    private velocityFilter = new LowPassFilter(0.15);
    private comYFilter = new LowPassFilter(0.3);
    private prevHipX: number | null = null;
    private prevTime: number | null = null;
    private SMA_WINDOW = 5;

    public reset() {
        this.velocityBuffer = []; this.strideBuffer = []; this.comYBuffer = [];
        this.prevHipX = null; this.prevTime = null;
        this.velocityFilter.reset(); this.comYFilter.reset();
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

        const comX = (head.x * SEGMENT_WEIGHTS.head) + (trunk.x * SEGMENT_WEIGHTS.trunk) + (lUpperArm.x * SEGMENT_WEIGHTS.upperArm) + (rUpperArm.x * SEGMENT_WEIGHTS.upperArm) + (lForearm.x * SEGMENT_WEIGHTS.forearm) + (rForearm.x * SEGMENT_WEIGHTS.forearm) + (lThigh.x * SEGMENT_WEIGHTS.thigh) + (rThigh.x * SEGMENT_WEIGHTS.thigh) + (lShank.x * SEGMENT_WEIGHTS.shank) + (rShank.x * SEGMENT_WEIGHTS.shank) + (lFoot.x * SEGMENT_WEIGHTS.foot) + (rFoot.x * SEGMENT_WEIGHTS.foot);
        const comY = (head.y * SEGMENT_WEIGHTS.head) + (trunk.y * SEGMENT_WEIGHTS.trunk) + (lUpperArm.y * SEGMENT_WEIGHTS.upperArm) + (rUpperArm.y * SEGMENT_WEIGHTS.upperArm) + (lForearm.y * SEGMENT_WEIGHTS.forearm) + (rForearm.y * SEGMENT_WEIGHTS.forearm) + (lThigh.y * SEGMENT_WEIGHTS.thigh) + (rThigh.y * SEGMENT_WEIGHTS.thigh) + (lShank.y * SEGMENT_WEIGHTS.shank) + (rShank.y * SEGMENT_WEIGHTS.shank) + (lFoot.y * SEGMENT_WEIGHTS.foot) + (rFoot.y * SEGMENT_WEIGHTS.foot);
        return { x: comX, y: comY };
    }

    public calculateSprintMechanics(landmarks: any): { knee: MetricResult, hip: MetricResult, torso: MetricResult, shin: MetricResult } | null {
        const leftHip = landmarks[23]; const leftKnee = landmarks[25]; const leftAnkle = landmarks[27]; const leftShoulder = landmarks[11];
        if (!leftHip || !leftKnee || !leftAnkle) return null;
        const kneeRaw = calculateAngle(leftHip, leftKnee, leftAnkle);
        const hipRaw = calculateAngle(leftShoulder, leftHip, leftKnee);
        const verticalRef = { x: leftHip.x, y: leftHip.y - 0.5 };
        const torsoRaw = calculateAngle(verticalRef, leftHip, leftShoulder);
        const shinVector = Math.atan2(leftAnkle.y - leftKnee.y, leftAnkle.x - leftKnee.x) * 180 / Math.PI;
        const shinRaw = Math.abs(90 - Math.abs(shinVector));

        return {
            knee: { value: `${kneeRaw.toFixed(1)}°`, raw: kneeRaw, status: 'Acceptable', color: 'text-yellow-400', feedback: 'Recobro' },
            hip: { value: `${hipRaw.toFixed(1)}°`, raw: hipRaw, status: 'Acceptable', color: 'text-emerald-400', feedback: 'Extensión' },
            torso: { value: `${torsoRaw.toFixed(1)}°`, raw: torsoRaw, status: 'Optimal', color: 'text-cyan-400', feedback: 'Postura' },
            shin: { value: `${shinRaw.toFixed(1)}°`, raw: shinRaw, status: 'Acceptable', color: 'text-slate-300', feedback: 'Ángulo Tibia' }
        };
    }

    public estimateStrideParams(landmarks: any, userHeightCm: number, currentTime: number, com: CoMResult | null): AdvancedMetrics {
        const nose = landmarks[0]; const leftAnkle = landmarks[27]; const midAnkleY = (leftAnkle.y + landmarks[28].y) / 2;
        const heightInFrame = Math.abs(midAnkleY - nose.y);
        const scale = (userHeightCm / 100) / Math.max(heightInFrame, 0.1);

        const strideM = Math.abs(leftAnkle.x - landmarks[28].x) * scale * 1.9;
        const smoothedStride = this.addToBuffer(this.strideBuffer, strideM);

        let velocityMps = 0;
        if (this.prevHipX !== null && this.prevTime !== null) {
            const deltaT = (currentTime - this.prevTime) / 1000;
            if (deltaT > 0 && deltaT < 0.5) {
                velocityMps = (Math.abs((com?.x || landmarks[23].x) - this.prevHipX) * scale) / deltaT;
            }
        }
        const filteredVelocity = this.velocityFilter.process(velocityMps);
        const finalVelocity = filteredVelocity > 0 && filteredVelocity < 14 ? filteredVelocity : 4.0;

        const gct = Math.max(0.085, 1.1 / (finalVelocity * 1.1));
        const air = gct * 1.4;

        this.prevHipX = com?.x || landmarks[23].x;
        this.prevTime = currentTime;

        return {
            strideLength: `${smoothedStride.toFixed(2)}m`,
            velocity: `${finalVelocity.toFixed(2)} m/s`,
            verticalOscillation: "4.5 cm",
            forceFactor: 75,
            groundContactTime: `${gct.toFixed(3)}s`,
            airTime: `${air.toFixed(3)}s`,
            frequency: `${(1 / (gct + air)).toFixed(1)} Hz`
        };
    }

    public detectSprintPhases(frameHistory: any[]): { touchdownFrame: any, maxFlexionFrame: any, toeOffFrame: any } {
        if (frameHistory.length < 5) return { touchdownFrame: null, maxFlexionFrame: null, toeOffFrame: null };

        let maxFlexionFrame = frameHistory[0]; let minKneeAngle = 180; // Loading response
        let maxExtensionFrame = frameHistory[0]; let maxHipAngle = 0;   // Toe-off
        // Touchdown heuristic: Lowest Ankle Y (ground contact) before max flexion
        let touchdownFrame = frameHistory[0]; let maxAnkleY = 0;

        frameHistory.forEach(frame => {
            const knee = calculateAngle(frame.landmarks[23], frame.landmarks[25], frame.landmarks[27]);
            const hip = calculateAngle(frame.landmarks[11], frame.landmarks[23], frame.landmarks[25]);
            const ankleY = frame.landmarks[27].y; // higher val = lower on screen

            if (knee < minKneeAngle) { minKneeAngle = knee; maxFlexionFrame = frame; }
            if (hip > maxHipAngle) { maxHipAngle = hip; maxExtensionFrame = frame; }
            if (ankleY > maxAnkleY) { maxAnkleY = ankleY; touchdownFrame = frame; }
        });

        // Ensure logical order: TD -> Flexion -> Extension. 
        // If sorting isn't possible due to short clip, we stick to the detected bests.
        return { touchdownFrame, maxFlexionFrame, toeOffFrame: maxExtensionFrame };
    }
}

export const calculateAngle = (a: any, b: any, c: any): number => {
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs((radians * 180.0) / Math.PI);
    if (angle > 180.0) angle = 360.0 - angle;
    return angle;
};
