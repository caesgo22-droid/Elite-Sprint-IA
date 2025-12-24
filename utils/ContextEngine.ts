import { UserProfile, TrainingPlan, LoadStats, BiomechanicalAnalysis, PerformanceLog, NexusInsight } from "../types";
import { getProtocolForState } from "../data/recoveryStrategies";

export interface OmniContext {
    identity: {
        name: string;
        role: "athlete" | "staff";
        level: "Beginner" | "Intermediate" | "Advanced" | "Elite";
    };
    physiologicalState: {
        fatigue: number; // 1-10 (derived or input)
        injuries: string[]; // Active injuries list
        acwr: number; // Acute:Chronic Workload Ratio
        recoveryRiskFlag: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
        recommendedRecovery: string[]; // Names of protocols
    };
    trainingState: {
        currentPhase: string;
        weeklyGoal: string;
        lastSessionIntensity: string;
        daysToNextRace: number | null;
        racePriority: "A" | "B" | "C" | "None";
    };
    history: {
        pastPhases: string[];
        injuryHistory: string[];
        therapyFreq: string[];
    };
    staffNotes: string[];
    biomechanicsSummary: {
        lastAnalysisDate: string;
        criticalErrors: string[];
        recentTrend: "Improving" | "Stagnant" | "Regressing";
        keyMetrics: { gct: number; stiffness: string } | null;
    };
}

export class ContextEngine {

    public static build(
        profile: UserProfile,
        currentPlan: TrainingPlan | null,
        acwr: LoadStats | null,
        lastAnalysis: BiomechanicalAnalysis | null,
        planHistory: TrainingPlan[] = [],
        logs: PerformanceLog[] = []
    ): OmniContext {

        // --- 1. Process Injuries ---
        const activeInjuries = profile.injuries
            .filter(i => i.status === 'Activa')
            .map(i => `${i.location} (${i.severity})`);

        const pastInjuries = profile.injuries
            .filter(i => i.status !== 'Activa')
            .map(i => `${i.location} (Sanada)`);

        // --- 2. Process Biomechanics ---
        let trend: "Improving" | "Stagnant" | "Regressing" = "Stagnant";
        if (lastAnalysis && lastAnalysis.score > 80) trend = "Improving";
        if (lastAnalysis && lastAnalysis.score < 60) trend = "Regressing";

        const bioMetrics = lastAnalysis ? {
            gct: parseFloat(lastAnalysis.kinetics?.groundContactTime || "0") || 0,
            stiffness: lastAnalysis.biomechanicalAudit?.stiffness || "Unknown"
        } : null;

        // --- 3. Aggregate History ---
        const pastPhases = planHistory.slice(0, 5).map(p => p.phase);
        const therapyLogs = logs.filter(l => l.event === 'Therapy').slice(0, 5).map(l => `${l.date}: ${l.notes}`);

        // --- 4. Aggregate Staff Notes ---
        const recentStaffNotes = planHistory
            .flatMap(p => p.sessions)
            .filter(s => s.coachNotes)
            .map(s => `[${s.day}]: ${s.coachNotes}`)
            .slice(0, 5);

        // --- 5. Competition Logic ---
        // Find next competition from profile
        const now = new Date();
        const nextComp = profile.competitions
            ?.map(c => ({ ...c, diff: new Date(c.date).getTime() - now.getTime() }))
            .filter(c => c.diff > 0)
            .sort((a, b) => a.diff - b.diff)[0];

        const daysToNextRace = nextComp ? Math.ceil(nextComp.diff / (1000 * 60 * 60 * 24)) : null;
        const racePriority = nextComp ? (nextComp.priority || "B") as "A" | "B" | "C" : "None";

        // --- 6. Derived Physiological State (Risk & Recovery) ---
        const currentFatigue = 6; // TODO: Hook into a real daily survey data source
        const currentACWR = acwr?.ratio || 1.0;

        let riskFlag: "LOW" | "MODERATE" | "HIGH" | "CRITICAL" = "LOW";
        if (currentACWR > 1.3 && currentFatigue > 7) riskFlag = "CRITICAL";
        else if (currentACWR > 1.3 || currentFatigue > 8) riskFlag = "HIGH";
        else if (currentACWR > 1.1 || currentFatigue > 6) riskFlag = "MODERATE";

        // Generate tailored recovery
        const activeInjuryLocations = profile.injuries.filter(i => i.status === 'Activa').map(i => i.location);
        const recoveryProtocols = getProtocolForState(
            currentFatigue,
            currentACWR,
            activeInjuryLocations[0] // Primary injury for now
        );

        return {
            identity: {
                name: profile.name,
                role: profile.role,
                level: profile.experienceLevel
            },
            physiologicalState: {
                fatigue: currentFatigue,
                injuries: activeInjuries,
                acwr: currentACWR,
                recoveryRiskFlag: riskFlag,
                recommendedRecovery: recoveryProtocols.map(p => `${p.name}: ${p.description}`)
            },
            trainingState: {
                currentPhase: currentPlan?.phase || "Off-Season",
                weeklyGoal: currentPlan?.weeklyGoal || "Maintenance",
                lastSessionIntensity: "Unknown",
                daysToNextRace,
                racePriority
            },
            history: {
                pastPhases,
                injuryHistory: pastInjuries,
                therapyFreq: therapyLogs
            },
            staffNotes: recentStaffNotes,
            biomechanicsSummary: {
                lastAnalysisDate: lastAnalysis?.savedAt || "Never",
                criticalErrors: lastAnalysis?.criticalErrors || [],
                recentTrend: trend,
                keyMetrics: bioMetrics
            }
        };
    }

