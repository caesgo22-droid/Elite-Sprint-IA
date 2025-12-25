
import * as React from 'react';
import { X, CheckCheck, Trash2 } from 'lucide-react';
import { BiomechanicalAnalysis } from '../../types';

interface AnalysisHistoryListProps {
    analysisHistory: BiomechanicalAnalysis[];
    selectedIds: string[];
    toggleSelection: (id: string) => void;
    deleteAnalysis: (id: string) => void;
    setActiveAnalysis: (a: BiomechanicalAnalysis) => void;
    setComparisonMode: (b: boolean) => void;
    setViewHistory: (b: boolean) => void;
    locationSearch: string;
}

export const AnalysisHistoryList: React.FC<AnalysisHistoryListProps> = ({
    analysisHistory,
    selectedIds,
    toggleSelection,
    deleteAnalysis,
    setActiveAnalysis,
    setComparisonMode,
    setViewHistory,
    locationSearch
}) => {
    const params = new URLSearchParams(locationSearch);
    const filter = params.get('filter');

    const filteredHistory = analysisHistory.filter(item => {
        if (filter === 'pending') return item.reviewStatus === 'Pending';
        return true;
    });

    return (
        <div className="max-w-xl mx-auto space-y-4 pt-10 pb-24">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Historial Bio</h2>
                <button onClick={() => setViewHistory(false)} className="p-2 bg-slate-800 rounded-full text-white"><X size={18} /></button>
            </div>

            {selectedIds.length > 0 && (
                <div className="sticky top-0 z-10 bg-indigo-600 text-white p-4 rounded-xl shadow-xl flex justify-between items-center animate-in slide-in-from-top-2">
                    <span className="font-bold text-xs uppercase">{selectedIds.length} Seleccionados</span>
                    <div className="flex gap-2">
                        {selectedIds.length === 1 && (
                            <button
                                onClick={() => {
                                    const selected = analysisHistory.find(a => a.id === selectedIds[0]);
                                    if (selected) {
                                        setActiveAnalysis(selected);
                                        setViewHistory(false);
                                    }
                                }}
                                className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-xs font-black uppercase"
                            >
                                Ver Análisis
                            </button>
                        )}
                        {selectedIds.length === 2 && (
                            <button
                                onClick={() => {
                                    setComparisonMode(true);
                                    setViewHistory(false);
                                }}
                                className="bg-white text-indigo-600 px-4 py-2 rounded-lg text-xs font-black uppercase hover:bg-indigo-50"
                            >
                                Comparar
                            </button>
                        )}
                        {/* Clear selection button is usually provided by parent or here */}
                    </div>
                </div>
            )}

            {filteredHistory.length === 0 ? (
                <div className="text-center py-20 text-slate-500 uppercase text-[10px] font-bold">No hay registros previos.</div>
            ) : filteredHistory.map(item => (
                <div
                    key={item.id}
                    onClick={() => toggleSelection(item.id)}
                    className={`group bg-slate-900 border transition-all rounded-3xl p-4 flex items-center justify-between cursor-pointer ${selectedIds.includes(item.id)
                        ? 'border-indigo-500 bg-indigo-900/10'
                        : item.reviewStatus === 'Pending'
                            ? 'border-indigo-500/50 hover:border-indigo-400'
                            : 'border-slate-800 hover:border-slate-700'
                        }`}
                    style={{ contentVisibility: 'auto' }} // Basic optimization
                >
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <img src={item.thumbnail} className="w-16 h-10 object-cover rounded-lg border border-slate-800" alt="thumbnail" />
                            {selectedIds.includes(item.id) && (
                                <div className="absolute -top-2 -right-2 bg-indigo-500 text-white rounded-full p-1 border-2 border-slate-950">
                                    <CheckCheck size={10} />
                                </div>
                            )}
                            {item.reviewStatus === 'Pending' && !selectedIds.includes(item.id) && (
                                <div className="absolute -top-2 -right-2 bg-red-500 rounded-full w-3 h-3 border-2 border-slate-950 animate-pulse" title="Pendiente de revisión" />
                            )}
                        </div>
                        <div className="text-left">
                            <div className="text-xs font-black text-white uppercase">{item.phaseDetected || 'Análisis General'}</div>
                            <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">
                                {item.savedAt ? new Date(item.savedAt).toLocaleDateString() : (item.timestamp ? new Date(item.timestamp * 1000).toLocaleDateString() : 'Fecha Desconocida')}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="text-right">
                            <div className="text-lg font-black text-emerald-400">{item.score}</div>
                            <div className="text-[8px] text-slate-600 font-bold uppercase">SCORE</div>
                        </div>
                        <button
                            onClick={(e) => { e.stopPropagation(); if (confirm('¿Eliminar del historial?')) deleteAnalysis(item.id); }}
                            className="p-2 text-slate-700 hover:text-red-500 transition-colors"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};
