
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

// Helper: Play a quick "Ping" sound to verify AudioContext is unlocked
const playPing = (ctx: AudioContext, frequency: number = 440, type: 'sine' | 'triangle' = 'sine') => {
    try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.value = frequency;
        osc.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
    } catch(e) { console.error("Audio Ping Failed", e); }
};

// --- MOCK SERVICE FOR DEMO MODE (ROBUST VERSION WITH TTS) ---
export class MockLiveService {
    private audioContext: AudioContext | null = null;
    private inputSource: MediaStreamAudioSourceNode | null = null;
    private processor: ScriptProcessorNode | null = null;
    private activeStream: MediaStream | null = null;
    
    // Simulation State
    private silenceFrames = 0;
    private speakingFrames = 0;
    private hasTriggeredResponse = false;
    private isCoachTalking = false;
    private autoTriggerTimer: any = null;

    constructor() {}

    public async startSession(
        profile: UserProfile, 
        currentPlan: TrainingPlan | null, 
        acwr: LoadStats | null,
        onAudioLevel: (level: number, isModelSpeaking: boolean) => void, 
        onStatusChange: (status: string, isError?: boolean) => void,
        onToolCall: (name: string, args: any) => Promise<any>,
        existingContext?: AudioContext // Accept external context
    ) {
        onStatusChange("Modo Demo: Habla ahora...", false);
        this.hasTriggeredResponse = false;
        
        // Use passed context or create new (should be passed from click handler for mobile)
        this.audioContext = existingContext || new (window.AudioContext || (window as any).webkitAudioContext)();
        if (this.audioContext.state === 'suspended') await this.audioContext.resume();

        // CONFIRM AUDIO OUT WORKS
        playPing(this.audioContext, 600, 'triangle');

        try {
            this.activeStream = await navigator.mediaDevices.getUserMedia({ 
                audio: { 
                    echoCancellation: true, 
                    noiseSuppression: false, 
                    autoGainControl: false 
                } 
            });
            
            this.inputSource = this.audioContext.createMediaStreamSource(this.activeStream);
            this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

            // FAILSAFE: Auto-trigger response after 5 seconds if VAD fails
            this.autoTriggerTimer = setTimeout(() => {
                if (!this.hasTriggeredResponse) {
                    console.log("Demo Auto-Trigger fired");
                    onStatusChange("Demo: Auto-respuesta...", false);
                    this.triggerMockResponse(onStatusChange, onToolCall, onAudioLevel);
                }
            }, 5000);

            this.processor.onaudioprocess = (e) => {
                if (this.isCoachTalking || this.hasTriggeredResponse) return;

                const inputData = e.inputBuffer.getChannelData(0);
                let sum = 0;
                for(let i=0; i<inputData.length; i++) sum += inputData[i] * inputData[i];
                const rms = Math.sqrt(sum / inputData.length);
                
                // Boost visual level for UI
                onAudioLevel(rms * 5, false);

                // LOWER THRESHOLD for Demo (sensitive)
                if (rms > 0.01) { 
                    this.speakingFrames++;
                    this.silenceFrames = 0;
                    onStatusChange("Te escucho...", false);
                } else {
                    this.silenceFrames++;
                }

                // Logic: Spoke for ~0.5s AND Silence for ~0.5s
                if (this.speakingFrames > 10 && this.silenceFrames > 15 && !this.hasTriggeredResponse) {
                    this.triggerMockResponse(onStatusChange, onToolCall, onAudioLevel);
                }
            };

            this.inputSource.connect(this.processor);
            this.processor.connect(this.audioContext.destination);

        } catch (e) {
            console.error("Demo Mic Error:", e);
            onStatusChange("Error Micrófono Demo", true);
            // Even if mic fails, trigger the demo experience after 2s
            setTimeout(() => this.triggerMockResponse(onStatusChange, onToolCall, onAudioLevel), 2000);
        }
    }

