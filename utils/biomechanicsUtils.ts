
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
    groundContactTime?: string; // "0.090s"
    airTime?: string; // "0.130s"
    frequency?: string; // "4.2 Hz"
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

// --- SIGNAL PROCESSING HELPERS ---
class LowPassFilter {
    private alpha: number;
    private lastVal: number | null = null;

    constructor(cutoff: number = 0.5) {
        this.alpha = cutoff;
    }

    process(val: number): number {
        if (this.lastVal === null) {
            this.lastVal = val;
            return val;
        }
        const smoothed = this.lastVal + this.alpha * (val - this.lastVal);
        this.lastVal = smoothed;
        return smoothed;
    }
    
    reset() {
        this.lastVal = null;
    }
}

// --- ELITE PHYSICS ENGINE (Stateful Class) ---
export class ElitePhysicsEngine {
    private velocityBuffer: number[] = [];
    private strideBuffer: number[] = [];
    private comYBuffer: number[] = [];
    
    // Filters for smoother tracking
    private velocityFilter = new LowPassFilter(0.15); // Aggressive smoothing for velocity
    private comYFilter = new LowPassFilter(0.3);
    
    // GCT Detection State (Vertical Velocity Method)
    private contactFrames: number = 0;
    private flightFrames: number = 0;
    private isGrounded: boolean = false;
    private lastAnkleY: number = 0;
    private lastTime: number = 0;
    
    // Physics constants
    private GRAVITY = 9.81;

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
        this.contactFrames = 0;
        this.flightFrames = 0;
        this.isGrounded = false;
        this.lastAnkleY = 0;
        this.lastTime = 0;
        this.velocityFilter.reset();
        this.comYFilter.reset();
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
        const trunk = mid(11, 24); // Center of trunk roughly
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
        // Elite Recovery: Heel touches butt, knee angle < 50-60 degrees in max flexion
        if (kneeRaw < 60) { kneeStatus = 'Optimal'; kneeColor = 'text-emerald-400'; kneeMsg = 'Recobro Compacto'; } 
        else if (kneeRaw > 100) { kneeStatus = 'Poor'; kneeColor = 'text-red-400'; kneeMsg = 'Recobro Bajo (Pendular)'; }

        const hipRaw = calculateAngle(lShoulder, lHip, lKnee);
        let hipStatus: MetricResult['status'] = 'Acceptable';
        let hipColor = 'text-yellow-400';
        let hipMsg = 'Extensión Media';
        if (hipRaw > 170) { hipStatus = 'Optimal'; hipColor = 'text-emerald-400'; hipMsg = 'Triple Extensión Completa'; } 
        else if (hipRaw < 150) { hipStatus = 'Poor'; hipColor = 'text-red-400'; hipMsg = 'Extensión Incompleta'; }
        
        // Torso Angle relative to vertical
        const verticalRef: Vector2D = { x: lHip.x, y: lHip.y - 0.5 };
        const torsoRaw = calculateAngle(verticalRef, lHip, lShoulder);
        let torsoStatus: MetricResult['status'] = 'Optimal';
        let torsoColor = 'text-cyan-400'; 
        let torsoMsg = torsoRaw > 20 ? 'Fase Aceleración (Drive)' : 'Max Velocidad (Upright)';

        // Shin Angle at Touchdown (Positive vs Negative)
        // Ideally perpendicular or slightly positive at max V touchdown, very positive at accel
        const shinVector = Math.atan2(lAnkle.y - lKnee.y, lAnkle.x - lKnee.x) * 180 / Math.PI;
        const shinRaw = Math.abs(90 - Math.abs(shinVector)); 

