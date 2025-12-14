
import * as React from 'react';
import { useState } from 'react';
import { UserProfile } from '../types';
import { Shield, Info, ChevronLeft, ChevronRight, X, HelpCircle } from 'lucide-react';
import { useApp } from '../contexts/AppContext';

// GLOSSARY DEFINITIONS
const DEFINITIONS: Record<string, { title: string; desc: string }> = {
    PAC: { title: "Pace / Velocidad Pura", desc: "Capacidad de desplazamiento máximo (m/s). Se calcula comparando tu Marca Personal (PB) con los estándares mundiales para tu nivel." },
    TEC: { title: "Technique / Eficiencia", desc: "Puntuación basada en el análisis de video biomecánico. Evalúa ángulos clave (Rodilla, Cadera) y la ausencia de errores críticos." },
    FOR: { title: "Form / Estado de Forma", desc: "Consistencia del entrenamiento. Se basa en la frecuencia de registros (Logs) y la estabilidad del ACWR en el último mes." },
    IQ: { title: "Race IQ / Táctica", desc: "Experiencia competitiva y gestión de carrera. Aumenta con los años de experiencia y la cantidad de competiciones registradas." },
    OVR: { title: "Overall Rating", desc: "Índice global del atleta. Algoritmo ponderado que combina capacidades físicas, técnicas y mentales." }
};

