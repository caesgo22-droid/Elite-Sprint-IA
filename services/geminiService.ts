
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { TrainingPlan, BiomechanicalAnalysis, UserProfile, NexusInsight } from "../types";

const getAI = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey.trim() === "") throw new Error("KEY_REQUIRED");
  return new GoogleGenAI({ apiKey });
};

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

/**
 * ANALIZADOR BIOMECÁNICO (FLASH/PRO)
 */
export const analyzeTechnique = async (images: string[], bioData: any, advancedMetrics: any, analysisMode: string): Promise<any> => {
    try {
        const ai = getAI();
        const isPro = analysisMode === 'External';
        const model = isPro ? "gemini-3-pro-image-preview" : "gemini-3-flash-preview";
        
        const imageParts = images.map(img => ({
            inlineData: { mimeType: "image/jpeg", data: img }
        }));

        const prompt = `Analiza biomecánica de sprint (World Athletics). Modo: ${analysisMode}. 
        Métricas: ${JSON.stringify(advancedMetrics)}. Datos: ${JSON.stringify(bioData)}.
        Responde estrictamente en JSON: { "phaseDetected": string, "criticalErrors": string[], "correctiveDrills": string[], "coachShouts": string[], "score": number }.`;

        const response = await ai.models.generateContent({
            model: model,
            contents: { parts: [...imageParts, { text: prompt }] },
            config: { 
                responseMimeType: "application/json",
                thinkingConfig: { thinkingBudget: isPro ? 2048 : 0 }
            }
        });

        return cleanAndParseJSON(response.text);
    } catch (e: any) {
        if (e.message?.includes("not found") || e.message?.includes("API Key") || e.message === "KEY_REQUIRED") throw new Error("KEY_REQUIRED");
        return null;
    }
};

/**
 * NEXUS ELITE (DEEP THINKING MONITOR)
 */
export const generateNexusInsight = async (logs: any[], readiness: any, lastAnalysis: any, acwr: any): Promise<NexusInsight | null> => {
    try {
        const ai = getAI();
        const response = await ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: `AUDITORÍA MULTIMODAL ELITE. 
            Historial Tiempos: ${JSON.stringify(logs.slice(-5))}. 
            Readiness: ${JSON.stringify(readiness)}. 
            Bio Reciente: ${JSON.stringify(lastAnalysis)}. 
            Carga (ACWR): ${acwr?.ratio}.
            
            Como Head Coach, correlaciona estos datos y determina si el atleta está en PEAK, RECOVERY o WARNING. Responde JSON con status, headline, analysis, recommendation.`,
            config: { 
                responseMimeType: "application/json",
                thinkingConfig: { thinkingBudget: 16384 }
            }
        });
        return cleanAndParseJSON(response.text);
    } catch (e: any) {
        if (e.message?.includes("not found") || e.message?.includes("API Key") || e.message === "KEY_REQUIRED") throw new Error("KEY_REQUIRED");
        return null;
    }
};

export const generateTrainingPlan = async (profile: UserProfile, readiness: any, currentDate: string, focusEvent?: string, acwr?: any): Promise<TrainingPlan | null> => {
    try {
        const ai = getAI();
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Genera microciclo. Atleta: ${profile.name}. Readiness: ${JSON.stringify(readiness)}. ACWR: ${acwr?.ratio}.`,
            config: { responseMimeType: "application/json" }
        });
        return cleanAndParseJSON(response.text);
    } catch (e) { return null; }
};

export const chatWithCoach = async (history: any[], message: string, context: any): Promise<any> => {
    try {
        const ai = getAI();
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [...history, { role: "user", parts: [{ text: message }] }],
            config: { systemInstruction: "Eres un Coach Nivel V. Contexto: " + JSON.stringify(context) }
        });
        return { text: response.text };
    } catch (e) { return { text: "Error de conexión." }; }
};
