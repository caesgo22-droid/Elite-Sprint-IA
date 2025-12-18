
import { GoogleGenAI, Type, GenerateContentResponse, FunctionDeclaration } from "@google/genai";
import { TrainingPlan, BiomechanicalAnalysis, UserProfile, NexusInsight } from "../types";

// Inicialización con API Key dinámica
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// Fix: Export hasApiKey as expected by VideoAnalyzer.tsx
export const hasApiKey = !!process.env.API_KEY;

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

// Fix: Removed Schema type annotation as it is not exported from @google/genai
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
 * GENERACIÓN DE PLAN (FLASH) - Optimizado para Estructura Técnica
 */
export const generateTrainingPlan = async (profile: UserProfile, readiness: any, currentDate: string, focusEvent?: string, acwr?: any): Promise<TrainingPlan | null> => {
    try {
        const ai = getAI();
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Eres un Head Coach de World Athletics. Diseña un microciclo de alta precisión para un atleta de nivel ${profile.experienceLevel}.
            Evento Objetivo: ${focusEvent}.
            Estado Biométrico: ${JSON.stringify(readiness)}.
            Ratio de Carga ACWR: ${acwr?.ratio || 1.0}.
            Utiliza una periodización basada en Bondarchuk. Prioriza la calidad sobre el volumen.`,
            config: { 
                responseMimeType: "application/json", 
                responseSchema: PLAN_SCHEMA,
                thinkingConfig: { thinkingBudget: 0 }
            }
        });
        return cleanAndParseJSON(response.text);
    } catch (e) {
        console.error(e);
        return null;
    }
};

/**
 * ANÁLISIS TÉCNICO MULTIMODAL (FLASH/PRO)
 * Realiza una validación cruzada entre los datos físicos calculados y la percepción visual de la IA.
 */
export const analyzeTechnique = async (images: string[], bioData: any, advancedMetrics: any, analysisMode: string): Promise<any> => {
    try {
        const ai = getAI();
        const imageParts = images.map(img => ({
            inlineData: { mimeType: "image/jpeg", data: img }
        }));

        const prompt = `Actúa como Biomecánico de Élite. Analiza esta secuencia de sprint.
        Detección Física Matemática: ${JSON.stringify(bioData)}.
        Métricas de Cinética: ${JSON.stringify(advancedMetrics)}.
        
        TAREA:
        1. Valida visualmente si los ángulos matemáticos coinciden con la imagen.
        2. Identifica "Frontside Mechanics" y eficiencia de la "Triple Extensión".
        3. Detecta errores sutiles de tensión o postura que no se ven en los números.
        
        Responde estrictamente en JSON: phaseDetected, criticalErrors, correctiveDrills, coachShouts, score.`;

        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: { parts: [...imageParts, { text: prompt }] },
            config: { 
                responseMimeType: "application/json",
                maxOutputTokens: 1000
            }
        });

        return cleanAndParseJSON(response.text);
    } catch (e) {
        console.error("Vision Analysis Error:", e);
        return null;
    }
};

/**
 * NEXUS INTELLIGENCE PRO (RAZONAMIENTO PROFUNDO)
 * Busca patrones no obvios en el historial de entrenamiento para predecir picos de forma o riesgos de sobreentrenamiento.
 */
export const generateNexusInsight = async (logs: any[], readiness: any, lastAnalysis: any, acwr: any): Promise<NexusInsight | null> => {
    try {
        const ai = getAI();
        // Poda estratégica: últimos 5 logs + resumen de carga
        const contextLogs = logs.slice(-5).map(l => `${l.date}: ${l.event} - ${l.time}s (${l.type})`);
        
        const response = await ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: `AUDITORÍA DE RENDIMIENTO ELITE.
            Historial Reciente: ${JSON.stringify(contextLogs)}
            Readiness Diario: ${JSON.stringify(readiness)}
            Biomecánica Reciente: ${JSON.stringify(lastAnalysis?.kinetics)}
            Estado de Carga ACWR: ${acwr?.ratio}.
            
            Como Estratega Deportivo, realiza una correlación profunda. ¿Hay una caída de velocidad correlacionada con un aumento de dolor o fatiga? ¿La técnica está degenerando por la carga acumulada?
            
            Genera un JSON con: status, headline, analysis (razonamiento técnico), recommendation (acción inmediata).`,
            config: { 
                responseMimeType: "application/json",
                thinkingConfig: { thinkingBudget: 32768 } // Deep reasoning for clinical sports auditing
            }
        });
        return cleanAndParseJSON(response.text);
    } catch (e) {
        console.error("Nexus Pro Error:", e);
        return null;
    }
};

/**
 * CHAT CONTEXTUAL STAFF-AWARE
 */
export const chatWithCoach = async (history: any[], message: string, context: any) => {
    try {
        const ai = getAI();
        const staff = context.profile.coaches || [];
        const staffContext = staff.map((c: any) => `${c.name} (${c.role})`).join(", ");

        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [
                ...history.slice(-4),
                { role: 'user', parts: [{ text: `Eres el coach principal de ${context.profile.name}.
                Equipo de apoyo: ${staffContext}.
                Fase actual: ${context.plan?.phase}.
                Pregunta del atleta: ${message}` }] }
            ],
            config: {
                maxOutputTokens: 600,
                thinkingConfig: { thinkingBudget: 0 }
            }
        });
        return { 
            text: response.text || "",
            functionCall: response.functionCalls?.[0]
        };
    } catch (e) {
        console.error(e);
        return { text: "Error en la conexión con el Coach." };
    }
};
