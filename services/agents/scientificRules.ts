export const SCIENCE_GOLDEN_TRUTHS = {
    ACWR: {
        DANGER_ZONE: 1.5,
        OPTIMAL_ZONE_MIN: 0.8,
        OPTIMAL_ZONE_MAX: 1.3,
        SOURCE: "Gabbett, T. J. (2016). The training—injury prevention paradox: should athletes be training smarter and harder?",
        RULE: "IF ACWR > 1.5 THEN FORCE_REDUCTION_VOLUME"
    },
    RECOVERY: {
        HRV_DROP_THRESHOLD: 0.10, // 10% drop
        SLEEP_MIN_HOURS: 7,
        SOURCE: "Plews et al. (2013). Heart rate variability in elite triathletes/sprinters.",
        RULE: "IF HRV_DROP > 10% OR SLEEP < 6h THEN REDUCE_INTENSITY"
    },
    TAPERING: {
        DAYS_BEFORE_COMPETITION: 14,
        VOLUME_REDUCTION: 0.40, // 40-60% reduction
        INTENSITY_MAINTENANCE: true,
        SOURCE: "Mujika, I., & Padilla, S. (2003). Scientific bases for precompetition tapering strategies.",
        RULE: "IF DAYS_TO_RACE < 14 THEN MAINTAIN_INTENSITY AND REDUCE_VOLUME"
    },
    BIOMECHANICS: {
        GCT_ELITE_MAX: 0.10, // seconds
        ASYMMETRY_THRESHOLD: 0.05, // 5%
        SOURCE: "Ralph Mann, The Mechanics of Sprinting and Hurdles.",
        RULE: "IF GCT > 0.12s THEN SUGGEST_PLYOMETRICS"
    }
};

export const getRelevantTruths = (contextTags: string[]): string => {
    let context = "### REFERENCE LIBRARY (GOLDEN TRUTH) ###\n";
    if (contextTags.includes('LOAD') || contextTags.includes('INJURY')) {
        context += `- ACWR Limit: ${SCIENCE_GOLDEN_TRUTHS.ACWR.DANGER_ZONE} (Gabbett, 2016). exceed this = injury risk.\n`;
        context += `- Safety Rule: ${SCIENCE_GOLDEN_TRUTHS.ACWR.RULE}\n`;
    }
    if (contextTags.includes('RECOVERY') || contextTags.includes('PLAN')) {
        context += `- Recovery Rule: ${SCIENCE_GOLDEN_TRUTHS.RECOVERY.RULE} (Plews, 2013)\n`;
    }
    if (contextTags.includes('COMPETITION') || contextTags.includes('PLAN')) {
        context += `- Tapering Rule: ${SCIENCE_GOLDEN_TRUTHS.TAPERING.RULE} (Mujika, 2003)\n`;
    }
    context += "### END REFERENCE ###\n";
    return context;
};
