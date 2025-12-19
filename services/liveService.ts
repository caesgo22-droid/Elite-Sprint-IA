import { GoogleGenAI, LiveServerMessage, Modality, Type } from "@google/genai";
import { ContextEngine } from "../utils/ContextEngine";
import { UserProfile, TrainingPlan, LoadStats, BiomechanicalAnalysis } from "../types";
import { encode, decode, decodeAudioData } from "../utils/audioUtils";

// ... (existing helper functions encode/decode/decodeAudioData removed as they are now imported) ...

export class EliteLiveService {
  private ai: GoogleGenAI;
  private audioContext: AudioContext | null = null;
  private nextStartTime = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private activeStream: MediaStream | null = null;
  private session: any = null;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  public async startSession(
    profile: UserProfile,
    currentPlan: TrainingPlan | null,
    acwr: LoadStats | null,
    lastAnalysis: BiomechanicalAnalysis | null,
    planHistory: TrainingPlan[] = [],
    logs: any[] = [],
    onAudioLevel: (level: number, isModel: boolean) => void,
    onStatusChange: (status: string) => void,
    onToolCall: (name: string, args: any) => Promise<any>
  ) {
    onStatusChange("Iniciando conexión...");

    // Generate Omni-Context
    const omniContext = ContextEngine.build(profile, currentPlan, acwr, lastAnalysis, planHistory, logs);
    const systemInstruction = `
      Eres el "Elite Sprint Coach" (Voz Nativa).
      
      ${ContextEngine.generateSystemPrompt(omniContext)}
      
      PERSONALIDAD DE VOZ:
      - Tono: Seguro, energético, profesional.
      - Estilo: Breve (máximo 2-3 frases por turno). Directo al grano.
      - Rol: Eres su entrenador personal en la pista.

      HERRAMIENTAS DISPONIBLES:
      - Puedes modificar la sesión actual si el atleta reporta fatiga o dolor.
    `;

    console.log("[VoiceLive] Connecting with Context:", systemInstruction); // VERIFICATION LOG

    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

    this.session = await this.ai.live.connect({
      model: 'gemini-2.0-flash-exp', // Updated to latest available experimental model for live
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } }
        },
        systemInstruction: systemInstruction,
        tools: [{
          functionDeclarations: [{
            name: "modify_session",
            description: "Ajusta el enfoque o la intensidad de la sesión del atleta para hoy.",
            parameters: {
              type: Type.OBJECT,
              properties: {
                newFocus: { type: Type.STRING, description: "Nuevo enfoque (ej: Recuperación)" },
                newIntensity: { type: Type.STRING, enum: ["Low", "Medium", "High", "Max"] }
              },
              required: ["newFocus", "newIntensity"]
            }
          }]
        }]
      },
      callbacks: {
        onopen: async () => {
          onStatusChange("Conectado. Habla ahora.");
          await this.setupMicrophone(onAudioLevel);
        },
        onmessage: async (message: LiveServerMessage) => {
          // Procesar audio del modelo
          const audioBase64 = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          if (audioBase64) {
            this.playAudioChunk(audioBase64, onAudioLevel);
          }

          // Manejar interrupciones
          if (message.serverContent?.interrupted) {
            this.stopAllAudio();
          }

          // Ejecutar herramientas (El cerebro actuando)
          if (message.toolCall) {
            for (const fc of message.toolCall.functionCalls) {
              const result = await onToolCall(fc.name, fc.args);
              this.session.sendToolResponse({
                functionResponses: [{ id: fc.id, name: fc.name, response: { result } }]
              });
            }
          }
        },
        onclose: () => onStatusChange("Sesión cerrada."),
        onerror: (e) => {
          console.error("Live API Error:", e);
          onStatusChange("Error de conexión.");
        }
      }
    });
  }

  private async setupMicrophone(onLevel: (l: number, m: boolean) => void) {
    this.activeStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const inputCtx = new AudioContext({ sampleRate: 16000 });
    const source = inputCtx.createMediaStreamSource(this.activeStream);
    const processor = inputCtx.createScriptProcessor(4096, 1, 1);

    processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);

      // Calcular nivel para visualización
      let sum = 0;
      for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
      onLevel(Math.sqrt(sum / inputData.length), false);

      // Enviar a la API
      const pcm16 = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        pcm16[i] = inputData[i] * 32767;
      }
      const base64 = encode(new Uint8Array(pcm16.buffer));
      this.session.sendRealtimeInput({
        media: { data: base64, mimeType: "audio/pcm;rate=16000" }
      });
    };

    source.connect(processor);
    processor.connect(inputCtx.destination);
  }

  private async playAudioChunk(base64: string, onLevel: (l: number, m: boolean) => void) {
    if (!this.audioContext) return;

    this.nextStartTime = Math.max(this.nextStartTime, this.audioContext.currentTime);
    const buffer = await decodeAudioData(decode(base64), this.audioContext, 24000, 1);

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);

    source.onended = () => {
      this.sources.delete(source);
      if (this.sources.size === 0) onLevel(0, true);
    };

    onLevel(0.5, true); // Nivel simulado de habla de la IA
    source.start(this.nextStartTime);
    this.nextStartTime += buffer.duration;
    this.sources.add(source);
  }

  private stopAllAudio() {
    this.sources.forEach(s => { try { s.stop(); } catch (e) { } });
    this.sources.clear();
    this.nextStartTime = 0;
  }

  public stop() {
    this.stopAllAudio();
    if (this.activeStream) this.activeStream.getTracks().forEach(t => t.stop());
    if (this.session) this.session.close();
  }
}
