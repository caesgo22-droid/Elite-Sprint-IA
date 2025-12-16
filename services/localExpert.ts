
import { BiomechanicalAnalysis, KineticMetrics } from "../types";
import { AdvancedMetrics } from "../utils/biomechanicsUtils";

// --- LOCAL EXPERT SYSTEM (RULE-BASED AI) ---
// Este sistema actúa como respaldo cuando Gemini no está disponible.
// Utiliza lógica determinista basada en los principios de Ralph Mann y Frans Bosch.

export const LocalExpert = {
    analyze: (
        mechanics: { knee: any, hip: any, torso: any, shin: any },
        metrics: AdvancedMetrics,
        kinetics: KineticMetrics
    ): BiomechanicalAnalysis => {
        
        const errors: string[] = [];
        const shouts: string[] = [];
        const drills: string[] = [];
        let score = 100;
        
        // --- PHASE DETECTION LOGIC ---
        // Determines phase based on Torso Angle and Velocity
        let phase = "Max Velocity (Upright)";
        const torsoAngle = mechanics.torso.raw; // 0 is upright, >0 is forward lean
        const velocity = parseFloat(metrics.velocity.replace(' m/s', '')) || 0;

        if (torsoAngle > 25) {
            phase = "Acceleration (Drive)";
        } else if (torsoAngle > 10 && torsoAngle <= 25) {
            phase = "Transition (Drive to Lift)";
        } else if (velocity > 0 && velocity < 4) {
            phase = "Start / Low Velocity"; // Safety catch
        }

        // --- SPECIFIC ANALYTICS BASED ON PHASE ---

        // 1. ANÁLISIS DE TIEMPO DE CONTACTO (GCT)
        // Elite Benchmark: < 0.108s (Max V), < 0.170s (Accel)
        const gctVal = parseFloat(metrics.groundContactTime?.replace('s', '') || '0.150');
        const gctLimit = phase.includes("Accel") ? 0.170 : 0.115;
        
        if (gctVal > gctLimit + 0.030) {
            score -= 15;
            errors.push(`GCT Crítico (${gctVal}s)`);
            shouts.push("¡Quema el suelo!", "¡Reactivo!");
            drills.push(phase.includes("Accel") ? "Heavy Sleds" : "Depth Jumps");
        } else if (gctVal > gctLimit) {
            score -= 5;
            errors.push("Contacto Lento");
            drills.push("Wicket Runs");
        }

        // 2. ANÁLISIS DE RECOBRO (KNEE ANGLE)
        // Max V: Heel to Butt (<60). Accel: Low Heel Recovery (<120)
        const kneeAngle = mechanics.knee.raw;
        if (phase.includes("Max Velocity")) {
            if (kneeAngle > 110) {
                score -= 20;
                errors.push("Recobro Pendular (Talón bajo)");
                shouts.push("¡Zarpazo!", "¡Talón arriba!");
                drills.push("Butt Kicks", "A-Skip High");
            }
        } else {
            // In acceleration, high heel recovery is actually bad (cycle too long)
            if (kneeAngle < 70) {
                score -= 10;
                errors.push("Recobro Prematuro (Ciclo Alto en Drive)");
                shouts.push("¡Pistones!", "¡Empuja, no subas!");
                drills.push("Wall Drills (Piston)");
            }
        }

        // 3. ANÁLISIS DE EXTENSIÓN DE CADERA
        const hipAngle = mechanics.hip.raw;
        if (hipAngle < 160) {
            score -= 15;
            errors.push("Extensión Cadera Incompleta");
            shouts.push("¡Extiende fuerte!", "¡Cadera adelante!");
            drills.push("Broad Jumps", "Hip Flexor Stretch");
        }

        // 4. OSCILACIÓN VERTICAL (Solo relevante en Max V)
        if (phase.includes("Max Velocity")) {
            const oscVal = parseFloat(metrics.verticalOscillation?.replace(' cm', '') || '5');
            if (oscVal > 7.5) {
                score -= 10;
                errors.push("Oscilación Vertical (Bouncing)");
                shouts.push("¡Corre plano!", "¡Cabeza quieta!");
            }
        }

        // Final Score Clamping based on phase difficulty
        // Acceleration mechanics are harder to score perfectly via simple video
        if (phase.includes("Accel")) score = Math.min(score + 5, 100); 

        score = Math.max(40, Math.min(99, Math.round(score)));

        // Fallback checks
        if (errors.length === 0) {
            errors.push("Mecánica Estable");
            shouts.push("¡Mantén fluidez!", "¡Excelente ritmo!");
            drills.push("Flying 30m (Consolidación)");
        }

        return {
            id: Date.now().toString(),
            type: 'Single',
            category: 'Personal',
            phaseDetected: phase,
            jointAngles: {
                knee: `${mechanics.knee.value}`,
                hip: `${mechanics.hip.value}`,
                torso: `${mechanics.torso.value}`,
                shin: `${mechanics.shin.value}`
            },
            kinetics: kinetics,
            groundContactTimeEstimate: metrics.groundContactTime || "0.120s",
            criticalErrors: errors.slice(0, 3), 
            correctiveDrills: [...new Set(drills)].slice(0, 3), 
            coachShouts: shouts.slice(0, 2),
            score: score,
            savedAt: new Date().toISOString(),
            coachNotes: "[OFFLINE] Análisis generado por Heurística Nivel V."
        };
    }
};
