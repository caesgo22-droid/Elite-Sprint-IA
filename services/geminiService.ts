import { GoogleGenerativeAI } from "@google/generative-ai";
import { TrainingPlan, NexusInsight, UserProfile } from "../types";
import { COACH_PERSONA, PLAN_GENERATION_PROMPT, VIDEO_ANALYSIS_PROMPT, ANALYSIS_SYSTEM_INSTRUCTION, MASTER_AUDIT_PROMPT, MASTER_ANALYSIS_SYSTEM_INSTRUCTION } from "../utils/prompts";

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
        return null;
    }
};

const getModelInstance = (modelName: string) => {
    const apiKey = (window as any).aistudio?.apiKey || getEnv("GEMINI_API_KEY") || getEnv("VITE_GEMINI_API_KEY") || getEnv("API_KEY");
    if (!apiKey) {
        console.warn("⚠️ Google Gemini API Key missing. Video analysis and AI features will be unavailable.");
        return null;
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    return genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
            temperature: 0.1,  // More deterministic for technical analysis
            topP: 0.95,
            topK: 40,
        }
    });
};

export const analyzeTechnique = async (images: string[], bioData: any, advancedMetrics: any, analysisMode: string, userProfile?: any, lastAnalysis?: any, currentSession?: any): Promise<any> => {
    const isMaster = analysisMode === 'External';
    // ✅ UPGRADED: Gemini 2.0 Flash (faster and more accurate than Pro 1.5)
    const modelName = isMaster ? "gemini-2.0-flash-exp" : "gemini-2.0-flash-thinking-exp";
    const model = getModelInstance(modelName);
    if (!model) return null;

    try {
        const imageParts = images.map(img => ({
            inlineData: { mimeType: "image/jpeg", data: img }
        }));

        // Build enriched prompt with athlete context
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

        const result = await model.generateContent({
            contents: [{
                role: "user",
                parts: [
                    ...imageParts,
                    { text: prompt }
                ]
            }],
            generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.1,
            },
            systemInstruction: isMaster ? MASTER_ANALYSIS_SYSTEM_INSTRUCTION : ANALYSIS_SYSTEM_INSTRUCTION,
        });

        const response = await result.response;
        return cleanAndParseJSON(response.text());
    } catch (e: any) {
        console.error("AI Analysis Error:", e);
        return null;
    }
};

export const generateNexusInsight = async (logs: any[], readiness: any, analysisHistory: any[], acwr: any): Promise<NexusInsight | null> => {
    const model = getModelInstance("gemini-2.0-flash-thinking-exp");
    if (!model) return null;

    const prompt = `AUDITORÍA HOLÍSTICA (Nivel 5).
            Historial Tiempos: ${JSON.stringify(logs.slice(-5))}. 
            Readiness: ${JSON.stringify(readiness)}. 
            Historial Biomecánico (últimos 3): ${JSON.stringify(analysisHistory.slice(0, 3))}. 
            Carga (ACWR): ${acwr?.ratio}.
            
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

export const generateTrainingPlan = async (profile: UserProfile, readiness: any, currentDate: string, focusEvent?: string, acwr?: any): Promise<TrainingPlan | null> => {
    const model = getModelInstance("gemini-2.0-flash-exp");
    if (!model) return null;

    try {
        const prompt = PLAN_GENERATION_PROMPT(profile, readiness, focusEvent || "100m", acwr?.ratio);

        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: "application/json",
            },
            systemInstruction: COACH_PERSONA
        });

        const response = await result.response;
        const plan = cleanAndParseJSON(response.text());
        if (plan && plan.sessions && plan.sessions.length > 0) {
            return {
                ...plan,
                id: Date.now().toString(),
                createdAt: new Date().toISOString()
            };
        }
        return null;
    } catch (e) {
        console.error("Plan Gen Error:", e);
        return null;
    }
};

export const chatWithCoach = async (history: any[], message: string, context: any): Promise<any> => {
    const model = getModelInstance("gemini-2.0-flash-exp");
    if (!model) return { text: "Sistema Offline." };

    try {
        const result = await model.generateContent({
            contents: [
                ...history,
                { role: "user", parts: [{ text: `CONTEXTO TÉCNICO: ${JSON.stringify(context)}. PREGUNTA: ${message}` }] }
            ],
            systemInstruction: COACH_PERSONA,
        });
        const response = await result.response;
        return { text: response.text() };
    } catch (e) {
        return { text: "El Coach está ocupado en pista (Error de conexión)." };
    }
};