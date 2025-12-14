
import { Drill, PhaseTemplate } from "../types";

export const DRILL_DATABASE: Drill[] = [
    // --- ACCELERATION (0-30m) ---
    // Focus: Projection, Piston Action, Positive Shin Angle
    { name: "Wall Drills (Posture/Piston)", category: "Accel", intensity: 3, videoKeyword: "sprint wall drill posture" },
    { name: "Heavy Sled Pulls (50-75% BW)", category: "Accel", intensity: 9, videoKeyword: "heavy sled sprint" },
    { name: "Hill Sprints (Steep/Short)", category: "Accel", intensity: 10, videoKeyword: "hill sprints technique" },
    { name: "Block Starts (Exit Only 10m)", category: "Accel", intensity: 10, videoKeyword: "block start mechanics" },
    { name: "Bullet Belt Resisted Runs", category: "Accel", intensity: 8, videoKeyword: "resisted sprint training" },
    { name: "Boom-Booms (Switch Drill)", category: "Accel", intensity: 6, videoKeyword: "sprint switch drills" },
    { name: "Medicine Ball Push Starts", category: "Accel", intensity: 8, videoKeyword: "medball sprint start" },

    // --- MAX VELOCITY (Top Speed) ---
    // Focus: Vertical Force, Stiffness, Frontside Mechanics
    { name: "Wicket Runs (Vallas de Ritmo)", category: "MaxV", intensity: 7, videoKeyword: "wicket drill sprint" },
    { name: "Flying 10m (30m Build-up)", category: "MaxV", intensity: 10, videoKeyword: "flying 10m sprint" },
    { name: "Flying 20m (30m Build-up)", category: "MaxV", intensity: 10, videoKeyword: "flying 20m sprint" },
    { name: "Straight Leg Bounds (Tijeras)", category: "MaxV", intensity: 8, videoKeyword: "straight leg bounds" },
    { name: "Dribbles (Ankling/Calf)", category: "MaxV", intensity: 4, videoKeyword: "sprint dribble drills" },
    { name: "A-Skip (High Knee)", category: "MaxV", intensity: 5, videoKeyword: "a skip drill" },
    { name: "B-Skip (Paw Back)", category: "MaxV", intensity: 5, videoKeyword: "b skip drill" },
    { name: "Frans Bosch Hip Lock Runs", category: "MaxV", intensity: 7, videoKeyword: "frans bosch hip lock" },

    // --- SPEED ENDURANCE (Lactic Capacity) ---
    // Focus: Technique under fatigue, pH buffering
    { name: "Split 300s (200m + 100m, 60s Rest)", category: "MaxV", intensity: 9, videoKeyword: "400m split runs" },
    { name: "150m Ins & Outs (Float-Sprint-Float)", category: "MaxV", intensity: 8, videoKeyword: "ins and outs sprint" },
    { name: "Glycolytic 250m @95%", category: "MaxV", intensity: 10, videoKeyword: "250m sprint" },
    { name: "Broken 400s (2x200m, 30s rest)", category: "MaxV", intensity: 9, videoKeyword: "broken 400m drill" },
    { name: "120m Progressive (Build-Hold-Relax)", category: "MaxV", intensity: 8, videoKeyword: "progressive sprints" },

    // --- PLYOMETRICS & STIFFNESS ---
    // Focus: Ground Contact Time (GCT) reduction, Reactive Strength Index (RSI)
    { name: "Depth Jumps (alturas variables)", category: "Plyo", intensity: 9, videoKeyword: "depth jump plyometric" },
    { name: "Continuous Hurdle Hops", category: "Plyo", intensity: 8, videoKeyword: "hurdle hops plyo" },
    { name: "Single Leg Speed Hops", category: "Plyo", intensity: 7, videoKeyword: "single leg speed hops" },
    { name: "Pogos (Ankle Stiffness)", category: "Plyo", intensity: 5, videoKeyword: "pogo jumps" },
    { name: "Drop Jumps (Reactive)", category: "Plyo", intensity: 9, videoKeyword: "drop jump rsi" },
    { name: "Bounding (Distance)", category: "Plyo", intensity: 8, videoKeyword: "bounding track drills" },

    // --- STRENGTH & SPECIFIC POWER ---
    // Focus: Force production, core stability
    { name: "Clean Pulls (Olympic)", category: "Strength", intensity: 9, videoKeyword: "clean pulls technique" },
    { name: "Nordic Hamstring Curls", category: "Strength", intensity: 7, videoKeyword: "nordic curl form" },
    { name: "Step-Ups (Explosive)", category: "Strength", intensity: 7, videoKeyword: "explosive step ups" },
    { name: "Quarter Squats (Max Force)", category: "Strength", intensity: 9, videoKeyword: "quarter squat sprint" },
    { name: "Bulgarian Split Squats", category: "Strength", intensity: 8, videoKeyword: "bulgarian split squat" },

    // --- REGENERATION & TEMPO ---
    // Focus: Blood flow, Aerobic Capacity, Parasympathetic activation
    { name: "Extensive Tempo 100m @65-70%", category: "Recovery", intensity: 5, videoKeyword: "tempo run technique" },
    { name: "GS Circuit (General Strength)", category: "Strength", intensity: 4, videoKeyword: "general strength circuit runner" },
    { name: "Pool Recovery Session", category: "Recovery", intensity: 2, videoKeyword: "pool running recovery" },
    { name: "Medball Throws Series", category: "Strength", intensity: 5, videoKeyword: "medball throws explosive" },
    { name: "Mobility Flow (Hips/Spine)", category: "Recovery", intensity: 2, videoKeyword: "hip mobility track" }
];

