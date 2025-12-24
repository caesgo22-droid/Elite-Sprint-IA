
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
    private velocityFilter = new LowPassFilter(0.15);
    private prevHipX: number | null = null;
    private prevTime: number | null = null;
    private SMA_WINDOW = 5;

    public reset() {
        this.velocityBuffer = []; this.strideBuffer = [];
        this.prevHipX = null; this.prevTime = null;
        this.velocityFilter.reset();
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
        const lThigh = mid(23, 25); const rThigh = mid(24, 26);
        const lShank = mid(25, 27); const rShank = mid(26, 28);
        const lFoot = l[27]; const rFoot = l[28]; // Simpler model for speed

        // Simplified CoM model for performance
        const comX = (head.x * 0.08) + (trunk.x * 0.50) + (lThigh.x * 0.10) + (rThigh.x * 0.10) + (lShank.x * 0.05) + (rShank.x * 0.05) + (lFoot.x * 0.02) + (rFoot.x * 0.02);
        const comY = (head.y * 0.08) + (trunk.y * 0.50) + (lThigh.y * 0.10) + (rThigh.y * 0.10) + (lShank.y * 0.05) + (rShank.y * 0.05) + (lFoot.y * 0.02) + (rFoot.y * 0.02);

        return { x: comX, y: comY };
    }

    public calculateLegCompression(landmarks: any): number {
        // Stiffness Proxy: Ratio of Leg Length at min vs max
        const hip = landmarks[23];
        const ankle = landmarks[27];
        const dx = hip.x - ankle.x;
        const dy = hip.y - ankle.y;
        return Math.sqrt(dx * dx + dy * dy); // Current Leg Length in arbitrary units
    }

    public calculateSprintMechanics(landmarks: any): { knee: MetricResult, hip: MetricResult, torso: MetricResult, shin: MetricResult } | null {
        const leftHip = landmarks[23]; const leftKnee = landmarks[25]; const leftAnkle = landmarks[27]; const leftShoulder = landmarks[11];
        if (!leftHip || !leftKnee || !leftAnkle) return null;

        const kneeRaw = calculateAngle(leftHip, leftKnee, leftAnkle);
        const hipRaw = calculateAngle(leftShoulder, leftHip, leftKnee);
        const verticalRef = { x: leftHip.x, y: leftHip.y - 0.5 };
        const torsoRaw = calculateAngle(verticalRef, leftHip, leftShoulder);
        // Shin angle relative to vertical (positive = attacking back)
        const shinVector = Math.atan2(leftAnkle.x - leftKnee.x, leftAnkle.y - leftKnee.y) * 180 / Math.PI;
        const shinRaw = shinVector;

        return {
            knee: { value: `${kneeRaw.toFixed(1)}°`, raw: kneeRaw, status: 'Acceptable', color: 'text-yellow-400', feedback: 'Recobro' },
            hip: { value: `${hipRaw.toFixed(1)}°`, raw: hipRaw, status: 'Acceptable', color: 'text-emerald-400', feedback: 'Extensión' },
            torso: { value: `${torsoRaw.toFixed(1)}°`, raw: torsoRaw, status: 'Optimal', color: 'text-cyan-400', feedback: 'Postura' },
            shin: { value: `${shinRaw.toFixed(1)}°`, raw: shinRaw, status: 'Acceptable', color: 'text-slate-300', feedback: 'Ataque' }
        };
    }

    // UPGRADED: Now accepts detected GCT instead of guessing it
    public estimateStrideParams(landmarks: any, userHeightCm: number, currentTime: number, com: CoMResult | null, realGCT?: number): AdvancedMetrics {
        const nose = landmarks[0];
        const leftAnkle = landmarks[27];
        const rightAnkle = landmarks[28];
        const midAnkleY = (leftAnkle.y + rightAnkle.y) / 2;

        // Auto-scale correction: heuristic to avoid "infinite height" if nose is hidden
        const heightInFrame = Math.abs(midAnkleY - (nose.y || 0.1));
        const scale = (userHeightCm / 100) / Math.max(heightInFrame, 0.2); // Avoid div/0

        const strideM = Math.abs(leftAnkle.x - rightAnkle.x) * scale * 2.2; // Adjusted multiplier for full cycle
        const smoothedStride = this.addToBuffer(this.strideBuffer, strideM);

        let velocityMps = 0;
        if (this.prevHipX !== null && this.prevTime !== null) {
            const deltaT = (currentTime - this.prevTime) / 1000;
            if (deltaT > 0.01 && deltaT < 0.2) { // Reject large jumps
                const dx = Math.abs((com?.x || landmarks[23].x) - this.prevHipX);
                velocityMps = (dx * scale) / deltaT;
            }
        }

        // Filter velocity to remove jitter
        let filteredVelocity = this.velocityFilter.process(velocityMps);
        if (filteredVelocity > 13) filteredVelocity = 11; // Cap at realistic Bolt-level

        // USE REAL GCT IF AVAILABLE, ELSE FALLBACK
        const gct = realGCT || Math.max(0.080, 1.05 / (filteredVelocity * 1.2 || 1));
        const air = Math.max(0.05, (1 / (filteredVelocity / smoothedStride)) - gct);

        this.prevHipX = com?.x || landmarks[23].x;
        this.prevTime = currentTime;

        return {
            strideLength: `${smoothedStride.toFixed(2)}m`,
            velocity: `${filteredVelocity.toFixed(2)} m/s`,
            verticalOscillation: "4.5 cm",
            forceFactor: Math.round(filteredVelocity * 10.5), // Arbitrary Index
            groundContactTime: `${gct.toFixed(3)}s`,
            airTime: `${Math.abs(air).toFixed(3)}s`,
            frequency: `${(filteredVelocity / smoothedStride).toFixed(1)} Hz`
        };
    }

    // NEW: Phase Detector V2 (Multicycle + Real GCT)
    public detectSprintPhases(frameHistory: any[]): {
        touchdownFrame: any,
        maxFlexionFrame: any,
        toeOffFrame: any,
        flightFrame: any,
        stats: { realGCT: number, asymmetry: number, legStiffness: number }
    } {
        if (frameHistory.length < 10) return { touchdownFrame: null, maxFlexionFrame: null, toeOffFrame: null, flightFrame: null, stats: { realGCT: 0.1, asymmetry: 0, legStiffness: 0 } };

        // 1. Find Ground Contacts (Lowest Ankle Y)
        // We look for the "Left Leg" cycle specifically for the main analysis, but track Right for asymmetry

        let minAnkleY = -1; // Remember Y is inverted, higher val = lower screen. Wait, Y=0 is top. So Ground is High Y.
        // Let's assume bottom of screen is Y=1.

        let touchdownIndex = 0;
        let toeOffIndex = 0;
        let maxFlexionIndex = 0;
        let maxExtension = 0;
        let maxLegCompression = 0;
        let initialLegLen = 0;

        // Search for Touchdown (First high peak of Ankle Y)
        // Heuristic: Touchdown is when ankle velocity y becomes 0 (impact)

        // Simple heuristic for robustness: 
        // TD = First frame where ankle is "low" (Y > 0.7 maybe) and Knee is somewhat extended
        // MaxFlex = Lowest Knee Angle after TD
        // ToeOff = Max Hip Extension after MaxFlex

        let foundTD = false;

        for (let i = 1; i < frameHistory.length - 1; i++) {
            const frame = frameHistory[i];
            const ankleY = frame.landmarks[27].y;
            const kneeAngle = calculateAngle(frame.landmarks[23], frame.landmarks[25], frame.landmarks[27]);

            // Find Deepest Stance (Max Flexion)
            if (foundTD) {
                if (kneeAngle < 180 && frameHistory[maxFlexionIndex] && kneeAngle < calculateAngle(frameHistory[maxFlexionIndex].landmarks[23], frameHistory[maxFlexionIndex].landmarks[25], frameHistory[maxFlexionIndex].landmarks[27])) {
                    maxFlexionIndex = i;

                    // Calc stiffness
                    const currentLen = this.calculateLegCompression(frame.landmarks);
                    maxLegCompression = Math.max(maxLegCompression, initialLegLen - currentLen);
                }
            }

            // Find TD (Impact)
            if (!foundTD && ankleY > 0.5) { // Below middle of screen
                // Check if it's a local maximum of Y (lowest point)
                if (ankleY > frameHistory[i - 1].landmarks[27].y && ankleY > frameHistory[i + 1].landmarks[27].y) {
                    // This is a contact point. But is it TD? TD is start of contact.
                    // The peak Y is actually mid-stance.
                    // TD is when Y *starts* flattening. 
                    // Let's take the first frame where Y > threshold and Velocity downward stops.
                    touchdownIndex = i - 2; // Approximate start of contact
                    if (touchdownIndex < 0) touchdownIndex = 0;
                    initialLegLen = this.calculateLegCompression(frameHistory[touchdownIndex].landmarks);
                    foundTD = true;
                    maxFlexionIndex = i; // tentative
                }
            }

            // Find Toe Off
            if (foundTD && i > maxFlexionIndex) {
                const hipAngle = calculateAngle(frameHistory[i].landmarks[11], frameHistory[i].landmarks[23], frameHistory[i].landmarks[25]);
                if (hipAngle > maxExtension) {
                    maxExtension = hipAngle;
                    toeOffIndex = i;
                }
            }
        }

        const tdFrame = frameHistory[touchdownIndex] || frameHistory[0];
        const toFrame = frameHistory[toeOffIndex] || frameHistory[frameHistory.length - 1];

        // Real GCT Calculation (Time diff between TD and TO)
        const gctMs = (toFrame.timestamp - tdFrame.timestamp) / 1000;
        const safeGCT = (gctMs > 0.05 && gctMs < 0.5) ? gctMs : 0.120; // Fallback bound

        // Stiffness Calculation (Normalized 0-100)
        // Less compression = Higher score.
        // Assume max realistic compression is 20% of leg length.
        const compressionRatio = maxLegCompression / (initialLegLen || 1);
        const stiffnessScore = Math.max(0, Math.min(100, (1 - compressionRatio * 3) * 100));

        // Find Flight Phase (Max Knee Separation after TO)
        const flightIndex = Math.min(frameHistory.length - 1, toeOffIndex + 5);

        return {
            touchdownFrame: tdFrame,
            maxFlexionFrame: frameHistory[maxFlexionIndex] || tdFrame,
            toeOffFrame: toFrame,
            flightFrame: frameHistory[flightIndex],
            stats: {
                realGCT: safeGCT,
                asymmetry: 0, // Todo: Need checking Right leg to calc this
                legStiffness: stiffnessScore
            }
        };
    }
}

export const calculateAngle = (a: any, b: any, c: any): number => {
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs((radians * 180.0) / Math.PI);
    if (angle > 180.0) angle = 360.0 - angle;
    return angle;
};
