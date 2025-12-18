
import * as React from 'react';
import { useState, useMemo } from 'react';
import { UserProfile } from '../types';
import { Shield, Info, ChevronLeft, ChevronRight, X, HelpCircle, Zap } from 'lucide-react';
import { useApp } from '../contexts/AppContext';

const DEFINITIONS: Record<string, { title: string; desc: string }> = {
    PAC: { title: "Pace / Velocidad Pura", desc: "Velocidad máxima (m/s) detectada en tus logs de tiempos recientes comparada con los estándares de tu categoría." },
    TEC: { title: "Technique / Eficiencia", desc: "Puntuación biomecánica directa del Laboratorio Bio. Evalúa ángulos críticos y tiempos de contacto." },
    FOR: { title: "Form / Estado de Forma", desc: "Estabilidad de tu carga de trabajo (ACWR). Un valor óptimo indica que estás listo para competir sin riesgo." },
    IQ: { title: "Race IQ / Táctica", desc: "Gestión competitiva basada en años de experiencia y cantidad de carreras registradas." },
    OVR: { title: "Overall Rating", desc: "Índice global de rendimiento Elite (Algoritmo: 40% PAC, 30% TEC, 20% FOR, 10% IQ)." }
};

export const AthletePassport: React.FC = () => {
    const { userProfile, analysisHistory, logs, acwrStats } = useApp();
    const [activeSlide, setActiveSlide] = useState(0);
    const [showInfo, setShowInfo] = useState<string | null>(null);

    const activeEvents = (userProfile.events && userProfile.events.length > 0) ? userProfile.events : ['Sprint'];

    const scores = useMemo(() => {
        return activeEvents.map(evt => {
            // 1. PAC (Tiempos)
            const pbTime = parseFloat(userProfile.pbs[evt as '100m' | '200m' | '400m']?.time || '0');
            let pac = 50;
            if (pbTime > 0) {
                if (evt === '100m') pac = Math.max(50, Math.min(99, 100 - (pbTime - 9.5) * 12));
                else pac = 75;
            }

            // 2. TEC (Último análisis Bio)
            const lastTech = analysisHistory[0]?.score || 60;
            
            // 3. FOR (ACWR y logs recientes)
            let form = 60;
            if (acwrStats) {
                if (acwrStats.status === 'Óptimo') form = 90;
                else if (acwrStats.status === 'Carga Baja') form = 70;
                else form = 50;
            }

            // 4. IQ (Experiencia)
            const iq = Math.min(99, 50 + (userProfile.yearsExperience * 5));

            const ovr = Math.round((pac * 0.4) + (lastTech * 0.3) + (form * 0.2) + (iq * 0.1));

            return { event: evt, pac, tec: lastTech, form, iq, ovr };
        });
    }, [userProfile, analysisHistory, acwrStats]);

    return (
        <div className="relative w-full max-w-[340px] mx-auto">
            <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-2 border-yellow-500/40 rounded-[2.5rem] p-6 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,_rgba(234,179,8,0.15),transparent)]"></div>
                
                <div className="flex justify-between items-start mb-6 relative z-10">
                    <div className="cursor-pointer group" onClick={() => setShowInfo('OVR')}>
                        <div className="text-6xl font-black text-yellow-500 tracking-tighter drop-shadow-2xl flex items-start gap-1">
                            {scores[activeSlide]?.ovr}
                            <Zap size={14} className="text-yellow-600 mt-2 opacity-40 group-hover:opacity-100 transition-opacity"/>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{activeEvents[activeSlide]}</span>
                            <div className="h-px w-8 bg-yellow-500/30"></div>
                        </div>
                    </div>
                    <div className="p-3 bg-yellow-500/10 rounded-2xl border border-yellow-500/20 shadow-inner">
                        <Shield size={32} className="text-yellow-500/80" strokeWidth={1.5}/>
                    </div>
                </div>

                <div className="relative w-32 h-32 mx-auto mb-6">
                    <div className="absolute inset-0 bg-yellow-500/20 blur-2xl rounded-full"></div>
                    <div className="relative w-full h-full rounded-full bg-slate-800 border-4 border-slate-700 shadow-2xl flex items-center justify-center overflow-hidden">
                        <span className="text-5xl font-black text-slate-500 select-none">{userProfile.name?.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="absolute -bottom-2 right-0 bg-yellow-500 text-slate-950 font-black text-[11px] px-3 py-1 rounded-lg shadow-xl border border-white/20">
                        {userProfile.experienceLevel === 'Elite' ? 'LEVEL V' : 'LEVEL IV'}
                    </div>
                </div>

                <div className="text-center mb-6 border-b border-white/10 pb-4">
                    <h3 className="text-2xl font-black text-white uppercase tracking-tight truncate">{userProfile.name || "SQUADDER"}</h3>
                    <p className="text-[9px] text-yellow-500 font-bold uppercase tracking-[0.3em] mt-1 opacity-70">Athlete Passport Elite AI</p>
                </div>

                <div className="grid grid-cols-2 gap-y-4 gap-x-8 relative z-10 px-2">
                    <StatBox label="PAC" value={scores[activeSlide]?.pac} onClick={() => setShowInfo('PAC')} color="text-emerald-400" />
                    <StatBox label="TEC" value={scores[activeSlide]?.tec} onClick={() => setShowInfo('TEC')} color="text-purple-400" />
                    <StatBox label="FOR" value={scores[activeSlide]?.form} onClick={() => setShowInfo('FOR')} color="text-cyan-400" />
                    <StatBox label="IQ" value={scores[activeSlide]?.iq} onClick={() => setShowInfo('IQ')} color="text-blue-400" />
                </div>

                {activeEvents.length > 1 && (
                    <div className="flex justify-center gap-1.5 mt-6">
                        {activeEvents.map((_, i) => (
                            <button key={i} onClick={() => setActiveSlide(i)} className={`h-1 rounded-full transition-all duration-300 ${i === activeSlide ? 'w-6 bg-yellow-500' : 'w-2 bg-slate-700'}`}></button>
                        ))}
                    </div>
                )}
            </div>

            {showInfo && (
                <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300" onClick={() => setShowInfo(null)}>
                    <div className="bg-slate-900 border border-yellow-500/30 p-8 rounded-[2.5rem] max-w-sm text-center relative" onClick={e => e.stopPropagation()}>
                        <div className="w-16 h-16 bg-yellow-500/10 rounded-3xl border border-yellow-500/20 flex items-center justify-center mx-auto mb-4">
                            <HelpCircle size={32} className="text-yellow-500" />
                        </div>
                        <h4 className="text-2xl font-black text-white mb-2 uppercase tracking-tight">{DEFINITIONS[showInfo].title}</h4>
                        <p className="text-sm text-slate-400 leading-relaxed mb-8">{DEFINITIONS[showInfo].desc}</p>
                        <button onClick={() => setShowInfo(null)} className="w-full bg-white text-slate-950 font-black py-4 rounded-2xl uppercase tracking-widest text-xs hover:bg-slate-200 transition-all">Entendido</button>
                    </div>
                </div>
            )}
        </div>
    );
};

const StatBox = ({ label, value, onClick, color }: any) => (
    <div className="flex items-center justify-between group cursor-pointer" onClick={onClick}>
        <span className="text-xs font-black text-slate-500 group-hover:text-yellow-500 transition-colors tracking-widest">{label}</span>
        <span className={`text-xl font-black transition-transform group-hover:scale-110 ${color}`}>{value}</span>
    </div>
);
