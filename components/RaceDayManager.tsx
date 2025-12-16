
import * as React from 'react';
import { useState, useEffect } from 'react';
import { Clock, Coffee, Zap, Flag, MapPin, X, Calendar, Edit2, Check, MessageSquare } from 'lucide-react';
import { useApp } from '../contexts/AppContext';

interface TimelineEvent {
    id: string; // Add stable ID for editing
    time: string;
    offset: number; 
    label: string;
    desc: string;
    icon: any;
    color: string;
}

export const RaceDayManager: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { userProfile } = useApp();
    const isStaff = userProfile.role === 'staff';

    // PERSISTENCE STATE
    const [raceTime, setRaceTime] = useState(() => localStorage.getItem('elite_race_time') || "16:00");
    const [raceDate, setRaceDate] = useState(() => localStorage.getItem('elite_race_date') || new Date().toISOString().split('T')[0]);
    const [customNotes, setCustomNotes] = useState<Record<string, string>>(() => {
        const saved = localStorage.getItem('elite_race_notes');
        return saved ? JSON.parse(saved) : {};
    });

    const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
    const [statusMessage, setStatusMessage] = useState("");
    
    // Edit Mode State
    const [editingEventId, setEditingEventId] = useState<string | null>(null);
    const [tempNote, setTempNote] = useState("");

    const generateTimeline = () => {
        const [hours, mins] = raceTime.split(':').map(Number);
        const targetDate = new Date(raceDate);
        targetDate.setHours(hours, mins, 0, 0);

        const now = new Date();
        const diffDays = Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        if (targetDate.toDateString() === now.toDateString()) {
            setStatusMessage("ES HOY");
        } else if (diffDays === 1) {
            setStatusMessage("MAÑANA");
        } else if (diffDays > 1) {
            setStatusMessage(`FALTAN ${diffDays} DÍAS`);
        } else {
            setStatusMessage("FECHA PASADA");
        }

        const createEvent = (id: string, offsetMinutes: number, label: string, desc: string, icon: any, color: string): TimelineEvent => {
            const t = new Date(targetDate.getTime() - offsetMinutes * 60000);
            return {
                id,
                time: t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                offset: offsetMinutes,
                label, 
                desc: customNotes[id] || desc, // Override description if custom note exists
                icon, 
                color
            };
        };

        const events = [
            createEvent("meal", 240, "Última Comida Grande", "Carbohidratos complejos (Arroz/Pasta), Proteína magra. Evita grasas/fibras.", Coffee, "bg-blue-500"),
            createEvent("snack", 90, "Snack Pre-Comp & Cafeína", "Plátano, Tostada c/ Miel + 3-5mg/kg Cafeína.", Zap, "bg-yellow-500"),
            createEvent("warmup", 60, "Inicio Calentamiento", "Trote suave 5' + Movilidad Dinámica + Drills Técnicos.", ActivityIcon, "bg-emerald-500"),
            createEvent("potentiation", 30, "Potenciación & Spikes", "3x30m Progresivos + 2 Salidas de tacos. Ponerse clavos.", Zap, "bg-red-500"),
            createEvent("callroom", 15, "Call Room / Cámara", "Visualización positiva. Mantener calor corporal.", MapPin, "bg-purple-500"),
            createEvent("race", 0, "DISPARO DE SALIDA", "Focus: Reacción y Drive. ¡Vuela!", Flag, "bg-white text-black"),
        ];

        setTimeline(events.reverse());
    };

    // Save Logic
    useEffect(() => {
        localStorage.setItem('elite_race_time', raceTime);
        localStorage.setItem('elite_race_date', raceDate);
        localStorage.setItem('elite_race_notes', JSON.stringify(customNotes));
        generateTimeline();
    }, [raceTime, raceDate, customNotes]);

    const handleSaveNote = () => {
        if (editingEventId) {
            setCustomNotes(prev => ({ ...prev, [editingEventId]: tempNote }));
            setEditingEventId(null);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-md">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                    <div>
                        <h3 className="font-bold text-white flex items-center gap-2"><Flag className="text-red-500"/> Protocolo Día D</h3>
                        <p className="text-[10px] text-slate-400 font-mono tracking-widest">{statusMessage}</p>
                    </div>
                    <button onClick={onClose}><X className="text-slate-400 hover:text-white"/></button>
                </div>

                <div className="p-4 bg-slate-900 border-b border-slate-800 grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1 flex items-center gap-1"><Calendar size={10}/> Fecha Evento</label>
                        <input 
                            type="date" 
                            value={raceDate} 
                            onChange={(e) => setRaceDate(e.target.value)} 
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm text-white font-bold focus:border-red-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1 flex items-center gap-1"><Clock size={10}/> Hora Carrera</label>
                        <input 
                            type="time" 
                            value={raceTime} 
                            onChange={(e) => setRaceTime(e.target.value)} 
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm text-white font-bold focus:border-red-500 outline-none"
                        />
                    </div>
                </div>

                <div className="overflow-y-auto p-6 space-y-6 flex-1 bg-slate-900 relative">
                    {/* Vertical Line */}
                    <div className="absolute left-[39px] top-6 bottom-6 w-0.5 bg-slate-800"></div>

                    {timeline.map((evt, idx) => (
                        <div key={idx} className="relative flex gap-4 animate-in slide-in-from-bottom-2" style={{ animationDelay: `${idx * 50}ms` }}>
                            {/* Time Bubble */}
                            <div className={`w-14 h-14 rounded-xl flex-shrink-0 flex flex-col items-center justify-center z-10 border-4 border-slate-900 shadow-lg ${evt.offset === 0 ? 'bg-white text-black' : 'bg-slate-800 text-slate-200'}`}>
                                <span className="text-xs font-bold">{evt.time}</span>
                                <span className="text-[9px] opacity-70">T-{evt.offset}m</span>
                            </div>

                            {/* Content */}
                            <div className={`flex-1 p-3 rounded-lg border border-slate-800 bg-slate-950/50 group transition-colors ${evt.offset === 0 ? 'border-red-500/50 bg-red-900/10' : 'hover:border-slate-600'}`}>
                                <div className="flex justify-between items-start mb-1">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${evt.color}`}></div>
                                        <h4 className="font-bold text-sm text-white">{evt.label}</h4>
                                    </div>
                                    {isStaff && editingEventId !== evt.id && (
                                        <button onClick={() => { setEditingEventId(evt.id); setTempNote(evt.desc); }} className="text-slate-600 hover:text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Edit2 size={12}/>
                                        </button>
                                    )}
                                </div>

                                {editingEventId === evt.id ? (
                                    <div className="mt-2 animate-in fade-in">
                                        <textarea 
                                            value={tempNote} 
                                            onChange={e => setTempNote(e.target.value)} 
                                            className="w-full bg-slate-900 border border-cyan-500/50 rounded p-2 text-xs text-white mb-2 h-16 focus:outline-none"
                                            autoFocus
                                        />
                                        <div className="flex gap-2">
                                            <button onClick={handleSaveNote} className="flex-1 bg-cyan-600 text-white text-xs py-1 rounded font-bold flex items-center justify-center gap-1"><Check size={12}/> Guardar</button>
                                            <button onClick={() => setEditingEventId(null)} className="bg-slate-800 text-slate-400 text-xs py-1 px-3 rounded hover:text-white">Cancelar</button>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        {evt.desc}
                                        {customNotes[evt.id] && <span className="block mt-1 text-[10px] text-cyan-500 font-bold flex items-center gap-1"><MessageSquare size={10}/> Nota Staff</span>}
                                    </p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// Icon Helper
const ActivityIcon = (props: any) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
);
