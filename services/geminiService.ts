import { GoogleGenerativeAI } from "@google/generative-ai";
import { TrainingPlan, NexusInsight, UserProfile } from "../types";
import { COACH_PERSONA, PLAN_GENERATION_PROMPT, VIDEO_ANALYSIS_PROMPT, ANALYSIS_SYSTEM_INSTRUCTION, MASTER_AUDIT_PROMPT, MASTER_ANALYSIS_SYSTEM_INSTRUCTION, getSystemInstruction } from "../utils/prompts";

import { getEnv } from "../utils/env";

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

const getModelInstance = (modelName: string) => {
    const apiKey = (window as any).aistudio?.apiKey || getEnv("GEMINI_API_KEY") || getEnv("VITE_GEMINI_API_KEY") || getEnv("API_KEY");

    if (!apiKey) {
        console.error("❌ CRITICAL: No API Key found in env or window.aistudio");
        console.log("Env Dump:", {
            VITE_GEMINI: !!getEnv("VITE_GEMINI_API_KEY"),
            GEMINI: !!getEnv("GEMINI_API_KEY"),
            AISTUDIO: !!(window as any).aistudio?.apiKey
        });
        return null;
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    return genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
            temperature: 0.1,  // More deterministic for technical analysis
            topP: 0.95,
            topK: 40,
        }
    });
};

export const analyzeTechnique = async (images: string[], bioData: any, advancedMetrics: any, analysisMode: string, userProfile?: any, lastAnalysis?: any, currentSession?: any): Promise<any> => {
    const isMaster = analysisMode === 'External';
    // ✅ UPGRADED: Gemini 2.0 Flash (faster and more accurate than Pro 1.5)
    // ✅ UPGRADED: Gemini 2.0 Flash (Stable Exp)
    const modelName = "gemini-2.0-flash-exp";
    const model = getModelInstance(modelName);
    if (!model) return null;

    try {
        const imageParts = images.map(img => ({
            inlineData: { mimeType: "image/jpeg", data: img }
        }));

        // Build enriched prompt with athlete context
        let contextAddition = "";
        if (userProfile) {
            const activeInjuries = userProfile.injuries?.filter((i: any) => i.status === 'Activa').map((i: any) => i.location).join(', ') || 'Ninguna';
            const mainEvent = userProfile.events?.[0] || '100m';
            const pb = userProfile.pbs?.[mainEvent]?.time || 'N/A';
            const lastErrors = lastAnalysis?.criticalErrors?.join(', ') || 'Primer análisis';
            const sessionFocus = currentSession?.biomechanicsKpi || 'General';

            contextAddition = `\n\nCONTEXTO DEL ATLETA:\n- Evento Principal: ${mainEvent}\n- PB Actual: ${pb}\n- Lesiones Activas: ${activeInjuries}\n- Último Análisis: ${lastErrors}\n- Objetivo de Sesión: ${sessionFocus}\n`;
        }

        const prompt = isMaster
            ? MASTER_AUDIT_PROMPT({ bioData, advancedMetrics }) + contextAddition
            : VIDEO_ANALYSIS_PROMPT({ bioData, advancedMetrics }) + contextAddition;

        // Force 3-distance prediction instruction
        const predictionInstruction = `\n\nINSTRUCCIÓN DE PREDICCIÓN DE CARRERA: Basado en la Cinemática (velocidad salida, mecánica de vuelo, GCT) y las métricas avanzadas, genera predicciones de tiempo POTENCIALES para: 100m, 200m, y 400m. Si el atleta no corre esa distancia, estima basado en su biomecánica.`;

        const finalPrompt = prompt + predictionInstruction;

        const result = await model.generateContent({
            contents: [{
                role: "user",
                parts: [
                    ...imageParts,
                    { text: finalPrompt }
                ]
            }],
            generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.1,
            },
            systemInstruction: isMaster ? MASTER_ANALYSIS_SYSTEM_INSTRUCTION : ANALYSIS_SYSTEM_INSTRUCTION,
        });

        const response = await result.response;
        return cleanAndParseJSON(response.text());
    } catch (e: any) {
        console.error("AI Analysis Error:", e);
        return null;
    }
};

