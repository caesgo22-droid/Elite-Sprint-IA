
// scripts/test_biomechanics.ts
import { ElitePhysicsEngine } from '../utils/biomechanicsUtils';

// Mock Landmark Generator
// Y coords: 1.0 = Bottom, 0.0 = Top
// To simulate contact, we need 'High Y' (e.g., 0.9)
// To simulate flight, we need 'Low Y' (e.g., 0.5)

const generateStep = (legVal: 'Left' | 'Right', frames: number) => {
    const sequence = [];
    const LEFT_IDX = 27;
    const RIGHT_IDX = 28;
    const LEG_IDX = legVal === 'Left' ? LEFT_IDX : RIGHT_IDX;

    // Stance Phase
    for (let i = 0; i < frames; i++) {
        // Create mock landmark object
        const lm: any = { landmarks: [] };
        // Initialize basic structure
        for (let j = 0; j < 33; j++) lm.landmarks.push({ x: 0, y: 0, visibility: 1 });

        // Active Leg in Contact (Y close to 1.0)
        lm.landmarks[LEG_IDX].y = 0.9;

        // Other leg in air (Recobro)
        lm.landmarks[LEG_IDX === LEFT_IDX ? RIGHT_IDX : LEFT_IDX].y = 0.4;

        // Knee Angle mimicking flex (Stiffness)
        // Hip(23), Knee(25), Ankle(27)
        lm.landmarks[23] = { x: 0.5, y: 0.5 };
        lm.landmarks[25] = { x: 0.55, y: 0.7 }; // Flexed
        lm.landmarks[27] = { x: 0.5, y: 0.9 };

        sequence.push(lm);
    }
    return sequence;
};

const generateFlight = (frames: number) => {
    const sequence = [];
    for (let i = 0; i < frames; i++) {
        const lm: any = { landmarks: [] };
        for (let j = 0; j < 33; j++) lm.landmarks.push({ x: 0, y: 0, visibility: 1 });
        // Both legs high
        lm.landmarks[27].y = 0.4;
        lm.landmarks[28].y = 0.4;
        sequence.push(lm);
    }
    return sequence;
};

const runTest = () => {
    const engine = new ElitePhysicsEngine();

    // Simulate 3 Steps: Left (Short) -> Right (Long) -> Left (Short)
    // Left GCT = 10 frames, Right GCT = 14 frames
    // 30fps assumed (timestamp needs to increase by ~33ms)

    const history: any[] = [];
    let time = 0;
    const pushFrames = (frames: any[]) => {
        frames.forEach(f => {
            f.timestamp = time;
            history.push(f);
            time += 33.33;
        });
    };

    console.log("Generating Asymmetric Mock Run...");
    pushFrames(generateFlight(5));
    pushFrames(generateStep('Left', 6)); // Short Contact (~0.2s)
    pushFrames(generateFlight(5));
    pushFrames(generateStep('Right', 9)); // Long Contact (~0.3s) -> Asymmetry expected!
    pushFrames(generateFlight(5));
    pushFrames(generateStep('Left', 6)); // Short Again
    pushFrames(generateFlight(5));

    console.log(`Total Frames: ${history.length}`);

    const result = engine.detectSprintPhases(history);

    console.log("\n--- ANALYSIS RESULT ---");
    console.log("Real GCT (Avg):", result.stats.realGCT.toFixed(3), "s");
    console.log("Step Count:", result.stats.stepCount);
    console.log("Asymmetry:", result.stats.asymmetry, "%");
    console.log("Stiffness Score:", result.stats.legStiffness);

    // Validation
    if (result.stats.stepCount === 3) console.log("✅ Steps Detected Correctly");
    else console.log("❌ Step Count Mismatch");

    if (result.stats.asymmetry > 10) console.log("✅ Asymmetry Detected Correctly (>10%)");
    else console.log("❌ Asymmetry Failed");
};

runTest();
