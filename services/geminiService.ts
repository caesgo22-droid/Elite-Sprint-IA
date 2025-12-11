import { GoogleGenAI, Type, Schema, FunctionDeclaration } from "@google/genai";
import { TrainingPlan, BiomechanicalAnalysis, UserProfile } from "../types";
import { getStructureForPhase, DRILL_DATABASE } from "./trainingDatabase";

const getApiKey = () => {
  if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
    return process.env.API_KEY;
  }
  if (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_GEMINI_API_KEY) {
    return (import.meta as any).env.VITE_GEMINI_API_KEY;
  }
  return "";
}

const apiKey = getApiKey();
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({ apiKey });
} else {
  console.warn("CRITICAL: VITE_GEMINI_API_KEY is missing.");
}

const PLAN_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    weeklyGoal: { type: Type.STRING, description: "Objetivo técnico/fisiológico." },
    phase: { type: Type.STRING, enum: ['General Prep', 'Specific Prep', 'Pre-Comp', 'Competition', 'Transition'] },
    rationale: { type: Type.STRING, description: "Justificación técnica Nivel 5 basada en ACWR y biomarcadores." },
    sessions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          day: { type: Type.STRING, description: "Día de la semana (ej: Lunes)" },
          focus: { type: Type.STRING, enum: ['Acceleration', 'Max Velocity', 'Speed Endurance', 'Tempo', 'Recovery', 'Strength', 'Plyometrics', 'Technical', 'Lactic Tolerance'] },
          trackRoutine: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Lista de ejercicios con pausas." },
          gymRoutine: { type: Type.ARRAY, items: { type: Type.STRING } },
          biomechanicsKpi: { type: Type.STRING },
          videoKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
          intensity: { type: Type.STRING, enum: ['Low', 'Medium', 'High', 'Max'] }
        },
        required: ["day", "focus", "trackRoutine", "biomechanicsKpi", "intensity"]
      }
    }
  },
  required: ["weeklyGoal", "phase", "sessions", "rationale"]
};

const ANALYSIS_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    phaseDetected: { type: Type.STRING },
    jointAngles: { type: Type.OBJECT, properties: { knee: { type: Type.STRING }, hip: { type: Type.STRING }, torso: { type: Type.STRING }, shin: { type: Type.STRING } } },
    groundContactTimeEstimate: { type: Type.STRING },
    criticalErrors: { type: Type.ARRAY, items: { type: Type.STRING } },
    correctiveDrills: { type: Type.ARRAY, items: { type: Type.STRING } },
    coachShouts: { type: Type.ARRAY, items: { type: Type.STRING } },
    score: { type: Type.NUMBER }
  },
  required: ["phaseDetected", "criticalErrors", "correctiveDrills", "coachShouts", "score"]
};

const modifySessionTool: FunctionDeclaration = {
  name: "modifySession",
  description: "Modifica una sesión del plan.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      day: { type: Type.STRING },
      newFocus: { type: Type.STRING },
      newRoutine: { type: Type.ARRAY, items: { type: Type.STRING } },
      newIntensity: { type: Type.STRING }
    },
    required: ["day"]
  }
};

