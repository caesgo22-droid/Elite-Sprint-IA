import { GoogleGenerativeAI } from "@google/generative-ai";
import { TrainingPlan, NexusInsight, UserProfile } from "../types";
import { COACH_PERSONA, PLAN_GENERATION_PROMPT, VIDEO_ANALYSIS_PROMPT, ANALYSIS_SYSTEM_INSTRUCTION, MASTER_AUDIT_PROMPT, MASTER_ANALYSIS_SYSTEM_INSTRUCTION } from "../utils/prompts";

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
    const apiKey = (window as any).aistudio?.apiKey || process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) return null;
    const genAI = new GoogleGenerativeAI(apiKey);
    return genAI.getGenerativeModel({ model: modelName });
};

export const analyzeTechnique = async (images: string[], bioData: any, advancedMetrics: any, analysisMode: string): Promise<any> => {
    const isMaster = analysisMode === 'External';
    const modelName = isMaster ? "gemini-pro-latest" : "gemini-flash-latest";
    const model = getModelInstance(modelName);
    if (!model) return null;

    try {
        const imageParts = images.map(img => ({
            inlineData: { mimeType: "image/jpeg", data: img }
        }));

        const prompt = isMaster
            ? MASTER_AUDIT_PROMPT({ bioData, advancedMetrics })
            : VIDEO_ANALYSIS_PROMPT({ bioData, advancedMetrics });

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
    const model = getModelInstance("gemini-flash-latest");
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
    const model = getModelInstance("gemini-flash-latest");
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
    const model = getModelInstance("gemini-pro-latest");
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