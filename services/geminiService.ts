
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

export const analyzeTechnique = async (images: string[], bioData: any, advancedMetrics: any, analysisMode: string): Promise<any> => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("KEY_REQUIRED");
    
    // Create instance inside the call to get the latest injected key
    const ai = new GoogleGenAI({ apiKey });
    const isPro = analysisMode === 'External';
    const model = isPro ? "gemini-3-pro-image-preview" : "gemini-3-flash-preview";
    
    try {
        const imageParts = images.map(img => ({
            inlineData: { mimeType: "image/jpeg", data: img }
        }));

        const prompt = `Analiza biomecánica de sprint (World Athletics). Modo: ${analysisMode}. 
        Métricas: ${JSON.stringify(advancedMetrics)}. Datos Biomecánicos: ${JSON.stringify(bioData)}.
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
        if (e.message?.includes("not found") || e.message?.includes("API key")) throw new Error("KEY_REQUIRED");
        throw e;
    }
};

export const generateNexusInsight = async (logs: any[], readiness: any, lastAnalysis: any, acwr: any): Promise<NexusInsight | null> => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("KEY_REQUIRED");

    const ai = new GoogleGenAI({ apiKey });
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: `AUDITORÍA MULTIMODAL ELITE. 
            Historial Tiempos: ${JSON.stringify(logs.slice(-5))}. 
            Readiness: ${JSON.stringify(readiness)}. 
            Bio Reciente: ${JSON.stringify(lastAnalysis)}. 
            Carga (ACWR): ${acwr?.ratio}.
            Como Head Coach, determina si el atleta está en PEAK, RECOVERY o WARNING. Responde JSON con status, headline, analysis, recommendation.`,
            config: { 
                responseMimeType: "application/json",
                thinkingConfig: { thinkingBudget: 4096 }
            }
        });
        return cleanAndParseJSON(response.text);
    } catch (e: any) {
        if (e.message?.includes("not found") || e.message?.includes("API key")) throw new Error("KEY_REQUIRED");
        throw e;
    }
};

export const generateTrainingPlan = async (profile: UserProfile, readiness: any, currentDate: string, focusEvent?: string, acwr?: any): Promise<TrainingPlan | null> => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) return null;
    
    const ai = new GoogleGenAI({ apiKey });
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Genera microciclo de entrenamiento para ${profile.name}. Readiness: ${JSON.stringify(readiness)}. ACWR: ${acwr?.ratio}.`,
            config: { responseMimeType: "application/json" }
        });
        return cleanAndParseJSON(response.text);
    } catch (e) { return null; }
};

// Fixed missing chatWithCoach function for the LiveCoach (text-based chat) component.
// This function utilizes tool calling to allow the AI to modify athlete sessions.
export const chatWithCoach = async (history: any[], message: string, context: any): Promise<any> => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("KEY_REQUIRED");

    const ai = new GoogleGenAI({ apiKey });
    
    // Defining the modifySession tool for context-aware training plan updates
    const modifySessionTool = {
        name: "modifySession",
        description: "Modifies the training session for a specific day based on coach or athlete input.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                day: { type: Type.STRING, description: "Day of the week (e.g., 'Mon', 'Tue', 'Wed')" },
                newFocus: { type: Type.STRING, description: "The new main objective or title for the session" },
                newRoutine: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Array of specific drills/exercises" },
                newIntensity: { type: Type.STRING, enum: ["Low", "Medium", "High", "Max"], description: "The updated intensity level" }
            },
            required: ["day", "newFocus", "newRoutine", "newIntensity"]
        }
    };

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: [
                ...history,
                { role: "user", parts: [{ text: `CONTEXTO COMPLETO DEL ATLETA: ${JSON.stringify(context)}. MENSAJE ACTUAL: ${message}` }] }
            ],
            config: {
                systemInstruction: "Eres un Head Coach de Atletismo de Nivel V. Tu misión es asesorar al atleta basándote en su historial de marcas, biomecánica y carga (ACWR). Tienes autoridad para modificar su plan si detectas sobreentrenamiento o riesgo de lesión. Responde de forma técnica, empoderadora y directa.",
                tools: [{ functionDeclarations: [modifySessionTool] }]
            }
        });

        // Returning the response in the format expected by LiveCoach.tsx
        return {
            text: response.text,
            functionCall: response.functionCalls?.[0]
        };
    } catch (e: any) {
        if (e.message?.includes("not found") || e.message?.includes("API key")) throw new Error("KEY_REQUIRED");
        throw e;
    }
};
