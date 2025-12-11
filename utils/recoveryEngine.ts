export const calculateRecovery = (sessionIntensity: string, duration: number, bodyWeight: number, rpe: number) => {
    // 1. Determine Session Type Impact
    let type: 'Neural' | 'Metabolic' | 'Structural' = 'Metabolic';
    
    // Logic: High intensity + short duration = Neural. Long or hard = Structural/Metabolic.
    if (sessionIntensity === 'Max' && duration < 45) {
        type = 'Neural'; // Speed/Power work
    } else if (rpe > 8) {
        type = 'Structural'; // Heavy damage (DOMS likely)
    }

    // 2. Nutrition Math (Precision Nutrition Logic)
    let carbsFactor = 0.8; // Default g/kg
    if (type === 'Metabolic' && duration > 60) carbsFactor = 1.2; // Glycogen depletion
    if (type === 'Neural') carbsFactor = 0.5; // Less glycogen, more CNS focus

    const carbs = Math.round(bodyWeight * carbsFactor);
    const protein = 30; // Standard optimal protein bolus for synthesis
    const fluids = Math.round(duration * 12); // Approx 12ml per min of sweat loss

    // 3. Protocols (Recovery Science)
    const protocols: string[] = [];
    protocols.push("Hidratación con Electrolitos (Sodio/Potasio)");
    
    if (type === 'Neural') {
        protocols.push("Ambiente oscuro/silencio (Restauración del Sistema Nervioso Central)");
        protocols.push("Magnesio (400mg) o Glicinato pre-sueño");
        protocols.push("Evitar pantallas/luz azul 1h antes de dormir");
    } else if (type === 'Structural') {
        protocols.push("Proteína de asimilación lenta (Caseína) antes de dormir");
        protocols.push("Sueño extendido (+30-60min) para reparación de tejidos");
        protocols.push("Compresión o elevación de piernas si hay inflamación");
    } else { // Metabolic (Lactate/Volume)
        protocols.push("Masaje de descarga, Foam Roller o Pistola de percusión");
        protocols.push("Baño de contraste (Frio/Calor) o Inmersión en agua fría (10min @ 12°C)");
        protocols.push("Comida rica en antioxidantes (Frutos rojos, Vitamina C)");
    }

    return {
        sessionType: type,
        nutrition: {
            carbs: `${carbs}g`,
            protein: `${protein}g`,
            hydration: `${fluids}ml`,
            notes: type === 'Neural' 
                ? "Prioriza calidad de nutrientes y grasas saludables. No necesitas carga masiva de carbos." 
                : "Ventana de oportunidad abierta. Recarga glucógeno rápido (IG Alto) en los próximos 45min."
        },
        protocols
    };
};