
import { GoogleGenAI, Type, Schema, FunctionDeclaration } from "@google/genai";
import { TrainingPlan, BiomechanicalAnalysis, UserProfile, NexusInsight } from "../types";
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

// --- UTILITY: Robust JSON Parser ---
const cleanAndParseJSON = (text: string) => {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (e) {
    try {
        let cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
        return JSON.parse(cleaned);
    } catch (e2) {
        try {
            const firstBrace = text.indexOf('{');
            const lastBrace = text.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1) {
                const subStr = text.substring(firstBrace, lastBrace + 1);
                return JSON.parse(subStr);
            }
        } catch (e3) {
            console.error("JSON Parse Critical Fail. Raw:", text);
            return null;
        }
    }
    return null;
  }
};

// --- ELITE FRAMEWORKS INJECTION (RAG Context) ---
const ELITE_BIOMECHANICS_FRAMEWORK = `
FRAMEWORK BIOMECÁNICO (RALPH MANN / ALTIS / FRANS BOSCH):
1. **POSTURA (Posture):** La pelvis debe estar neutra. Evitar "Anterior Pelvic Tilt". El tronco estable.
2. **CONTACTO (Ground Contact):** 
   - Objetivo: Minimizar la "Braking Force" (Fuerza de frenado).
   - Indicador: El pie debe contactar *debajo* o mínimamente delante del Centro de Masa (CoM).
   - Si el pie aterriza muy adelante = Overstriding (Frenado excesivo, riesgo de isquios).
3. **MECÁNICA FRONTAL (Frontside Mechanics):** 
   - Maximizar la flexión de cadera y rodilla al frente.
   - Evitar "Backside Mechanics" excesiva (talón subiendo demasiado atrás al despegar).
4. **TIJERAS (Scissoring):** La acción de las piernas debe ser un pistoneo agresivo vertical, no un ciclo circular pasivo.
`;

const ELITE_PLANNING_FRAMEWORK = `
FRAMEWORK DE PERIODIZACIÓN (BONDARCHUK / CHARLIE FRANCIS):
1. **CLASIFICACIÓN DE EJERCICIOS:**
   - CE (Competitivo Específico): El evento completo (ej. 100m, salidas de taco).
   - SDE (Desarrollo Específico): Partes del evento (ej. Flys, Sleds, Split Runs).
   - SPE (Preparación Especial): Ejercicios de fuerza que imitan el gesto (ej. Step-ups, Cleans).
   - GPE (Preparación General): Construcción de base (ej. Circuitos, Tempo).
2. **GESTIÓN DEL SNC (Sistema Nervioso Central):**
   - High Intensity (HI): >95% velocidad. Drena SNC. Requiere 48h+ recup.
   - Low Intensity (LI): <75% velocidad (Tempo). Regenera y construye capilares.
   - **REGLA DE ORO:** Nunca mezclar HI y LI en la misma sesión de forma que compitan. High/Low approach.
`;

const PLAN_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    weeklyGoal: { type: Type.STRING, description: "Objetivo técnico/fisiológico preciso (ej: 'Mejorar stiffness en contacto')." },
    phase: { type: Type.STRING, enum: ['General Prep', 'Specific Prep', 'Pre-Comp', 'Competition', 'Transition'] },
    rationale: { type: Type.STRING, description: "Justificación científica Nivel 5 (mencionar sistemas de energía o mecánica)." },
    sessions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          day: { type: Type.STRING },
          focus: { type: Type.STRING, enum: ['Acceleration', 'Max Velocity', 'Speed Endurance', 'Tempo', 'Recovery', 'Strength', 'Plyometrics', 'Technical', 'Activation'] },
          trackRoutine: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Ejercicios específicos con distancias y %." },
          gymRoutine: { type: Type.ARRAY, items: { type: Type.STRING } },
          biomechanicsKpi: { type: Type.STRING, description: "Qué buscar visualmente (ej: 'Shin angle paralelo al torso')." },
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
    phaseDetected: { type: Type.STRING, enum: ['Acceleration (Drive)', 'Max Velocity (Upright)', 'Transition', 'Deceleration'] },
    jointAngles: { type: Type.OBJECT, properties: { knee: { type: Type.STRING }, hip: { type: Type.STRING }, torso: { type: Type.STRING }, shin: { type: Type.STRING } } },
    groundContactTimeEstimate: { type: Type.STRING },
    criticalErrors: { type: Type.ARRAY, items: { type: Type.STRING } },
    correctiveDrills: { type: Type.ARRAY, items: { type: Type.STRING } },
    coachShouts: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Cues verbales cortos (ej: '¡Pisa debajo!', '¡Rodilla arriba!')." },
    score: { type: Type.NUMBER }
  },
  required: ["phaseDetected", "criticalErrors", "correctiveDrills", "coachShouts", "score"]
};

