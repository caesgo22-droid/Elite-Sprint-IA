
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
        // Sometimes gemini adds text before the JSON
        const firstBrace = cleaned.indexOf('{');
        const lastBrace = cleaned.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1) {
            cleaned = cleaned.substring(firstBrace, lastBrace + 1);
        }
        return JSON.parse(cleaned);
    } catch (e2) {
        console.error("JSON Parse Critical Fail. Raw:", text);
        return null;
    }
    return null;
  }
};

// --- HELPER: Day Sorter & Normalizer ---
const normalizeDay = (d: string) => d.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

const dayMapES: {[key: string]: string} = {
    'mon': 'Lunes', 'tue': 'Martes', 'wed': 'Miércoles', 'thu': 'Jueves', 'fri': 'Viernes', 'sat': 'Sábado', 'sun': 'Domingo',
    'lunes': 'Lunes', 'martes': 'Martes', 'miércoles': 'Miércoles', 'miercoles': 'Miércoles', 'jueves': 'Jueves', 'viernes': 'Viernes', 'sábado': 'Sábado', 'sabado': 'Sábado', 'domingo': 'Domingo'
};

const DAY_ORDER: { [key: string]: number } = {
    'lunes': 1, 'martes': 2, 'miércoles': 3, 'jueves': 4, 'viernes': 5, 'sábado': 6, 'domingo': 7
};

// --- RICH FALLBACK SESSION GENERATOR ---
// Used only when AI fails for a specific day, preventing "empty" plans
const generateRichFallbackSession = (day: string, phase: string, index: number) => {
    let focus = "Acceleration";
    let intensity = "High";
    let routine = [
        "Calentamiento: Movilidad Articular + Activación Glúteo (15')",
        "Drills: A-Skip, B-Skip, Straight Leg Bounds (3x20m)",
    ];
    let gym = [];
    let kpi = "Postura Neutra";

    // Logic based on day index/phase to mimic AI variance
    if (index % 3 === 0) { // Accel / Power
        focus = "Acceleration & Power";
        intensity = "High";
        routine.push("Main: Sled Pushes 4x20m (75% BW)");
        routine.push("Main: Block Starts 4x10m (Enfoque salida)");
        routine.push("Plyo: Broad Jumps 4x5");
        kpi = "Proyección horizontal y 'Triple Extensión'";
        gym = ["Clean Pulls 3x3", "Squats 3x5 @ 80%"];
    } else if (index % 3 === 1) { // Tempo / Capacity
        focus = "Tempo & Recovery";
        intensity = "Low";
        routine.push("Main: Extensive Tempo 10x100m @ 70% (Rec 2')");
        routine.push("Core: Plank Circuit (3 rounds)");
        kpi = "Relajación mecánica a velocidad sub-máxima";
    } else { // Max V / Speed
        focus = "Max Velocity";
        intensity = "Max";
        routine.push("Drills: Wicket Runs (Vallas de ritmo) 6 reps");
        routine.push("Main: Flying 20m (30m buildup) x 4 reps (Rec 6')");
        kpi = "Mecánica Frontal (Rodilla alta) y Contacto debajo del CoM";
        gym = ["Nordic Hamstrings 3x5", "Calf Raises 3x10"];
    }
    routine.push("Cooldown: 5' Trote suave + Estiramientos estáticos");

    return {
        day: dayMapES[normalizeDay(day)] || day,
        focus: focus,
        trackRoutine: routine,
        gymRoutine: gym,
        biomechanicsKpi: kpi,
        videoKeywords: [focus.toLowerCase()],
        intensity: intensity
    };
};

