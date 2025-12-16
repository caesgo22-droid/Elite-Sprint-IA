
import * as React from 'react';
import { useState } from 'react';
import { Clock, Coffee, Zap, Flag, MapPin, X } from 'lucide-react';

interface TimelineEvent {
    time: string;
    offset: number; // minutes before race
    label: string;
    desc: string;
    icon: any;
    color: string;
}

export const RaceDayManager: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    // PERSISTENCE FIX: Load from localStorage
    const [raceTime, setRaceTime] = useState(() => {
        return localStorage.getItem('elite_race_time') || "16:00";
    });
    const [timeline, setTimeline] = useState<TimelineEvent[]>([]);

    const generateTimeline = () => {
        const [hours, mins] = raceTime.split(':').map(Number);
        const raceDate = new Date();
        raceDate.setHours(hours, mins, 0, 0);

        const createEvent = (offsetMinutes: number, label: string, desc: string, icon: any, color: string): TimelineEvent => {
            const t = new Date(raceDate.getTime() - offsetMinutes * 60000);
            return {
                time: t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                offset: offsetMinutes,
                label, desc, icon, color
            };
        };

        const events = [
            createEvent(240, "Última Comida Grande", "Carbohidratos complejos (Arroz/Pasta), Proteína magra. Evita grasas/fibras.", Coffee, "bg-blue-500"),
            createEvent(90, "Snack Pre-Comp & Cafeína", "Plátano, Tostada c/ Miel + 3-5mg/kg Cafeína.", Zap, "bg-yellow-500"),
            createEvent(60, "Inicio Calentamiento", "Trote suave 5' + Movilidad Dinámica + Drills Técnicos.", ActivityIcon, "bg-emerald-500"),
            createEvent(30, "Potenciación & Spikes", "3x30m Progresivos + 2 Salidas de tacos. Ponerse clavos.", Zap, "bg-red-500"),
            createEvent(15, "Call Room / Cámara", "Visualización positiva. Mantener calor corporal.", MapPin, "bg-purple-500"),
            createEvent(0, "DISPARO DE SALIDA", "Focus: Reacción y Drive. ¡Vuela!", Flag, "bg-white text-black"),
        ];

        setTimeline(events.reverse());
    };

    // Trigger generation on load and sync to localStorage
    React.useEffect(() => {
        localStorage.setItem('elite_race_time', raceTime);
        generateTimeline();
    }, [raceTime]);

    return (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-md">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                    <div>
                        <h3 className="font-bold text-white flex items-center gap-2"><Flag className="text-red-500"/> Protocolo Día D</h3>
                    </div>
                    <button onClick={onClose}><X className="text-slate-400 hover:text-white"/></button>
                </div>

                <div className="p-6 bg-slate-900 border-b border-slate-800">
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Hora de Carrera</label>
                    <input 
                        type="time" 
                        value={raceTime} 
                        onChange={(e) => setRaceTime(e.target.value)} 
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-3xl font-mono text-center text-white font-bold focus:border-red-500 outline-none"
                    />
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
                            <div className={`flex-1 p-3 rounded-lg border border-slate-800 bg-slate-950/50 ${evt.offset === 0 ? 'border-red-500/50 bg-red-900/10' : ''}`}>
                                <div className="flex items-center gap-2 mb-1">
                                    <div className={`w-2 h-2 rounded-full ${evt.color}`}></div>
                                    <h4 className="font-bold text-sm text-white">{evt.label}</h4>
                                </div>
                                <p className="text-xs text-slate-400 leading-relaxed">{evt.desc}</p>
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