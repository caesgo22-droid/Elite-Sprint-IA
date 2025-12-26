
import { calculateACWR, getSessionLoad } from "../utils/loadCalculator";
import { TrainingPlan, PerformanceLog } from "../types";

// Mock Data
const mockSessionPlanned = {
    intensity: 'High',
    duration: 60
};

const mockSessionCompleted = {
    intensity: 'High',
    feedback: {
        completed: true,
        rpe: 9,
        duration: 90,
        timestamp: new Date().toISOString()
    }
};

const mockPlans: TrainingPlan[] = [{
    id: 'p1',
    createdAt: new Date().toISOString(),
    phase: 'General Prep',
    sessions: [mockSessionCompleted],
    weeklyGoal: 'Test',
    rationale: 'Test'
}] as any;

const mockLogs: PerformanceLog[] = [
    {
        id: '1',
        date: new Date().toISOString(),
        event: 'Therapy',
        type: 'Training',
        location: 'Gym',
        time: 0,
        rpe: 8,
        duration: 60,
        notes: 'Heavy session'
    }
];

// Test getSessionLoad
console.log("--- Testing getSessionLoad ---");
const plannedLoad = getSessionLoad(mockSessionPlanned);
console.log(`Planned Load (High * 60): ${plannedLoad} (Expected: 480)`);

const actualLoad = getSessionLoad(mockSessionCompleted);
console.log(`Actual Load (RPE 9 * 90): ${actualLoad} (Expected: 810)`);

if (plannedLoad === 480 && actualLoad === 810) {
    console.log("SUCCESS: getSessionLoad logic is correct.");
} else {
    console.error("FAILURE: getSessionLoad logic mismatch.");
}

// Test calculateACWR
console.log("\n--- Testing calculateACWR with unified logic ---");
const result = calculateACWR(mockPlans, mockLogs);
console.log("ACWR Status:", result.status);
console.log("ACWR Ratio:", result.ratio);

if (result.history && result.history.length > 0) {
    console.log(`SUCCESS: History generated (${result.history.length} days).`);
    // Check if limits are present
    if (result.limits) {
        console.log("SUCCESS: Limits present.");
    }
} else {
    console.error("FAILURE: History missing.");
}

if (result.acuteLoad > 0) {
    console.log("SUCCESS: Acute load detected.");
} else {
    console.error("FAILURE: Acute load is 0.");
}
