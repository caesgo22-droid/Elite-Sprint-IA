
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

// --- FALLBACK PLAN GENERATOR (Emergency Protocol) ---
const generateFallbackPlan = (profile: UserProfile, phaseName: string): TrainingPlan => {
    return {
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        weeklyGoal: "Recuperación Estructural y Mecánica (Modo Fallback)",
        phase: "General Prep",
        rationale: "Se ha generado un plan base de mantenimiento debido a un error de conexión con el motor de IA. Este plan asegura que puedas entrenar hoy de forma segura.",
        sessions: [
            {
                day: "Lunes",
                focus: "Acceleration",
                trackRoutine: ["Wall Drills 3x30s", "A-Skip 3x20m", "Sled Push 4x20m", "Falling Starts 6x20m"],
                gymRoutine: ["Squats 3x5", "RDL 3x8"],
                biomechanicsKpi: "Empuje horizontal completo",
                videoKeywords: ["accel"],
                intensity: "High"
            },
            {
                day: "Miércoles",
                focus: "Max Velocity",
                trackRoutine: ["Wicket Runs 6x", "Fly 10m (30m buildup) x 4"],
                gymRoutine: ["Nordic Curl 3x5", "Core"],
                biomechanicsKpi: "Contacto debajo de cadera",
                videoKeywords: ["maxv"],
                intensity: "Max"
            },
            {
                day: "Viernes",
                focus: "Tempo",
                trackRoutine: ["100m @ 70% x 10 (Walk back recovery)", "Mobility Routine"],
                gymRoutine: [],
                biomechanicsKpi: "Relajación de hombros",
                videoKeywords: ["tempo"],
                intensity: "Low"
            }
        ]
    } as any; // Cast to bypass strict checks if needed
};

export const generateTrainingPlan = async (
  profile: UserProfile, 
  readiness: { fatigue: number; sleep: number; soreness: number; stress: number; hydration: number }, 
  currentDate: string,
  focusEvent?: string,
  acwr?: { ratio: number; status: string }
): Promise<TrainingPlan | null> => {
  // Always define phase name first to use in fallback if needed
  const currentMonth = new Date().getMonth(); 
  let phaseName = "General Prep";
  if (currentMonth >= 2 && currentMonth <= 4) phaseName = "Specific Prep"; 
  else if (currentMonth >= 5 && currentMonth <= 8) phaseName = "Competition"; 
  else if (currentMonth >= 9) phaseName = "General Prep";

  if (!ai) {
      console.warn("AI not initialized, returning fallback plan");
      return generateFallbackPlan(profile, phaseName);
  }

  try {
    const cnsScore = ((readiness.sleep) + (10 - readiness.fatigue) + (10 - readiness.soreness) + (10 - readiness.stress) + (readiness.hydration)) / 5; 
    
    // SAFETY FIX: Ensure trainingDays exists, default to M/W/F if empty or invalid
    const trainingDays = (profile.trainingDays && Array.isArray(profile.trainingDays) && profile.trainingDays.length > 0) 
        ? profile.trainingDays 
        : ['Mon', 'Wed', 'Fri'];
        
    const dayMap: {[key:string]: string} = { 'Mon': 'Lunes', 'Tue': 'Martes', 'Wed': 'Miércoles', 'Thu': 'Jueves', 'Fri': 'Viernes', 'Sat': 'Sábado', 'Sun': 'Domingo' };
    const userDaysES = trainingDays.map(d => dayMap[d] || d);
    
    const prompt = `
      ACTÚA COMO: DIRECTOR DE ALTO RENDIMIENTO (WORLD ATHLETICS LEVEL V).
      
      PACIENTE (ATLETA):
      - Nombre: ${profile.name || 'Atleta'}
      - Nivel: ${profile.experienceLevel || 'Intermedio'}
      - Evento: ${focusEvent || "100m"}
      - Contexto: Fase ${phaseName}.
      - Estado SNC (Readiness): ${cnsScore.toFixed(1)}/10.
      - Carga (ACWR): ${acwr ? acwr.ratio : "N/A"}.
      
      TAREA:
      Diseñar el microciclo SOLAMENTE para los días: [ ${userDaysES.join(", ")} ].
      Usa la base de datos de Drills para seleccionar ejercicios específicos (CE, SDE, SPE).
      
      IMPORTANTE:
      - Devuelve un objeto JSON válido que cumpla estrictamente con el esquema.
      - Asegúrate de incluir todos los campos requeridos (weeklyGoal, rationale, sessions).
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json', responseSchema: PLAN_SCHEMA }
    });

    if (response.text) {
      const data = cleanAndParseJSON(response.text);
      if (!data) throw new Error("Failed to parse JSON response");
      // Add IDs to sessions if missing, or handle in frontend
      return { id: Date.now().toString(), createdAt: new Date().toISOString(), focusEvent: focusEvent || profile.events[0], acwrStatus: acwr, ...data } as TrainingPlan;
    }
    
    // If no text response but no error thrown
    return generateFallbackPlan(profile, phaseName);

  } catch (error) { 
      console.error("Plan Gen Error (Using Fallback):", error); 
      // CRITICAL: Return fallback instead of null to prevent UI freeze
      return generateFallbackPlan(profile, phaseName);
  }
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
      
      SALIDA JSON REQUERIDA.
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
