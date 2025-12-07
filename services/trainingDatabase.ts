import { Drill, PhaseTemplate } from "../types";

export const DRILL_DATABASE: Drill[] = [
    // Acceleration
    { name: "Wall Drills (Posture)", category: "Accel", intensity: 3, videoKeyword: "wall drill sprint" },
    { name: "A-Skip", category: "Accel", intensity: 4, videoKeyword: "a skip drill" },
    { name: "Sled Pulls (Heavy 50% BW)", category: "Accel", intensity: 9, videoKeyword: "heavy sled pull sprint" },
    { name: "Block Starts (10-30m)", category: "Accel", intensity: 10, videoKeyword: "block start sprint" },
    
    // Max Velocity
    { name: "Flying 10m (30m buildup)", category: "MaxV", intensity: 10, videoKeyword: "flying 10m sprint" },
    { name: "Flying 30m (30m buildup)", category: "MaxV", intensity: 10, videoKeyword: "flying 30m sprint" },
    { name: "Wicket Runs (Valla)", category: "MaxV", intensity: 7, videoKeyword: "wicket drill sprint" },
    { name: "Dribbles / Ankling", category: "MaxV", intensity: 3, videoKeyword: "ankling drill" },

    // Lactic Tolerance / Special Endurance (400m Specific)
    { name: "Split 400s (300m + 100m, Rec: 1min)", category: "MaxV", intensity: 9, videoKeyword: "400m training drills" },
    { name: "150m Ins & Outs", category: "MaxV", intensity: 8, videoKeyword: "ins and outs sprint" },
    { name: "Lactic Acid 300m @95%", category: "MaxV", intensity: 10, videoKeyword: "300m sprint technique" },

    // Plyometrics
    { name: "Depth Jumps", category: "Plyo", intensity: 9, videoKeyword: "depth jump plyometric" },
    { name: "Pogo Hops", category: "Plyo", intensity: 5, videoKeyword: "pogo hops" },
    { name: "Bounding", category: "Plyo", intensity: 8, videoKeyword: "bounding drill" },

    // Tempo/Recovery
    { name: "Extensive Tempo 100m @70%", category: "Recovery", intensity: 5, videoKeyword: "tempo run technique" },
    { name: "Medball Throws", category: "Recovery", intensity: 4, videoKeyword: "medball throws" }
];

export const PHASE_TEMPLATES: { [key: string]: PhaseTemplate } = {
    "General Prep": {
        name: "Preparación General (GPP)",
        focusPoints: ["Capacidad Aeróbica", "Fuerza General", "Técnica Básica"],
        weeklyStructure: {
            "Mon": "Accel (Short Hills)",
            "Tue": "Extensive Tempo",
            "Thu": "Strength/Plyo",
            "Fri": "Circuits/Tempo"
        }
    },
    "Specific Prep": {
        name: "Preparación Específica (SPP)",
        focusPoints: ["Potencia Aláctica", "Max Velocity Intro", "Resistencia a la Velocidad"],
        weeklyStructure: {
            "Mon": "Accel (Sleds)",
            "Tue": "Intensive Tempo (85%)",
            "Thu": "Max Velocity (Wickets)",
            "Fri": "Special Endurance I"
        }
    },
    "Pre-Comp": {
        name: "Pre-Competición",
        focusPoints: ["Max Velocity Maintenance", "Race Modelling", "Neural Activation"],
        weeklyStructure: {
            "Mon": "Accel (Blocks 30m)",
            "Tue": "Recovery",
            "Thu": "Max Velocity (Flys Full Rec)",
            "Fri": "Speed Endurance / Modeling"
        }
    },
    "Competition": {
        name: "Competición (Peaking)",
        focusPoints: ["Peak Performance", "Rest", "Activation"],
        weeklyStructure: {
            "Mon": "Activation (Blocks 20m)",
            "Tue": "Active Recovery",
            "Thu": "Potentiation (Short Flys)",
            "Fri": "REST / RACE DAY"
        }
    }
};

export const getStructureForPhase = (phase: string) => {
    return PHASE_TEMPLATES[phase] || PHASE_TEMPLATES["General Prep"];
};