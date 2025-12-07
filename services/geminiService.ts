import { GoogleGenAI, Type, Schema, FunctionDeclaration } from "@google/genai";
import { TrainingPlan, BiomechanicalAnalysis, UserProfile } from "../types";
import { getStructureForPhase, DRILL_DATABASE } from "./trainingDatabase";

// Helper to safely get API Key
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
  console.warn("CRITICAL: VITE_GEMINI_API_KEY is missing. AI features will not work.");
}

const PLAN_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    weeklyGoal: { type: Type.STRING, description: "Objetivo fisiológico o técnico específico en Español. NO usar lenguaje motivacional." },
    phase: { type: Type.STRING, enum: ['General Prep', 'Specific Prep', 'Pre-Comp', 'Competition', 'Transition'] },
    rationale: { type: Type.STRING, description: "JUSTIFICACIÓN TÉCNICA DETALLADA (Nivel 5): Explicar decisiones basadas en ACWR (Carga), CNS (Fatiga) y Lesiones. Citar explícitamente al experto (Fisioterapeuta, Biomecánico) que toma la decisión. Ej: 'Debido a ACWR 1.6, el Fisioterapeuta ordena descarga de volumen del 30%'." },
    sessions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          day: { type: Type.STRING, description: "Nombre del día (Lunes, Martes...)" },
          focus: { type: Type.STRING, enum: ['Acceleration', 'Max Velocity', 'Speed Endurance', 'Tempo', 'Recovery', 'Strength', 'Plyometrics', 'Technical', 'Lactic Tolerance'] },
          trackRoutine: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Rutina detallada. OBLIGATORIO: Incluir Densidad/Recuperación exacta (ej: 'Rec: 3min')." },
          gymRoutine: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Ejercicios de fuerza o pliometría (opcional) en Español" },
          biomechanicsKpi: { type: Type.STRING, description: "Foco técnico (ej: 'Tiempo de contacto < 0.09s')." },
          videoKeywords: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3 términos de búsqueda para YouTube" },
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
    phaseDetected: { type: Type.STRING, description: "Fase detectada." },
    jointAngles: {
      type: Type.OBJECT,
      properties: {
        knee: { type: Type.STRING },
        hip: { type: Type.STRING },
        torso: { type: Type.STRING },
        shin: { type: Type.STRING }
      }
    },
    groundContactTimeEstimate: { type: Type.STRING, description: "Estimación experta GCT." },
    criticalErrors: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Errores biomecánicos (Causa Raíz)." },
    correctiveDrills: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Drills correctivos." },
    coachShouts: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Correcciones verbales inmediatas (Cues)." },
    score: { type: Type.NUMBER }
  },
  required: ["phaseDetected", "criticalErrors", "correctiveDrills", "coachShouts", "score"]
};