    private async triggerMockResponse(
        onStatusChange: (s: string, isError?: boolean) => void, 
        onToolCall: (n: string, a: any) => Promise<any>,
        onAudioLevel: (l: number, m: boolean) => void
    ) {
        if (this.hasTriggeredResponse) return;
        this.hasTriggeredResponse = true;
        if (this.autoTriggerTimer) clearTimeout(this.autoTriggerTimer);

        this.isCoachTalking = true;
        onStatusChange("Procesando...", false);
        
        // 1. Thinking Delay
        await new Promise(r => setTimeout(r, 1000));
        
        // 2. Speaking Simulation using NATIVE TTS
        onStatusChange("Coach Respondiendo...", false);
        
        const msg = "Entendido. Voy a ajustar la sesión de hoy a recuperación activa. Buen trabajo.";
        const utterance = new SpeechSynthesisUtterance(msg);
        utterance.lang = "es-ES";
        utterance.rate = 1.1;
        utterance.pitch = 1.0;
        
        // Animate Visualizer while speaking
        const speakInterval = setInterval(() => {
            onAudioLevel(Math.random() * 0.6 + 0.2, true);
        }, 80);

        utterance.onend = async () => {
            clearInterval(speakInterval);
            this.isCoachTalking = false;
            onAudioLevel(0, false);
            
            onStatusChange("Ejecutando cambios...", false);
            
            await onToolCall("modify_session", {
                day: "Hoy",
                newFocus: "Recuperación Activa (Demo)",
                intensity: "Low"
            });

            onStatusChange("Demo Finalizada", false);
        };

        // Fallback if TTS fails/not supported
        utterance.onerror = () => {
             clearInterval(speakInterval);
             this.isCoachTalking = false;
             onStatusChange("Error TTS Demo", true);
        };

        window.speechSynthesis.cancel(); // Clear queue
        window.speechSynthesis.speak(utterance);
    }

    public stop() {
        if (this.autoTriggerTimer) clearTimeout(this.autoTriggerTimer);
        window.speechSynthesis.cancel(); // Stop talking
        if (this.activeStream) this.activeStream.getTracks().forEach(t => t.stop());
        if (this.processor) this.processor.disconnect();
        if (this.inputSource) this.inputSource.disconnect();
        // Do NOT close context if it was passed in externally
    }
}

export class EliteLiveService {
  private ai: GoogleGenAI;
  private audioContext: AudioContext | null = null;
  private inputSource: MediaStreamAudioSourceNode | null = null;
  private inputGain: GainNode | null = null; 
  private processor: ScriptProcessorNode | null = null;
  private currentSession: Promise<any> | null = null;
  
  private audioQueue: Float32Array[] = [];
  private isPlaying = false;
  private nextStartTime = 0;
  
  private activeStream: MediaStream | null = null;
  private inputSampleRate: number = 48000;
  
