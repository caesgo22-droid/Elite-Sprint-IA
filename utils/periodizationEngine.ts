import { Competition } from "../types";

export interface PeriodizationPhase {
    name: 'General Prep' | 'Specific Prep' | 'Pre-Competition' | 'Competition' | 'Transition';
    focus: string;
    intensity: string; // "Low", "Moderate", "High", "Peak"
    volume: string; // "High", "Moderate", "Low", "Taper"
    weeksToRace: number;
    primaryEnergySystem: string;
}

export class PeriodizationEngine {
    /**
     * Calculates the current macrocycle phase based on the NEXT Priority 'A' race.
     */
    public static calculateCurrentPhase(competitions: Competition[], currentDate: Date = new Date()): PeriodizationPhase {
        // 1. Find the Most Recent Past Race (for Transition check)
        const pastComps = competitions
            .filter(c => new Date(c.date).getTime() < currentDate.getTime())
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const lastRace = pastComps[0];
        const weeksSinceRace = lastRace ? this.getWeeksDiff(new Date(lastRace.date), currentDate) : 999;

        // 2. Find the next "A" Race
        const nextRace = this.findNextPriorityRace(competitions, currentDate);

        // TRANSITION Logic: If a race was within the last 1-2 weeks, or no races scheduled
        if (weeksSinceRace <= 2 || !nextRace) {
            return {
                name: 'Transition',
                focus: "Active Recovery, Regeneration, Cross Training",
                intensity: "Low",
                volume: "Low",
                weeksToRace: nextRace ? this.getWeeksDiff(currentDate, new Date(nextRace.date)) : 99,
                primaryEnergySystem: "Aerobic"
            };
        }

        const weeksToRace = this.getWeeksDiff(currentDate, new Date(nextRace.date));

        // 3. Logic Cascade
        if (weeksToRace <= 2) {
            return {
                name: 'Competition',
                focus: "Peaking, Neural Activation, Race Modeling",
                intensity: "Peak (Max)",
                volume: "Taper (Very Low)",
                weeksToRace,
                primaryEnergySystem: "Anaerobic Alactic (Power)"
            };
        } else if (weeksToRace <= 6) {
            return {
                name: 'Pre-Competition',
                focus: "Speed Endurance, Lactic Tolerance, Race Specifics",
                intensity: "High",
                volume: "Low-Moderate",
                weeksToRace,
                primaryEnergySystem: "Anaerobic Lactic (Glycolytic)"
            };
        } else if (weeksToRace <= 12) {
            return {
                name: 'Specific Prep',
                focus: "Max Velocity, Acceleration, Special Endurance",
                intensity: "High",
                volume: "Moderate",
                weeksToRace,
                primaryEnergySystem: "Anaerobic Alactic / Mix"
            };
        } else {
            // General Prep for everything else up to 24 weeks or beyond
            return {
                name: 'General Prep',
                focus: "Base Building, General Capacity, Strength",
                intensity: "Moderate",
                volume: "High",
                weeksToRace,
                primaryEnergySystem: "Aerobic / Extensive Tempo"
            };
        }
    }

    private static findNextPriorityRace(competitions: Competition[], now: Date): Competition | null {
        // Filter future comps
        const futureComps = competitions
            .filter(c => new Date(c.date).getTime() >= now.getTime())
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        if (futureComps.length === 0) return null;

        // Find first 'A' priority, else take the soonest one
        const priorityA = futureComps.find(c => c.priority === 'A');
        return priorityA || futureComps[0];
    }

    private static getWeeksDiff(d1: Date, d2: Date): number {
        return Math.ceil((d2.getTime() - d1.getTime()) / (7 * 24 * 60 * 60 * 1000));
    }
}
