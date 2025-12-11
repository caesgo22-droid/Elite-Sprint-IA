export const calculateRecovery = (sessionIntensity: string, duration: number, bodyWeight: number, rpe: number) => {
    let type: 'Neural' | 'Metabolic' | 'Structural' = 'Metabolic';
    if (sessionIntensity === 'Max' && duration < 45) type = 'Neural'; 
    if (rpe > 8) type = 'Structural'; 

    let carbsFactor = 0.8; 
    if (type === 'Metabolic' && duration > 60) carbsFactor = 1.2;
    if (type === 'Neural') carbsFactor = 0.5;

    const carbs = Math.round(bodyWeight * carbsFactor);
    const protein = 30; 
    const fluids = Math.round(duration * 12); 

    const protocols: string[] = [];
    protocols.push("Hidratación con Electrolitos");
    
    if (type === 'Neural') {
        protocols.push("Ambiente oscuro/silencio (Restauración CNS)");
        protocols.push("Magnesio (400mg) pre-sueño");
    } else if (type === 'Structural') {
        protocols.push("Proteína de asimilación lenta (Caseína)");
        protocols.push("Sueño extendido (+30min)");
    } else { 
        protocols.push("Masaje de descarga");
        protocols.push("Baño de contraste");
    }

    return {
        sessionType: type,
        nutrition: {
            carbs: `${carbs}g`,
            protein: `${protein}g`,
            hydration: `${fluids}ml`,
            notes: type === 'Neural' ? "Prioriza calidad." : "Recarga glucógeno rápido."
        },
        protocols
    };
};