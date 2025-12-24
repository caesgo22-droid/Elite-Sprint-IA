import * as React from 'react';
import { X } from 'lucide-react';

interface RecoveryProtocolViewProps {
    data: {
        sessionType: string;
        nutrition: {
            carbs: string;
            protein: string;
            hydration: string;
            notes: string;
        };
        protocols: string[];
    };
    onClose: () => void;
}

export const RecoveryProtocolView: React.FC<RecoveryProtocolViewProps> = ({
    data,
    onClose
}) => {
    return (
        <div className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-slate-900 border border-emerald-500/30 p-6 rounded-[2.5rem] w-full max-w-sm space-y-6 relative shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center">
                    <h3 className="text-xl font-black text-white uppercase tracking-tight">Protocolo Pro</h3>
                    <button onClick={onClose} className="p-2 bg-slate-800 rounded-full text-white hover:bg-slate-700 transition-colors"><X size={20} /></button>
                </div>
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                    <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Tipo de Estresor</div>
                    <div className="text-3xl font-black text-white uppercase">{data.sessionType}</div>
                </div>
                <div className="space-y-4">
                    <div>
                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Nutrición & Hidratación</h4>
                        <div className="grid grid-cols-3 gap-2 mb-3">
                            <div className="bg-slate-800 p-2 rounded-xl text-center">
                                <div className="text-[8px] text-slate-400 uppercase font-bold">Carbos</div>
                                <div className="text-xs font-black text-white">{data.nutrition.carbs}</div>
                            </div>
                            <div className="bg-slate-800 p-2 rounded-xl text-center">
                                <div className="text-[8px] text-slate-400 uppercase font-bold">Prot</div>
                                <div className="text-xs font-black text-white">{data.nutrition.protein}</div>
                            </div>
                            <div className="bg-slate-800 p-2 rounded-xl text-center">
                                <div className="text-[8px] text-slate-400 uppercase font-bold">H2O</div>
                                <div className="text-xs font-black text-white">{data.nutrition.hydration}</div>
                            </div>
                        </div>
                        <p className="text-[11px] text-slate-300 italic mb-4 leading-snug">"{data.nutrition.notes}"</p>
                    </div>
                    <div>
                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Protocolos Recomendados</h4>
                        <div className="grid grid-cols-1 gap-2">
                            {data.protocols?.map((protocol: string, i: number) => (
                                <div key={i} className="bg-slate-800/50 border border-slate-700 p-3 rounded-xl text-[10px] font-bold text-white uppercase flex items-center gap-2 transition-all hover:border-emerald-500/30">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                    {protocol}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <button onClick={onClose} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 rounded-2xl uppercase tracking-widest text-xs transition-all active:scale-[0.98]">Entendido</button>
            </div>
        </div>
    );
};
