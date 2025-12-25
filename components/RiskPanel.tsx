import * as React from 'react';
import { AlertTriangle, Activity } from 'lucide-react';
import { UserProfile } from '../types';

interface RiskPanelProps {
    roster: {
        uid: string;
        profile: UserProfile;
        risk: 'High' | 'Low' | 'Optimal';
        acwrRatio: number;
    }[];
    onSelectAthlete: (uid: string) => void;
}

export const RiskPanel: React.FC<RiskPanelProps> = ({ roster, onSelectAthlete }) => {
    // Filter athletes in High Risk zone (ACWR > 1.3 or explicitly marked High)
    const highRiskAthletes = roster.filter(a => a.risk === 'High');

    if (highRiskAthletes.length === 0) return null;

    return (
        <div className="bg-red-500/10 border border-red-500/30 rounded-3xl p-6 mb-6 animate-in slide-in-from-top-4">
            <div className="flex items-center gap-3 mb-4">
                <div className="bg-red-500 p-2 rounded-xl text-white shadow-[0_0_15px_rgba(239,68,68,0.4)] animate-pulse">
                    <AlertTriangle size={20} />
                </div>
                <div>
                    <h3 className="text-lg font-black text-white uppercase tracking-tighter">Zona de Peligro</h3>
                    <p className="text-[10px] text-red-300 font-bold uppercase tracking-widest">Atención Prioritaria (Óptimo: 0.8 - 1.3)</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {highRiskAthletes.map(athlete => (
                    <button
                        key={athlete.uid}
                        onClick={() => onSelectAthlete(athlete.uid)}
                        className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/50 p-3 rounded-2xl flex items-center justify-between transition-all group text-left"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center border border-red-500/30">
                                <Activity size={18} className="text-red-500" />
                            </div>
                            <div>
                                <div className="text-sm font-bold text-white group-hover:text-red-200">{athlete.profile?.name}</div>
                                <div className="text-[10px] text-red-400 font-black uppercase">ACWR: {athlete.acwrRatio.toFixed(2)}</div>
                            </div>
                        </div>
                        <div className="px-3 py-1 rounded-lg bg-red-500/20 text-[9px] font-bold text-red-300 border border-red-500/30 uppercase">
                            Revisar
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
};
