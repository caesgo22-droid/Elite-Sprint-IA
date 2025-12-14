
import { GoogleGenAI, Type, Schema, FunctionDeclaration, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { TrainingPlan, BiomechanicalAnalysis, UserProfile, NexusInsight } from "../types";
import { getStructureForPhase, DRILL_DATABASE } from "./trainingDatabase";
import { TRANSLATIONS, Language } from "../utils/translations";

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
const generateRichFallbackSession = (day: string, phase: string, index: number) => {
    let focus = "Acceleration";
    let intensity = "High";
    let routine = [
        "Calentamiento: Movilidad Articular + Activación Glúteo (15')",
        "Drills: A-Skip, B-Skip, Straight Leg Bounds (3x20m)",
    ];
    let gym = [];
    let kpi = "Postura Neutra";

    if (index % 3 === 0) { 
        focus = "Acceleration & Power";
        intensity = "High";
        routine.push("Main: Sled Pushes 4x20m (75% BW)");
        routine.push("Main: Block Starts 4x10m (Enfoque salida)");
        routine.push("Plyo: Broad Jumps 4x5");
        kpi = "Proyección horizontal y 'Triple Extensión'";
        gym = ["Clean Pulls 3x3", "Squats 3x5 @ 80%"];
    } else if (index % 3 === 1) { 
        focus = "Tempo & Recovery";
        intensity = "Low";
        routine.push("Main: Extensive Tempo 10x100m @ 70% (Rec 2')");
        routine.push("Core: Plank Circuit (3 rounds)");
        kpi = "Relajación mecánica a velocidad sub-máxima";
    } else { 
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

// --- MASTER INSTRUCTIONS (LEVEL V INTELLIGENCE) ---

const MASTER_TRAINING_INSTRUCTIONS = `
ERES: Director de Metodología de World Athletics (Nivel V).
TU OBJETIVO: Diseñar un microciclo de sprint de élite basado estrictamente en el perfil del atleta y las leyes biológicas de adaptación.

REGLAS DE ORO (HARD CONSTRAINTS):
1. TABLA DE INTENSIDAD (No alucinar):
   - 'Max': >98% esfuerzo (Aláctico). Solo si Readiness > 7/10 y ACWR < 1.3.
   - 'High': 90-95% (Resistencia a la Velocidad/Especial). Altamente taxativo.
   - 'Medium': 80-89% (Tempo Intensivo). Desarrollo técnico-glucolítico.
   - 'Low': <75% (Tempo Extensivo/Recuperación). Vascularización y técnica.
2. LEY DEL SNC (Sistema Nervioso Central): NUNCA programes días de intensidad 'Max' o 'High' consecutivos. Debe haber al menos 48h entre picos neurales o usar días 'Low' intercalados.
3. ESPECIFICIDAD DEL EVENTO:
   - 100m/200m: Prioriza Aceleración, Potencia y Max V. Volumen bajo, Intensidad máxima.
   - 400m: Prioriza Tolerancia al Lactato, Ritmo de Carrera y Tempo Extensivo. Volumen medio-alto.
4. RATIONALE (CoT): En el campo 'rationale', explica tu "Cadena de Pensamiento": Diagnóstico -> Estrategia de Carga -> Selección de Día Crítico.

ESTRUCTURA DE RESPUESTA:
- Rutinas en pista ('trackRoutine') deben ser detalladas: (Ej: "3x4x60m @ 95% rec 8'").
- KPIs Biomecánicos ('biomechanicsKpi') deben ser términos de física (Ej: "Impulso horizontal", "Tiempo de contacto", "Stiffness").
`;

const MASTER_BIOMECHANICS_INSTRUCTIONS = `
ERES: Biomecánico Senior de Centro de Alto Rendimiento.
TU TAREA: Analizar datos cinemáticos y generar un diagnóstico técnico de élite.

ENFOQUE ANALÍTICO:
1. No solo mires ángulos, infiere DINÁMICA (Fuerzas).
2. Usa terminología de Ralph Mann / Frans Bosch (Ej: "Frontside Mechanics", "Scissoring", "Ankle Stiffness").
3. RELACIÓN CAUSA-EFECTO: Si la rodilla está baja (recobro), la causa suele ser una mala aplicación de fuerza en el paso anterior.
4. DRILLS CORRECTIVOS: Prescribe ejercicios específicos del 'Drill Database' para corregir el error raíz.

CRITERIOS DE ÉLITE (Velocidad Máxima):
- GCT (Tiempo Contacto) > 0.11s es "Pobre" para élite.
- Rodilla libre debe cruzar rodilla de apoyo antes del despegue.
- Aterrizaje debe ser debajo del Centro de Masa (CoM), no delante (Frenado).
`;

// --- MAIN FUNCTIONS ---

export const generateTrainingPlan = async (
  profile: UserProfile, 
  readiness: { fatigue: number; sleep: number; soreness: number; stress: number; hydration: number }, 
  currentDate: string,
  focusEvent?: string,
  acwr?: { ratio: number; status: string },
  language: Language = 'es' // NEW PARAMETER
): Promise<TrainingPlan | null> => {
  const currentMonth = new Date().getMonth(); 
  let phaseName = "General Prep";
  if (currentMonth >= 2 && currentMonth <= 4) phaseName = "Specific Prep"; 
  else if (currentMonth >= 5 && currentMonth <= 8) phaseName = "Competition"; 
  else if (currentMonth >= 9) phaseName = "General Prep";

  const rawDays = (profile.trainingDays && Array.isArray(profile.trainingDays) && profile.trainingDays.length > 0) 
        ? profile.trainingDays 
        : ['Mon', 'Wed', 'Fri'];
  
  const targetDaysES = Array.from(new Set(rawDays.map(d => dayMapES[normalizeDay(d)] || 'Lunes')))
      .sort((a, b) => (DAY_ORDER[normalizeDay(a)] || 99) - (DAY_ORDER[normalizeDay(b)] || 99));

  if (!ai) {
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
    
    let safetyLockProtocol = "";
    if (acwr && acwr.ratio > 1.35) {
        safetyLockProtocol = `ALERTA ROJA: ACWR (${acwr.ratio}) es PELIGROSO. PROHIBIDO intensidad 'Max'. Reemplazar con Tempo Extensivo o Técnica Sub-máxima.`;
    } else if (readiness.soreness > 7 || readiness.fatigue > 8) {
        safetyLockProtocol = `ALERTA FISIOLÓGICA: Atleta reporta fatiga/dolor severo. Microciclo de descarga obligatoria (-40% volumen).`;
    }

    const langInstruction = TRANSLATIONS[language].ai.promptLang;

    const prompt = `
      ${MASTER_TRAINING_INSTRUCTIONS}
      ${langInstruction}

      CONTEXTO DEL ATLETA:
      - Nivel: ${profile.experienceLevel} (${profile.yearsExperience} años exp)
      - Evento Principal: ${focusEvent} (Ajusta fisiología para esto)
      - Fase: ${phaseName}
      - Readiness Score: ${cnsScore.toFixed(1)}/10 (Factor Clave)
      - ACWR Actual: ${acwr ? acwr.ratio : 'N/A'}
      - Lesiones Activas: ${profile.injuries.length > 0 ? JSON.stringify(profile.injuries) : "Ninguna"}
      ${safetyLockProtocol}

      TAREA:
      Genera un microciclo JSON para los días: ${targetDaysES.join(", ")}.
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

    // STRICT MAPPING
    const finalSessions = targetDaysES.map((targetDay, index) => {
        const normTarget = normalizeDay(targetDay);
        const match = aiSessions.find(s => normalizeDay(s.day) === normTarget);
        
        if (match) {
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
      const sessions = targetDaysES.map((day, idx) => generateRichFallbackSession(day, phaseName, idx));
      return {
          id: Date.now().toString(),
          createdAt: new Date().toISOString(),
          weeklyGoal: "Recuperación Estructural (Protocolo Seguro)",
          phase: phaseName as any,
          rationale: "Microciclo de ajuste generado mediante algoritmos de seguridad debido a latencia en la red neuronal.",
          sessions: sessions as any
      } as TrainingPlan;
  }
};

export const analyzeTechnique = async (images: string[], bioData: any = null, advancedMetrics: any = null, analysisMode: 'Personal' | 'External' = 'Personal', language: Language = 'es'): Promise<BiomechanicalAnalysis | null> => {
  if (!ai) {
    console.error("Gemini AI instance not initialized. Missing API Key.");
    throw new Error("API_KEY_MISSING");
  }
  
  try {
    const hasMetrics = advancedMetrics && advancedMetrics.velocity !== '-';
    
    const metricsTxt = hasMetrics ? 
      `GCT:${advancedMetrics.groundContactTime||"N/A"}, Vuelo:${advancedMetrics.airTime||"N/A"}, Vel:${advancedMetrics.velocity}, Freq:${advancedMetrics.frequency}` : 
      "Sin métricas cinéticas avanzadas.";

    const anglesTxt = bioData ? 
      `Rodilla:${bioData.knee.value} (Ref: ${bioData.knee.status}), Cadera:${bioData.hip.value}, Torso:${bioData.torso.value}` : 
      "Sin ángulos.";

    const langInstruction = TRANSLATIONS[language].ai.promptLang;

    const promptText = `
      ${MASTER_BIOMECHANICS_INSTRUCTIONS}
      ${langInstruction}
      
      MODO DE ANÁLISIS: ${analysisMode === 'External' ? 'EDUCATIVO (Analiza este video de referencia)' : 'DIAGNÓSTICO PERSONAL (Corrige al atleta)'}
      
      DATOS DEL SENSOR:
      - ${metricsTxt}
      - ${anglesTxt}
      
      TAREA:
      1. Identifica la Fase (Aceleración, Max V, Deceleración).
      2. Detecta ERRORES CRÍTICOS (Limitantes de rendimiento).
      3. Asigna un SCORE (0-100) basado en eficiencia mecánica.
      4. Prescribe DRILLS CORRECTIVOS específicos.
      
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
      if (error.message?.includes("429") || error.status === 429) {
          throw new Error("QUOTA_EXCEEDED");
      }
      throw error; 
  }
};

export const chatWithCoach = async (history: any[], message: string, context: any, language: Language = 'es') => {
  if (!ai) return { text: "⚠️ API Key faltante.", functionCall: null };
  try {
    const prunedHistory = history.slice(-6); 
    
    const planSummary = context.plan ? 
        `[PLAN] Fase: ${context.plan.phase}, Goal: ${context.plan.weeklyGoal}. Today: ${context.plan.sessions?.find((s:any) => s.day === 'Hoy')?.focus || 'Rest'}.` : 
        "No active plan.";
    
    const logsSummary = context.logs?.slice(-5).map((l:any) => `[LOG ${l.date}] ${l.event}: ${l.time}s (${l.type})`).join("; ") || "No recent logs.";
    
    const lastBio = context.lastAnalysis ? 
        `[LAST VIDEO] Score: ${context.lastAnalysis.score}, Error: ${context.lastAnalysis.criticalErrors[0] || 'None'}.` :
        "No video analysis.";

    const injuryReport = context.profile.injuries?.length > 0 
        ? `[INJURY] ${context.profile.injuries[0].location} (${context.profile.injuries[0].status})`
        : "Health OK";
    
    const acwrData = context.acwr ? `[ACWR] ${context.acwr.ratio} (${context.acwr.status})` : "ACWR N/A";

    const langInstruction = TRANSLATIONS[language].ai.promptLang;

    const systemPrompt = `
      ERES: Staff Técnico 'Elite Sprint AI' (Omni-consciente).
      ${langInstruction}
      
      EXPEDIENTE DEL ATLETA (${context.profile.name}):
      1. ${planSummary}
      2. ${logsSummary}
      3. ${lastBio}
      4. ${injuryReport}
      5. ${acwrData}
      
      INSTRUCCIONES:
      - Responde de forma breve, técnica y motivadora.
      - CRUZA DATOS: Si pregunta "¿Por qué corro lento?", revisa sus logs recientes y su último análisis biomecánico.
      - SEGURIDAD: Si el ACWR es alto (>1.3) o hay lesión, sugiere descanso o terapia.
    `;

    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: { systemInstruction: systemPrompt, tools: [{ functionDeclarations: [modifySessionTool] }] },
      history: prunedHistory
    });

    const result = await chat.sendMessage({ message });
    return { text: result.text || "...", functionCall: result.functionCalls?.[0] || null };
  } catch (error) { console.error("Chat Error", error); return { text: "Error de conexión.", functionCall: null }; }
};

export const generateNexusInsight = async (logs: any[], readiness: any, lastAnalysis: any, acwr: any, language: Language = 'es'): Promise<NexusInsight | null> => {
    if(!ai) return null;
    try {
        const langInstruction = TRANSLATIONS[language].ai.promptLang;
        const prompt = `
            ACTÚA: SISTEMA NEXUS (Algoritmo de Detección de Patrones).
            ${langInstruction}
            
            INPUTS:
            - Fatiga Subjetiva: ${JSON.stringify(readiness)}
            - Eficiencia Técnica: ${lastAnalysis ? lastAnalysis.score : "N/A"}/100
            - Carga ACWR: ${acwr?.ratio || 0}
            - Tendencia Tiempos: ${logs.slice(-3).map((l:any) => l.time).join(", ")}
            
            TAREA:
            Genera un "Insight" corto (titular + análisis + recomendación).
            Detecta: Sobreentrenamiento, Pico de Forma, o Estancamiento.
            
            SALIDA: JSON (NexusSchema).
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
