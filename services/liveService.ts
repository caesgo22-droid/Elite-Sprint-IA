
import { GoogleGenAI, LiveServerMessage, Modality, Type } from "@google/genai";
import { UserProfile, TrainingPlan, LoadStats } from "../types";

// Auxiliares para codificación/decodificación de audio PCM
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

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
    onAudioLevel: (level: number, isModel: boolean) => void,
    onStatusChange: (status: string) => void,
    onToolCall: (name: string, args: any) => Promise<any>
  ) {
    onStatusChange("Iniciando conexión...");
    
    // Crear el dossier del atleta para el "cerebro" de la IA
    const athleteDossier = `
      ATLETA: ${profile.name}.
      NIVEL: ${profile.experienceLevel}.
      PBs: 100m: ${profile.pbs['100m']?.time || 'N/A'}, 200m: ${profile.pbs['200m']?.time || 'N/A'}.
      PLAN ACTUAL: ${currentPlan?.weeklyGoal || 'Sin plan activo'}.
      FASE: ${currentPlan?.phase || 'Desconocida'}.
      ESTADO CARGA (ACWR): ${acwr?.ratio || 'Normal'}.
      LESIONES: ${profile.injuries.length > 0 ? profile.injuries.map(i => i.location).join(', ') : 'Ninguna'}.
    `;

    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    
    this.session = await this.ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } // Voz dinámica y fluida
        },
        systemInstruction: `Eres el Elite Sprint Coach, un asistente de voz de clase mundial. 
        Hablas de forma breve, motivadora y técnica. Tu objetivo es guiar al atleta en su sesión.
        
        CONTEXTO DEL ATLETA:
        ${athleteDossier}
        
        REGLAS:
        - Si el atleta reporta dolor, sugiérele bajar la carga mediante la herramienta 'modify_session'.
        - No uses listas largas, sé conversacional.`,
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
    this.sources.forEach(s => { try { s.stop(); } catch(e) {} });
    this.sources.clear();
    this.nextStartTime = 0;
  }

  public stop() {
    this.stopAllAudio();
    if (this.activeStream) this.activeStream.getTracks().forEach(t => t.stop());
    if (this.session) this.session.close();
  }
}
