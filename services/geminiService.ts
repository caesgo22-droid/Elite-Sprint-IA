
import { GoogleGenAI, Type, Schema, FunctionDeclaration, HarmCategory, HarmBlockThreshold } from "@google/genai";
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
export const hasApiKey = !!apiKey; // EXPORTED FOR UI

let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({ apiKey });
} else {
  console.warn("CRITICAL: VITE_GEMINI_API_KEY is missing. App will run in offline mode.");
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
  const targetDaysES = Array.from(new Set(rawDays.map(d => dayMapES[normalizeDay(d)] || 'Lunes')))
      .sort((a, b) => (DAY_ORDER[normalizeDay(a)] || 99) - (DAY_ORDER[normalizeDay(b)] || 99));

  if (!ai) {
      // Offline fallback
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
    
    // BLINDAJE DE SEGURIDAD (ACWR Safety Lock)
    let safetyLockProtocol = "";
    if (acwr && acwr.ratio > 1.3) {
        safetyLockProtocol = `ACWR ALTO (${acwr.ratio}). NO INTENSIDAD 'MAX'.`;
    } else if (readiness.soreness > 7 || readiness.fatigue > 8) {
        safetyLockProtocol = `FATIGA SEVERA. SOLO RECUPERACIÓN.`;
    }

    const prompt = `
      ACTÚA: DIRECTOR ALTO RENDIMIENTO.
      ATLETA: Nivel ${profile.experienceLevel}, Evento ${focusEvent}, Fase ${phaseName}.
      READINESS: ${cnsScore.toFixed(1)}/10. ACWR: ${acwr ? acwr.ratio : 'N/A'}.
      ${safetyLockProtocol ? `PROTOCOLO SEGURIDAD: ${safetyLockProtocol}` : ''}
      
      TAREA: Microciclo para: ${targetDaysES.join(", ")}.
      
      REGLAS:
      1. Solo días listados.
      2. Rutinas trackRoutine detalladas (Drills + Main + Cooldown).
      3. Terminología técnica.
      
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

    // STRICT MAPPING & VALIDATION
    const finalSessions = targetDaysES.map((targetDay, index) => {
        const normTarget = normalizeDay(targetDay);
        const match = aiSessions.find(s => normalizeDay(s.day) === normTarget);
        
        if (match) {
            // Validate richness
            if (!match.trackRoutine || match.trackRoutine.length < 2) {
                const fb = generateRichFallbackSession(targetDay, phaseName, index);
                return { ...match, trackRoutine: fb.trackRoutine };
            }
            return match;
        } else {
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
      // FALLBACK GRACEFUL
      const sessions = targetDaysES.map((day, idx) => generateRichFallbackSession(day, phaseName, idx));
      return {
          id: Date.now().toString(),
          createdAt: new Date().toISOString(),
          weeklyGoal: "Recuperación Estructural (Protocolo Seguro)",
          phase: phaseName as any,
          rationale: "Microciclo de ajuste generado mediante algoritmos de seguridad debido a latencia en la red neuronal. Se prioriza la carga técnica.",
          sessions: sessions as any
      } as TrainingPlan;
  }
};

export const analyzeTechnique = async (images: string[], bioData: any = null, advancedMetrics: any = null, analysisMode: 'Personal' | 'External' = 'Personal'): Promise<BiomechanicalAnalysis | null> => {
  if (!ai) {
    console.error("Gemini AI instance not initialized. Missing API Key.");
    throw new Error("API_KEY_MISSING");
  }
  
  try {
    const hasMetrics = advancedMetrics && advancedMetrics.velocity !== '-';
    
    // COMPRESSED CONTEXT (Token Saving)
    const metricsTxt = hasMetrics ? 
      `GCT:${advancedMetrics.groundContactTime||"N/A"}, Vuelo:${advancedMetrics.airTime||"N/A"}, Vel:${advancedMetrics.velocity}` : 
      "Sin métricas cinéticas.";

    const anglesTxt = bioData ? 
      `Rodilla:${bioData.knee.value}, Cadera:${bioData.hip.value}, Torso:${bioData.torso.value}` : 
      "Sin ángulos.";

    const promptText = `
      ACTÚA: BIOMECÁNICO.
      ANALIZA IMAGENES SPRINT.
      DATOS: ${metricsTxt}. ${anglesTxt}.
      CRITERIOS:
      1. GCT > 0.12s es lento.
      2. Talón cerca glúteo en recobro.
      3. Extensión cadera completa.
      SALIDA: JSON estricto.
    `;

    const parts: any[] = [];
    images.forEach(img => parts.push({ inlineData: { mimeType: 'image/jpeg', data: img } }));
    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts },
      config: { 
          responseMimeType: 'application/json', 
          responseSchema: ANALYSIS_SCHEMA,
          // Safety Settings to avoid blocking sports analysis
          safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH }
          ]
      }
    });

    if (response.text) {
        const result = cleanAndParseJSON(response.text);
        if (result) {
            return { ...result, category: analysisMode } as BiomechanicalAnalysis;
        }
    }
    return null;
  } catch (error: any) { 
      console.error("Analysis Error:", error);
      // Propagate quota errors specifically
      if (error.message?.includes("429") || error.status === 429) {
          throw new Error("QUOTA_EXCEEDED");
      }
      throw error; 
  }
};

export const chatWithCoach = async (history: any[], message: string, context: any) => {
  if (!ai) return { text: "⚠️ API Key faltante.", functionCall: null };
  try {
    // 1. COMPRESS HISTORY (Token Optimization)
    // Reduce history to last 4 interactions to save tokens
    const prunedHistory = history.slice(-4); 
    
    // 2. COMPRESS CONTEXT (Token Optimization)
    // Instead of sending full JSON objects, send concise text summaries.
    const planSummary = context.plan ? 
        `PLAN ACTUAL: Fase ${context.plan.phase}, Objetivo: ${context.plan.weeklyGoal}. Hoy: ${context.plan.sessions?.find((s:any) => s.day === 'Hoy')?.focus || 'Descanso'}.` : 
        "Sin plan activo.";
    
    const logsSummary = context.logs?.slice(-3).map((l:any) => `${l.event}:${l.time}s`).join(", ") || "Sin tiempos recientes.";
    
    const feedbackSummary = context.plan?.sessions
        ?.filter((s:any) => s.feedback && s.feedback.completed)
        ?.slice(-1) // Only last session feedback
        ?.map((s:any) => `Feedback reciente: RPE ${s.feedback.rpe}/10`)
        ?.join("") || "";

    const injuryReport = context.profile.injuries?.length > 0 
        ? `LESIÓN: ${context.profile.injuries[0].location}`
        : "Salud OK";

    // Hardened & Compressed System Prompt
    const systemPrompt = `
      ERES: Staff Técnico Elite.
      ATLETA: ${context.profile.name}. ${injuryReport}. ACWR: ${context.acwr?.ratio || 'N/A'}.
      DATOS: ${planSummary} ${logsSummary} ${feedbackSummary}
      INSTRUCCIÓN: Respuestas cortas y técnicas (<50 palabras). Si ACWR > 1.3 o dolor, sugiere descanso.
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
            ACTÚA: ALGORITMO DETECCIÓN TALENTO.
            DATOS: Fatiga ${JSON.stringify(readiness)}, Score Tec ${lastAnalysis ? lastAnalysis.score : "N/A"}, ACWR ${acwr?.ratio || 0}.
            TAREA: Insight corto sobre rendimiento.
            SALIDA: JSON.
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