export const generateTrainingPlan = async (
  profile: UserProfile, 
  readiness: { fatigue: number; sleep: number; soreness: number; stress: number; hydration: number }, 
  currentDate: string,
  focusEvent?: string,
  acwr?: { ratio: number; status: string }
): Promise<TrainingPlan | null> => {
  if (!ai) return null;
  try {
    const cnsScore = ((readiness.sleep) + (10 - readiness.fatigue) + (10 - readiness.soreness) + (10 - readiness.stress) + (readiness.hydration)) / 5; 
    const currentMonth = new Date().getMonth(); 
    let phaseName = "General Prep";
    if (currentMonth >= 2 && currentMonth <= 4) phaseName = "Specific Prep"; 
    else if (currentMonth >= 5 && currentMonth <= 8) phaseName = "Competition"; 
    else if (currentMonth >= 9) phaseName = "General Prep";

    const structure = getStructureForPhase(phaseName);
    
    // Day Translation Logic for Prompt
    const dayMap: {[key:string]: string} = { 'Mon': 'Lunes', 'Tue': 'Martes', 'Wed': 'Miércoles', 'Thu': 'Jueves', 'Fri': 'Viernes', 'Sat': 'Sábado', 'Sun': 'Domingo' };
    const userDays = profile.trainingDays.map(d => dayMap[d] || d).join(", ");

    const prompt = `
      ROL: ENTRENADOR NIVEL 5 WORLD ATHLETICS.
      
      TAREA CRÍTICA: Generar un microciclo de entrenamiento ADAPTADO A LOS DÍAS DISPONIBLES.
      
      DÍAS DE ENTRENAMIENTO DEL ATLETA: [ ${userDays} ]
      ⚠️ REGLA DE ORO: Genera sesiones ÚNICAMENTE para estos días. Si el atleta eligió "Lunes, Miércoles, Viernes", el JSON debe tener exactamente 3 sesiones correspondientes a esos días. NO agregues días extra. Adapta el volumen semanal para que quepa en estos días.

      CONTEXTO:
      - Atleta: ${profile.name} (${profile.experienceLevel})
      - Evento: ${focusEvent || '100m'}
      - Fase: ${phaseName}
      - CNS Readiness: ${cnsScore.toFixed(1)}/10
      - ACWR: ${acwr ? acwr.ratio : "N/A"}
      
      ESTRUCTURA BASE (REFERENCIA, ADAPTAR A LOS DÍAS SELECCIONADOS):
      ${JSON.stringify(structure.weeklyStructure)}
      
      INSTRUCCIONES DE DISEÑO:
      1. Si entrena 3 días, prioriza: Aceleración, Max Vel, Resistencia.
      2. Si entrena 5+ días, divide el volumen y agrega recuperación activa.
      3. Especifica SIEMPRE la pausa (Densidad) en los ejercicios de pista.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: PLAN_SCHEMA,
      }
    });

    if (response.text) {
      const data = JSON.parse(response.text);
      return {
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        focusEvent: focusEvent || profile.events[0],
        acwrStatus: acwr, 
        ...data
      } as TrainingPlan;
    }
    return null;
  } catch (error) {
    console.error("Plan Gen Error:", error);
    return null;
  }
};

export const analyzeTechnique = async (images: string[], bioData: any = null, advancedMetrics: any = null): Promise<BiomechanicalAnalysis | null> => {
  if (!ai) return null;
  try {
    const isSequence = images.length > 1;
    let promptText = "";
    
    const advContext = advancedMetrics ? `METRICAS: Vel ${advancedMetrics.velocity}, Zancada ${advancedMetrics.strideLen}` : "";
    const bioContext = bioData ? `DATOS MEDIDOS: Rodilla ${bioData.knee.value}, Cadera ${bioData.hip.value}, Torso ${bioData.torso.value}. ${advContext}` : "Estimación visual.";

    if (isSequence) promptText = `ANÁLISIS SECUENCIAL (Elite Coach): Evalúa la evolución de la zancada. \n${bioContext}`;
    else promptText = `ANÁLISIS DE FRAME (Elite Coach): Diagnóstico biomecánico. \n${bioContext}`;

    const parts: any[] = [];
    images.forEach(img => parts.push({ inlineData: { mimeType: 'image/webp', data: img } }));
    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts },
      config: { responseMimeType: 'application/json', responseSchema: ANALYSIS_SCHEMA }
    });

    if (response.text) return JSON.parse(response.text) as BiomechanicalAnalysis;
    return null;
  } catch (error) { console.error("Analysis Error:", error); return null; }
};

export const chatWithCoach = async (history: any[], message: string, context: any) => {
  if (!ai) return { text: "⚠️ API Key faltante.", functionCall: null };
  try {
    const prunedHistory = history.slice(-10);
    const staffContext = context.profile.coaches?.length ? `STAFF REGISTRADO: ${context.profile.coaches.map((c:any)=>`${c.name} (${c.role})`).join(', ')}` : "";
    const systemPrompt = `IDENTIDAD: Entrenador Nivel 5. CONTEXTO: Atleta ${context.profile.name}, ACWR ${context.acwr?.ratio || 'N/A'}. ${staffContext}. Si el usuario pregunta por un miembro del staff, responde asumiendo ese rol. DIRECTIVAS: Sé breve, técnico y socrático.`;

    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: { systemInstruction: systemPrompt, tools: [{ functionDeclarations: [modifySessionTool] }] },
      history: prunedHistory
    });

    const result = await chat.sendMessage({ message });
    return { text: result.text || "...", functionCall: result.functionCalls?.[0] || null };
  } catch (error) { return { text: "Error de conexión.", functionCall: null }; }
};