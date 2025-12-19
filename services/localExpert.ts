
import { BiomechanicalAnalysis, KineticMetrics } from "../types";
import { AdvancedMetrics } from "../utils/biomechanicsUtils";

// --- LOCAL EXPERT SYSTEM (RULE-BASED AI) ---
// Este sistema actúa como respaldo cuando Gemini no está disponible.
// Utiliza lógica determinista basada en los principios de Ralph Mann y Frans Bosch.

export const LocalExpert = {
    analyze: (
        phases: { touchdown: any, flexion: any, extension: any },
        metrics: AdvancedMetrics,
        kinetics: KineticMetrics
    ): BiomechanicalAnalysis => {

        const errors: string[] = [];
        const shouts: string[] = [];
        const drills: string[] = [];
        let score = 100;

        // --- FILMSTRIP ANALYSIS (OFFLINE) ---
        const mechanics = phases.flexion.mechanics; // Use Max Flexion as representative for angles
        const torsoAngle = mechanics.torso.raw;

        // 1. TOUCHDOWN PHASE (Braking Forces)
        const tdAnkleX = phases.touchdown.landmarks[27].x;
        const tdHipX = phases.touchdown.landmarks[23].x;
        if (tdAnkleX > tdHipX + 0.15) {
            score -= 15;
            errors.push("Overstriding (Frenado excesivo)");
            shouts.push("¡Pisa debajo!", "¡Zarpazo atrás!");
            drills.push("A-Run", "Wall Drills");
        }

        // 2. TOE-OFF PHASE (Extension)
        const toHipAngle = phases.extension.mechanics.hip.raw;
        if (toHipAngle < 165) {
            score -= 10;
            errors.push("Extensión Incompleta");
            shouts.push("¡Empuja el suelo!");
        }

        // 3. PHASE DETECTION
        let phase = "Max Velocity (Upright)";
        const velocity = parseFloat(metrics.velocity?.toString().replace(' m/s', '') || '0');

        if (torsoAngle > 25) {
            phase = "Acceleration (Drive)";
        } else if (torsoAngle > 10 && torsoAngle <= 25) {
            phase = "Transition (Drive to Lift)";
        } else if (velocity > 0 && velocity < 4) {
            phase = "Start / Low Velocity";
        }

        // --- SPECIFIC ANALYTICS BASED ON PHASE ---
        const gctVal = parseFloat(metrics.groundContactTime?.toString().replace('s', '') || '0.150');
        const gctLimit = phase.includes("Accel") ? 0.170 : 0.115;

        if (gctVal > gctLimit + 0.030) {
            score -= 15;
            errors.push(`GCT Crítico (\${gctVal}s)`);
            shouts.push("¡Quema el suelo!", "¡Reactivo!");
            drills.push(phase.includes("Accel") ? "Heavy Sleds" : "Depth Jumps");
        }

        const kneeAngle = mechanics.knee.raw;
        if (phase.includes("Max Velocity")) {
            if (kneeAngle > 110) {
                score -= 20;
                errors.push("Recobro Pendular (Talón bajo)");
                shouts.push("¡Zarpazo!", "¡Talón arriba!");
                drills.push("Butt Kicks", "A-Skip High");
            }
        }

        const hipAngle = mechanics.hip.raw;
        if (hipAngle < 160) {
            score -= 15;
            errors.push("Extensión Cadera Incompleta");
            shouts.push("¡Extiende fuerte!", "¡Cadera adelante!");
            drills.push("Broad Jumps", "Hip Flexor Stretch");
        }

        score = Math.max(40, Math.min(99, Math.round(score)));

        if (errors.length === 0) {
            errors.push("Mecánica Estable");
            shouts.push("¡Mantén fluidez!", "¡Excelente ritmo!");
            drills.push("Flying 30m");
        }

        return {
            id: Date.now().toString(),
            type: 'Filmstrip',
            category: 'Personal',
            phaseDetected: phase,
            jointAngles: {
                knee: `\${mechanics.knee.value}`,
                hip: `\${mechanics.hip.value}`,
                torso: `\${mechanics.torso.value}`,
                shin: `\${mechanics.shin.value}`
            },
            kinetics: kinetics,
            groundContactTimeEstimate: metrics.groundContactTime || "0.120s",
            criticalErrors: errors.slice(0, 3),
            correctiveDrills: [...new Set(drills)].slice(0, 3),
            coachShouts: shouts.slice(0, 2),
            score: score,
            savedAt: new Date().toISOString(),
            coachNotes: "[OFFLINE] Análisis generado por Motor Local."
        };
    }
};
