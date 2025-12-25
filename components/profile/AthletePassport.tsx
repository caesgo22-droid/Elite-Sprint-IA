
import * as React from 'react';
import { useState, useMemo } from 'react';
import { UserProfile } from '../../types';
import { Shield, Info, ChevronLeft, ChevronRight, X, HelpCircle, Zap, Plus } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';

const DEFINITIONS: Record<string, { title: string; desc: string }> = {
    PAC: { title: "Pace / Velocidad Pura", desc: "Velocidad máxima (m/s) detectada en tus logs de tiempos recientes comparada con los estándares de tu categoría." },
    TEC: { title: "Technique / Eficiencia", desc: "Puntuación biomecánica directa del Laboratorio Bio. Evalúa ángulos críticos y tiempos de contacto." },
    FOR: { title: "Form / Estado de Forma", desc: "Estabilidad de tu carga de trabajo (ACWR). Un valor óptimo indica que estás listo para competir sin riesgo." },
    IQ: { title: "Race IQ / Táctica", desc: "Gestión competitiva basada en años de experiencia y cantidad de carreras registradas." },
    OVR: { title: "Overall Rating", desc: "Índice global de rendimiento Elite (Algoritmo: 40% PAC, 30% TEC, 20% FOR, 10% IQ)." }
};

interface AthletePassportProps {
    profile?: UserProfile;
    history?: any[];
    acwr?: any;
    logs?: any[];
}