// --- SCHEMAS ---
const PLAN_SCHEMA: Schema = {
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
          gymRoutine: { type: Type.ARRAY, items: { type: Type.STRING } },
          biomechanicsKpi: { type: Type.STRING },
          videoKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
          intensity: { type: Type.STRING }
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
    coachShouts: { type: Type.ARRAY, items: { type: Type.STRING } },
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

// --- MAIN FUNCTIONS ---

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

  // 1. DETERMINE REQUESTED DAYS (Strict Source of Truth)
  const rawDays = (profile.trainingDays && Array.isArray(profile.trainingDays) && profile.trainingDays.length > 0) 
        ? profile.trainingDays 
        : ['Mon', 'Wed', 'Fri'];
  
  // Normalize requested days to Spanish names for the Prompt and Sorting
  // This creates the "Master List" of days we MUST populate.
  const targetDaysES = Array.from(new Set(rawDays.map(d => dayMapES[normalizeDay(d)] || 'Lunes')))
      .sort((a, b) => (DAY_ORDER[normalizeDay(a)] || 99) - (DAY_ORDER[normalizeDay(b)] || 99));

  if (!ai) {
      // Offline fallback: Use the generator
      const sessions = targetDaysES.map((day, idx) => generateRichFallbackSession(day, phaseName, idx));
      return {
          id: Date.now().toString(),
          createdAt: new Date().toISOString(),
          weeklyGoal: "Desarrollo Mecánico (Modo Offline)",
          phase: phaseName as any,
          rationale: "Plan generado localmente debido a falta de conexión API.",
          sessions: sessions as any,
          focusEvent: focusEvent || profile.events[0],
          acwrStatus: acwr as any,
      };
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
      
      TAREA CRÍTICA:
      Generar un microciclo de entrenamiento DETALLADO.
      
      DÍAS REQUERIDOS: ${targetDaysES.join(", ")}.
      
      REGLAS DE ORO:
      1. Genera sesiones SOLO para los días listados arriba.
      2. EL "trackRoutine" DEBE SER RICO Y DETALLADO. No pongas solo "Sprints". 
         Ejemplo Bueno: ["Calentamiento A (10')", "Drills de Vallas x 6", "4x30m Block Starts (Rec 3')", "Cooldown"].
      3. Usa terminología de élite (Wickets, Flys, Sleds, Plyos).
      
      SALIDA: JSON estricto.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json', responseSchema: PLAN_SCHEMA }
    });

    let aiSessions: any[] = [];
    let weeklyGoal = "Desarrollo de Potencia";
    let rationale = "Enfoque en calidad neuromuscular.";

    if (response.text) {
      const data = cleanAndParseJSON(response.text);
      if (data && data.sessions) {
          aiSessions = data.sessions;
          weeklyGoal = data.weeklyGoal || weeklyGoal;
          rationale = data.rationale || rationale;
      }
    }

    // --- STRICT MAPPING STRATEGY ---
    // Iterate through the REQUESTED days. Try to find a matching AI session.
    // If found, use it. If not (or duplicate), generate a rich fallback.
    // This ensures correct count, correct order, and no duplicates.
    const finalSessions = targetDaysES.map((targetDay, index) => {
        const normTarget = normalizeDay(targetDay);
        
        // Find best match in AI output
        const match = aiSessions.find(s => normalizeDay(s.day) === normTarget);
        
        if (match) {
            // Validate richness. If trackRoutine is empty/weak, replace it.
            if (!match.trackRoutine || match.trackRoutine.length < 2) {
                const fb = generateRichFallbackSession(targetDay, phaseName, index);
                return { ...match, trackRoutine: fb.trackRoutine }; // Inject rich routine into AI logic
            }
            return match;
        } else {
            // AI missed this day -> Use rich fallback
            return generateRichFallbackSession(targetDay, phaseName, index);
        }
    });

    return { 
        id: Date.now().toString(), 
        createdAt: new Date().toISOString(), 
        focusEvent: focusEvent || profile.events[0], 
        acwrStatus: acwr as any,
        phase: phaseName as any,
        weeklyGoal,
        rationale,
        sessions: finalSessions as any 
    };

  } catch (error) { 
      console.error("Plan Gen Error:", error); 
      // Error fallback
      const sessions = targetDaysES.map((day, idx) => generateRichFallbackSession(day, phaseName, idx));
      return {
          id: Date.now().toString(),
          createdAt: new Date().toISOString(),
          weeklyGoal: "Recuperación Estructural (Fallback)",
          phase: phaseName as any,
          rationale: "Error de red. Plan generado con protocolos de seguridad.",
          sessions: sessions as any
      } as TrainingPlan;
  }
};

export const analyzeTechnique = async (images: string[], bioData: any = null, advancedMetrics: any = null, analysisMode: 'Personal' | 'External' = 'Personal'): Promise<BiomechanicalAnalysis | null> => {
  if (!ai) return null;
  try {
    // Determine context richness
    const hasMetrics = advancedMetrics && advancedMetrics.velocity !== '-';
    
    const physicsContext = hasMetrics ? `
      DATOS CINÉTICOS (Physics Engine):
      - Velocidad Horizontal CoM: ${advancedMetrics.velocity}
      - Oscilación Vertical: ${advancedMetrics.verticalOscillation || 'N/A'}.
      - Force Index: ${advancedMetrics.forceFactor || 'N/A'}/100.
    ` : "Datos cinéticos no disponibles (Video estático o error de tracking).";

    const bioContext = bioData ? `
      ÁNGULOS (MediaPipe):
      - Rodilla (Recobro): ${bioData.knee.value}
      - Cadera (Extensión): ${bioData.hip.value}
      - Torso (Inclinación): ${bioData.torso.value}
      ${physicsContext}
    ` : "Estimación visual (Sin datos de sensor).";

    const promptText = `
      ACTÚA COMO: BIOMECÁNICO DEL DEPORTE (PHD).
      
      TAREA:
      Analiza las imágenes del sprint (Kinograma).
      
      DATOS SENSOR: ${bioContext}
      
      CRITERIOS (Modelo Ralph Mann):
      1. Contacto: ¿Debajo del CoM o Overstriding?
      2. Recobro: ¿Talón cerrado al glúteo?
      3. Despegue: ¿Extensión completa de cadera?
      
      IMPORTANTE:
      Si los datos del sensor indican velocidad baja o ángulos pobres, sé crítico.
      Si los datos son buenos, elogia la técnica.
      
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
    
    const injuryReport = context.profile.injuries?.length > 0 
        ? context.profile.injuries.map((i:any) => `LESIÓN ACTIVA: ${i.location} (${i.severity})`).join(", ")
        : "Salud Óptima.";

    const systemPrompt = `
      ERES: El Staff Técnico Completo (Entrenador, Biomecánico, Fisio) de Nivel Mundial.
      
      EXPEDIENTE ATLETA:
      - Nombre: ${context.profile.name}
      - Estado Salud: ${injuryReport} (SI HAY LESIÓN, PRIORIZA LA SEGURIDAD).
      - Carga Actual: ACWR ${context.acwr?.ratio || 'N/A'}.
      - Tiempos Recientes: ${recentLogs}
      
      Responde breve, técnico y motivador.
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
            Analiza correlaciones entre Fatiga (${JSON.stringify(readiness)}), Técnica (${lastAnalysis ? lastAnalysis.score : "N/A"}) y Carga ACWR (${acwr?.ratio || 0}).
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
