
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from 'fs';
import path from 'path';

// Manual Env Loader
const loadEnv = () => {
    const paths = ['.env.local', '.env'];
    for (const p of paths) {
        if (fs.existsSync(p)) {
            const content = fs.readFileSync(p, 'utf-8');
            const match = content.match(/GEMINI_API_KEY=(.*)/) || content.match(/VITE_GEMINI_API_KEY=(.*)/);
            if (match && match[1]) {
                return match[1].trim();
            }
        }
    }
    return process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
};

const apiKey = loadEnv();

if (!apiKey) {
    console.error("❌ No API KEY found in .env or .env.local");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function testModel(modelName: string) {
    console.log(`\n--- Testing ${modelName} ---`);
    try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent("Hello, are you online?");
        const response = await result.response;
        console.log(`✅ [SUCCESS] ${modelName}`);
        return true;
    } catch (e: any) {
        console.error(`❌ [FAILED] ${modelName}:`, e.message?.split('[')[0]); // Log simplified error
        return false;
    }
}

async function run() {
    console.log("Checking Gemini Models availability...");

    // List of models to test
    const modelsToTest = [
        "gemini-1.5-flash",
        "gemini-1.5-pro",
        "gemini-2.0-flash-exp",
        "gemini-1.5-pro-latest",
        "gemini-1.5-pro-001",
        "gemini-1.5-pro-002"
    ];

    for (const m of modelsToTest) {
        await testModel(m);
    }
}

run();