const NEXUS_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    status: { type: Type.STRING, enum: ['Peak', 'Recovery', 'Warning', 'Neutral'] },
    headline: { type: Type.STRING },
    analysis: { type: Type.STRING },
    recommendation: { type: Type.STRING }
  },
  required: ["status", "headline", "analysis", "recommendation"]
};

const modifySessionTool: FunctionDeclaration = {
  name: "modifySession",
  description: "Modifica una sesión del plan actual basándose en feedback.",
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
    
    // Auto-Phase Detection
    const currentMonth = new Date().getMonth(); 
    let phaseName = "General Prep";
    if (currentMonth >= 2 && currentMonth <= 4) phaseName = "Specific Prep"; 
    else if (currentMonth >= 5 && currentMonth <= 8) phaseName = "Competition"; 
    else if (currentMonth >= 9) phaseName = "General Prep";

    const structure = getStructureForPhase(phaseName);
    const dayMap: {[key:string]: string} = { 'Mon': 'Lunes', 'Tue': 'Martes', 'Wed': 'Miércoles', 'Thu': 'Jueves', 'Fri': 'Viernes', 'Sat': 'Sábado', 'Sun': 'Domingo' };
    const userDaysES = profile.trainingDays.map(d => dayMap[d] || d);
    
    const templatePriorities = Object.values(structure.weeklyStructure);

    const prompt = `
      ACTÚA COMO: DIRECTOR DE ALTO RENDIMIENTO (WORLD ATHLETICS LEVEL V).
      
      ${ELITE_PLANNING_FRAMEWORK}
      
      PACIENTE (ATLETA):
      - Nombre: ${profile.name}
      - Nivel: ${profile.experienceLevel}
      - Evento: ${focusEvent || "100m"}
      - Contexto: Fase ${phaseName}.
      - Estado CNS (Readiness): ${cnsScore.toFixed(1)}/10.
      - Carga (ACWR): ${acwr ? acwr.ratio : "N/A"}.
      
      PROTOCOLOS DE SEGURIDAD OBLIGATORIOS:
      1. Si ACWR > 1.3 o Readiness < 5: Implementar "Unloading Week" (Reducir volumen 40%, mantener intensidad).
      2. Si hay dolor muscular reportado > 3/10: Eliminar pliometría y MaxV. Sustituir por Tempo en Piscina o Bicicleta.
      3. Fase Competición: Volumen mínimo efectivo. Enfoque Neural.
      
      TAREA:
      Diseñar el microciclo para los días: [ ${userDaysES.join(", ")} ].
      Usa la base de datos de Drills para seleccionar ejercicios específicos (CE, SDE, SPE).
      
      SALIDA JSON REQUERIDA (Esquema definido).
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json', responseSchema: PLAN_SCHEMA }
    });

    if (response.text) {
      const data = cleanAndParseJSON(response.text);
      if (!data) throw new Error("Failed to parse JSON response");
      return { id: Date.now().toString(), createdAt: new Date().toISOString(), focusEvent: focusEvent || profile.events[0], acwrStatus: acwr, ...data } as TrainingPlan;
    }
    return null;
  } catch (error) { console.error("Plan Gen Error:", error); return null; }
};

export const analyzeTechnique = async (images: string[], bioData: any = null, advancedMetrics: any = null, analysisMode: 'Personal' | 'External' = 'Personal'): Promise<BiomechanicalAnalysis | null> => {
  if (!ai) return null;
  try {
    const isSequence = images.length > 1;
    
    const physicsContext = advancedMetrics ? `
      DATOS CINÉTICOS (Physics Engine):
      - Velocidad Horizontal CoM: ${advancedMetrics.velocity}
      - Oscilación Vertical (Bouncing): ${advancedMetrics.verticalOscillation || 'N/A'}. (Elite < 4-5cm).
      - Force Index: ${advancedMetrics.forceFactor || 'N/A'}/100.
    ` : "";

    const bioContext = bioData ? `
      ÁNGULOS (MediaPipe):
      - Rodilla (Recobro): ${bioData.knee.value}
      - Cadera (Extensión): ${bioData.hip.value}
      - Torso (Inclinación): ${bioData.torso.value}
      ${physicsContext}
    ` : "Estimación visual.";

    const contextPrefix = analysisMode === 'Personal' 
        ? "DIAGNÓSTICO CLÍNICO-DEPORTIVO (ATLETA PROPIO)." 
        : "ANÁLISIS DE MODELO TÉCNICO (DIDÁCTICO).";

    const promptText = `
      ACTÚA COMO: BIOMECÁNICO DEL DEPORTE (PHD).
      MODO: ${contextPrefix}
      
      ${ELITE_BIOMECHANICS_FRAMEWORK}
      
      DATOS DE ENTRADA: ${bioContext}
      
      TAREA:
      Analiza las imágenes proporcionadas (Kinograma). Busca discrepancias con el "Modelo Oro" (Ralph Mann).
      
      CRITERIOS DE EVALUACIÓN:
      1. ¿Aterriza el pie delante del CoM (Overstriding/Frenado)? Esto es CRÍTICO.
      2. ¿Hay "Colapso" en la rodilla de apoyo durante la amortiguación? (Falta de Stiffness).
      3. ¿La pierna libre hace un recorrido circular (Backside) o lineal (Pistón)?
      
      SALIDA:
      - Identifica 2 Errores Críticos que impacten la velocidad o riesgo de lesión.
      - Asigna Drills Correctivos específicos (ej: "Wickets" para Overstriding, "Sleds" para aceleración).
      - Genera "Coach Shouts" cortos y directos para usar en pista.
    `;

    const parts: any[] = [];
    images.forEach(img => parts.push({ inlineData: { mimeType: 'image/webp', data: img } }));
    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts },
      config: { responseMimeType: 'application/json', responseSchema: ANALYSIS_SCHEMA }
    });

    if (response.text) {
        const result = cleanAndParseJSON(response.text);
        if (result) {
            return { ...result, category: analysisMode } as BiomechanicalAnalysis;
        }
    }
    return null;
  } catch (error) { console.error("Analysis Error:", error); return null; }
};

export const chatWithCoach = async (history: any[], message: string, context: any) => {
  if (!ai) return { text: "⚠️ API Key faltante.", functionCall: null };
  try {
    const prunedHistory = history.slice(-6); 
    const recentLogs = context.logs?.slice(-3).map((l:any) => `[${l.date}] ${l.event}: ${l.time}s`).join("; ") || "Sin data.";
    
    // Clinical Dossier
    const injuryReport = context.profile.injuries?.length > 0 
        ? context.profile.injuries.map((i:any) => `LESIÓN ACTIVA: ${i.location} (${i.severity})`).join(", ")
        : "Salud Óptima.";

    const systemPrompt = `
      ERES: El Staff Técnico Completo (Entrenador, Biomecánico, Fisio) de Nivel Mundial.
      
      EXPEDIENTE ATLETA:
      - Nombre: ${context.profile.name}
      - Estado Salud: ${injuryReport} (SI HAY LESIÓN, PRIORIZA LA SEGURIDAD SOBRE EL RENDIMIENTO).
      - Carga Actual: ACWR ${context.acwr?.ratio || 'N/A'}.
      - Tiempos Recientes: ${recentLogs}
      
      DIRECTRICES DE RESPUESTA:
      1. Sé breve, técnico y basado en evidencia. No uses lenguaje de "animo", usa lenguaje de "alto rendimiento".
      2. Si el atleta propone algo estúpido (ej: entrenar MaxV con dolor de isquios), PROHÍBELO tajantemente citando riesgos mecánicos.
      3. Usa terminología correcta (SNC, Stiffness, RFD, Vector de Fuerza).
    `;

    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: { systemInstruction: systemPrompt, tools: [{ functionDeclarations: [modifySessionTool] }] },
      history: prunedHistory
    });

    const result = await chat.sendMessage({ message });
    return { text: result.text || "...", functionCall: result.functionCalls?.[0] || null };
  } catch (error) { console.error("Chat Error", error); return { text: "Error de conexión con el Staff.", functionCall: null }; }
};

export const generateNexusInsight = async (logs: any[], readiness: any, lastAnalysis: any, acwr: any): Promise<NexusInsight | null> => {
    if(!ai) return null;
    try {
        const prompt = `
            ACTÚA COMO: ALGORITMO DE DETECCIÓN DE TALENTO Y RENDIMIENTO.
            Analiza correlaciones no lineales entre:
            1. Fisiología (Fatiga: ${JSON.stringify(readiness)})
            2. Mecánica (Score Téc: ${lastAnalysis ? lastAnalysis.score : "N/A"})
            3. Carga (ACWR: ${acwr?.ratio || 0})
            
            Busca anomalías: ¿Rendimiento bajando a pesar de carga baja? (Posible problema técnico o de salud). ¿Rendimiento subiendo con fatiga alta? (Supercompensación o riesgo inminente).
            
            Salida JSON estricta.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: 'application/json', responseSchema: NEXUS_SCHEMA }
        });

        if (response.text) return cleanAndParseJSON(response.text) as NexusInsight;
        return null;

    } catch (error) { console.error("Nexus Error", error); return null; }
}
