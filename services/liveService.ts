
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

const playPing = (ctx: AudioContext, frequency: number = 440, type: 'sine' | 'triangle' = 'sine') => {
    try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.value = frequency;
        osc.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
    } catch(e) { console.error("Audio Ping Failed", e); }
};

// --- MOCK SERVICE ---
export class MockLiveService {
    private audioContext: AudioContext | null = null;
    private inputSource: MediaStreamAudioSourceNode | null = null;
    private processor: ScriptProcessorNode | null = null;
    private activeStream: MediaStream | null = null;
    private autoTriggerTimer: any = null;
    private hasTriggeredResponse = false;
    private isCoachTalking = false;

    public async startSession(
        profile: UserProfile, 
        currentPlan: TrainingPlan | null, 
        acwr: LoadStats | null,
        onAudioLevel: (level: number, isModelSpeaking: boolean) => void, 
        onStatusChange: (status: string, isError?: boolean) => void,
        onToolCall: (name: string, args: any) => Promise<any>,
        existingContext?: AudioContext 
    ) {
        onStatusChange("Modo Demo: Habla ahora...", false);
        this.hasTriggeredResponse = false;
        this.audioContext = existingContext || new (window.AudioContext || (window as any).webkitAudioContext)();
        if (this.audioContext.state === 'suspended') await this.audioContext.resume();
        playPing(this.audioContext, 600, 'triangle');

        try {
            this.activeStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.inputSource = this.audioContext.createMediaStreamSource(this.activeStream);
            this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
            
            this.autoTriggerTimer = setTimeout(() => {
                if (!this.hasTriggeredResponse) this.triggerMockResponse(onStatusChange, onToolCall, onAudioLevel);
            }, 5000);

            this.processor.onaudioprocess = (e) => {
                if (this.isCoachTalking || this.hasTriggeredResponse) return;
                const inputData = e.inputBuffer.getChannelData(0);
                let sum = 0; for(let i=0; i<inputData.length; i++) sum += inputData[i] * inputData[i];
                const rms = Math.sqrt(sum / inputData.length);
                onAudioLevel(rms * 5, false);
                if (rms > 0.02 && !this.hasTriggeredResponse) {
                    setTimeout(() => this.triggerMockResponse(onStatusChange, onToolCall, onAudioLevel), 1000);
                }
            };
            this.inputSource.connect(this.processor);
            this.processor.connect(this.audioContext.destination);
        } catch (e) { onStatusChange("Error Micrófono Demo", true); }
    }

    private triggerMockResponse(onStatusChange: any, onToolCall: any, onAudioLevel: any) {
        if (this.hasTriggeredResponse) return;
        this.hasTriggeredResponse = true;
        this.isCoachTalking = true;
        onStatusChange("Coach Respondiendo...", false);
        const utterance = new SpeechSynthesisUtterance("Entendido atleta. Ajustaré tu carga para priorizar la recuperación. Buen trabajo hoy.");
        utterance.lang = "es-ES";
        utterance.rate = 0.9;
        utterance.pitch = 0.8;
        const interval = setInterval(() => onAudioLevel(Math.random() * 0.5 + 0.2, true), 100);
        utterance.onend = () => {
            clearInterval(interval);
            this.isCoachTalking = false;
            onAudioLevel(0, false);
            onToolCall("modify_session", { day: "Hoy", newFocus: "Recuperación (Demo)", intensity: "Low" });
            onStatusChange("Demo Finalizada", false);
        };
        window.speechSynthesis.speak(utterance);
    }

    public stop() {
        if (this.autoTriggerTimer) clearTimeout(this.autoTriggerTimer);
        window.speechSynthesis.cancel();
        if (this.activeStream) this.activeStream.getTracks().forEach(t => t.stop());
        if (this.processor) this.processor.disconnect();
    }
}

