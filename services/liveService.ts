
import { GoogleGenAI, LiveServerMessage, Modality, Type, LiveSession } from "@google/genai";
import { UserProfile, TrainingPlan, LoadStats } from "../types";

// --- AUDIO UTILS (Raw PCM Handling) ---

// Convert Float32 (Browser Mic) -> Int16 (Gemini Input)
// Gemini expects 16kHz, 1 channel, PCM 16-bit Little Endian
const floatTo16BitPCM = (float32Array: Float32Array) => {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32Array.length; i++) {
    let s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  return new Uint8Array(buffer);
};

// Base64 Helper
const base64ToUint8Array = (base64: string) => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

export class EliteLiveService {
  private ai: GoogleGenAI;
  private audioContext: AudioContext | null = null;
  private inputSource: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private currentSession: Promise<LiveSession> | null = null;
  
  // Audio Queue Management
  private audioQueue: Float32Array[] = [];
  private isPlaying = false;
  private nextStartTime = 0;
  
  private activeStream: MediaStream | null = null;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  public async startSession(
    profile: UserProfile, 
    currentPlan: TrainingPlan | null, 
    acwr: LoadStats | null,
    onAudioLevel: (level: number) => void,
    onStatusChange: (status: string) => void,
    onToolCall: (name: string, args: any) => Promise<any>
  ) {
    if (this.currentSession) return;

    onStatusChange("Inicializando Satélite...");

    // 1. PREPARE OMNI-AWARE CONTEXT
    const todaysSession = currentPlan?.sessions.find(s => {
        const today = new Date().getDay();
        const map = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
        const dayName = map[today];
        return s.day.includes(dayName) || s.day.includes(dayName.toLowerCase());
    });

    const systemInstruction = `
    ERES: "Elite Coach", la IA de voz de la plataforma Elite Sprint Coach AI.
    MODELO DE INTERACCIÓN: Conversación natural, fluida y realista (NO robótica).
    VOZ: Kore (Autoritario, Calmado, Profesional).
    IDIOMA: Español.

    CONTEXTO DE TIEMPO REAL (OMNI-AWARENESS):
    - Atleta: ${profile.name} (${profile.events.join('/')})
    - Fase: ${currentPlan?.phase || "General"}
    - Objetivo: ${currentPlan?.weeklyGoal || "Base"}
    - ACWR: ${acwr ? acwr.ratio : "N/A"} (${acwr ? acwr.status : "Desconocido"})
    - Hoy (${new Date().toLocaleDateString()}): ${todaysSession ? `${todaysSession.focus} - Intensidad: ${todaysSession.intensity}` : "Descanso o No Planificado"}
    - Detalles Sesión Hoy: ${todaysSession ? `Rutina: ${todaysSession.trackRoutine.join(', ')}. KPI: ${todaysSession.biomechanicsKpi}` : "N/A"}
    - Lesiones: ${profile.injuries.length > 0 ? profile.injuries.map(i => `${i.location} (${i.status})`).join(', ') : "Ninguna"}

    REGLAS DE ORO (COMPORTAMIENTO):
    1. **HABLA COMO UN COACH**: Usa frases cortas. No des discursos. Ve al grano.
    2. **PERSONALIDAD**: Eres exigente pero motivador. Usa jerga técnica: "Whip", "Stiffness", "GCT", "Triple Extensión".
    3. **SEGURIDAD**: Si ACWR > 1.3 o hay dolor, sugiere bajar la intensidad INMEDIATAMENTE usando la herramienta 'modify_session'.
    4. **NO LEAS JSON**: Nunca digas "Tu array de lesiones tiene...". Di "Veo que te molesta el isquio".
    `;

    // 2. DEFINE TOOLS
    const tools = [{
      functionDeclarations: [
        {
          name: "modify_session",
          description: "Modifica la sesión de entrenamiento de hoy en el calendario.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              day: { type: Type.STRING, description: "El día a modificar (ej: 'Hoy', 'Lunes')" },
              newFocus: { type: Type.STRING, description: "El nuevo enfoque principal" },
              intensity: { type: Type.STRING, enum: ["Low", "Medium", "High", "Max"] }
            },
            required: ["day", "newFocus"]
          }
        },
        {
            name: "log_rpe",
            description: "Registra el esfuerzo percibido (RPE) del atleta.",
            parameters: {
                type: Type.OBJECT,
                properties: {
                    rpe: { type: Type.NUMBER, description: "Valor de 1 a 10" },
                    notes: { type: Type.STRING, description: "Comentario corto" }
                },
                required: ["rpe"]
            }
        }
      ]
    }];

    try {
        // 3. INIT AUDIO CONTEXT (Output @ 24kHz for Gemini Native Quality)
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        this.nextStartTime = this.audioContext.currentTime;

        // 4. CONNECT TO GEMINI LIVE
        this.currentSession = this.ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            config: {
                responseModalities: [Modality.AUDIO], // CRITICAL: Forces Audio Output
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } // High Quality Voice
                },
                systemInstruction: { parts: [{ text: systemInstruction }] },
                tools: tools,
            },
            callbacks: {
                onopen: async () => {
                    onStatusChange("🔴 EN VIVO");
                    await this.startMicrophone(onAudioLevel);
                },
                onmessage: async (msg: LiveServerMessage) => {
                    // A. Handle Audio Output (PCM)
                    const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                    if (audioData) {
                        this.queueAudioChunk(audioData);
                    }

                    // B. Handle Tool Calls
                    if (msg.toolCall) {
                        const functionCalls = msg.toolCall.functionCalls;
                        for (const call of functionCalls) {
                            onStatusChange(`⚡ Ejecutando: ${call.name}...`);
                            const result = await onToolCall(call.name, call.args);
                            
                            // Send response back to Gemini so it knows tool finished
                            this.currentSession!.then(session => {
                                session.sendToolResponse({
                                    functionResponses: [{
                                        id: call.id,
                                        name: call.name,
                                        response: { result: result }
                                    }]
                                });
                            });
                            onStatusChange("🔴 EN VIVO");
                        }
                    }
                },
                onclose: () => {
                    onStatusChange("Desconectado");
                    this.stop();
                },
                onerror: (err) => {
                    console.error("Gemini Live Error:", err);
                    onStatusChange("Error de Conexión");
                    this.stop();
                }
            }
        });

    } catch (e) {
        console.error("Connection Failed:", e);
        this.stop();
    }
  }

  private async startMicrophone(onLevel: (l: number) => void) {
      if (!this.audioContext) return;

      this.activeStream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
              sampleRate: 16000, // Gemini prefers 16kHz input
              channelCount: 1,
              echoCancellation: true,
              autoGainControl: true,
              noiseSuppression: true
          }
      });

      this.inputSource = this.audioContext.createMediaStreamSource(this.activeStream);
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      this.processor.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0);
          
          // Visualizer Logic (RMS)
          let sum = 0;
          for(let i=0; i<inputData.length; i++) sum += inputData[i] * inputData[i];
          const rms = Math.sqrt(sum / inputData.length);
          onLevel(rms); // Update UI

          // Convert to PCM Int16
          const pcmData = floatTo16BitPCM(inputData);
          
          // Convert to Base64
          let binary = '';
          const len = pcmData.byteLength;
          const bytes = new Uint8Array(pcmData.buffer);
          for (let i = 0; i < len; i++) {
              binary += String.fromCharCode(bytes[i]);
          }
          const base64Data = btoa(binary);

          // Send to Gemini
          if (this.currentSession) {
              this.currentSession.then(session => {
                  session.sendRealtimeInput([{
                      mimeType: "audio/pcm;rate=16000",
                      data: base64Data
                  }]);
              });
          }
      };

      this.inputSource.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
  }

  private async queueAudioChunk(base64Data: string) {
      if (!this.audioContext) return;

      // Decode Base64 -> Uint8 -> Int16 -> Float32
      const uint8Array = base64ToUint8Array(base64Data);
      const int16Array = new Int16Array(uint8Array.buffer);
      const float32Array = new Float32Array(int16Array.length);
      
      for (let i = 0; i < int16Array.length; i++) {
          float32Array[i] = int16Array[i] / 32768; // Normalize to -1.0 to 1.0
      }

      this.audioQueue.push(float32Array);
      
      if (!this.isPlaying) {
          this.playQueue();
      }
  }

  private playQueue() {
      if (!this.audioContext || this.audioQueue.length === 0) {
          this.isPlaying = false;
          return;
      }

      this.isPlaying = true;
      const audioData = this.audioQueue.shift()!;
      
      const audioBuffer = this.audioContext.createBuffer(1, audioData.length, 24000); // 24kHz Output
      audioBuffer.getChannelData(0).set(audioData);

      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);

      // Schedule seamless playback
      const currentTime = this.audioContext.currentTime;
      const startTime = Math.max(currentTime, this.nextStartTime);
      
      source.start(startTime);
      this.nextStartTime = startTime + audioBuffer.duration;

      source.onended = () => {
          this.playQueue();
      };
  }

  public stop() {
      if (this.currentSession) {
          this.currentSession.then(s => s.close());
          this.currentSession = null;
      }
      if (this.activeStream) {
          this.activeStream.getTracks().forEach(t => t.stop());
          this.activeStream = null;
      }
      if (this.processor) { this.processor.disconnect(); this.processor = null; }
      if (this.inputSource) { this.inputSource.disconnect(); this.inputSource = null; }
      if (this.audioContext) { this.audioContext.close(); this.audioContext = null; }
      
      this.audioQueue = [];
      this.isPlaying = false;
      this.nextStartTime = 0;
  }
}