export const PHASE_TEMPLATES: { [key: string]: PhaseTemplate } = {
    "General Prep": {
        name: "GPP (Preparación General)",
        focusPoints: ["Capacidad de Trabajo", "Fuerza Estructural", "Mecánica Básica"],
        weeklyStructure: {
            "Mon": "Accel (Short Hills) + Strength (Hypertrophy)",
            "Tue": "Extensive Tempo (Aerobic Capacity)",
            "Wed": "Recovery / Mobility / Pool",
            "Thu": "Accel Mechanics (Drills) + Plyo (Volume)",
            "Fri": "Circuits / General Strength",
            "Sat": "Active Recovery (Hike/Bike)",
            "Sun": "Rest (Total)"
        }
    },
    "Specific Prep": {
        name: "SPP (Preparación Específica)",
        focusPoints: ["Desarrollo de Potencia", "Max Velocity (Early)", "Resistencia Específica"],
        weeklyStructure: {
            "Mon": "Accel (Sleds 0-30m) + Power Clean / Squat",
            "Tue": "Intensive Tempo (80-85% smooth)",
            "Wed": "Pool / Massage / Regeneration",
            "Thu": "Max Velocity (Wickets/Flys)",
            "Fri": "Special Endurance I (150-300m 90%)",
            "Sat": "Hills or Plyos (High Intensity)",
            "Sun": "Rest"
        }
    },
    "Pre-Comp": {
        name: "Pre-Competición",
        focusPoints: ["Race Modeling", "Neural Sharpness", "Volume Reduction"],
        weeklyStructure: {
            "Mon": "Accel (Blocks 30-50m) + Neural Strength (Low Reps)",
            "Tue": "Tempo (Low Vol) or Technical Runs",
            "Wed": "Rest / Physio",
            "Thu": "Max Velocity (Flys Full Rec - Low Reps)",
            "Fri": "Speed Endurance II (Lactic Tolerance)",
            "Sat": "Potentiation / Shakeout",
            "Sun": "Rest"
        }
    },
    "Competition": {
        name: "Competición (Tapering)",
        focusPoints: ["Peak Performance", "Dissipation of Fatigue", "Neural Tone"],
        weeklyStructure: {
            "Mon": "Activation (Blocks 10-20m) + Potentiation Lift",
            "Tue": "Recovery (Pool/Walk)",
            "Wed": "Potentiation (if race Sat) or Rest",
            "Thu": "Rest / Mobility",
            "Fri": "Pre-Meet Shakeout (Reactiva)",
            "Sat": "** RACE DAY **",
            "Sun": "Rest"
        }
    }
};

export const getStructureForPhase = (phase: string) => {
    return PHASE_TEMPLATES[phase] || PHASE_TEMPLATES["General Prep"];
};
