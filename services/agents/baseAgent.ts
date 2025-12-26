import { GoogleGenerativeAI } from "@google/generative-ai";
import { getEnv } from "../../utils/env";

export class BaseAgent {
    protected model: any;
    protected modelName: string;

    constructor(role: 'Pro' | 'Flash' = 'Flash') {
        const apiKey = getEnv("GEMINI_API_KEY") || getEnv("VITE_GEMINI_API_KEY") || getEnv("API_KEY");
        if (!apiKey) {
            console.error("❌ CRITICAL: BaseAgent initialized without API Key!");
            throw new Error("Gemini API Key not found");
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        this.modelName = role === 'Pro' ? "gemini-1.5-pro-002" : "gemini-1.5-flash-002";
        this.model = genAI.getGenerativeModel({ model: this.modelName });
    }

    protected async callLLM(systemInstruction: string, prompt: string, jsonMode: boolean = true): Promise<any> {
        try {
            const generationConfig = {
                temperature: 0.2, // Scientific precision = low temp
                responseMimeType: jsonMode ? "application/json" : "text/plain",
            };

            // Gemini 1.5 supports system instructions at model level, or we can prepend.
            // Using prepend for flexibility in this base class wrapper if SDK version varies.
            // But SDK 0.24 supports systemInstruction param.

            const result = await this.model.generateContent({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig,
                systemInstruction: { role: "system", parts: [{ text: systemInstruction }] } // Enforce persona
            });

            const text = result.response.text();
            if (jsonMode) {
                return JSON.parse(text);
            }
            return text;
        } catch (error) {
            console.error(`Agent Error (${this.modelName}):`, error);
            return null;
        }
    }
}
