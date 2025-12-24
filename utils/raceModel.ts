
export const PREDICTION_CONSTANTS = {
    // Basic conversion factors for elite sprinters
    // V_max usually occurs around 60-70m
    // Avg Velocity for 100m is roughly 0.82-0.85 of Max Velocity due to acceleration phase.
    ACCEL_FACTOR_100: 0.835,
    ACCEL_FACTOR_200: 0.780, // Lower due to curve and longer duration
    FATIGUE_FACTOR: 0.98, // Multiplier per 10m after peak? Simplified global factor here.
};

export interface RacePrediction {
    event: '100m' | '200m';
    time: string;
    splits?: string[];
    confidence: number; // 0-100%
}

/**
 * Predicts race time based on max velocity and potentially other factors like stiffness/endurance.
 * This is a simplified model: Time = Distance / (MaxVel * AccelFactor)
 * @param maxVelocityMps - Maximum velocity achieved in m/s (e.g. from fly-10 or 30m fly)
 * @param event - '100m' or '200m'
 */
export const predictRaceTime = (maxVelocityMps: number, event: '100m' | '200m'): RacePrediction => {
    if (maxVelocityMps <= 0) return { event, time: '--', confidence: 0 };

    // Safety clamp for unrealistic inputs (Weltklasse vs Amateur)
    // Usain Bolt ~12.2 m/s -> 9.58s
    // Amateur ~7.0 m/s -> 14-15s
    const safeVel = Math.min(Math.max(maxVelocityMps, 4), 13);

    const distance = event === '100m' ? 100 : 200;
    const accelFactor = event === '100m'
        ? PREDICTION_CONSTANTS.ACCEL_FACTOR_100
        : PREDICTION_CONSTANTS.ACCEL_FACTOR_200;

    const avgVelocity = safeVel * accelFactor;

    // Wind/Altitude corrections could go here in future V2

    const projectedTime = distance / avgVelocity;

    return {
        event,
        time: projectedTime.toFixed(2),
        confidence: 85 // Static for now, could adjust based on data consistency
    };
};

/**
 * Estimates V_max required for a target time.
 */
export const calculateRequiredVelocity = (targetTime: number, event: '100m' | '200m'): number => {
    const distance = event === '100m' ? 100 : 200;
    const accelFactor = event === '100m'
        ? PREDICTION_CONSTANTS.ACCEL_FACTOR_100
        : PREDICTION_CONSTANTS.ACCEL_FACTOR_200;

    // AvgVel = Distance / Time
    // MaxVel = AvgVel / AccelFactor
    return (distance / targetTime) / accelFactor;
};
