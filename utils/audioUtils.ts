/**
 * Utilerías para procesamiento de Audio PCM (Gemini Live)
 */

export function encode(buffer: ArrayBuffer | Uint8Array): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

export function decode(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

export async function decodeAudioData(
    arrayBuffer: ArrayBuffer,
    audioContext: AudioContext,
    sampleRate: number = 24000,
    channels: number = 1
): Promise<AudioBuffer> {
    // Para datos PCM raw, necesitamos crear el buffer manualmente
    // Gemini devuelve PCM 16-bit little-endian
    const dataView = new DataView(arrayBuffer);
    const numSamples = arrayBuffer.byteLength / 2;
    const audioBuffer = audioContext.createBuffer(channels, numSamples, sampleRate);
    const channelData = audioBuffer.getChannelData(0);

    for (let i = 0; i < numSamples; i++) {
        // Normalizar int16 (-32768 a 32767) a float (-1.0 a 1.0)
        const sample = dataView.getInt16(i * 2, true);
        channelData[i] = sample < 0 ? sample / 32768 : sample / 32767;
    }

    return audioBuffer;
}
