
// scripts/test_context_v2.ts
import { ContextEngine } from '../utils/ContextEngine';
import { UserProfile, TrainingPlan } from '../types';

// Mock Data
const mockProfile: UserProfile = {
    name: "Usain Test",
    age: 25,
    role: "athlete",
    experienceLevel: "Elite",
    height: 195,
    weight: 94,
    events: ["100m"],
    pbs: {
        "100m": { time: "9.58", date: "2009" },
        "200m": { time: "19.19", date: "2009" },
        "400m": { time: "45.00", date: "2008" }
    },
    injuries: [],
    coaches: [],
    trainingDays: ["Monday"],
    hoursPerDay: 2,
    preferredTime: "Morning",
    competitions: [
        { id: "c1", name: "Olympics", date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), priority: "A" }
    ],
    yearsExperience: 10
};

// Scenario 1: High Risk + Competition Close
const scenario1 = () => {
    console.log("--- SCENARIO 1: High Risk & Competition in 2 Days ---");
    const acwr = { acuteLoad: 800, chronicLoad: 500, ratio: 1.6, status: "Alto Riesgo" as const }; // Risk

    // Create context
    const context = ContextEngine.build(
        mockProfile,
        null,
        acwr,
        null
    );

    console.log("Risk Flag:", context.physiologicalState.recoveryRiskFlag);
    console.log("Days to Race:", context.trainingState.daysToNextRace);
    console.log("Recommended Recovery:", context.physiologicalState.recommendedRecovery);

    const prompt = ContextEngine.generateSystemPrompt(context);
    console.log("Prompt Snippet:", prompt.includes("ALERTA DE RIESGO") ? "SUCCESS: Alert Triggered" : "FAIL: No Alert");
};

// Scenario 2: Injury Active
const scenario2 = () => {
    console.log("\n--- SCENARIO 2: Hamstring Injury Active ---");
    const injuredProfile = {
        ...mockProfile,
        injuries: [{ type: "Strain", location: "Hamstring", severity: "Moderada" as const, status: "Activa" as const }]
    };

    const context = ContextEngine.build(
        injuredProfile,
        null,
        { ratio: 0.9, acuteLoad: 400, chronicLoad: 450, status: "Óptimo" as const },
        null
    );

    console.log("Recommended Recovery:", context.physiologicalState.recommendedRecovery);
    console.log("Prompt Includes Injury:", context.physiologicalState.injuries.length > 0);
};

scenario1();
scenario2();