const modifySessionTool: FunctionDeclaration = {
  name: "modifySession",
  description: "Modifica una sesión del plan actual.",
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
    
    let eventSpecificInstruction = "";
    if (focusEvent === '400m') {
        eventSpecificInstruction = "ATLETA DE 400m: En fases Específicas/Pre-Comp, es CRÍTICO incluir Tolerancia al Lactato (Special Endurance II). Volúmenes más altos, pausas incompletas en sesiones lácticas.";
    } else {
        eventSpecificInstruction = "ATLETA DE 100/200m: Prioridad absoluta a la Calidad Neural, Potencia Aláctica y CNS. Pausas completas (1min x cada 10m recorridos) en sesiones de velocidad.";
    }

    const prompt = `
      ROL: ENTRENADOR NIVEL 5 WORLD ATHLETICS (Elite Sprint Coach).
      
      ESTÁNDARES DE CALIDAD (NO NEGOCIABLES):
      1. **DENSIDAD (RECUPERACIÓN):** Nunca prescribas una serie sin especificar la pausa (Rec). Ej: "3x60m (Rec: 6min)". La pausa define el sistema energético (ATP-PCr vs Glucólisis).
      2. **VOLUMEN vs INTENSIDAD:** Gestiona la carga. Si ACWR > 1.3, reduce volumen un 20% pero mantén intensidad (Tapering/Deload).
      3. **ESPECIFICIDAD:** ${eventSpecificInstruction}
      4. **JUSTIFICACIÓN (RATIONALE):** Habla como un científico del deporte. Explica la fisiología detrás del plan.

      CONTEXTO DEL ATLETA:
      - Nombre: ${profile.name} (${profile.experienceLevel}, ${profile.yearsExperience} años)
      - Evento Foco: ${focusEvent}
      - PBs: 100m(${profile.pbs['100m'].time}), 200m(${profile.pbs['200m'].time}), 400m(${profile.pbs['400m'].time})
      - Lesiones: ${JSON.stringify(profile.injuries)}
      
      ESTADO ACTUAL (MICRO):
      - CNS Readiness: ${cnsScore.toFixed(1)}/10
      - ACWR Load: ${acwr ? `${acwr.ratio} (${acwr.status})` : "N/A"}
      - Fase Macrociclo: ${phaseName}
      
      ESTRUCTURA SUGERIDA (BASE):
      ${JSON.stringify(structure.weeklyStructure)}
      
      Genera el Microciclo en JSON. La prioridad es la salud del atleta y la adaptación fisiológica correcta.
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

export const analyzeTechnique = async (images: string[], bioData: any = null): Promise<BiomechanicalAnalysis | null> => {
  if (!ai) return null;
  try {
    const isSequence = images.length > 1;
    let promptText = "";
    
    const bioContext = bioData ? `
    DATOS MEDIDOS (MediaPipe):
    - Rodilla: ${bioData.knee.value} (${bioData.knee.status})
    - Cadera: ${bioData.hip.value} (${bioData.hip.status})
    - Torso: ${bioData.torso.value} (${bioData.torso.status})
    ` : "Estimación visual requerida.";

    if (isSequence) {
        promptText = `ANÁLISIS SECUENCIAL (Elite Coach): Evalúa la evolución de la zancada (Touchdown -> Stance -> Toe-off). Busca colapso de cadera o aumento de GCT. \n${bioContext}`;
    } else {
        promptText = `ANÁLISIS DE FRAME (Elite Coach): Diagnóstico biomecánico preciso. \n${bioContext}`;
    }

    const parts: any[] = [];
    images.forEach(img => {
        parts.push({ inlineData: { mimeType: 'image/webp', data: img } });
    });
    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts },
      config: {
        responseMimeType: 'application/json',
        responseSchema: ANALYSIS_SCHEMA,
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as BiomechanicalAnalysis;
    }
    return null;
  } catch (error) {
    console.error("Analysis Error:", error);
    return null;
  }
};

export const chatWithCoach = async (history: any[], message: string, context: any) => {
  if (!ai) return { text: "⚠️ API Key faltante.", functionCall: null };
  try {
    const prunedHistory = history.slice(-10);
    
    const systemPrompt = `
    IDENTIDAD: Entrenador Nivel 5 World Athletics.
    OBJETIVO: Maximizar rendimiento mediante ciencia aplicada.
    
    CONTEXTO OMNISCIENTE:
    - Atleta: ${context.profile.name} (${context.profile.events?.join('/')})
    - ACWR: ${context.acwr?.ratio || 'N/A'} (Gestión de Carga)
    - Plan: ${context.plan?.phase} - ${context.plan?.weeklyGoal}
    
    DIRECTRICES:
    1. Si ACWR > 1.5, sugiere descanso activo o reducción de volumen.
    2. Usa terminología de élite (GCT, Stiffness, Rate of Force Development).
    3. Sé conciso y directo.
    `;

    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: systemPrompt,
        tools: [{ functionDeclarations: [modifySessionTool] }]
      },
      history: prunedHistory
    });

    const result = await chat.sendMessage({ message });
    return { text: result.text || "...", functionCall: result.functionCalls?.[0] || null };

  } catch (error) {
    return { text: "Error de conexión.", functionCall: null };
  }
};