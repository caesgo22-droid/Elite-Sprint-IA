import { GoogleGenerativeAI } from "@google/generative-ai";
import { TrainingPlan, NexusInsight, UserProfile } from "../types";
import { COACH_PERSONA, VIDEO_ANALYSIS_PROMPT, ANALYSIS_SYSTEM_INSTRUCTION, MASTER_AUDIT_PROMPT, MASTER_ANALYSIS_SYSTEM_INSTRUCTION, getSystemInstruction } from "../utils/prompts";
import { getEnv } from "../utils/env";

const cleanAndParseJSON = (text: string) => {
    if (!text) return null;
    try {
        let cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
        const firstBrace = cleaned.indexOf('{');
        const lastBrace = cleaned.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1) {
            cleaned = cleaned.substring(firstBrace, lastBrace + 1);
        }
        return JSON.parse(cleaned);
    } catch (e) {
        console.error("JSON Parse Fail:", e);
        console.error("Raw response (first 500 chars):", text?.substring(0, 500));
        return null;
    }
};

const getModelInstance = (modelName: string) => {
    const apiKey = getEnv("GEMINI_API_KEY") || getEnv("VITE_GEMINI_API_KEY") || getEnv("API_KEY");

    if (!apiKey) {
        console.error("❌ CRITICAL: No API Key found in env.");
        return null;
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    return genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
            temperature: 0.1,
            topP: 0.95,
            topK: 40,
        }
    });
};

export const analyzeTechnique = async (images: string[], bioData: any, advancedMetrics: any, analysisMode: string, userProfile?: any, lastAnalysis?: any, currentSession?: any): Promise<any> => {
    const isMaster = analysisMode === 'External';
    const modelName = "gemini-2.0-flash-exp"; // 1.5 unavailable, 2.0 working
    const model = getModelInstance(modelName);
    if (!model) return null;

    try {
        const imageParts = images.map(img => ({
            inlineData: { mimeType: "image/jpeg", data: img }
        }));

        let contextAddition = "";
        if (userProfile) {
            const activeInjuries = userProfile.injuries?.filter((i: any) => i.status === 'Activa').map((i: any) => i.location).join(', ') || 'Ninguna';
            const mainEvent = userProfile.events?.[0] || '100m';
            const pb = userProfile.pbs?.[mainEvent]?.time || 'N/A';
            const lastErrors = lastAnalysis?.criticalErrors?.join(', ') || 'Primer análisis';
            const sessionFocus = currentSession?.biomechanicsKpi || 'General';

            contextAddition = `\n\nCONTEXTO DEL ATLETA:\n- Evento Principal: ${mainEvent}\n- PB Actual: ${pb}\n- Lesiones Activas: ${activeInjuries}\n- Último Análisis: ${lastErrors}\n- Objetivo de Sesión: ${sessionFocus}\n`;
        }

        const prompt = isMaster
            ? MASTER_AUDIT_PROMPT({ bioData, advancedMetrics }) + contextAddition
            : VIDEO_ANALYSIS_PROMPT({ bioData, advancedMetrics }) + contextAddition;

        const predictionInstruction = `\n\nINSTRUCCIÓN DE PREDICCIÓN DE CARRERA: Basado en la Cinemática y fuerza, llena el campo 'racePredictions' en el JSON con tiempos para 100m, 200m y 400m. Es OBLIGATORIO.`;

        const finalPrompt = prompt + predictionInstruction;

        const result = await model.generateContent({
            contents: [{
                role: "user",
                parts: [
                    ...imageParts,
                    { text: finalPrompt }
                ]
            }],
            generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.1,
            },
            systemInstruction: isMaster ? MASTER_ANALYSIS_SYSTEM_INSTRUCTION : ANALYSIS_SYSTEM_INSTRUCTION,
        });

        const response = await result.response;
        const parsedResult = cleanAndParseJSON(response.text());

        if (!parsedResult) {
            console.error("Failed to parse AI response:", response.text());
        }

        return parsedResult;
    } catch (e: any) {
        console.error("AI Analysis Error:", e);
        console.error("Error details:", e.message, e.stack);
        return null;
    }
};

