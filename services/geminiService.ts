
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { TrainingPlan, BiomechanicalAnalysis, UserProfile, NexusInsight } from "../types";

/**
 * Utility to safely parse JSON from model responses.
 */
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

const PLAN_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    weeklyGoal: { type: Type.STRING },
    phase: { type: Type.STRING },
    rationale: { type: Type.STRING },
    sessions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          day: { type: Type.STRING },
          focus: { type: Type.STRING },
          trackRoutine: { type: Type.ARRAY, items: { type: Type.STRING } },
          biomechanicsKpi: { type: Type.STRING },
          intensity: { type: Type.STRING }
        },
        required: ["day", "focus", "trackRoutine", "intensity"]
      }
    }
  },
  required: ["weeklyGoal", "phase", "sessions"]
};

/**
 * GENERACIÓN DE PLAN (FLASH)
 */
export const generateTrainingPlan = async (profile: UserProfile, readiness: any, currentDate: string, focusEvent?: string, acwr?: any): Promise<TrainingPlan | null> => {
    try {
        // Instantiate right before call for security and dynamic key updates
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Como Head Coach Nivel V, genera microciclo. Atleta: ${profile.name}. Nivel: ${profile.experienceLevel}. Evento: ${focusEvent}. Readiness: ${JSON.stringify(readiness)}. ACWR: ${acwr?.ratio}.`,
            config: { 
                responseMimeType: "application/json", 
                responseSchema: PLAN_SCHEMA,
                thinkingConfig: { thinkingBudget: 0 }
            }
        });
        return cleanAndParseJSON(response.text);
    } catch (e) {
        console.error("Plan Gen Error:", e);
        return null;
    }
};

/**
 * ANÁLISIS DE VISIÓN (PRO/FLASH)
 */
export const analyzeTechnique = async (images: string[], bioData: any, advancedMetrics: any, analysisMode: string): Promise<any> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const imageParts = images.map(img => ({
            inlineData: { mimeType: "image/jpeg", data: img }
        }));

        const isPro = analysisMode === 'External' || (images.length > 1);
        const model = isPro ? "gemini-3-pro-image-preview" : "gemini-3-flash-preview";

        const prompt = `Analiza biomecánica de sprint nivel World Athletics. Datos: ${JSON.stringify(bioData)}. Métricas: ${JSON.stringify(advancedMetrics)}. Responde JSON: phaseDetected, criticalErrors, correctiveDrills, coachShouts, score.`;

        const response = await ai.models.generateContent({
            model: model,
            contents: { parts: [...imageParts, { text: prompt }] },
            config: { 
                responseMimeType: "application/json",
                thinkingConfig: { thinkingBudget: isPro ? 2048 : 0 }
            }
        });

        return cleanAndParseJSON(response.text);
    } catch (e) {
        console.error("Vision Analysis Error:", e);
        return null;
    }
};

/**
 * NEXUS ELITE (DEEP THINKING PRO)
 */
export const generateNexusInsight = async (logs: any[], readiness: any, lastAnalysis: any, acwr: any): Promise<NexusInsight | null> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const contextLogs = logs.slice(-5);
        
        const response = await ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: `AUDITORÍA ELITE SPRINT. Historial: ${JSON.stringify(contextLogs)}. Estado: ${JSON.stringify(readiness)}. Bio: ${JSON.stringify(lastAnalysis)}. Carga: ${acwr?.ratio}. Buscamos picos de forma y riesgos de lesión.`,
            config: { 
                responseMimeType: "application/json",
                thinkingConfig: { thinkingBudget: 32768 } // Max reasoning for paid tier
            }
        });
        return cleanAndParseJSON(response.text);
    } catch (e: any) {
        console.error("Nexus Elite Error:", e);
        throw e; // Rethrow to let components handle key selection flow
    }
};

/**
 * CHAT ELITE (FLASH)
 */
export const chatWithCoach = async (history: any[], message: string, context: any) => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [
                ...history.slice(-4).map(m => ({ role: m.role, parts: [{ text: m.parts[0].text }] })),
                { role: 'user', parts: [{ text: `Atleta: ${context.profile.name}. Fase: ${context.plan?.phase}. Msg: ${message}` }] }
            ],
            config: {
                thinkingConfig: { thinkingBudget: 0 }
            }
        });
        return { 
            text: response.text || "",
            functionCall: response.functionCalls?.[0]
        };
    } catch (e) {
        console.error("Chat Error:", e);
        return { text: "Error de comunicación elite." };
    }
};
