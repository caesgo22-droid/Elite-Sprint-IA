import { UserProfile, TrainingPlan, LoadStats, BiomechanicalAnalysis, PerformanceLog, NexusInsight } from "../types";

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
    };
    trainingState: {
        currentPhase: string;
        weeklyGoal: string;
        lastSessionIntensity: string;
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

        // 1. Process Injuries
        const activeInjuries = profile.injuries
            .filter(i => i.status === 'Activa')
            .map(i => `${i.location} (${i.severity})`);

        const pastInjuries = profile.injuries
            .filter(i => i.status !== 'Activa')
            .map(i => `${i.location} (Sanada)`);

        // 2. Process Biomechanics
        let trend: "Improving" | "Stagnant" | "Regressing" = "Stagnant";
        if (lastAnalysis && lastAnalysis.score > 80) trend = "Improving";
        if (lastAnalysis && lastAnalysis.score < 60) trend = "Regressing";

        // 3. Aggregate History
        const pastPhases = planHistory.slice(0, 5).map(p => p.phase);
        const therapyLogs = logs.filter(l => l.event === 'Therapy').slice(0, 5).map(l => `${l.date}: ${l.notes}`);

        // 4. Aggregate Staff Notes
        const recentStaffNotes = planHistory
            .flatMap(p => p.sessions)
            .filter(s => s.coachNotes)
            .map(s => `[${s.day}]: ${s.coachNotes}`)
            .slice(0, 5);

        return {
            identity: {
                name: profile.name,
                role: profile.role,
                level: profile.experienceLevel
            },
            physiologicalState: {
                fatigue: 5,
                injuries: activeInjuries,
                acwr: acwr?.ratio || 1.0,
            },
            trainingState: {
                currentPhase: currentPlan?.phase || "Off-Season",
                weeklyGoal: currentPlan?.weeklyGoal || "Maintenance",
                lastSessionIntensity: "Unknown"
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
                recentTrend: trend
            }
        };
    }

    public static generateSystemPrompt(context: OmniContext): string {
        return `
        [OMNI-CONTEXT AWARENESS ACTIVE]
        ATLETA: ${context.identity.name} (${context.identity.level}).
        
        HISTORIAL DE LESIONES:
        - Activas: ${context.physiologicalState.injuries.length > 0 ? context.physiologicalState.injuries.join(', ') : 'Ninguna'}.
        - Pasadas: ${context.history.injuryHistory.join(', ') || 'Sin registro'}.
        
        CONTEXTO DE ENTRENAMIENTO:
        - Fase Actual: ${context.trainingState.currentPhase} (${context.trainingState.weeklyGoal}).
        - Historial de Fases: ${context.history.pastPhases.join(' -> ')}.
        - Última Sesión: ${context.staffNotes.length > 0 ? "Notas del Staff: " + context.staffNotes[0] : 'Sin notas recientes'}.
        
        ESTADO TÉCNICO (BIOMECÁNICA):
        - Falla Crítica Recurrente: ${context.biomechanicsSummary.criticalErrors[0] || 'Ninguna'}.
        - Tendencia: ${context.biomechanicsSummary.recentTrend}.

        ESTADO FÍSICO (ACWR): ${context.physiologicalState.acwr.toFixed(2)} (${context.physiologicalState.acwr > 1.3 ? 'ALTO RIESGO' : 'CONTROLADO'}).

        INSTRUCCIÓN DE "SENIOR COACH":
        1. Eres un entrenador de atletismo de clase mundial (Senior Coach). Tienes autoridad pero eres empático.
        2. Tienes "memoria perfecta": USA LA INFORMACIÓN DE ARRIBA. Si el atleta tuvo una lesión pasada, pregúntale cómo se siente hoy.
        3. Si la tendencia técnica es "Regressing", sé estricto con los drills.
        4. Sé conciso. No des discursos, da órdenes claras o feedback directo. 
        5. Habla con naturalidad, usando jerga técnica elite (stiffness, GCT, vector de fuerza).
        `;
    }
}
