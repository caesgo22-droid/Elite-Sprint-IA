import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { Mic, Send, X, Play, Pause, Trash2, MessageSquare, Clock } from 'lucide-react';
import { VideoAnnotation } from '../types';
import { useApp } from '../contexts/AppContext';

interface VideoAnnotationOverlayProps {
    currentTime: number; // Current playback time in seconds
    duration: number; // Total video duration
    annotations: VideoAnnotation[];
    onSave: (annotation: Omit<VideoAnnotation, 'id' | 'createdAt'>) => Promise<void>;
    onSeek: (time: number) => void;
    onDelete?: (id: string) => void;
    readOnly?: boolean;
}

export const VideoAnnotationOverlay: React.FC<VideoAnnotationOverlayProps> = ({
    currentTime,
    duration,
    annotations,
    onSave,
    onSeek,
    onDelete,
    readOnly = false
}) => {
    const { userProfile } = useApp();
    const [isAdding, setIsAdding] = useState(false);
    const [noteText, setNoteText] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

    // Media Recorder Refs
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const handleStartRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                setAudioBlob(audioBlob);
                stream.getTracks().forEach(track => track.stop()); // Stop mic
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingTime(0);
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);

        } catch (err) {
            console.error("Microphone access denied:", err);
            alert("No se pudo acceder al micrófono. Verifica los permisos.");
        }
    };

    const handleStopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (timerRef.current) clearInterval(timerRef.current);
        }
    };

    const handleSave = async () => {
        if (!noteText.trim() && !audioBlob) return;

        let content = noteText;
        let type: 'text' | 'voice' = 'text';

        // NOTE: In a real app, we would upload the audioBlob to Firebase Storage here and get a URL.
        // For this MVP/Demo, we will convert Blob to Base64 to store in Firestore (Size limited!).
        // Warning: This is not production scalable for long audio, but fine for short <30s memos.
        if (audioBlob) {
            type = 'voice';
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            reader.onloadend = async () => {
                const base64data = reader.result as string;
                await onSave({
                    analysisId: '', // Filled by parent
                    videoTimestamp: currentTime,
                    authorId: userProfile.uid || 'unknown',
                    authorName: userProfile.name || 'Staff',
                    authorRole: userProfile.role || 'Coach',
                    type: 'voice',
                    content: base64data
                });
                resetForm();
            };
            return;
        }

        await onSave({
            analysisId: '', // Filled by parent
            videoTimestamp: currentTime,
            authorId: userProfile.uid || 'unknown',
            authorName: userProfile.name || 'Staff',
            authorRole: userProfile.role || 'Coach',
            type: 'text',
            content: noteText
        });
        resetForm();
    };

    const resetForm = () => {
        setIsAdding(false);
        setNoteText('');
        setAudioBlob(null);
        setIsRecording(false);
        setRecordingTime(0);
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="absolute inset-0 pointer-events-none z-40 flex flex-col justify-between p-4">

            {/* Timeline Markers Layer - Positioned over the progress bar area usually, 
                but here we visualize them floating on the right side or just markers */}
            <div className="absolute right-4 top-20 bottom-32 w-64 pointer-events-auto space-y-2 overflow-y-auto no-scrollbar mask-gradient">
                {annotations.map(ann => (
                    <div
                        key={ann.id}
                        onClick={() => onSeek(ann.videoTimestamp)}
                        className={`bg-slate-900/80 backdrop-blur-md border border-slate-700 p-3 rounded-xl cursor-pointer hover:border-cyan-400 transition-all group ${Math.abs(currentTime - ann.videoTimestamp) < 1 ? 'border-cyan-500 shadow-[0_0_15px_rgba(34,211,238,0.3)]' : ''}`}
                    >
                        <div className="flex justify-between items-start mb-1">
                            <div className="flex items-center gap-1 text-[9px] font-black uppercase text-cyan-400">
                                <Clock size={10} /> {formatTime(ann.videoTimestamp)}
                            </div>
                            {!readOnly && onDelete && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onDelete(ann.id); }}
                                    className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Trash2 size={12} />
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-2 mb-1">
                            <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold ${ann.type === 'voice' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                {ann.authorName.charAt(0)}
                            </div>
                            <span className="text-[9px] font-bold text-slate-300 truncate">{ann.authorName}</span>
                        </div>

                        {ann.type === 'text' ? (
                            <p className="text-xs text-white leading-tight">{ann.content}</p>
                        ) : (
                            <div className="flex items-center gap-2 mt-1 bg-slate-800 p-2 rounded-lg">
                                <Mic size={14} className="text-purple-400" />
                                <div className="h-1 bg-slate-700 flex-1 rounded-full overflow-hidden">
                                    <div className="h-full bg-purple-500 w-1/2"></div>
                                </div>
                                <span className="text-[8px] text-slate-400">Audio</span>
                                <audio src={ann.content} controls className="w-20 h-6 hidden" />
                                {/* Custom play logic would go here ideally, for now naive Text label */}
                            </div>
                        )}

                        {/* Audio Player for Voice Notes (Simple) */}
                        {ann.type === 'voice' && (
                            <audio src={ann.content} controls className="w-full mt-2 h-6 opacity-60 hover:opacity-100" />
                        )}
                    </div>
                ))}
            </div>

            {/* Add Button */}
            {!readOnly && (
                <div className="absolute right-4 bottom-24 pointer-events-auto">
                    {!isAdding ? (
                        <button
                            onClick={() => setIsAdding(true)}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-full p-4 shadow-lg active:scale-95 transition-all"
                        >
                            <MessageSquare className="w-6 h-6" />
                        </button>
                    ) : (
                        <div className="bg-slate-900 border border-slate-700 p-4 rounded-2xl w-72 shadow-2xl animate-in slide-in-from-bottom-5">
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="text-xs font-black uppercase text-white tracking-widest flex items-center gap-2">
                                    <Clock size={12} className="text-indigo-400" /> @ {formatTime(currentTime)}
                                </h3>
                                <button onClick={resetForm}><X size={16} className="text-slate-500 hover:text-white" /></button>
                            </div>

                            {/* Audio Recorder */}
                            {!audioBlob ? (
                                <div className="mb-3">
                                    {isRecording ? (
                                        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                                                <span className="text-red-400 font-mono text-xs">{formatTime(recordingTime)}</span>
                                            </div>
                                            <button onClick={handleStopRecording} className="bg-red-500 text-white p-1.5 rounded-lg text-xs font-bold uppercase">Parar</button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={handleStartRecording}
                                            className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 py-2 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-colors"
                                        >
                                            <Mic size={14} /> Grabar Nota de Voz
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="mb-3 bg-purple-500/10 border border-purple-500/30 p-2 rounded-xl flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-purple-400 text-xs font-bold">
                                        <Mic size={14} /> Audio Listo
                                    </div>
                                    <button onClick={() => setAudioBlob(null)} className="text-slate-400 hover:text-white"><X size={14} /></button>
                                </div>
                            )}

                            <textarea
                                value={noteText}
                                onChange={e => setNoteText(e.target.value)}
                                placeholder="Escribe una observación técnica..."
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:border-indigo-500 outline-none h-24 mb-3 resize-none"
                            />

                            <button
                                onClick={handleSave}
                                disabled={!noteText.trim() && !audioBlob}
                                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-2 rounded-xl flex items-center justify-center gap-2"
                            >
                                <Send size={14} /> Guardar Nota
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
