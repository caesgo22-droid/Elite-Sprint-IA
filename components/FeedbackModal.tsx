import * as React from 'react';
import { useState } from 'react';
import { X, Info } from 'lucide-react';
import { TrainingSession } from '../types';

interface FeedbackModalProps {
    session: TrainingSession;
    onClose: () => void;
    onSave: (day: string, data: any) => void;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
    session,
    onClose,
    onSave
}) => {
    const [rpe, setRpe] = useState(session.feedback?.rpe || 5);
    const [pain, setPain] = useState(session.feedback?.painLevel || 0);
    const [dur, setDur] = useState(session.feedback?.duration || 60);
    const [srf, setSrf] = useState(session.feedback?.surface || 'Track');
    const [ftw, setFtw] = useState(session.footwear || 'Flats');
    const [wnd, setWnd] = useState(session.wind || 'Neutral');
    const [nts, setNts] = useState(session.feedback?.notes || '');

    const save = () => {
        onSave(session.day, {
            footwear: ftw as any,
            wind: wnd as any,
            feedback: {
                completed: true,
                rpe,
                painLevel: pain,
                duration: dur,
                surface: srf as any,
                notes: nts,
                timestamp: new Date().toISOString()
            }
        });
        onClose();
    };

    const InfoButton = ({ title, text }: { title: string, text: string }) => (
        <div className="group relative inline-block ml-1">
            <Info size={10} className="text-slate-500 hover:text-cyan-400 cursor-help" />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-800 text-[9px] text-slate-200 p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl border border-slate-700 leading-tight">
                <div className="font-bold text-cyan-400 mb-1">{title}</div>
                {text}
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm space-y-6 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center bg-slate-800 -mx-6 -mt-6 p-4 rounded-t-2xl border-b border-slate-700 shadow-sm">
                    <h3 className="font-bold text-white flex items-center gap-2 tracking-tight uppercase">Feedback Diario</h3>
                    <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded-full transition-colors text-slate-400 hover:text-white"><X size={20} /></button>
                </div>

                <div className="space-y-4">
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center">Esfuerzo Percibido (RPE) <InfoButton title="RPE" text="Escala de 1 a 10 donde 10 es esfuerzo máximo." /></label>
                            <span className="text-xs font-black text-cyan-400">{rpe}/10</span>
                        </div>
                        <input type="range" min="1" max="10" value={rpe} onChange={e => setRpe(parseInt(e.target.value))} className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500" />
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center">Nivel de Dolor <InfoButton title="Dolor" text="0 = Sin dolor, 10 = Extremo." /></label>
                            <span className="text-xs font-black text-red-400">{pain}/10</span>
                        </div>
                        <input type="range" min="0" max="10" value={pain} onChange={e => setPain(parseInt(e.target.value))} className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-red-500" />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Calzado</label>
                            <select value={ftw} onChange={e => setFtw(e.target.value as any)} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:border-cyan-500 outline-none transition-colors">
                                <option value="Flats">Zapatillas</option>
                                <option value="Spikes">Clavos</option>
                                <option value="Other">Otro</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Viento</label>
                            <select value={wnd} onChange={e => setWnd(e.target.value as any)} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:border-cyan-500 outline-none transition-colors">
                                <option value="Neutral">Neutral</option>
                                <option value="Tail">A favor</option>
                                <option value="Head">En contra</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-black text-slate-400 block mb-1 uppercase tracking-widest">Notas / Sensaciones</label>
                        <textarea
                            value={nts}
                            onChange={e => setNts(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-4 text-xs text-white h-24 focus:border-cyan-500 outline-none transition-all placeholder-slate-700 resize-none shadow-inner"
                            placeholder="¿Cómo te sentiste?"
                        />
                    </div>
                </div>

                <button onClick={save} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-2xl transition-all active:scale-95 shadow-lg shadow-emerald-900/40 uppercase tracking-widest text-xs">
                    Guardar Registro
                </button>
            </div>
        </div>
    );
};