export const generateNexusInsight = async (logs: any[], readiness: any, analysisHistory: any[], acwr: any, profile?: UserProfile): Promise<NexusInsight | null> => {
    const model = getModelInstance("gemini-2.0-flash-exp");
    if (!model) return null;

    const acwrRatio = acwr?.ratio || 0;
    const therapyLogs = logs.filter(l => l.type === 'Recovery' || l.event === 'Therapy').slice(-3);

    // Extract medical and competition context from profile
    const activeInjuries = profile?.injuries?.filter((inj: any) => inj.status === 'Activa').map((inj: any) => `${inj.location} (${inj.type})`).join(', ') || 'Ninguna';
    const upcomingComps = profile?.competitions?.map((c: any) => `${c.name} (${c.date})`).join(', ') || 'Ninguna';

    const prompt = `AUDITORÍA HOLÍSTICA (Nivel 5).
            Historial Tiempos: ${JSON.stringify(logs.slice(-7))}. 
            Readiness: ${JSON.stringify(readiness)}. 
            Historial Biomecánico (últimos 3): ${JSON.stringify(analysisHistory.slice(0, 3))}. 
            REPORTE MÉDICO & COMPETITIVO:
            - Lesiones Activas: ${activeInjuries}
            - Terapia Reciente: ${JSON.stringify(therapyLogs)}
            - Próximas Competiciones: ${upcomingComps}
            
            - SI ACWR < 0.8: Marca status "Recovery" o "Neutral".
            - SI ACWR > 1.5: Marca status "Warning" OBLIGATORIAMENTE.
            - REGLA DE ORO: No recalcules la carga. Si el ACWR proporcionado es ${acwrRatio.toFixed(2)}, ese es el ÚNICO valor real.
            INSTRUCCIÓN CRÍTICA: Detecta "Fatiga Técnica Silenciosa". 
            Si la Velocidad del Centro de Masas (VCoM) ha bajado sistemáticamente o el Tiempo de Contacto (GCT) ha subido en los últimos 3 videos, marca status: "Warning" y alerta sobre riesgo de lesión.
            
            FORMATO DE RESPUESTA JSON OBLIGATORIO:
            {
              "status": "Peak" | "Fatigue" | "Warning" | "Recovery",
              "headline": "Título corto y contundente (ej: RIESGO DE SOBRECARGA)",
              "analysis": "Análisis detallado de 2-3 frases explicando el porqué en español."
            }`;

    try {
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: "application/json",
            },
            systemInstruction: COACH_PERSONA
        });
        const response = await result.response;
        return cleanAndParseJSON(response.text());
    } catch (e) {
        return null;
    }
};

import { PeriodizationEngine } from "../utils/periodizationEngine";

export const generateTrainingPlan = async (profile: UserProfile, readiness: any, currentDate: string, focusEvent?: string, acwr?: any, lastAnalysis?: any, logs?: any[]): Promise<TrainingPlan | null> => {
    const model = getModelInstance("gemini-2.0-flash-exp");
    if (!model) return null;

    try {
        // PERDIODIZATION ENGINE INTEGRATION
        const structuralPhase = PeriodizationEngine.calculateCurrentPhase(profile.competitions || [], new Date());

        const therapyLogs = logs?.filter((l: any) => l.type === 'Recovery' || l.event === 'Therapy').slice(-3);
        const enrichedProfile = {
            ...profile,
            recentTherapy: therapyLogs?.map((l: any) => `${l.date}: ${l.notes || l.activity || l.event}`).join(' | ')
        };

        // Inject Phase Directives
        // The prompt function needs to be updated or we append the instruction here.
        // Assuming PLAN_GENERATION_PROMPT takes standard args, we will append a "STRICT INSTRUCTION" block.

        let prompt = PLAN_GENERATION_PROMPT(enrichedProfile, readiness, focusEvent || "100m", acwr?.ratio, lastAnalysis);

        prompt += `\n\n[MANDATORY PERIODIZATION FRAMEWORK]
        CURRENT PHASE: ${structuralPhase.name} (Calculated based on Race Date: ${structuralPhase.weeksToRace} weeks out).
        PRIMARY FOCUS: ${structuralPhase.focus}.
        INTENSITY: ${structuralPhase.intensity}.
        VOLUME: ${structuralPhase.volume}.
        ENERGY SYSTEM: ${structuralPhase.primaryEnergySystem}.
        
        CRITICAL INSTRUCTION: You MUST ignore any generic phase requests. Build the plan SPECIFICALLY for the '${structuralPhase.name}' phase.
        if (Phase is 'Taper', volume must be reduced by 40-60%.
        If Phase is 'Competition', focus on neural activation and rest.

        [AI TUNING PARAMETERS]
        The coach has explicitly tuned your behavior for this specific athlete:
        - VOLUME BIAS: ${(profile.trainingPreferences?.volumeBias || 1.0).toFixed(1)}x (Multiply standard volume by this factor).
        - INTENSITY BIAS: ${(profile.trainingPreferences?.intensityBias || 1.0).toFixed(1)}x (Adjust prescribed intensities by this factor, capping at 100%).
        - TECHNIQUE FOCUS: ${profile.trainingPreferences?.techniqueFocus || 'Balanced'} (If 'Technique', prioritize drills over raw output. If 'Power', prioritize explosive movements).
        
        Apply these biases to the generated sessions.
        `;

        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: "application/json",
            },
            systemInstruction: COACH_PERSONA
        });

        const response = await result.response;
        const plan = cleanAndParseJSON(response.text());
        if (plan && plan.sessions && plan.sessions.length > 0) {
            return {
                ...plan,
                phase: structuralPhase.name, // ENFORCE calculated phase
                startDate: new Date().toISOString(), // Add start date for reference
                id: Date.now().toString(),
                createdAt: new Date().toISOString()
            };
        }
        return null;
    } catch (e) {
        console.error("Plan Gen Error:", e);
        return null;
    }
};

export const chatWithCoach = async (history: any[], message: string, context: any, persona: string = 'Coach'): Promise<any> => {
    const model = getModelInstance("gemini-2.0-flash-exp");
    if (!model) return { text: "Sistema Offline." };

    try {
        const result = await model.generateContent({
            contents: [
                ...history,
                { role: "user", parts: [{ text: `CONTEXTO TÉCNICO: ${JSON.stringify(context)}. PREGUNTA: ${message}` }] }
            ],
            systemInstruction: getSystemInstruction(persona),
        });
        const response = await result.response;
        return { text: response.text() };
    } catch (e) {
        return { text: "El Coach está ocupado en pista (Error de conexión)." };
    }
};