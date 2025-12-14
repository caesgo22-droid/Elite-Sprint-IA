
import * as React from 'react';
import { UserProfile, BiomechanicalAnalysis, PerformanceLog } from '../types';
import { Shield, Share2, Medal, Zap, Activity, Brain } from 'lucide-react';
import { useApp } from '../contexts/AppContext';

export const AthletePassport: React.FC = () => {
    const { userProfile, analysisHistory, logs } = useApp();
    const { pbs, events } = userProfile;

    // --- ALGORITHM: CALCULATE OVR (0-99) ---
    const calculateScores = () => {
        // 1. SPEED SCORE (Based on PB vs World Class Standards)
        const pb100 = parseFloat(pbs['100m']?.time || '99');
        let speedScore = 50;
        if (pb100 < 10.0) speedScore = 99;
        else if (pb100 < 11.0) speedScore = 90 + (11.0 - pb100) * 10;
        else if (pb100 < 12.0) speedScore = 80 + (12.0 - pb100) * 10;
        else if (pb100 < 14.0) speedScore = 60 + (14.0 - pb100) * 10;
        else speedScore = 50;

        // 2. TECHNIQUE SCORE (Avg of Video Analysis)
        const recentAnalysis = analysisHistory.slice(0, 5);
        const techScore = recentAnalysis.length > 0 
            ? recentAnalysis.reduce((acc, curr) => acc + curr.score, 0) / recentAnalysis.length 
            : 60; // Base score

        // 3. FORM SCORE (Consistency)
        const recentLogs = logs.filter(l => {
            const date = new Date(l.date);
            const now = new Date();
            return (now.getTime() - date.getTime()) / (1000 * 3600 * 24) < 30; // Last 30 days
        });
        const formScore = Math.min(99, 50 + (recentLogs.length * 4));

        // 4. IQ / TACTICS (Experience)
        const iqScore = Math.min(99, 50 + (userProfile.yearsExperience * 5));

        // GLOBAL OVR
        const ovr = Math.round((speedScore * 0.4) + (techScore * 0.3) + (formScore * 0.2) + (iqScore * 0.1));

        return { speed: Math.round(speedScore), tech: Math.round(techScore), form: Math.round(formScore), iq: Math.round(iqScore), ovr };
    };

    const scores = calculateScores();
    const mainEvent = events[0] || 'SPRINT';

    return (
        <div className="relative group perspective-1000 w-full max-w-sm mx-auto">
            {/* CARD CONTAINER */}
            <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-2 border-yellow-500/50 rounded-[2rem] p-6 shadow-[0_0_40px_-10px_rgba(234,179,8,0.3)] overflow-hidden transition-transform duration-500 hover:scale-[1.02]">
                
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-yellow-500 via-transparent to-transparent"></div>
                
                {/* TOP HEADER */}
                <div className="flex justify-between items-start mb-6 relative z-10">
                    <div className="flex flex-col">
                        <span className="text-5xl font-black text-yellow-400 drop-shadow-lg tracking-tighter">{scores.ovr}</span>
                        <span className="text-sm font-bold text-slate-400 tracking-widest uppercase">{mainEvent}</span>
                    </div>
                    <div className="w-16 h-10 flex items-center justify-center">
                         {/* Dynamic Flag/Icon could go here */}
                         <Shield size={40} className="text-yellow-500/80" strokeWidth={1}/>
                    </div>
                </div>

                {/* AVATAR AREA */}
                <div className="relative w-32 h-32 mx-auto mb-6">
                    <div className="w-full h-full rounded-full bg-gradient-to-t from-slate-700 to-slate-600 border-4 border-slate-500 shadow-inner flex items-center justify-center overflow-hidden">
                        <span className="text-4xl font-bold text-slate-400 select-none">
                            {userProfile.name ? userProfile.name.charAt(0).toUpperCase() : 'A'}
                        </span>
                    </div>
                    {/* Rank Badge */}
                    <div className="absolute -bottom-2 -right-2 bg-yellow-500 text-black font-black text-xs px-2 py-1 rounded border border-white shadow-lg">
                        LVL {userProfile.experienceLevel === 'Elite' ? 'V' : userProfile.experienceLevel === 'Advanced' ? 'IV' : 'III'}
                    </div>
                </div>

                {/* NAME */}
                <div className="text-center mb-6 border-b border-yellow-500/30 pb-4">
                    <h3 className="text-2xl font-black text-white uppercase tracking-tight truncate">{userProfile.name || "ATLETA"}</h3>
                    <p className="text-xs text-yellow-500/80 font-bold uppercase tracking-widest mt-1">Elite Sprint AI Passport</p>
                </div>

                {/* STATS GRID */}
                <div className="grid grid-cols-2 gap-y-3 gap-x-6 px-2 relative z-10">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-400">PAC</span>
                        <span className={`text-lg font-black ${scores.speed > 80 ? 'text-emerald-400' : 'text-white'}`}>{scores.speed}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-400">TEC</span>
                        <span className={`text-lg font-black ${scores.tech > 80 ? 'text-purple-400' : 'text-white'}`}>{scores.tech}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-400">FOR</span>
                        <span className={`text-lg font-black ${scores.form > 80 ? 'text-cyan-400' : 'text-white'}`}>{scores.form}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-400">IQ</span>
                        <span className={`text-lg font-black ${scores.iq > 80 ? 'text-blue-400' : 'text-white'}`}>{scores.iq}</span>
                    </div>
                </div>

                {/* BOTTOM SHINE */}
                <div className="absolute bottom-0 left-0 w-full h-1/3 bg-gradient-to-t from-yellow-500/10 to-transparent pointer-events-none"></div>
            </div>
            
            <div className="text-center mt-4 opacity-50 text-[10px] uppercase font-bold text-slate-500">
                Official Virtual Card • Season 2024
            </div>
        </div>
    );
};
