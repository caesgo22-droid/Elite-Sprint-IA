
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

// --- HELPER: Day Sorter ---
const DAY_ORDER: { [key: string]: number } = {
    'lunes': 1, 'martes': 2, 'miércoles': 3, 'miercoles': 3, 'jueves': 4, 'viernes': 5, 'sábado': 6, 'sabado': 6, 'domingo': 7,
    'mon': 1, 'tue': 2, 'wed': 3, 'thu': 4, 'fri': 5, 'sat': 6, 'sun': 7
};

const normalizeDay = (d: string) => d.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

const sortSessions = (sessions: any[]) => {
    return sessions.sort((a, b) => {
        const da = DAY_ORDER[normalizeDay(a.day)] || 99;
        const db = DAY_ORDER[normalizeDay(b.day)] || 99;
        return da - db;
    });
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
          trackRoutine: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Lista detallada: Calentamiento, Drills, Main Set, Cooldown." },
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

// --- DYNAMIC & RICH FALLBACK PLAN GENERATOR (Looks like AI) ---
const generateFallbackPlan = (profile: UserProfile, phaseName: string, daysES: string[]): TrainingPlan => {
    // 1. Clean and sort days to prevent duplicates
    const uniqueDays = Array.from(new Set(daysES)).sort((a, b) => (DAY_ORDER[normalizeDay(a)] || 99) - (DAY_ORDER[normalizeDay(b)] || 99));

    // 2. Generate RICH content from local database
    const sessions = uniqueDays.map((day, index) => {
        let focus = "Acceleration";
        let intensity = "High";
        let routine = [
            "Calentamiento General + Movilidad (15')",
            "Activación de Glúteo (Minibands)",
            "Wall Drills (Pistón) 3x10s"
        ];
        
        // Smart distribution based on index and phase
        if (index % 3 === 0) { // Accel
            focus = "Acceleration";
            intensity = "High";
            routine.push("Sled Pushes 4x20m (Carga Media)");
            routine.push("Block Starts 3x10m (Enfoque en salida)");
            routine.push("Plyo: Broad Jumps 3x5");
            routine.push("Cooldown: 5' Trote + Estiramientos");
        } else if (index % 3 === 1) { // Tempo
            focus = "Tempo";
            intensity = "Low";
            routine = [
                "Calentamiento General (10')",
                "Extensive Tempo: 100m @ 70% x 8 (Rec 2')",
                "Core Circuit (Planks/Side Planks)",
                "Estiramiento Estático"
            ];
        } else { // Max V
            focus = "Max Velocity";
            intensity = "Max";
            routine.push("Wicket Runs (Vallas de Ritmo) 6x");
            routine.push("Flying 10m (30m Build-up) x 4");
            routine.push("Cooldown: Trote Suave 5'");
        }

        return {
            day: day,
            focus: focus,
            trackRoutine: routine,
            gymRoutine: index === 0 ? ["Squats 3x5", "RDL 3x8"] : [],
            biomechanicsKpi: "Postura Neutra y Ataque Vertical",
            videoKeywords: [focus.toLowerCase()],
            intensity: intensity
        };
    });

    return {
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        weeklyGoal: "Desarrollo de Potencia y Eficiencia Mecánica (Protocolo Estándar)", 
        phase: phaseName as any,
        rationale: "Plan generado con base en protocolos estándar de World Athletics para garantizar la continuidad del entrenamiento.",
        sessions: sessions as any
    } as TrainingPlan; 
};

export const generateTrainingPlan = async (
  profile: UserProfile, 
  readiness: { fatigue: number; sleep: number; soreness: number; stress: number; hydration: number }, 
  currentDate: string,
  focusEvent?: string,
  acwr?: { ratio: number; status: string }
): Promise<TrainingPlan | null> => {
  const currentMonth = new Date().getMonth(); 
  let phaseName = "General Prep";
  if (currentMonth >= 2 && currentMonth <= 4) phaseName = "Specific Prep"; 
  else if (currentMonth >= 5 && currentMonth <= 8) phaseName = "Competition"; 
  else if (currentMonth >= 9) phaseName = "General Prep";

  // --- CRITICAL FIX: CLEAN AND SORT DAYS ---
  const rawDays = (profile.trainingDays && Array.isArray(profile.trainingDays) && profile.trainingDays.length > 0) 
        ? profile.trainingDays 
        : ['Mon', 'Wed', 'Fri'];
  
  const dayMap: {[key:string]: string} = { 'Mon': 'Lunes', 'Tue': 'Martes', 'Wed': 'Miércoles', 'Thu': 'Jueves', 'Fri': 'Viernes', 'Sat': 'Sábado', 'Sun': 'Domingo' };
  
  // 1. Map to Spanish
  // 2. Remove Duplicates (Set)
  // 3. Sort Chronologically (Mon->Sun)
  const userDaysES = Array.from(new Set(rawDays.map(d => dayMap[d] || d)))
      .sort((a, b) => (DAY_ORDER[normalizeDay(a)] || 99) - (DAY_ORDER[normalizeDay(b)] || 99));

  if (!ai) {
      console.warn("AI not initialized, returning dynamic fallback plan");
      return generateFallbackPlan(profile, phaseName, userDaysES);
  }

  try {
    const cnsScore = ((readiness.sleep) + (10 - readiness.fatigue) + (10 - readiness.soreness) + (10 - readiness.stress) + (readiness.hydration)) / 5; 
    
    const prompt = `
      ACTÚA COMO: DIRECTOR DE ALTO RENDIMIENTO (WORLD ATHLETICS LEVEL V).
      
      PACIENTE (ATLETA):
      - Nivel: ${profile.experienceLevel || 'Intermedio'}
      - Evento: ${focusEvent || "100m"}
      - Fase: ${phaseName}.
      - Readiness: ${cnsScore.toFixed(1)}/10.
      
      TAREA:
      Generar un microciclo de entrenamiento ESTRICTAMENTE para estos ${userDaysES.length} días: ${userDaysES.join(", ")}.
      
      **REGLAS DE ORO:**
      1. Genera UN objeto sesión POR CADA día de la lista. Ni más, ni menos.
      2. Si la lista pide "Lunes" y "Jueves", SOLO genera sesiones para "Lunes" y "Jueves".
      3. **DETALLE:** El 'trackRoutine' debe ser rico y detallado (Calentamiento, Drills, Bloque Principal, Cooldown). No dejes sesiones vacías.
      
      SALIDA: JSON válido según esquema.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json', responseSchema: PLAN_SCHEMA }
    });

    if (response.text) {
      const data = cleanAndParseJSON(response.text);
      if (!data) throw new Error("Failed to parse JSON response");
      
      // --- CRITICAL FIX: FILTER HALLUCINATED DAYS ---
      // Force sort AND filter the returned sessions
      if (data.sessions && Array.isArray(data.sessions)) {
          // 1. Remove duplicates by day name
          const seenDays = new Set();
          const uniqueSessions = data.sessions.filter((s:any) => {
              const normalized = normalizeDay(s.day);
              if (seenDays.has(normalized)) return false;
              seenDays.add(normalized);
              return true;
          });

          // 2. Strict Filter: Keep ONLY days that were requested
          data.sessions = uniqueSessions.filter((s:any) => {
              const sNorm = normalizeDay(s.day);
              // Check if this day exists in the requested userDaysES list
              return userDaysES.some(ud => normalizeDay(ud) === sNorm);
          });
          
          // 3. Sort Chronologically
          data.sessions = sortSessions(data.sessions);
      }

      return { id: Date.now().toString(), createdAt: new Date().toISOString(), focusEvent: focusEvent || profile.events[0], acwrStatus: acwr, ...data } as TrainingPlan;
    }
    
    return generateFallbackPlan(profile, phaseName, userDaysES);

  } catch (error) { 
      console.error("Plan Gen Error (Using Dynamic Fallback):", error); 
      return generateFallbackPlan(profile, phaseName, userDaysES);
  }
};

export const analyzeTechnique = async (images: string[], bioData: any = null, advancedMetrics: any = null, analysisMode: 'Personal' | 'External' = 'Personal'): Promise<BiomechanicalAnalysis | null> => {
  if (!ai) return null;
  try {
    const isSequence = images.length > 1;
    
    const physicsContext = advancedMetrics ? `
      DATOS CINÉTICOS (Physics Engine):
      - Velocidad Horizontal CoM: ${advancedMetrics.velocity}
      - Oscilación Vertical: ${advancedMetrics.verticalOscillation || 'N/A'}.
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
      
      TAREA:
      Analiza las imágenes del sprint (Kinograma).
      
      DATOS SENSOR: ${bioContext}
      
      CRITERIOS (Modelo Ralph Mann):
      1. Contacto: ¿Debajo del CoM o Overstriding?
      2. Recobro: ¿Talón cerrado al glúteo?
      3. Despegue: ¿Extensión completa de cadera?
      
      SALIDA: JSON estricto.
    `;

    const parts: any[] = [];
    // Ensure images are properly formatted
    images.forEach(img => parts.push({ inlineData: { mimeType: 'image/jpeg', data: img } }));
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
