
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
  try {
    let cleaned = text.replace(/```json/g, "").replace(/```/g, "");
    cleaned = cleaned.trim();
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("JSON Parse Error. Raw text:", text);
    try {
      const firstBrace = text.indexOf('{');
      const lastBrace = text.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        const subStr = text.substring(firstBrace, lastBrace + 1);
        return JSON.parse(subStr);
      }
    } catch (e2) { return null; }
    return null;
  }
};

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
          day: { type: Type.STRING, description: "Día exacto (ej: Lunes)" },
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

// --- MENTAL MODELS & ARCHITECTURE ---
const ELITE_MENTAL_MODELS = `
1. MODELO DE RENDIMIENTO (ALTIS/FRANS BOSCH):
   - El sprint es una habilidad motora, no solo "fuerza". Prioriza la coordinación intermuscular.
   - "Attractors" vs "Fluctuators": Corrige lo estable (Attractors: extensión de cadera, shin angle) y permite variabilidad en lo demás.
   - Contextual Strength: La fuerza debe aplicarse en vectores específicos.

2. PERIODIZACIÓN (BONDARCHUK HYBRID):
   - Clasificación de ejercicios: CE (Competitivo Específico), SDE (Desarrollo Específico), GE (General).
   - No mezclar señales contradictorias el mismo día (Neural vs Metabólico).

3. MODELO DE SALUD (PAIN SCIENCE):
   - El dolor es una señal de alarma del cerebro, no siempre daño tisular.
   - "Load Management" > "Passive Rest". Es mejor reducir volumen que parar totalmente (Active Recovery).
`;

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
    
    // STRICT DAY MAPPING LOGIC
    const dayMap: {[key:string]: string} = { 'Mon': 'Lunes', 'Tue': 'Martes', 'Wed': 'Miércoles', 'Thu': 'Jueves', 'Fri': 'Viernes', 'Sat': 'Sábado', 'Sun': 'Domingo' };
    const userDaysES = profile.trainingDays.map(d => dayMap[d] || d);
    
    // Convert template object to array of priorities to map sequentially to user days
    const templatePriorities = Object.values(structure.weeklyStructure);

    const prompt = `
      ROL: DIRECTOR DE RENDIMIENTO (WORLD ATHLETICS LEVEL 5).
      FILOSOFÍA: ${ELITE_MENTAL_MODELS}
      
      TAREA: Diseñar microciclo para ${profile.name} (${profile.experienceLevel}, ${focusEvent}).
      CONTEXTO: Fase ${phaseName}. CNS Readiness ${cnsScore.toFixed(1)}/10. ACWR ${acwr ? acwr.ratio : "N/A"}.
      
      ESTRATEGIA OMNI-CONSCIENTE:
      - Si CNS es bajo (<5) o ACWR alto (>1.3): Activa el protocolo de "Deload" o "Active Recovery" automáticamente.
      - Si estamos en Fase Competición: Elimina volumen basura. Todo debe ser al 95%+ o al 0% (Recuperación).
      - Selecciona Drills específicos que corrijan la técnica, no solo ejercicios aleatorios.

      *** REGLA CRÍTICA DE CALENDARIO ***
      El atleta SOLO entrena estos días exactos: [ ${userDaysES.join(", ")} ].
      NO generes sesiones para otros días. Si el template tiene 5 sesiones pero el usuario entrena 3 días, prioriza las sesiones de Calidad (Speed/Power) y elimina las de relleno (Tempo/General).
      
      ESTRUCTURA DE FASE SUGERIDA (Prioridades): 
      ${JSON.stringify(templatePriorities)}
      
      Instrucción: Mapea las prioridades de la fase secuencialmente a los días disponibles del usuario ([${userDaysES.join(", ")}]).
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
    let promptText = "";
    
    // Advanced Physics Context for Gemini
    const physicsContext = advancedMetrics ? `
      CINÉTICA AVANZADA (Calculada por Physics Engine):
      - Velocidad CoM: ${advancedMetrics.velocity}
      - Zancada: ${advancedMetrics.strideLength}
      - Oscilación Vertical (Bounce): ${advancedMetrics.verticalOscillation || 'N/A'} (Eficiencia Baja si >6cm en MaxV).
      - Force Index: ${advancedMetrics.forceFactor || 'N/A'}/100.
    ` : "";

    const bioContext = bioData ? `
      ANGULOS CLAVE (MediaPipe):
      - Rodilla Recobro: ${bioData.knee.value}
      - Extensión Cadera: ${bioData.hip.value}
      - Torso: ${bioData.torso.value}
      ${physicsContext}
    ` : "Estimación visual.";

    const contextPrefix = analysisMode === 'Personal' 
        ? "ANÁLISIS DE ATLETA (Diagnóstico Crítico)." 
        : "ANÁLISIS DE REFERENCIA/DIDÁCTICO (Estudio de Modelo Técnico).";

    promptText = `
      ROL: BIOMECÁNICO SENIOR (RALPH MANN / ALTIS).
      MODO: ${contextPrefix}
      TAREA: Analizar ${isSequence ? 'secuencia cinética' : 'kinograma estático'}.
      DATOS: ${bioContext}
      
      FRAMEWORK DE ANÁLISIS:
      1. Centro de Masa (CoM): ¿Hay demasiada oscilación vertical (Bouncing)? El objetivo es proyección horizontal.
      2. Postura (Posture): ¿Está la pelvis neutra o en anteversión?
      3. Acción de Piernas (Leg Action): ¿Hay 'Scissoring' agresivo o flotación pasiva?
      4. Contacto (Ground Contact): ¿Pie debajo de la cadera (Masa Central) o por delante (Braking Forces)?
      
      SALIDA:
      - Identifica SOLO 1-2 "Big Rocks" (Errores principales que limitan el rendimiento).
      - Si la "Oscilación Vertical" es alta, critica la falta de rigidez (stiffness) en el contacto.
      - Asigna Drills que ataquen la CAUSA RAÍZ.
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
    const prunedHistory = history.slice(-10);
    const staffContext = context.profile.coaches?.length ? `STAFF REGISTRADO: ${context.profile.coaches.map((c:any)=>`${c.name} (${c.role})`).join(', ')}` : "Sin staff registrado.";
    
    // --- BUILD OMNI-CONSCIOUS DOSSIER ---
    
    // 1. Injuries
    const injuryReport = context.profile.injuries?.length > 0 
        ? context.profile.injuries.map((i:any) => `${i.location} (${i.severity}) - Estado: ${i.status}`).join(", ")
        : "Sin lesiones activas.";
    
    // 2. Competitions
    const compReport = context.profile.competitions?.length > 0
        ? context.profile.competitions.map((c:any) => `${c.name} (${c.date})`).join(", ")
        : "Sin competiciones programadas.";
        
    // 3. Technical Evolution (Personal Videos Only)
    const personalAnalyses = context.analysisHistory?.filter((a:any) => a.category === 'Personal') || [];
    const techReport = personalAnalyses.slice(0, 3).map((a:any) => 
        `[${new Date(a.savedAt).toLocaleDateString()}] Score ${a.score}: ${a.criticalErrors.join(', ')}`
    ).join("\n") || "Sin historial de análisis técnico.";

    // 4. Plan Context
    const currentPhase = context.plan ? context.plan.phase : "No Plan Active";
    const weeklyGoal = context.plan ? context.plan.weeklyGoal : "N/A";

    const systemPrompt = `
      ESTÁS ACTUANDO COMO: EL "CONSEJO TÉCNICO" (NIVEL 5 WORLD ATHLETICS).
      
      TU ARQUITECTURA MENTAL (Omni-Consciente):
      No respondes linealmente. Analizas TODO el expediente del atleta antes de hablar.

      EXPEDIENTE DEL ATLETA (${context.profile.name}):
      ------------------------------------------------------------
      [SALUD & LESIONES]: ${injuryReport}
      [CARGA DE TRABAJO]: ACWR ${context.acwr?.ratio || 'N/A'} (Status: ${context.acwr?.status || 'Unknown'}).
      [COMPETICIONES FUTURAS]: ${compReport}
      [EVOLUCIÓN TÉCNICA]: 
      ${techReport}
      [PLAN ACTUAL]: Fase ${currentPhase}. Objetivo: ${weeklyGoal}.
      [STAFF]: ${staffContext}
      ------------------------------------------------------------

      REGLAS DE DECISIÓN (PROTOCOLO ELITE):
      1. SI HAY LESIÓN ACTIVA: Prioridad absoluta = Rehabilitación. Bloquea cualquier petición de intensidad máxima que afecte la zona dañada.
      2. SI HAY COMPETICIÓN < 14 DÍAS: Entra en modo "Tapering". Niega peticiones de volumen alto. Sugiere calidad y descanso.
      3. SI TÉCNICA ES DEFICIENTE (Scores < 60): No sugieras "correr más rápido". Sugiere "correr mejor" (Drills).
      
      DEBATE INTERNO (Simulado):
         - HEAD COACH: ¿Esto mejora el tiempo?
         - FISIO: ¿Esto rompe al atleta (considerando historial)?
         - BIOMECÁNICO: ¿Técnicamente viable (según historial de video)?
      
      INSTRUCCIONES DE RESPUESTA:
      - Si el usuario pregunta algo simple, responde simple pero fundamentado en SU contexto.
      - "Veo que tienes una molestia en ${injuryReport}, así que hoy sugiero..."
      - "Considerando que tu competencia en ${compReport} se acerca..."
    `;

    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: { systemInstruction: systemPrompt, tools: [{ functionDeclarations: [modifySessionTool] }] },
      history: prunedHistory
    });

    const result = await chat.sendMessage({ message });
    return { text: result.text || "...", functionCall: result.functionCalls?.[0] || null };
  } catch (error) { return { text: "Error de conexión con el Staff.", functionCall: null }; }
};

