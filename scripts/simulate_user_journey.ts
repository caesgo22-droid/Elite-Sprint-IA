
import { calculateReadiness, generatePrescription } from '../utils/recoveryEngine.ts';
import { getSystemInstruction } from '../utils/prompts.ts';

// MOCK DATA
const mockWellness = {
    sleepQuality: 6, // Un poco baja
    sleepHours: 7.2,
    fatigue: 7, // Alta fatiga
    soreness: 8, // Muy dolorido
    stress: 4,
    mood: 5
};

const mockAcwr = 1.6; // DANGER ZONE (Spike)

console.log("---------------------------------------------------------");
console.log("🚀 INICIANDO SIMULACIÓN DE USUARIO: 'Carlos' (Velocista)");
console.log("---------------------------------------------------------");

// 1. MORNING CHECK-IN (Recovery Engine)
console.log("\n☀️ [07:00 AM] MAÑANA: Wellness Check");
console.log("Input:", mockWellness);
console.log("ACWR Actual:", mockAcwr);

const readiness = calculateReadiness(mockWellness, mockAcwr);
console.log("\n📊 RESULTADO READINESS:", readiness);

const prescription = generatePrescription(readiness, mockWellness);
console.log("💊 PRESCRIPCIÓN GENERADA:", prescription.status);
console.log("   Nota del Coach:", prescription.coachNote);
console.log("   Protocolos:", prescription.protocols.map(p => `[${p.type}] ${p.title} (${p.durationMin}m)`).join(', '));


// 2. TRAINING SESSION (Persona Chat)
console.log("\n---------------------------------------------------------");
console.log("🏋️ [10:00 AM] ENTRENAMIENTO & CONSULTA");
console.log("Situation: Carlos siente dolor en el tendón y decide preguntar al staff.");

// Simulate Chat Interface
const userQuestion = "Me duele el tendón de Aquiles al rebotar. ¿Debo seguir?";
const selectedPersona = "Physio";

console.log(`\n💬 CHAT (Select: ${selectedPersona})`);
console.log(`User: "${userQuestion}"`);

const systemPrompt = getSystemInstruction(selectedPersona);
console.log(`\n🤖 SYSTEM PROMPT ACTIVADO (Shortened):`);
console.log(systemPrompt.substring(0, 150) + "...");

console.log("\n(Simulated AI Response based on Physio Persona...)");
console.log(`"Coach Physio: ¡Alto ahí, Carlos! Si hay dolor al rebote (pliometría), es una red flag para tendinopatía.
Protocolo inmediato:
1. Reduce carga de impacto hoy (Cero saltos).
2. Isométricos de sóleo (45s x 5 reps).
3. Hielo local 10min post-actividad."`);

// 3. POST-TRAINING ANALYSIS (Biomechanics V3)
console.log("\n---------------------------------------------------------");
console.log("📹 [11:30 AM] ANÁLISIS DE VIDEO (Pro Suite)");
console.log("Simulating detection of 'Collapsing Ankle'...");

const mockMetrics = {
    realGCT: 0.145, // SLOW (Amateur/Bad)
    forceFactor: 35, // LOW STIFFNESS (Collapse)
    asymmetry: 8.5 // HIGH ASYMMETRY (Right leg weak)
};

console.log("\n📊 SENSOR DATA (Physics Engine V3):");
console.log(mockMetrics);

console.log("\n🚨 AI AUDIT TRIGGERED (Auto-Analysis):");
if (mockMetrics.realGCT > 0.120) console.log("   ❌ GCT Warning: Too slow (>120ms).");
if (mockMetrics.forceFactor < 40) console.log("   ❌ Stiffness Warning: COLAPSO DETECTADO. Energy leak.");
if (mockMetrics.asymmetry > 5) console.log("   ⚠️ Asymmetry Alert: Desbalance significativo (>5%).");

console.log("\n✅ SIMULACIÓN COMPLETADA CON ÉXITO.");
console.log("---------------------------------------------------------");