export const AthletePassport: React.FC = () => {
    const { userProfile, analysisHistory, logs } = useApp();
    const { pbs, events } = userProfile;
    const [activeSlide, setActiveSlide] = useState(0);
    const [showInfo, setShowInfo] = useState<string | null>(null);

    // Filter valid events or default to generic
    const activeEvents = (events && events.length > 0) ? events : ['Sprint'];

    // --- ALGORITHM: CALCULATE OVR PER EVENT ---
    const calculateScores = (event: string) => {
        // 1. SPEED SCORE (Contextual to Event)
        let speedScore = 50;
        const pbTime = pbs[event as '100m' | '200m' | '400m']?.time;
        const timeVal = parseFloat(pbTime || '0');

        if (timeVal > 0) {
            // Basic logic adjustments per event standards
            if (event === '100m') {
                if (timeVal < 10.0) speedScore = 99;
                else if (timeVal < 11.0) speedScore = 90 + (11.0 - timeVal) * 10;
                else if (timeVal < 12.0) speedScore = 80 + (12.0 - timeVal) * 10;
                else if (timeVal < 14.0) speedScore = 60 + (14.0 - timeVal) * 10;
            } else if (event === '200m') {
                if (timeVal < 20.0) speedScore = 99;
                else if (timeVal < 22.0) speedScore = 90;
                else if (timeVal < 24.0) speedScore = 80;
                else speedScore = 60;
            } else { // 400m or others
                speedScore = 70; // Placeholder calculation for other events
            }
        }

        // 2. TECHNIQUE SCORE (Global avg for now)
        const recentAnalysis = analysisHistory.slice(0, 5);
        const techScore = recentAnalysis.length > 0 
            ? recentAnalysis.reduce((acc, curr) => acc + curr.score, 0) / recentAnalysis.length 
            : 60; 

        // 3. FORM SCORE (Consistency)
        const recentLogs = logs.filter(l => {
            const date = new Date(l.date);
            const now = new Date();
            return (now.getTime() - date.getTime()) / (1000 * 3600 * 24) < 30; 
        });
        const formScore = Math.min(99, 50 + (recentLogs.length * 4));

        // 4. IQ SCORE
        const iqScore = Math.min(99, 50 + (userProfile.yearsExperience * 5));

        // GLOBAL OVR
        const ovr = Math.round((speedScore * 0.4) + (techScore * 0.3) + (formScore * 0.2) + (iqScore * 0.1));

        return { speed: Math.round(speedScore), tech: Math.round(techScore), form: Math.round(formScore), iq: Math.round(iqScore), ovr };
    };

    const handleSlide = (direction: 'left' | 'right') => {
        if (direction === 'left') {
            setActiveSlide(prev => (prev === 0 ? activeEvents.length - 1 : prev - 1));
        } else {
            setActiveSlide(prev => (prev === activeEvents.length - 1 ? 0 : prev + 1));
        }
    };

    return (
        <div className="relative w-full max-w-sm mx-auto perspective-1000">
            
            {/* CAROUSEL CONTROLS */}
            {activeEvents.length > 1 && (
                <>
                    <button onClick={() => handleSlide('left')} className="absolute left-[-15px] top-1/2 -translate-y-1/2 z-20 p-2 bg-slate-800/80 rounded-full text-slate-300 hover:text-white border border-slate-700 backdrop-blur"><ChevronLeft size={20}/></button>
                    <button onClick={() => handleSlide('right')} className="absolute right-[-15px] top-1/2 -translate-y-1/2 z-20 p-2 bg-slate-800/80 rounded-full text-slate-300 hover:text-white border border-slate-700 backdrop-blur"><ChevronRight size={20}/></button>
                </>
            )}

            {/* CARD AREA */}
            <div className="overflow-hidden py-2 px-1">
                <div 
                    className="flex transition-transform duration-500 ease-out" 
                    style={{ transform: `translateX(-${activeSlide * 100}%)` }}
                >
                    {activeEvents.map((evt, index) => {
                        const scores = calculateScores(evt);
                        return (
                            <div key={evt} className="w-full flex-shrink-0 px-1">
                                <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-2 border-yellow-500/50 rounded-[2rem] p-6 shadow-[0_0_30px_-5px_rgba(234,179,8,0.2)] overflow-hidden">
                                    
                                    {/* Background Pattern */}
                                    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-yellow-500 via-transparent to-transparent"></div>
                                    
                                    {/* HEADER */}
                                    <div className="flex justify-between items-start mb-4 relative z-10">
                                        <div className="flex flex-col cursor-pointer" onClick={() => setShowInfo('OVR')}>
                                            <span className="text-5xl font-black text-yellow-400 drop-shadow-lg tracking-tighter flex items-start gap-1">
                                                {scores.ovr}
                                                <Info size={12} className="text-yellow-600 mt-2 opacity-50"/>
                                            </span>
                                            <span className="text-sm font-bold text-slate-400 tracking-widest uppercase">{evt}</span>
                                        </div>
                                        <div className="w-12 h-8 flex items-center justify-center">
                                            <Shield size={36} className="text-yellow-500/80" strokeWidth={1}/>
                                        </div>
                                    </div>

                                    {/* AVATAR */}
                                    <div className="relative w-28 h-28 mx-auto mb-4">
                                        <div className="w-full h-full rounded-full bg-gradient-to-t from-slate-700 to-slate-600 border-4 border-slate-500 shadow-inner flex items-center justify-center overflow-hidden">
                                            <span className="text-4xl font-bold text-slate-400 select-none">
                                                {userProfile.name ? userProfile.name.charAt(0).toUpperCase() : 'A'}
                                            </span>
                                        </div>
                                        <div className="absolute -bottom-2 -right-2 bg-yellow-500 text-black font-black text-[10px] px-2 py-1 rounded border border-white shadow-lg">
                                            LVL {userProfile.experienceLevel === 'Elite' ? 'V' : userProfile.experienceLevel === 'Advanced' ? 'IV' : 'III'}
                                        </div>
                                    </div>

                                    {/* NAME */}
                                    <div className="text-center mb-5 border-b border-yellow-500/30 pb-3">
                                        <h3 className="text-xl font-black text-white uppercase tracking-tight truncate">{userProfile.name || "ATLETA"}</h3>
                                        <p className="text-[10px] text-yellow-500/80 font-bold uppercase tracking-widest mt-1">Elite Sprint AI Passport</p>
                                    </div>

                                    {/* STATS GRID with CLICK HANDLERS */}
                                    <div className="grid grid-cols-2 gap-y-2 gap-x-4 px-1 relative z-10">
                                        <StatRow label="PAC" value={scores.speed} onClick={() => setShowInfo('PAC')} highlight={scores.speed > 85} />
                                        <StatRow label="TEC" value={scores.tech} onClick={() => setShowInfo('TEC')} highlight={scores.tech > 85} color="text-purple-400" />
                                        <StatRow label="FOR" value={scores.form} onClick={() => setShowInfo('FOR')} highlight={scores.form > 85} color="text-cyan-400" />
                                        <StatRow label="IQ" value={scores.iq} onClick={() => setShowInfo('IQ')} highlight={scores.iq > 85} color="text-blue-400" />
                                    </div>

                                    {/* SHINE FX */}
                                    <div className="absolute bottom-0 left-0 w-full h-1/3 bg-gradient-to-t from-yellow-500/10 to-transparent pointer-events-none"></div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* PAGINATION DOTS */}
            {activeEvents.length > 1 && (
                <div className="flex justify-center gap-2 mt-2">
                    {activeEvents.map((_, i) => (
                        <div key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === activeSlide ? 'bg-yellow-500' : 'bg-slate-700'}`}></div>
                    ))}
                </div>
            )}

            {/* INFO MODAL */}
            {showInfo && (
                <div className="absolute inset-0 z-50 bg-slate-950/95 backdrop-blur-sm rounded-[2rem] flex items-center justify-center p-6 animate-in fade-in zoom-in-95" onClick={() => setShowInfo(null)}>
                    <div className="text-center" onClick={e => e.stopPropagation()}>
                        <HelpCircle size={40} className="text-yellow-500 mx-auto mb-3" />
                        <h4 className="text-xl font-bold text-white mb-2">{DEFINITIONS[showInfo].title}</h4>
                        <p className="text-sm text-slate-300 leading-relaxed mb-6">{DEFINITIONS[showInfo].desc}</p>
                        <button onClick={() => setShowInfo(null)} className="bg-slate-800 border border-slate-700 text-white px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-slate-700">Entendido</button>
                    </div>
                </div>
            )}
        </div>
    );
};

const StatRow = ({ label, value, onClick, highlight, color = 'text-emerald-400' }: any) => (
    <div className="flex items-center justify-between cursor-pointer group" onClick={onClick}>
        <span className="text-sm font-bold text-slate-400 group-hover:text-white transition-colors flex items-center gap-1">
            {label} 
            <Info size={10} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-500"/>
        </span>
        <span className={`text-lg font-black ${highlight ? color : 'text-white'}`}>{value}</span>
    </div>
);