export const generateNexusInsight = async (
    logs: any[], 
    readiness: any, 
    lastAnalysis: BiomechanicalAnalysis | null,
    acwr: any
): Promise<NexusInsight | null> => {
    if(!ai) return null;
    try {
        const recentLogs = logs.slice(-3);
        const prompt = `
            ROL: DIRECTOR DE ALTO RENDIMIENTO (OMNI-CONSCIENTE).
            TAREA: Síntesis de datos cruzados (Nexus).

            DATOS:
            - Rendimiento (Tiempos): ${JSON.stringify(recentLogs)}
            - Fisiología (Fatiga/Sueño): ${JSON.stringify(readiness)}
            - Mecánica (Video): ${lastAnalysis ? `Score ${lastAnalysis.score} (${lastAnalysis.category}), Errores: ${lastAnalysis.criticalErrors.join(', ')}` : "Sin video personal reciente"}
            - Carga (ACWR): ${acwr?.ratio || 0} (${acwr?.status || 'N/A'})

            MODELO MENTAL:
            Busca patrones no obvios.
            - ¿Baja velocidad + Alta Fatiga? -> Sobrecarga Neural.
            - ¿Baja velocidad + Baja Fatiga? -> Mecánica ineficiente o falta de intención.
            - ¿Mejor marca personal + ACWR Alto? -> Riesgo de pico de estrés (Warning).
            
            Salida: Insight corto, estilo "War Room".
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