export const generateNexusInsight = async (logs: any[], readiness: any, analysisHistory: any[], acwr: any, profile?: UserProfile): Promise<NexusInsight | null> => {
    const model = getModelInstance("gemini-1.5-flash");
    if (!model) return null;

    const acwrRatio = acwr?.ratio || 0;
    const therapyLogs = logs.filter(l => l.type === 'Recovery' || l.event === 'Therapy').slice(-3);

    const activeInjuries = profile?.injuries?.filter((inj: any) => inj.status === 'Activa').map((inj: any) => `${inj.location} (${inj.type})`).join(', ') || 'Ninguna';
    const upcomingComps = profile?.competitions?.map((c: any) => `${c.name} (${c.date})`).join(', ') || 'Ninguna';

    const prompt = `AUDITORÍA HOLÍSTICA (Nivel 5).
            Historial Tiempos: ${JSON.stringify(logs.slice(-7))}. 
            Readiness: ${JSON.stringify(readiness)}. 
            Historial Biomecánico (últimos 3): ${JSON.stringify(analysisHistory.slice(0, 3))}. 
            REPORTE MÉDICO & COMPETITIVO:
            - Lesiones Activas: ${activeInjuries}
            - Terapia Reciente: ${JSON.stringify(therapyLogs)}
            - Próximas Competiciones: ${upcomingComps}
            
            - SI ACWR < 0.8: Marca status "Recovery" o "Neutral".
            - SI ACWR > 1.5: Marca status "Warning" OBLIGATORIAMENTE.
            - REGLA DE ORO: No recalcules la carga. Si el ACWR proporcionado es ${acwrRatio.toFixed(2)}, ese es el ÚNICO valor real.
            INSTRUCCIÓN CRÍTICA: Detecta "Fatiga Técnica Silenciosa". 
            Si la Velocidad del Centro de Masas (VCoM) ha bajado sistemáticamente o el Tiempo de Contacto (GCT) ha subido en los últimos 3 videos, marca status: "Warning" y alerta sobre riesgo de lesión.
            
            FORMATO DE RESPUESTA JSON OBLIGATORIO:
            {
              "status": "Peak" | "Fatigue" | "Warning" | "Recovery",
              "headline": "Título corto y contundente (ej: RIESGO DE SOBRECARGA)",
              "analysis": "Análisis detallado de 2-3 frases explicando el porqué en español."
            }`;

    try {
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: "application/json",
            },
            systemInstruction: COACH_PERSONA
        });
        const response = await result.response;
        return cleanAndParseJSON(response.text());
    } catch (e) {
        return null;
    }
};

// --- ELITE 5 MULTI-AGENT ORCHESTRATION ---
import { HeadCoachOrchestrator } from "./agents/HeadCoachOrchestrator";

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export const generateTrainingPlan = async (
    profile: UserProfile,
    readiness: any,
    currentDate: string,
    _focusEvent?: string,
    acwr?: any,
    _lastAnalysis?: any,
    _logs?: any[]
): Promise<TrainingPlan | null> => {
    try {
        const orchestrator = new HeadCoachOrchestrator();

        let daysToRace = 90;
        if (profile.competitions && profile.competitions.length > 0) {
            const nextComp = profile.competitions.find((c: any) => new Date(c.date) > new Date());
            if (nextComp) {
                const diff = new Date(nextComp.date).getTime() - new Date().getTime();
                daysToRace = Math.ceil(diff / (1000 * 3600 * 24));
            }
        }

        const athleteData = {
            acwr: acwr?.ratio || 1.0,
            hrv: readiness?.hrvStatus || 'average',
            sleep: readiness?.sleepHours || 8,
            painLevel: readiness?.painLevel || 0,
            phase: (profile.competitions && profile.competitions.length > 0) ? "Auto-Calculated" : "General Prep",
            event: profile.events?.[0] || '100m',
            daysToRace: daysToRace
        };

        // Use trainingDays from profile, fallback to default
        const trainingDays = profile.trainingDays || ['Mon', 'Wed', 'Fri'];

        // Generate a session for EACH training day
        const sessions = [];
        for (const day of trainingDays) {
            const result = await orchestrator.generateDailyPlan(athleteData, day);
            sessions.push({
                ...result.finalPlan,
                day: day
            });
            // Throttling to avoid 429 Errors
            await delay(1000);
        }

        return {
            id: Date.now().toString(),
            createdAt: new Date().toISOString(),
            phase: athleteData.daysToRace < 14 ? 'Competition' : 'General Prep',
            sessions: sessions,
            weeklyGoal: `Plan Elite 5: ${trainingDays.length} sesiones/semana`,
            rationale: `Generado con ${trainingDays.length} días: ${trainingDays.join(', ')}`
        };

    } catch (error) {
        console.error("Orchestrator Failed:", error);
        return null;
    }
};

export const chatWithCoach = async (history: any[], message: string, context: any, persona: string = 'Coach'): Promise<any> => {
    const model = getModelInstance("gemini-1.5-flash");
    if (!model) return { text: "Sistema Offline." };

    try {
        const result = await model.generateContent({
            contents: [
                ...history,
                { role: "user", parts: [{ text: `CONTEXTO TÉCNICO: ${JSON.stringify(context)}. PREGUNTA: ${message}` }] }
            ],
            systemInstruction: getSystemInstruction(persona),
        });
        const response = await result.response;
        return { text: response.text() };
    } catch (e) {
        return { text: "El Coach está ocupado en pista (Error de conexión)." };
    }
};