export const AthletePassport: React.FC<AthletePassportProps> = ({ profile, history, acwr, logs: propLogs }) => {
    const { userProfile: contextProfile, analysisHistory: contextHistory, logs: contextLogs, acwrStats: contextAcwr, updateProfile } = useApp();

    // Use props if provided (Coach View), else use context (Athlete View)
    const userProfile = profile || contextProfile;
    const analysisHistory = history || contextHistory;
    const acwrStats = acwr || contextAcwr;
    // const logs = propLogs || contextLogs; // Not used in calculation directly yet but good to have

    const [activeSlide, setActiveSlide] = useState(0);
    const [showInfo, setShowInfo] = useState<string | null>(null);

    // Ensure all main sprints are available for viewing
    const availableEvents = ['100m', '200m', '400m'];

    const scores = useMemo(() => {
        return availableEvents.map(evt => {
            const pbTime = parseFloat(userProfile.pbs?.[evt as '100m' | '200m' | '400m']?.time || '0');

            // PAC Score logic based on event
            let pac = 50;
            if (pbTime > 0) {
                if (evt === '100m') pac = Math.max(50, Math.min(99, 100 - (pbTime - 9.5) * 12));
                else if (evt === '200m') pac = Math.max(50, Math.min(99, 100 - (pbTime - 19.3) * 6));
                else pac = Math.max(50, Math.min(99, 100 - (pbTime - 43.0) * 3));
            }

            const lastTech = analysisHistory?.[0]?.score || 60;
            let form = 60;
            if (acwrStats) {
                if (acwrStats.status === 'Óptimo') form = 90;
                else if (acwrStats.status === 'Carga Baja') form = 70;
                else form = 50;
            }
            const iq = Math.min(99, 50 + ((userProfile.yearsExperience || 1) * 5));
            const ovr = Math.round((pac * 0.4) + (lastTech * 0.3) + (form * 0.2) + (iq * 0.1));

            return {
                event: evt,
                pac: Math.round(pac),
                tec: Math.round(lastTech),
                form: Math.round(form),
                iq: Math.round(iq),
                ovr: Math.round(ovr)
            };
        });
    }, [userProfile, analysisHistory, acwrStats]);

    const nextSlide = (e: React.MouseEvent) => {
        e.stopPropagation();
        setActiveSlide((prev) => (prev + 1) % availableEvents.length);
    };

    const prevSlide = (e: React.MouseEvent) => {
        e.stopPropagation();
        setActiveSlide((prev) => (prev - 1 + availableEvents.length) % availableEvents.length);
    };

    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (profile) return; // Read-only mode if props are passed (Coach can't change athlete photo here easily)
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result as string;
                updateProfile({ ...userProfile, photoURL: base64 });
            }
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="relative w-full max-w-[280px] mx-auto">
            <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-2 border-yellow-500/40 rounded-[2rem] p-5 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,_rgba(234,179,8,0.1),transparent)] pointer-events-none"></div>

                <div className="flex justify-between items-start mb-4 relative z-10">
                    <div className="cursor-pointer group" onClick={() => setShowInfo('OVR')}>
                        <div className="text-5xl font-black text-yellow-500 tracking-tighter drop-shadow-2xl flex items-baseline gap-1">
                            {scores[activeSlide]?.ovr}
                            <span className="text-[10px] text-yellow-500/50 uppercase font-black tracking-widest">OVR</span>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">{availableEvents[activeSlide]} Sprint</span>
                        </div>
                    </div>
                    <div className="p-2 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
                        <Shield size={20} className="text-yellow-500/80" />
                    </div>
                </div>

                <div className="relative w-20 h-20 mx-auto mb-4 group">
                    <div className="absolute inset-0 bg-yellow-500/10 blur-xl rounded-full"></div>

                    {/* Event Navigation Arrows */}
                    <button onClick={prevSlide} className="absolute -left-8 top-1/2 -translate-y-1/2 p-1.5 text-slate-600 hover:text-yellow-500 transition-colors">
                        <ChevronLeft size={24} />
                    </button>
                    <button onClick={nextSlide} className="absolute -right-8 top-1/2 -translate-y-1/2 p-1.5 text-slate-600 hover:text-yellow-500 transition-colors">
                        <ChevronRight size={24} />
                    </button>

                    <div
                        onClick={() => !profile && document.getElementById('avatar-upload')?.click()}
                        className={`relative w-full h-full rounded-full bg-slate-800 border-2 border-slate-700 shadow-xl flex items-center justify-center overflow-hidden transition-all ${!profile ? 'cursor-pointer hover:border-yellow-500 hover:scale-105 active:scale-95' : ''} group`}
                    >
                        {userProfile.photoURL ? (
                            <img src={userProfile.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-3xl font-black text-slate-500 group-hover:text-yellow-500 transition-colors">
                                {userProfile.name?.charAt(0).toUpperCase() || "I"}
                            </span>
                        )}
                        {!profile && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Plus size={20} className="text-white" />
                            </div>
                        )}
                    </div>
                    <input
                        id="avatar-upload"
                        type="file"
                        accept="image/*"
                        hidden
                        disabled={!!profile}
                        onChange={handlePhotoUpload}
                    />
                </div>

                <div className="text-center mb-4 px-1">
                    <h3 className="text-base font-black text-white uppercase tracking-tight truncate">
                        {userProfile.name || "INVITADO"}
                    </h3>
                    <div className="flex justify-center gap-1 mt-1.5">
                        {availableEvents.map((_, i) => (
                            <div key={i} className={`h-1 rounded-full transition-all ${activeSlide === i ? 'w-4 bg-yellow-500' : 'w-1 bg-slate-700'}`}></div>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-y-2 gap-x-4 relative z-10 border-t border-white/5 pt-3">
                    <StatBox label="PAC" value={scores[activeSlide]?.pac} onClick={() => setShowInfo('PAC')} color="text-emerald-400" />
                    <StatBox label="TEC" value={scores[activeSlide]?.tec} onClick={() => setShowInfo('TEC')} color="text-purple-400" />
                    <StatBox label="FOR" value={scores[activeSlide]?.form} onClick={() => setShowInfo('FOR')} color="text-cyan-400" />
                    <StatBox label="IQ" value={scores[activeSlide]?.iq} onClick={() => setShowInfo('IQ')} color="text-blue-400" />
                </div>
            </div>

            {showInfo && (
                <div className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-md flex items-center justify-center p-6" onClick={() => setShowInfo(null)}>
                    <div className="bg-slate-900 border border-yellow-500/30 p-8 rounded-[2rem] max-w-xs text-center relative shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h4 className="text-xl font-black text-white mb-2 uppercase tracking-tight">{DEFINITIONS[showInfo].title}</h4>
                        <p className="text-xs text-slate-400 leading-relaxed mb-6">{DEFINITIONS[showInfo].desc}</p>
                        <button onClick={() => setShowInfo(null)} className="w-full bg-white text-slate-950 font-black py-3 rounded-xl uppercase tracking-widest text-[10px]">Cerrar</button>
                    </div>
                </div>
            )}
        </div>
    );
};

const StatBox = ({ label, value, onClick, color }: any) => (
    <div className="flex items-center justify-between group cursor-pointer" onClick={onClick}>
        <span className="text-[9px] font-black text-slate-500 group-hover:text-yellow-500 transition-colors uppercase tracking-widest">{label}</span>
        <span className={`text-sm font-black ${color}`}>{value}</span>
    </div>
);