  private silenceWatchdog: any = null;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  public async startSession(
    profile: UserProfile, 
    currentPlan: TrainingPlan | null, 
    acwr: LoadStats | null,
    onAudioLevel: (level: number, isModelSpeaking: boolean) => void, 
    onStatusChange: (status: string, isError?: boolean) => void,
    onToolCall: (name: string, args: any) => Promise<any>,
    existingContext?: AudioContext // Accept external context
  ) {
    if (this.currentSession) return;

    onStatusChange("Iniciando satélite...", false);

    const todaysSession = currentPlan?.sessions.find(s => {
        const today = new Date().getDay();
        const map = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
        const dayName = map[today];
        return s.day.includes(dayName) || s.day.includes(dayName.toLowerCase());
    });

    const systemInstruction = `
    ERES: "Elite Coach", Staff Técnico Nivel V.
    MODO: Llamada de Voz.
    ESTADO: Atleta ${profile.name}. Hoy: ${todaysSession ? todaysSession.focus : "Descanso"}.
    INSTRUCCIÓN: Respuestas cortas (1 frase). Entrenador militar pero empático.
    `;

    const tools = [{
      functionDeclarations: [
        {
          name: "modify_session",
          description: "Modifica la sesión.",
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
        // USE EXTERNAL CONTEXT IF PROVIDED (Fixes Mobile Safari)
        this.audioContext = existingContext || new (window.AudioContext || (window as any).webkitAudioContext)();
        this.inputSampleRate = this.audioContext.sampleRate;
        
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
        
        // PING TO VERIFY AUDIO OUTPUT IS ALIVE
        playPing(this.audioContext, 880, 'sine');

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
                    onStatusChange("Conectado", false);
                    await this.startMicrophone(onAudioLevel, onStatusChange);
                    
                    // Sending initial Hello to wake up the model
                    this.currentSession!.then(session => {
                        session.sendRealtimeInput([{ mimeType: "text/plain", data: "Hola Coach." }]);
                    });
                    
                    // WATCHDOG: If no audio received in 5s after connect, it's a zombie connection
                    this.silenceWatchdog = setTimeout(() => {
                        if (!this.isPlaying) {
                            onStatusChange("Sin audio de IA (Zombie)", true);
                            this.stop();
                        }
                    }, 8000);
                },
                onmessage: async (msg: LiveServerMessage) => {
                    // Clear watchdog on first message
                    if (this.silenceWatchdog) { clearTimeout(this.silenceWatchdog); this.silenceWatchdog = null; }

                    const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                    if (audioData) {
                        this.queueAudioChunk(audioData);
                        onAudioLevel(0.5, true); 
                    } else {
                        onAudioLevel(0, false);
                    }
                    
                    if (msg.serverContent?.interrupted) {
                        this.audioQueue = [];
                        this.isPlaying = false;
                        onStatusChange("Interrumpido...", false);
                        setTimeout(() => onStatusChange("Escuchando...", false), 1000);
                    }

                    if (msg.toolCall) {
                        const functionCalls = msg.toolCall.functionCalls;
                        for (const call of functionCalls) {
                            onStatusChange(`Ejecutando ${call.name}...`, false);
                            try {
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
                            } catch (err) {
                                console.error("Tool execution failed:", err);
                            }
                            onStatusChange("Conectado", false);
                        }
                    }
                },
                onclose: (e) => {
                    console.log("Session Closed", e);
                    onStatusChange("Desconectado", false);
                    this.stop();
                },
                onerror: (err: any) => {
                    console.error("Gemini Error Event:", err);
                    let msg = "Error de Conexión";
                    const errStr = JSON.stringify(err);
                    if (errStr.includes("429") || errStr.includes("ResourceExhausted")) {
                        msg = "Cuota Excedida (429)";
                    }
                    onStatusChange(msg, true);
                    this.stop();
                }
            }
        });

    } catch (e: any) {
        console.error("Connection Failed Exception:", e);
        let msg = "Fallo de Conexión";
        if (e.message?.includes("429")) msg = "Cuota Excedida (429)";
        onStatusChange(msg, true);
        this.stop();
    }
  }

  private async startMicrophone(onLevel: (l: number, isModel: boolean) => void, onStatusChange: (status: string, isError?: boolean) => void) {
      if (!this.audioContext) return;

      try {
          if (this.audioContext.state === 'suspended') {
              await this.audioContext.resume();
          }

          this.activeStream = await navigator.mediaDevices.getUserMedia({ 
              audio: {
                  echoCancellation: true,
                  autoGainControl: true,
                  noiseSuppression: true,
                  channelCount: 1,
                  sampleRate: 16000 
              }
          });

          this.inputSource = this.audioContext.createMediaStreamSource(this.activeStream);
          this.inputGain = this.audioContext.createGain();
          this.inputGain.gain.value = 2.0; // Boost input

          this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

          this.processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              
              let sum = 0;
              for(let i=0; i<inputData.length; i++) sum += inputData[i] * inputData[i];
              const rms = Math.sqrt(sum / inputData.length);
              
              if (rms > 0.01) onLevel(rms, false); 

              const pcm16k = downsampleTo16k(inputData, this.inputSampleRate);
              
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

          this.inputSource.connect(this.inputGain);
          this.inputGain.connect(this.processor);
          this.processor.connect(this.audioContext.destination);

      } catch (err) {
          console.error("Microphone Access Error:", err);
          onStatusChange("Error Micrófono", true);
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
      if (this.silenceWatchdog) clearTimeout(this.silenceWatchdog);
      if (this.currentSession) {
          this.currentSession.then(s => s.close().catch(() => {})); 
          this.currentSession = null;
      }
      if (this.activeStream) {
          this.activeStream.getTracks().forEach(t => t.stop());
          this.activeStream = null;
      }
      if (this.processor) { this.processor.disconnect(); this.processor = null; }
      if (this.inputGain) { this.inputGain.disconnect(); this.inputGain = null; }
      if (this.inputSource) { this.inputSource.disconnect(); this.inputSource = null; }
      // Don't close context to avoid breaking re-entry
      
      this.audioQueue = [];
      this.isPlaying = false;
      this.nextStartTime = 0;
  }
}
