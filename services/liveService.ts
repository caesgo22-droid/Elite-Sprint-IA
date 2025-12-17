
import { GoogleGenAI, LiveServerMessage, Modality, Type } from "@google/genai";
import { UserProfile, TrainingPlan, LoadStats } from "../types";

// --- AUDIO UTILS ---

const downsampleTo16k = (input: Float32Array, sampleRate: number): Int16Array => {
  if (sampleRate === 16000) {
      return floatTo16BitPCM(input);
  }
  const ratio = sampleRate / 16000;
  const newLength = Math.ceil(input.length / ratio);
  const result = new Int16Array(newLength);
  for (let i = 0; i < newLength; i++) {
      const index = i * ratio;
      const floorIndex = Math.floor(index);
      const weight = index - floorIndex;
      const val1 = input[floorIndex] || 0;
      const val2 = input[floorIndex + 1] || val1;
      const val = val1 * (1 - weight) + val2 * weight;
      const s = Math.max(-1, Math.min(1, val));
      result[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return result;
};

const floatTo16BitPCM = (float32Array: Float32Array): Int16Array => {
  const result = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    let s = Math.max(-1, Math.min(1, float32Array[i]));
    result[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return result;
};

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
  private inputGain: GainNode | null = null; // NEW: Boost volume
  private processor: ScriptProcessorNode | null = null;
  private currentSession: Promise<any> | null = null;
  
  private audioQueue: Float32Array[] = [];
  private isPlaying = false;
  private nextStartTime = 0;
  
  private activeStream: MediaStream | null = null;
  private inputSampleRate: number = 48000;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  public async startSession(
    profile: UserProfile, 
    currentPlan: TrainingPlan | null, 
    acwr: LoadStats | null,
    onAudioLevel: (level: number, isModelSpeaking: boolean) => void, // Updated signature
    onStatusChange: (status: string) => void,
    onToolCall: (name: string, args: any) => Promise<any>
  ) {
    if (this.currentSession) return;

    onStatusChange("Conectando satélite...");

    const todaysSession = currentPlan?.sessions.find(s => {
        const today = new Date().getDay();
        const map = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
        const dayName = map[today];
        return s.day.includes(dayName) || s.day.includes(dayName.toLowerCase());
    });

    const systemInstruction = `
    ERES: "Elite Coach", Staff Técnico Nivel V.
    MODO: Llamada de Voz.
    
    ESTADO ACTUAL:
    - Atleta: ${profile.name}
    - Hoy: ${todaysSession ? todaysSession.focus : "Descanso"}
    
    INSTRUCCIÓN CLAVE:
    1. Eres un entrenador hablando por radio/teléfono.
    2. RESPUESTAS MUY CORTAS (1-2 oraciones).
    3. Si el usuario se queda callado, pregunta "¿Me copias?" o "¿Cómo te sientes?".
    `;

    const tools = [{
      functionDeclarations: [
        {
          name: "modify_session",
          description: "Modifica la sesión de hoy.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              day: { type: Type.STRING },
              newFocus: { type: Type.STRING },
              intensity: { type: Type.STRING, enum: ["Low", "Medium", "High", "Max"] }
            },
            required: ["day", "newFocus"]
          }
        },
        {
            name: "log_rpe",
            description: "Registra RPE.",
            parameters: {
                type: Type.OBJECT,
                properties: { rpe: { type: Type.NUMBER } },
                required: ["rpe"]
            }
        }
      ]
    }];

    try {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        this.inputSampleRate = this.audioContext.sampleRate;
        
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }

        this.nextStartTime = this.audioContext.currentTime;

        this.currentSession = this.ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
                systemInstruction: { parts: [{ text: systemInstruction }] },
                tools: tools,
            },
            callbacks: {
                onopen: async () => {
                    onStatusChange("Conectado");
                    await this.startMicrophone(onAudioLevel);
                    
                    // KICKSTART: Send a text message to force the model to speak first.
                    // This confirms the audio output path is working immediately.
                    this.currentSession!.then(session => {
                        session.sendRealtimeInput([{ mimeType: "text/plain", data: "Hola Coach, probando audio. ¿Me recibes?" }]);
                    });
                },
                onmessage: async (msg: LiveServerMessage) => {
                    const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                    if (audioData) {
                        this.queueAudioChunk(audioData);
                        // Notify UI that model is speaking (fake level for visualizer)
                        onAudioLevel(0.5, true); 
                    } else {
                        onAudioLevel(0, false);
                    }
                    
                    if (msg.serverContent?.interrupted) {
                        this.audioQueue = [];
                        this.isPlaying = false;
                        onStatusChange("Interrumpido...");
                    }

                    if (msg.toolCall) {
                        const functionCalls = msg.toolCall.functionCalls;
                        for (const call of functionCalls) {
                            onStatusChange(`Ejecutando ${call.name}...`);
                            const result = await onToolCall(call.name, call.args);
                            this.currentSession!.then(session => {
                                session.sendToolResponse({
                                    functionResponses: [{
                                        id: call.id,
                                        name: call.name,
                                        response: { result: result }
                                    }]
                                });
                            });
                            onStatusChange("Conectado");
                        }
                    }
                },
                onclose: () => {
                    onStatusChange("Finalizado");
                    this.stop();
                },
                onerror: (err) => {
                    console.error("Gemini Error:", err);
                    onStatusChange("Error de Conexión");
                }
            }
        });

    } catch (e) {
        console.error("Connection Failed:", e);
        this.stop();
    }
  }

  private async startMicrophone(onLevel: (l: number, isModel: boolean) => void) {
      if (!this.audioContext) return;

      try {
          this.activeStream = await navigator.mediaDevices.getUserMedia({ 
              audio: {
                  echoCancellation: true,
                  autoGainControl: true, // Browser AGC
                  noiseSuppression: true,
                  channelCount: 1
              }
          });

          this.inputSource = this.audioContext.createMediaStreamSource(this.activeStream);
          
          // GAIN NODE: Boost volume by 1.5x to ensure VAD picks it up
          this.inputGain = this.audioContext.createGain();
          this.inputGain.gain.value = 1.5; 

          this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

          this.processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              
              // Visualizer Logic
              let sum = 0;
              for(let i=0; i<inputData.length; i++) sum += inputData[i] * inputData[i];
              const rms = Math.sqrt(sum / inputData.length);
              
              // Only update UI if user is speaking loud enough
              if (rms > 0.01) onLevel(rms, false); 

              const pcm16k = downsampleTo16k(inputData, this.inputSampleRate);
              
              // Optimized Base64 Conversion
              let binary = '';
              const len = pcm16k.byteLength;
              const bytes = new Uint8Array(pcm16k.buffer);
              const CHUNK_SIZE = 0x8000; 
              for (let i = 0; i < len; i += CHUNK_SIZE) {
                binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + CHUNK_SIZE, len)) as any);
              }
              const base64Data = btoa(binary);

              if (this.currentSession) {
                  this.currentSession.then(session => {
                      session.sendRealtimeInput([{
                          mimeType: "audio/pcm;rate=16000",
                          data: base64Data
                      }]);
                  });
              }
          };

          // Chain: Mic -> Gain -> Processor -> Destination (Muted to avoid feedback loop)
          this.inputSource.connect(this.inputGain);
          this.inputGain.connect(this.processor);
          this.processor.connect(this.audioContext.destination);

      } catch (err) {
          console.error("Microphone Access Error:", err);
      }
  }

  private async queueAudioChunk(base64Data: string) {
      if (!this.audioContext) return;

      const uint8Array = base64ToUint8Array(base64Data);
      const int16Array = new Int16Array(uint8Array.buffer);
      const float32Array = new Float32Array(int16Array.length);
      
      for (let i = 0; i < int16Array.length; i++) {
          float32Array[i] = int16Array[i] / 32768; 
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
      
      const audioBuffer = this.audioContext.createBuffer(1, audioData.length, 24000); 
      audioBuffer.getChannelData(0).set(audioData);

      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);

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
      if (this.inputGain) { this.inputGain.disconnect(); this.inputGain = null; }
      if (this.inputSource) { this.inputSource.disconnect(); this.inputSource = null; }
      if (this.audioContext) { 
          this.audioContext.close(); 
          this.audioContext = null; 
      }
      
      this.audioQueue = [];
      this.isPlaying = false;
      this.nextStartTime = 0;
  }
}