    public static generateSystemPrompt(context: OmniContext): string {
        const raceAlert = context.trainingState.daysToNextRace && context.trainingState.daysToNextRace < 7
            ? `⚠️ COMPETENCIA CLAVE (${context.trainingState.racePriority}) EN ${context.trainingState.daysToNextRace} DÍAS. PRIORIDAD: FRESCURA NEUROMUSCULAR. NO FATIGAR.`
            : "No hay competencias inmediatas.";

        const riskAlert = context.physiologicalState.recoveryRiskFlag === "CRITICAL" || context.physiologicalState.recoveryRiskFlag === "HIGH"
            ? `🛑 ALERTA DE RIESGO: ${context.physiologicalState.recoveryRiskFlag}. Fatiga o Carga Crónica peligrosas. TU OBJETIVO PRINCIPAL ES MODULAR LA CARGA Y PREVENIR LESIÓN.`
            : "";

        return `
        [OMNI-CONTEXT v2.0 ACTIVE]
        ATLETA: ${context.identity.name} (${context.identity.level}).
        
        ESTADO FISIOLÓGICO CLAVE:
        - ACWR: ${context.physiologicalState.acwr.toFixed(2)}
        - Riesgo de Lesión: ${context.physiologicalState.recoveryRiskFlag} ${riskAlert}
        - Lesiones Activas: ${context.physiologicalState.injuries.length > 0 ? context.physiologicalState.injuries.join(', ') : 'Ninguna'}.
        
        COMPETENCIA Y ENTRENAMIENTO:
        - ${raceAlert}
        - Fase Actual: ${context.trainingState.currentPhase}.
        
        BIOMECÁNICA RECIENTE:
        - Tendencia: ${context.biomechanicsSummary.recentTrend}.
        - Errores Críticos: ${context.biomechanicsSummary.criticalErrors.join(', ') || 'Ninguno'}.
        
        PROTOCOLOS DE RECUPERACIÓN SUGERIDOS (PARA TU REFERENCIA):
        ${context.physiologicalState.recommendedRecovery.map(r => "- " + r).join('\n')}

        INSTRUCCIÓN DE "SENIOR COACH" (LÓGICA CRUZADA):
        1. Eres un entrenador nivel Elite. Tu consejo depende del CONTEXTO CRUZADO.
        2. SI hay competencia cerca (${raceAlert}), sé conservador. Cuidar el SNC (Sistema Nervioso Central).
        3. SI el riesgo es ALTO (${context.physiologicalState.recoveryRiskFlag}), sugiere modificar el entreno o enfocarse en recuperación (Crioterapia, Masaje, Sueño).
        4. USA LOS DATOS EXACTOS. Si el atleta pregunta "¿Qué hago hoy?", mira si tiene lesión o si el ACWR es alto y responde con los protocolos de recuperación sugeridos arriba.
        5. Tono: Profesional, empático pero 'No-Nonsense'.
        `;
    }
}
