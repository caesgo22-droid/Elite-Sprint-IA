import { BaseAgent } from "./baseAgent";
import { getRelevantTruths } from "./scientificRules";

interface PhysiologistOutput {
    safetyClearance: 'GREEN' | 'YELLOW' | 'RED';
    reasoning: string;
    maxRecommendedVolume?: number; // relative 0-1.0
    modifications: string[];
}

export class PhysiologistAgent extends BaseAgent {
    constructor() {
        super('Pro'); // Needs high reasoning for safety
    }

    async analyzeRecovery(acwr: number, hrvStatus: string, sleepHours: number, painLevel: number): Promise<PhysiologistOutput | null> {
        const knowledge = getRelevantTruths(['LOAD', 'RECOVERY', 'INJURY']);

        const systemPrompt = `
        ROLE: Elite Sports Physiologist (PhD).
        MISSION: Protect the athlete from injury and overtraining.
        
        ${knowledge}
        
        INPUT DATA:
        - ACWR: ${acwr}
        - HRV Status: ${hrvStatus}
        - Sleep: ${sleepHours}h
        - Pain Level: ${painLevel}/10
        
        TASK:
        Evaluate injury risk. If any Golden Truth rule is violated, you MUST issue a RED or YELLOW clearance.
        - SAFETY RULE: IF Pain Level > 3 THEN Status = "RED" (Stop/Active Recovery).
        - SAFETY RULE: IF ACWR > 1.5 THEN Status = "RED" or "YELLOW" (Significant reduction).
        
        OUTPUT FORMAT (JSON):
        {
            "safetyClearance": "GREEN" | "YELLOW" | "RED",
            "reasoning": "Scientific explanation citing the rules.",
            "maxRecommendedVolume": 0.0 to 1.0 (multiplier),
            "modifications": ["List of specific actions"]
        }
        `;

        return this.callLLM(systemPrompt, `Analyze current athlete state. Pain Level is ${painLevel}.`);
    }
}
