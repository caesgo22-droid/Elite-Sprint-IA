import { GoogleGenAI, Type } from "@google/genai";
import { TrainingPlan, BiomechanicalAnalysis, UserProfile, NexusInsight } from "../types";

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

const getModelInstance = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) return null;
    return new GoogleGenAI({ apiKey }).models;
};

export const analyzeTechnique = async (images: string[], bioData: any, advancedMetrics: any, analysisMode: string): Promise<any> => {
    const models = getModelInstance();
    if (!models) return null;

    let modelName = analysisMode === 'External' ? "gemini-3-pro-image-preview" : "gemini-3-flash-preview";
    
    try {
        const imageParts = images.map(img => ({
            inlineData: { mimeType: "image/jpeg", data: img }
        }));

        const prompt = `Analiza biomecánica de sprint (World Athletics). 
        Métricas: ${JSON.stringify(advancedMetrics)}. Datos Biomecánicos: ${JSON.stringify(bioData)}.
        Responde estrictamente en JSON: { "phaseDetected": string, "criticalErrors": string[], "correctiveDrills": string[], "coachShouts": string[], "score": number }.`;

        const response = await models.generateContent({
            model: modelName,
            contents: { parts: [...imageParts, { text: prompt }] },
            config: { 
                responseMimeType: "application/json",
                thinkingConfig: { thinkingBudget: modelName.includes("pro") ? 2048 : 0 }
            }
        });

        return cleanAndParseJSON(response.text);
    } catch (e: any) {
        if (modelName.includes("pro") && (e.message?.includes("not found") || e.message?.includes("402") || e.message?.includes("key"))) {
            try {
                const fallbackResponse = await models.generateContent({
                    model: "gemini-3-flash-preview",
                    contents: { parts: [...images.map(img => ({ inlineData: { mimeType: "image/jpeg", data: img } })), { text: `Analiza técnica de sprint. Responde JSON: { "phaseDetected": string, "criticalErrors": string[], "correctiveDrills": string[], "coachShouts": string[], "score": number }.` }] },
                    config: { responseMimeType: "application/json" }
                });
                return cleanAndParseJSON(fallbackResponse.text);
            } catch (fallbackError) {
                return null;
            }
        }
        return null;
    }
};

export const generateNexusInsight = async (logs: any[], readiness: any, lastAnalysis: any, acwr: any): Promise<NexusInsight | null> => {
    const models = getModelInstance();
    if (!models) return null;

    const prompt = `AUDITORÍA MULTIMODAL ELITE. 
            Historial Tiempos: ${JSON.stringify(logs.slice(-5))}. 
            Readiness: ${JSON.stringify(readiness)}. 
            Bio Reciente: ${JSON.stringify(lastAnalysis)}. 
            Carga (ACWR): ${acwr?.ratio}.
            Como Head Coach, determina si el atleta está en PEAK, RECOVERY o WARNING. Responde JSON con status, headline, analysis, recommendation.`;

    try {
        const response = await models.generateContent({
            model: "gemini-3-pro-preview",
            contents: prompt,
            config: { 
                responseMimeType: "application/json",
                thinkingConfig: { thinkingBudget: 4096 }
            }
        });
        return cleanAndParseJSON(response.text);
    } catch (e: any) {
        try {
            const fallbackResponse = await models.generateContent({
                model: "gemini-3-flash-preview",
                contents: prompt,
                config: { responseMimeType: "application/json" }
            });
            return cleanAndParseJSON(fallbackResponse.text);
        } catch (err) {
            return null;
        }
    }
};

export const generateTrainingPlan = async (profile: UserProfile, readiness: any, currentDate: string, focusEvent?: string, acwr?: any): Promise<TrainingPlan | null> => {
    const models = getModelInstance();
    if (!models) return null;

    try {
        const response = await models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Genera microciclo de entrenamiento para ${profile.name} enfocado en ${focusEvent}. Readiness: ${JSON.stringify(readiness)}. ACWR: ${acwr?.ratio}.`,
            config: { responseMimeType: "application/json" }
        });
        return cleanAndParseJSON(response.text);
    } catch (e) { 
        return null; 
    }
};

export const chatWithCoach = async (history: any[], message: string, context: any): Promise<any> => {
    const models = getModelInstance();
    if (!models) return { text: "No hay conexión con el servidor de IA." };

    try {
        const response = await models.generateContent({
            model: "gemini-3-pro-preview",
            contents: [
                ...history,
                { role: "user", parts: [{ text: `CONTEXTO: ${JSON.stringify(context)}. MENSAJE: ${message}` }] }
            ],
            config: {
                systemInstruction: "Eres un Head Coach Nivel V. Tienes autoridad para modificar el plan. Responde de forma técnica y directa.",
                tools: [{ googleSearch: {} }] 
            }
        });
        return { text: response.text };
    } catch (e: any) {
        try {
            const response = await models.generateContent({
                model: "gemini-3-flash-preview",
                contents: [
                    ...history,
                    { role: "user", parts: [{ text: `CONTEXTO: ${JSON.stringify(context)}. MENSAJE: ${message}` }] }
                ],
                config: {
                    systemInstruction: "Eres un Coach Asistente Elite. El sistema Pro está en mantenimiento. Responde técnico.",
                }
            });
            return { text: response.text };
        } catch (err) {
            return { text: "Error de comunicación con el Coach." };
        }
    }
};