export interface RecoveryProtocol {
    id: string;
    name: string;
    description: string;
    modalities: string[]; // e.g. ["Ice Bath", "Compression"]
    durationMin: number;
    contraindications: string[];
}

export const RECOVERY_DATABASE: Record<string, RecoveryProtocol> = {
    // ----------------------------------------------------
    // NEURAL / CNS RECOVERY (High Intensity / Velocity)
    // ----------------------------------------------------
    "neural_reset": {
        id: "neural_reset",
        name: "Neural Reset Protocol",
        description: "Focus on parasympathetic activation after high CNS stress (Max Velo/Plyos).",
        modalities: [
            "Dark Room Breathing (4-7-8 technique)",
            "Magnesium Supplementation",
            "Binaural Beats (Theta Waves)"
        ],
        durationMin: 20,
        contraindications: []
    },

    // ----------------------------------------------------
    // METABOLIC FLUSH (Lactate / Volume)
    // ----------------------------------------------------
    "metabolic_flush": {
        id: "metabolic_flush",
        name: "Metabolic Flush",
        description: "Active recovery to clear metabolites after high volume/lactic work.",
        modalities: [
            "Stationary Bike (Zone 1 - 90rpm)",
            "Contrast Hydrotherapy (1min Hot / 1min Cold x 5)",
            "Legs Up The Wall (10 min)"
        ],
        durationMin: 30,
        contraindications: ["Acute Soft Tissue Injury (Heat phase)"]
    },

    // ----------------------------------------------------
    // STRUCTURAL / TISSUE REPAIR (Soreness / Impact)
    // ----------------------------------------------------
    "soft_tissue_care": {
        id: "soft_tissue_care",
        name: "Soft Tissue Maintenance",
        description: "Targeted at reducing localized soreness and fascial tension.",
        modalities: [
            "Foam Rolling (Glutes/Calves/Quads)",
            "Percussion Therapy (Theragun) - Avoid bone",
            "Epsom Salt Bath"
        ],
        durationMin: 25,
        contraindications: ["Acute Tear/Strain", "Open Wounds"]
    },

    // ----------------------------------------------------
    // INJURY SPECIFIC ACUTE
    // ----------------------------------------------------
    "acute_hamstring": {
        id: "acute_hamstring",
        name: "Hamstring Guarding",
        description: "Immediate protocol for hamstring tightness/twinge.",
        modalities: [
            "Ice Application (15 min on / 45 off)",
            "Compression Garment",
            "Avoid Stretching (Do not stretch an irritated nerve/muscle)"
        ],
        durationMin: 15,
        contraindications: ["Heat", "Aggressive Massage"]
    },

    "shin_splint_relief": {
        id: "shin_splint_relief",
        name: "Tibial Stress Relief",
        description: "For medial tibial stress syndrome (Shin Splints).",
        modalities: [
            "Ice Massage directly on tibia (5-7 min)",
            "Tibialogen (Tibialis anterior scraping)",
            "Calf release"
        ],
        durationMin: 15,
        contraindications: []
    }
};

export const getProtocolForState = (fatigue: number, acwr: number, sorenessLocation?: string): RecoveryProtocol[] => {
    const protocols: RecoveryProtocol[] = [];

    // Prioritize Injury/Location first
    if (sorenessLocation) {
        if (sorenessLocation.toLowerCase().includes("hamstring") || sorenessLocation.toLowerCase().includes("isquio")) {
            protocols.push(RECOVERY_DATABASE["acute_hamstring"]);
        }
        if (sorenessLocation.toLowerCase().includes("tibia") || sorenessLocation.toLowerCase().includes("shin")) {
            protocols.push(RECOVERY_DATABASE["shin_splint_relief"]);
        }
    }

    // High Load Logic
    if (acwr > 1.3 || fatigue > 7) {
        protocols.push(RECOVERY_DATABASE["neural_reset"]);
    } else if (fatigue > 5) {
        protocols.push(RECOVERY_DATABASE["metabolic_flush"]);
    } else {
        // Maintenance
        protocols.push(RECOVERY_DATABASE["soft_tissue_care"]);
    }

    return protocols;
};
