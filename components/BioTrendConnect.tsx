import React, { useState, useMemo } from 'react';
import { useApp } from '../contexts/AppContext';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area, ReferenceLine
} from 'recharts';
import { TrendingUp, Activity, Timer, Zap, ArrowRight, BrainCircuit, ChevronLeft } from 'lucide-react';
import { predictRaceTime, calculateRequiredVelocity } from '../utils/raceModel';
import { useNavigate } from 'react-router-dom';

export const BioTrendConnect: React.FC = () => {
    const { analysisHistory } = useApp();
    const navigate = useNavigate();
    const [selectedMetric, setSelectedMetric] = useState<'velocity' | 'stiffness' | 'gct'>('velocity');
    const [targetTime, setTargetTime] = useState(10.50);

    // Prepare Data
    const trendData = useMemo(() => {
        // Sort by timestamp/date
        const sorted = [...analysisHistory]
            .filter(a => a.expertData?.velocity || a.score) // Ensure some data exists
            .sort((a, b) => {
                const dateA = a.timestamp || new Date(a.savedAt || 0).getTime();
                const dateB = b.timestamp || new Date(b.savedAt || 0).getTime();
                return dateA - dateB;
            });

        return sorted.map(a => {
            // Extract numerical velocity. If string "9.8 m/s", parse it.
            let vel = 0;
            if (a.expertData?.velocity) {
                const vStr = a.expertData.velocity.replace(' m/s', '');
                vel = parseFloat(vStr);
            }
            // Fallback to score proxy if no direct velocity (Score ~ Vel * 10 roughly for older data)
            if (!vel && a.score) vel = parseFloat(a.score) / 10;

            // Stiffness Measure (Leg Stiffness or Vertical Oscillation proxy)
            let stiffness = 0;
            if (a.expertData?.forceFactor) stiffness = a.expertData.forceFactor;

            // GCT
            let gct = 0;
            if (a.expertData?.groundContactTime) {
                gct = parseFloat(a.expertData.groundContactTime.replace('s', ''));
            }

            return {
                id: a.id,
                date: new Date(a.timestamp ? a.timestamp * 1000 : (a.savedAt || Date.now())).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                velocity: vel || null,
                stiffness: stiffness || null,
                gct: gct || null,
                fullDate: new Date(a.timestamp ? a.timestamp * 1000 : (a.savedAt || Date.now())).toLocaleDateString()
            };
        });
    }, [analysisHistory]);

    // Current Best (Max Velocity recently)
    const currentMaxVel = useMemo(() => {
        if (trendData.length === 0) return 0;
        // Look at last 5 sessions to find "Current" max capabilities
        const recent = trendData.slice(-5);
        return Math.max(...recent.map(d => d.velocity || 0));
    }, [trendData]);

    const prediction100 = predictRaceTime(currentMaxVel, '100m');
    const requiredVelForTarget = calculateRequiredVelocity(targetTime, '100m');

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-24 pt-4">
            {/* Header */}
            <div className="flex items-center gap-4 border-b border-slate-800 pb-4">
                <button onClick={() => navigate('/')} className="p-2 bg-slate-900 rounded-full text-slate-400 hover:text-white transition-colors">
                    <ChevronLeft size={20} />
                </button>
                <div>
                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-2">
                        <TrendingUp className="text-purple-500" /> BioTrends
                    </h2>
                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Analytics & Race Modeling</p>
                </div>
            </div>

            {/* Main Chart Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-5 shadow-xl">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex gap-2 bg-slate-950 p-1 rounded-xl">
                        {[
                            { id: 'velocity', label: 'Velocity', icon: Zap },
                            { id: 'stiffness', label: 'Stiffness', icon: Activity },
                            { id: 'gct', label: 'G.C.T.', icon: Timer }
                        ].map(m => (
                            <button
                                key={m.id}
                                onClick={() => setSelectedMetric(m.id as any)}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${selectedMetric === m.id ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'
                                    }`}
                            >
                                <m.icon size={12} /> {m.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trendData}>
                            <defs>
                                <linearGradient id="colorVel" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                            <XAxis
                                dataKey="date"
                                stroke="#475569"
                                tick={{ fontSize: 10, fontWeight: 'bold' }}
                                axisLine={false}
                                tickLine={false}
                                dy={10}
                            />
                            <YAxis
                                stroke="#475569"
                                tick={{ fontSize: 10, fontWeight: 'bold' }}
                                axisLine={false}
                                tickLine={false}
                                domain={['auto', 'auto']}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                                itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                                labelStyle={{ color: '#94a3b8', fontSize: '10px', marginBottom: '4px' }}
                            />
                            <Area
                                type="monotone"
                                dataKey={selectedMetric}
                                stroke="#8b5cf6"
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#colorVel)"
                                activeDot={{ r: 6, strokeWidth: 0, fill: '#fff' }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Race Predictor Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Prediction Card */}
                <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 border border-slate-800 rounded-[2rem] p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3 opacity-10">
                        <BrainCircuit size={100} className="text-white" />
                    </div>

                    <h3 className="text-sm font-black text-white uppercase tracking-tight mb-4 flex items-center gap-2">
                        <BrainCircuit size={16} className="text-cyan-400" />
                        Race Predictor (100m)
                    </h3>

                    <div className="flex items-center gap-6 mb-6">
                        <div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block">Current Max Vel</span>
                            <span className="text-3xl font-black text-white tracking-tighter">{currentMaxVel.toFixed(2)} <span className="text-xs text-slate-500 font-bold">m/s</span></span>
                        </div>
                        <ArrowRight className="text-slate-600" />
                        <div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block">Predicted Time</span>
                            <span className="text-3xl font-black text-cyan-400 tracking-tighter text-shadow-glow">{prediction100.time} <span className="text-xs text-slate-500 font-bold">s</span></span>
                        </div>
                    </div>

                    <div className="bg-slate-950/50 rounded-xl p-3 border border-slate-800/50">
                        <p className="text-[10px] text-slate-400 leading-relaxed">
                            Based on your recent Max Velocity of <strong>{currentMaxVel.toFixed(2)} m/s</strong> and elite acceleration profiles.
                            Confidence: <span className="text-emerald-400 font-bold">{prediction100.confidence}%</span>.
                        </p>
                    </div>
                </div>

                {/* Target Calculator */}
                <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-6 flex flex-col justify-between">
                    <div>
                        <h3 className="text-sm font-black text-white uppercase tracking-tight mb-4 flex items-center gap-2">
                            <Activity size={16} className="text-emerald-400" />
                            Target Setting
                        </h3>

                        <div className="mb-4">
                            <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block mb-2">Goal 100m Time (s)</label>
                            <input
                                type="number"
                                value={targetTime}
                                onChange={e => setTargetTime(parseFloat(e.target.value))}
                                step="0.05"
                                className="bg-slate-950 border border-slate-700 rounded-xl p-3 text-2xl font-black text-white w-full outline-none focus:border-emerald-500 transition-colors"
                            />
                        </div>
                    </div>

                    <div className="bg-emerald-900/10 border border-emerald-500/20 rounded-xl p-4">
                        <span className="text-[9px] text-emerald-300 font-bold uppercase tracking-widest block mb-1">Required Max Velocity</span>
                        <div className="text-2xl font-black text-emerald-400 tracking-tighter">
                            {requiredVelForTarget.toFixed(2)} <span className="text-xs text-emerald-600/70">m/s</span>
                        </div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
                            <div
                                className="h-full bg-emerald-500 rounded-full transition-all duration-1000"
                                style={{ width: `${Math.min(100, (currentMaxVel / requiredVelForTarget) * 100)}%` }}
                            ></div>
                        </div>
                        <div className="text-[8px] text-right text-slate-500 font-bold mt-1 uppercase">
                            {((currentMaxVel / requiredVelForTarget) * 100).toFixed(0)}% Achieved
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