// --- ELITE LIVE SERVICE (THE REAL IA) ---
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
    existingContext?: AudioContext 
  ) {
    if (this.currentSession) return;
    onStatusChange("Abriendo canal...", false);

    const systemInstruction = `ERES: "Elite Coach", Staff Técnico Nivel V. RESPUESTAS: Muy cortas (máx 15 palabras). TONO: Firme y técnico. Atleta actual: ${profile.name}.`;

    try {
        this.audioContext = existingContext || new (window.AudioContext || (window as any).webkitAudioContext)();
        this.inputSampleRate = this.audioContext.sampleRate;
        if (this.audioContext.state === 'suspended') await this.audioContext.resume();
        
        playPing(this.audioContext, 880, 'sine');
        this.nextStartTime = this.audioContext.currentTime;

        const sessionPromise = this.ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
                systemInstruction: { parts: [{ text: systemInstruction }] },
                tools: [{
                    functionDeclarations: [{
                        name: "modify_session",
                        description: "Modifica la sesión del atleta.",
                        parameters: {
                            type: Type.OBJECT,
                            properties: { day: { type: Type.STRING }, newFocus: { type: Type.STRING }, intensity: { type: Type.STRING } },
                            required: ["day", "newFocus"]
                        }
                    }]
                }],
            },
            callbacks: {
                onopen: async () => {
                    onStatusChange("Conectado", false);
                    await this.startMicrophone(onAudioLevel, onStatusChange);
                    
                    // MANDATORY WAKE-UP: Send text part to force a response.
                    // Correct parameter structure: sendRealtimeInput expects an object with a media property.
                    sessionPromise.then(session => {
                        session.sendRealtimeInput({ media: { mimeType: "text/plain", data: btoa("Hola Coach, estoy listo para el reporte.") } });
                    }).catch(e => console.error("Initial send failed", e));
                    
                    this.silenceWatchdog = setTimeout(() => {
                        if (!this.isPlaying) {
                            onStatusChange("IA no responde (Zombie)", true);
                            this.stop();
                        }
                    }, 10000);
                },
                onmessage: async (message: LiveServerMessage) => {
                    if (this.silenceWatchdog) { clearTimeout(this.silenceWatchdog); this.silenceWatchdog = null; }

                    const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                    if (audioData) {
                        this.queueAudioChunk(audioData);
                        onAudioLevel(0.5, true); 
                    }
                    
                    if (message.toolCall) {
                        for (const call of message.toolCall.functionCalls) {
                            onStatusChange(`Ejecutando ${call.name}...`, false);
                            const result = await onToolCall(call.name, call.args);
                            sessionPromise.then(session => {
                                session.sendToolResponse({
                                    functionResponses: [{ id: call.id, name: call.name, response: { result: result } }]
                                });
                            });
                        }
                    }
                },
                onclose: () => { onStatusChange("Staff Offline", false); this.stop(); },
                onerror: (err) => {
                    console.error("Live Error:", err);
                    let msg = "Error canal IA";
                    if (JSON.stringify(err).includes("429")) msg = "Cuota Excedida (429)";
                    onStatusChange(msg, true);
                    this.stop();
                }
            }
        });

        this.currentSession = sessionPromise;

    } catch (e: any) {
        onStatusChange("Error de Conexión", true);
        this.stop();
    }
  }

  private async startMicrophone(onLevel: (l: number, isModel: boolean) => void, onStatusChange: any) {
      if (!this.audioContext) return;
      try {
          this.activeStream = await navigator.mediaDevices.getUserMedia({ 
              audio: { echoCancellation: true, autoGainControl: true, noiseSuppression: true, sampleRate: 16000 }
          });
          this.inputSource = this.audioContext.createMediaStreamSource(this.activeStream);
          this.inputGain = this.audioContext.createGain();
          this.inputGain.gain.value = 1.5;
          this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
          
          this.processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              let sum = 0; for(let i=0; i<inputData.length; i++) sum += inputData[i] * inputData[i];
              const rms = Math.sqrt(sum / inputData.length);
              if (rms > 0.01) onLevel(rms, false); 
              
              const pcm16k = downsampleTo16k(inputData, this.inputSampleRate);
              let binary = '';
              const bytes = new Uint8Array(pcm16k.buffer);
              for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
              const base64Data = btoa(binary);

              if (this.currentSession) {
                  this.currentSession.then(session => {
                      // Correct parameter structure: wrap media in an object.
                      session.sendRealtimeInput({ media: { mimeType: "audio/pcm;rate=16000", data: base64Data } });
                  }).catch(() => {});
              }
          };
          this.inputSource.connect(this.inputGain);
          this.inputGain.connect(this.processor);
          this.processor.connect(this.audioContext.destination);
      } catch (err) { onStatusChange("Error Micrófono", true); }
  }

  private async queueAudioChunk(base64Data: string) {
      if (!this.audioContext) return;
      const bytes = base64ToUint8Array(base64Data);
      const int16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;
      this.audioQueue.push(float32);
      if (!this.isPlaying) this.playQueue();
  }

  private playQueue() {
      if (!this.audioContext || this.audioQueue.length === 0) { this.isPlaying = false; return; }
      this.isPlaying = true;
      const audioData = this.audioQueue.shift()!;
      const buffer = this.audioContext.createBuffer(1, audioData.length, 24000); 
      buffer.getChannelData(0).set(audioData);
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.audioContext.destination);
      const startTime = Math.max(this.audioContext.currentTime, this.nextStartTime);
      source.start(startTime);
      this.nextStartTime = startTime + buffer.duration;
      source.onended = () => this.playQueue();
  }

  public stop() {
      if (this.silenceWatchdog) clearTimeout(this.silenceWatchdog);
      if (this.currentSession) {
          // Robust cleanup: only attempt close if session exists
          this.currentSession.then(s => {
              try { s.close(); } catch(e) {}
          }).catch(() => {});
          this.currentSession = null;
      }
      if (this.activeStream) this.activeStream.getTracks().forEach(t => t.stop());
      if (this.processor) { try { this.processor.disconnect(); } catch(e) {} }
      this.isPlaying = false;
      this.audioQueue = [];
  }
}