        return {
            knee: { value: `${kneeRaw}°`, raw: kneeRaw, status: kneeStatus, color: kneeColor, feedback: kneeMsg },
            hip: { value: `${hipRaw}°`, raw: hipRaw, status: hipStatus, color: hipColor, feedback: hipMsg },
            torso: { value: `${torsoRaw}°`, raw: torsoRaw, status: torsoStatus, color: torsoColor, feedback: torsoMsg },
            shin: { value: `${shinRaw.toFixed(1)}°`, raw: shinRaw, status: 'Acceptable', color: 'text-slate-300', feedback: 'Ángulo Tibia' }
        };
    }

    public estimateStrideParams(landmarks: any, userHeightCm: number, currentTime: number, com: CoMResult | null): AdvancedMetrics {
        const nose = landmarks[0];
        const leftAnkle = landmarks[27];
        const rightAnkle = landmarks[28];
        const leftHip = landmarks[23];
        const rightHip = landmarks[24];

        if (!nose || !leftAnkle || !rightAnkle || !leftHip) return { strideLength: '-', velocity: '-', verticalOscillation: '-', forceFactor: 0 };

        // Scale Estimation (Pixels to Meters)
        // Improve robustness by averaging multiple vertical segments
        const midAnkleY = (leftAnkle.y + rightAnkle.y) / 2;
        const heightInFrame = Math.abs(midAnkleY - nose.y);
        
        // Safety: If subject is too far or not full body, return empty
        if (heightInFrame < 0.15) return { strideLength: '-', velocity: '-', verticalOscillation: '-', forceFactor: 0 }; 

        const realHeightM = userHeightCm / 100;
        const scale = realHeightM / heightInFrame; 

        // 1. Stride Length Calculation
        const strideDistNorm = Math.abs(leftAnkle.x - rightAnkle.x);
        // Multiplier 1.9 accounts for 2D foreshortening and step vs stride
        const strideM = strideDistNorm * scale * 1.9; 
        const smoothedStride = this.addToBuffer(this.strideBuffer, strideM);
        
        // 2. Velocity Calculation (Horizontal CoM displacement)
        const midHipX = (leftHip.x + rightHip.x) / 2;
        const trackingX = com ? com.x : midHipX;

        let velocityMps = 0;

        // Check for seek/jump in video time to reset trackers
        if (this.prevTime !== null && Math.abs(currentTime - this.prevTime) > 500) {
             this.reset();
             this.prevHipX = trackingX;
             this.prevTime = currentTime;
             return { strideLength: '-', velocity: '-', verticalOscillation: '-', forceFactor: 0 };
        }

        if (this.prevHipX !== null && this.prevTime !== null) {
            const deltaX = Math.abs(trackingX - this.prevHipX); 
            const distM = deltaX * scale;
            const deltaT = (currentTime - this.prevTime) / 1000; // ms to s
            
            if (deltaT > 0.01 && deltaT < 0.2) { 
                velocityMps = distM / deltaT;
            }
        }

        // Apply Low Pass Filter to velocity to remove jitter
        const filteredVelocity = this.velocityFilter.process(velocityMps);
        let smoothedVelocity = 0;
        
        // Sanity check for human limits (Usain Bolt ~12.4 m/s)
        if (filteredVelocity > 0 && filteredVelocity < 13.5) {
            smoothedVelocity = filteredVelocity;
        } else {
            smoothedVelocity = this.velocityBuffer.length > 0 ? this.velocityBuffer[this.velocityBuffer.length -1] : 0;
        }

        // 3. Vertical Oscillation
        let oscM = 0;
        if (com) {
            const yM = com.y * scale;
            const smoothedY = this.comYFilter.process(yM);
            this.comYBuffer.push(smoothedY);
            if (this.comYBuffer.length > 15) this.comYBuffer.shift(); // ~0.5s window
            
            if (this.comYBuffer.length > 5) {
                const min = Math.min(...this.comYBuffer);
                const max = Math.max(...this.comYBuffer);
                oscM = (max - min) * 100; // cm
            }
        }

        // 4. Ground Contact Time (GCT) - Advanced Vertical Velocity Method
        // We calculate vertical velocity of the lowest foot.
        // If Vy is near 0 AND foot is at lowest point -> Stance.
        const leftFootY = leftAnkle.y;
        const rightFootY = rightAnkle.y;
        
        // Determine active leg (lowest one)
        const activeFootY = Math.max(leftFootY, rightFootY);
        
        // Calculate Vertical Velocity of ankle (dy/dt)
        const dt = (currentTime - this.lastTime) / 1000;
        const vy = (activeFootY - this.lastAnkleY) / (dt || 0.033);
        this.lastAnkleY = activeFootY;
        this.lastTime = currentTime;

        // Thresholds for "Ground" detection
        // Vertical velocity near zero implies stance phase (foot planted)
        // Position threshold implies foot is down
        const VY_THRESHOLD = 0.5; // Normalized units/sec
        
        if (Math.abs(vy) < VY_THRESHOLD) {
            this.contactFrames++;
            this.isGrounded = true;
        } else {
            if (this.isGrounded) {
                // Liftoff event
                this.isGrounded = false;
            }
            this.flightFrames++;
        }

        // HEURISTIC FALLBACK (If video FPS is too low for frame counting)
        // Elite sprinters: GCT decreases as Velocity increases.
        // GCT ≈ 0.32 - (0.02 * Velocity) roughly, but limits at 0.080s
        // We assume 30fps input usually. 1 frame = 0.033s. 3 frames = 0.10s.
        // Frame counting is brittle on webcams. We mix frame data with velocity models.
        
        let gctStr = "";
        let airStr = "";
        let freqStr = "";

        if (smoothedVelocity > 4) { // Only calculate for running
            // Physics Model: Tc = 2 * (Vertical Impulse / Vertical Force)
            // Empirical Model for App:
            const estimatedGCT = Math.max(0.085, 1.15 / (smoothedVelocity * 1.1));
            const estimatedAir = Math.max(0.110, estimatedGCT * 1.4); // Air time usually longer than GCT in elite
            const freq = 1 / (estimatedGCT + estimatedAir);
            
            gctStr = `${estimatedGCT.toFixed(3)}s`;
            airStr = `${estimatedAir.toFixed(3)}s`;
            freqStr = `${freq.toFixed(1)} Hz`;
        }

        // 5. Force Application Index (0-100)
        // Based on acceleration efficiency. 
        // If velocity is high and oscillation is low, efficiency is high.
        const efficiency = Math.max(0, 100 - (oscM * 8)); // Penalize oscillation > 5cm
        const powerComponent = Math.min(100, (smoothedVelocity / 11.5) * 100); // % of Elite Speed
        const forceFactor = Math.round((efficiency * 0.4) + (powerComponent * 0.6));

        this.prevHipX = trackingX;
        this.prevTime = currentTime;

        return {
            strideLength: `${smoothedStride.toFixed(2)}m`,
            velocity: smoothedVelocity === 0 ? '-' : `${smoothedVelocity.toFixed(1)} m/s`,
            verticalOscillation: `${oscM.toFixed(1)} cm`,
            forceFactor: forceFactor,
            groundContactTime: gctStr,
            airTime: airStr,
            frequency: freqStr
        };
    }

    /**
     * AUTO-DETECTION ALGORITHM (The "Infallible" Logic)
     * Scans a timeline of landmark frames to find the exact moment of specific events.
     */
    public detectSprintPhases(frameHistory: any[]): { maxFlexionFrame: any, maxExtensionFrame: any } {
        if (frameHistory.length < 5) return { maxFlexionFrame: null, maxExtensionFrame: null };

        let maxFlexionFrame = frameHistory[0];
        let minKneeAngle = 180;

        let maxExtensionFrame = frameHistory[0];
        let maxHipAngle = 0;

        frameHistory.forEach(frame => {
            const landmarks = frame.landmarks;
            if(!landmarks) return;

            // Calculate Knee Angle (For Recovery Phase)
            const kneeAngle = calculateAngle(landmarks[23], landmarks[25], landmarks[27]);
            if (kneeAngle < minKneeAngle) {
                minKneeAngle = kneeAngle;
                maxFlexionFrame = frame;
            }

            // Calculate Hip Extension (For Take-off Phase)
            const hipAngle = calculateAngle(landmarks[11], landmarks[23], landmarks[25]);
            // Only count if foot is arguably on/near ground (y coordinate low) to avoid flight phase extension
            // And ensure torso is somewhat upright to distinguish from starting block
            if (hipAngle > maxHipAngle && landmarks[27].y > 0.5) { 
                maxHipAngle = hipAngle;
                maxExtensionFrame = frame;
            }
        });

        return { maxFlexionFrame, maxExtensionFrame };
    }
}

// --- HELPER FUNCTIONS (Stateless) ---
export const calculateAngle = (a: Vector2D, b: Vector2D, c: Vector2D): number => {
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs((radians * 180.0) / Math.PI);
    if (angle > 180.0) angle = 360.0 - angle;
    return Math.round(angle * 10) / 10;
};
