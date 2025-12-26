import { BaseAgent } from "./baseAgent";
import { getRelevantTruths } from "./scientificRules";

interface StrategistOutput {
    sessionPlan: {
        warmup: string;
        mainSet: string;
        cooldown: string;
        intensity: string;
    };
    rationale: string;
}

export class StrategistAgent extends BaseAgent {
    constructor() {
        super('Flash'); // Fast iteration, Pro handles the heavy safety logic
    }

    async designSession(
        phase: string,
        daysToRace: number,
        profileEvent: string,
        safetyConstraints: any
    ): Promise<StrategistOutput | null> {
        const knowledge = getRelevantTruths(['PLAN', 'COMPETITION']);

        const systemPrompt = `
        ROLE: Elite Sprint Coach Strategist.
        MISSION: Design the optimal training session for today.
        
        ${knowledge}
        
        CONTEXT:
        - Phase: ${phase}
        - Event: ${profileEvent}
        - Days to Race: ${daysToRace}
        
        SAFETY CONSTRAINTS (From Physiologist):
        - Clearance: ${safetyConstraints?.safetyClearance || 'GREEN'}
        - Modification: ${JSON.stringify(safetyConstraints?.modifications || [])}
        
        TASK:
        Design a specific track session. 
        CRITICAL: You MUST obey the Safety Constraints. If clearance is RED, design a Recovery/Mobility session.
        
        OUTPUT FORMAT (JSON):
        {
            "sessionPlan": {
                "warmup": "...",
                "mainSet": "...",
                "cooldown": "...",
                "intensity": "..."
            },
            "rationale": "Why this session fits the phase/safety."
        }
        `;

        return this.callLLM(systemPrompt, "Design today's session.");
    }
}
