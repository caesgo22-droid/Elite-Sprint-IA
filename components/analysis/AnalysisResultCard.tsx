
import * as React from 'react';
import { Microscope, ScanLine, ShieldCheck, AlertCircle, Play, Edit3, CheckCheck } from 'lucide-react';
import { BiomechanicalAnalysis, UserProfile } from '../../types';

export const MetricBox = ({ label, value, tooltip }: { label: string, value: string, tooltip?: string }) => (
    <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800/50 text-center shadow-inner group relative cursor-help">
        <div className="text-[8px] text-slate-600 uppercase font-black tracking-widest mb-1">{label}</div>
        <div className="text-sm font-mono text-white font-black">{value}</div>
        {tooltip && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-32 bg-black/90 border border-slate-700 p-2 rounded-lg text-[9px] text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 text-center">
                {tooltip}
            </div>
        )}
    </div>
);

interface AnalysisResultCardProps {
    analysis: BiomechanicalAnalysis;
    isHistoryItem?: boolean;
    userProfile: UserProfile;
    updateAnalysis: (id: string, updates: any) => void;
}

export const AnalysisResultCard: React.FC<AnalysisResultCardProps> = ({
    analysis,
    isHistoryItem,
    userProfile,
    updateAnalysis
}) => {
    return (
        <div className="bg-slate-900 border border-slate-700 p-6 rounded-[2rem] space-y-6 animate-in slide-in-from-bottom-4 shadow-2xl overflow-hidden relative">
            {isHistoryItem && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-indigo-500 text-white text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-widest z-10">Vista de Historial</div>
            )}
            <div className="flex justify-between items-start">
                <div>
                    <h3 className={`font-black text-2xl tracking-tighter uppercase ${analysis.category === 'External' ? 'text-indigo-400' : 'text-white'}`}>{analysis.phaseDetected}</h3>
                    <div className="flex items-center gap-2 mt-1">
                        <Microscope size={12} className="text-slate-500" />
                        <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Motor: {analysis.coachNotes?.includes("OFFLINE") ? 'Local' : (analysis.category === 'External' ? 'Deep Pro' : 'Flash')}</span>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-3xl font-black text-emerald-400 tracking-tighter">{analysis.score}</div>
                    <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Score</div>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
                <MetricBox
                    label="VEL (m/s)"
                    value={analysis.kinetics?.comVelocity?.toString().split(' ')[0] || '--'}
                    tooltip="Velocidad del Centro de Masas. >9.0m/s indica nivel Elite."
                />
                <MetricBox
                    label="GCT (sec)"
                    value={analysis.groundContactTimeEstimate || '--'}
                    tooltip="Tiempo de Contacto. <0.10s es ideal para máxima velocidad."
                />
                <MetricBox
                    label="EFF"
                    value={`${analysis.kinetics?.forceApplicationIndex || '--'}%`}
                    tooltip="Índice de Aplicación de Fuerza. % de fuerza útil horizontal."
                />
            </div>

            {(analysis as any).jointAngles && (
                <div className="bg-black/40 rounded-2xl p-4 border border-slate-800/50 space-y-3">
                    <h4 className="text-[10px] font-black text-cyan-400 uppercase tracking-widest flex items-center gap-2"><ScanLine size={12} /> Biomecánica de Élite</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex justify-between items-center border-b border-slate-800/50 pb-1">
                            <span className="text-[10px] text-slate-500 uppercase font-bold">Rodilla (Ext)</span>
                            <span className="text-xs font-black text-white">{(analysis as any).jointAngles.kneeExtension || '--'}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-slate-800/50 pb-1">
                            <span className="text-[10px] text-slate-500 uppercase font-bold">Cadera (Flex)</span>
                            <span className="text-xs font-black text-white">{(analysis as any).jointAngles.hipFlexion || '--'}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-slate-800/50 pb-1">
                            <span className="text-[10px] text-slate-500 uppercase font-bold">Shin Angle</span>
                            <span className="text-xs font-black text-white">{(analysis as any).jointAngles.shinAngle || '--'}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-slate-800/50 pb-1">
                            <span className="text-[10px] text-slate-500 uppercase font-bold">Osc. Vertical</span>
                            <span className="text-xs font-black text-white">{analysis.kinetics?.verticalOscillation || '--'}</span>
                        </div>
                    </div>
                </div>
            )}

            <div className="space-y-4">
                <div className="space-y-2">
                    <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2"><ShieldCheck size={12} /> Successes</h4>
                    <ul className="space-y-1">
                        {(analysis as any).successes?.map((s: string, i: number) => (
                            <li key={i} className="text-[11px] text-slate-300 flex items-start gap-2">
                                <div className="w-1 h-1 bg-emerald-500 rounded-full mt-1.5 shrink-0" />
                                {s}
                            </li>
                        )) || <li className="text-[11px] text-slate-600 italic">No detectado.</li>}
                    </ul>
                </div>
                <div className="space-y-2">
                    <h4 className="text-[10px] font-black text-red-400 uppercase tracking-widest flex items-center gap-2"><AlertCircle size={12} /> Weaknesses</h4>
                    <ul className="space-y-1">
                        {(analysis as any).weaknesses?.map((w: string, i: number) => (
                            <li key={i} className="text-[11px] text-slate-300 flex items-start gap-2">
                                <div className="w-1 h-1 bg-red-500 rounded-full mt-1.5 shrink-0" />
                                {w}
                            </li>
                        )) || (analysis as any).criticalErrors?.map((w: string, i: number) => (
                            <li key={i} className="text-[11px] text-slate-300 flex items-start gap-2">
                                <div className="w-1 h-1 bg-red-500 rounded-full mt-1.5 shrink-0" />
                                {w}
                            </li>
                        )) || <li className="text-[11px] text-slate-600 italic">No detectado.</li>}
                    </ul>
                </div>
            </div>

            {(analysis as any).correctiveDrills && (analysis as any).correctiveDrills.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-slate-800">
                    <h4 className="text-[10px] font-black text-purple-400 uppercase tracking-widest flex items-center gap-2"><Microscope size={12} /> Plan de Corrección</h4>
                    <div className="grid gap-2">
                        {(analysis as any).correctiveDrills.map((drill: any, idx: number) => (
                            <div key={idx} className="bg-slate-950 p-3 rounded-2xl border border-slate-800/50 flex justify-between items-center group/drill">
                                <div className="flex-1">
                                    <div className="text-xs font-bold text-white uppercase tracking-tight">{typeof drill === 'string' ? drill : drill.name}</div>
                                    {drill.reason && <p className="text-[10px] text-slate-500 leading-tight mt-0.5 line-clamp-1 group-hover/drill:line-clamp-none transition-all">{drill.reason}</p>}
                                </div>
                                <a
                                    href={`https://www.youtube.com/results?search_query=track+and+field+drill+${(drill.videoKeywords || (typeof drill === 'string' ? drill : drill.name)).replace(/\s/g, '+')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 bg-slate-800 rounded-full text-slate-500 hover:text-red-500 transition-colors"
                                >
                                    <Play size={12} fill="currentColor" />
                                </a>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="space-y-3">
                <div className="flex flex-wrap gap-2 justify-center">
                    {analysis.coachShouts.map((s, i) => (
                        <span key={i} className="text-[10px] bg-slate-950 border border-slate-800 px-4 py-2 rounded-full text-slate-200 font-black italic shadow-inner">"{s}"</span>
                    ))}
                </div>
            </div>

            {userProfile.role === 'staff' && (
                <div className="mt-6 pt-6 border-t border-indigo-500/30 bg-indigo-900/10 -mx-4 px-4 pb-4 rounded-b-3xl">
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                            <Edit3 size={12} /> Zona de Feedback Staff
                        </h4>
                        {analysis.reviewStatus === 'Reviewed' && (
                            <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold border border-emerald-500/30 flex items-center gap-1">
                                <CheckCheck size={10} /> REVISADO
                            </span>
                        )}
                        {analysis.reviewStatus === 'Pending' && (
                            <span className="text-[9px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-bold border border-red-500/30 flex items-center gap-1" title="Video pendiente de revisión por el staff">
                                <AlertCircle size={10} /> PENDIENTE
                            </span>
                        )}
                    </div>
                    <textarea
                        placeholder="Añade notas técnicas para el atleta..."
                        value={analysis.coachNotes || ""}
                        onChange={(e) => updateAnalysis(analysis.id, { coachNotes: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all h-20"
                    />
                    <button
                        onClick={() => updateAnalysis(analysis.id, { reviewStatus: 'Reviewed' })}
                        className={`w-full mt-3 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${analysis.reviewStatus === 'Reviewed'
                            ? 'bg-slate-800 text-slate-400 cursor-default'
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                            }`}
                    >
                        {analysis.reviewStatus === 'Reviewed' ? 'Review Guardada' : 'Marcar como Revisado'}
                    </button>
                </div>
            )}
        </div>
    );
};
