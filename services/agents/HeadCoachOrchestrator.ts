import { PhysiologistAgent } from "./Physiologist";
import { StrategistAgent } from "./Strategist";

export class HeadCoachOrchestrator {
    private physiologist: PhysiologistAgent;
    private strategist: StrategistAgent;

    constructor() {
        this.physiologist = new PhysiologistAgent();
        this.strategist = new StrategistAgent();
    }

    async generateDailyPlan(
        athleteData: {
            acwr: number;
            hrv: string;
            sleep: number;
            painLevel: number;
            phase: string;
            event: string;
            daysToRace: number;
        },
        day?: string
    ) {
        console.log("🏟️ Board Meeting Started (Elite 5 Workflow)...");

        // STEP 1 & 2: SAFETY FILTER (Physiologist)
        console.log("🩺 Consulting Physiologist...");
        const safetyCheck = await this.physiologist.analyzeRecovery(
            athleteData.acwr,
            athleteData.hrv,
            athleteData.sleep,
            athleteData.painLevel
        );

        if (!safetyCheck) throw new Error("Physiologist failed to report.");
        console.log(`🩺 Physiologist Report: ${safetyCheck.safetyClearance}`);

        // Handle BLOCKING (Red Flag)
        if (safetyCheck.safetyClearance === 'RED') {
            return {
                finalPlan: {
                    day: day || "Hoy",
                    focus: "Recuperación / Gestión de Dolor",
                    warmup: ["Movilidad articular suave", "Estiramientos dinámicos"],
                    mainSet: ["Descanso total o caminata suave (20 min)", "Hielo/Compresión en zona de dolor"],
                    cooldown: ["Meditación / Respiración"],
                    intensity: "Low" as const,
                    biomechanicsKpi: "Minimal Ground Contact",
                    videoKeywords: ["recovery", "regeneration"]
                },
                safetyStatus: safetyCheck,
                coachRationale: `⛔ SESIÓN BLOQUEADA POR SEGURIDAD. ${safetyCheck.reasoning}`
            };
        }

        // STEP 3: STRATEGIC DESIGN & TECHNICAL VALIDATION (Tapering Audit)
        console.log("🧠 Consulting Strategist & Running Audit...");

        let sessionDesign = await this.strategist.designSession(
            athleteData.phase,
            athleteData.daysToRace,
            athleteData.event,
            safetyCheck
        );

        if (!sessionDesign) throw new Error("Strategist failed.");

        // TAPERING AUDIT (Step 3 Continued)
        if (athleteData.daysToRace <= 14) {
            if (!sessionDesign.rationale.toLowerCase().includes("taper") && !sessionDesign.rationale.toLowerCase().includes("volume")) {
                console.warn("⚠️ Taper Audit Failed. Enforcing 20% Reduction.");
                sessionDesign.rationale += " [AUDIT: Forced Volume Reduction for Tapering Compliance]";
                sessionDesign.sessionPlan.mainSet = `(REDUCIR VOLUMEN 20%) ${sessionDesign.sessionPlan.mainSet}`;
            }
        }

        // Map Strategist strings to TrainingSession arrays
        return {
            finalPlan: {
                day: day || "Hoy",
                focus: sessionDesign.sessionPlan.intensity,
                warmup: [sessionDesign.sessionPlan.warmup],
                mainSet: [sessionDesign.sessionPlan.mainSet],
                cooldown: [sessionDesign.sessionPlan.cooldown],
                intensity: (sessionDesign.sessionPlan.intensity === 'Max' || sessionDesign.sessionPlan.intensity === 'High' || sessionDesign.sessionPlan.intensity === 'Medium' || sessionDesign.sessionPlan.intensity === 'Low')
                    ? sessionDesign.sessionPlan.intensity
                    : 'Medium' as const,
                biomechanicsKpi: "Focus on Elasticity",
                videoKeywords: ["sprint", athleteData.event]
            },
            safetyStatus: safetyCheck,
            coachRationale: sessionDesign.rationale
        };
    }
}
