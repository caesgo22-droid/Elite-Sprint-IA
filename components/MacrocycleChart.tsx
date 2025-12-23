import * as React from 'react';
import { useMemo } from 'react';
import { Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ComposedChart, Line, Legend } from 'recharts';
import { BarChart3, Activity, AlertCircle, Trophy, Stethoscope } from 'lucide-react';
import { Injury } from '../types';

interface MacrocycleChartProps {
    history: any[];
    currentPlan: any;
    injuries?: Injury[];
    competitions?: { id: string; name: string; date: string }[];
    therapyLogs?: any[];
}

export const MacrocycleChart: React.FC<MacrocycleChartProps> = ({
    history,
    currentPlan,
    injuries,
    competitions,
    therapyLogs
}) => {
    const data = useMemo(() => {
        const allPlans = [...history].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        const recentHistory = allPlans.slice(-4);

        const calcLoad = (plan: any) => {
            let load = 0;
            if (plan && plan.sessions) {
                plan.sessions.forEach((s: any) => {
                    const factor = s.intensity === 'Max' ? 5 : s.intensity === 'High' ? 4 : s.intensity === 'Medium' ? 3 : 1;
                    load += factor * 10;
                });
            }
            return load;
        };

        const chartData: any[] = [];
        let rollingLoads: number[] = [];

        recentHistory.forEach((plan, i) => {
            const weekDate = new Date(plan.createdAt);
            const load = calcLoad(plan);
            rollingLoads.push(load);

            // Simplified ACWR for visualization
            const acute = load;
            const chronic = rollingLoads.length > 1 ? rollingLoads.reduce((a, b) => a + b, 0) / rollingLoads.length : load;
            const acwr = chronic > 0 ? acute / chronic : 1;

            chartData.push({
                name: `Sem ${-1 * (recentHistory.length - i)}`,
                realLoad: load,
                projectedLoad: null,
                isCurrent: false,
                fullDate: weekDate.toLocaleDateString(),
                weekStart: weekDate,
                acwr: parseFloat(acwr.toFixed(2))
            });
        });

        const currentLoad = currentPlan ? calcLoad(currentPlan) : 0;
        rollingLoads.push(currentLoad);
        const acuteNow = currentLoad;
        const chronicNow = rollingLoads.reduce((a, b) => a + b, 0) / rollingLoads.length;
        const acwrNow = chronicNow > 0 ? acuteNow / chronicNow : 1;

        chartData.push({
            name: 'ACTUAL',
            realLoad: currentLoad,
            projectedLoad: currentLoad,
            isCurrent: true,
            fullDate: 'Esta Semana',
            weekStart: new Date(),
            acwr: parseFloat(acwrNow.toFixed(2))
        });

        let lastLoad = currentLoad || 150;
        const phase = currentPlan?.phase || 'General Prep';
        for (let i = 1; i <= 3; i++) {
            let nextLoad = lastLoad;
            if (phase.includes('Specific') || phase.includes('Pre-Comp')) {
                if (i === 3) nextLoad = lastLoad * 0.7;
                else nextLoad = lastLoad * 1.05;
            } else if (phase.includes('Competition') || phase.includes('Tapering')) {
                nextLoad = lastLoad * 0.85;
            } else {
                nextLoad = lastLoad * 1.02;
            }

            chartData.push({
                name: `Sem +${i}`,
                realLoad: null,
                projectedLoad: Math.round(nextLoad),
                isCurrent: false,
                fullDate: 'Proyección',
                weekStart: new Date(Date.now() + (i * 7 * 24 * 60 * 60 * 1000)),
                acwr: null
            });
            lastLoad = nextLoad;
        }
        return chartData;
    }, [history, currentPlan]);

    const milestones = useMemo(() => {
        const marks: { week: string; type: 'injury' | 'competition' | 'therapy'; label: string; icon: any }[] = [];

        injuries?.filter(inj => inj.diagnosedDate).forEach(inj => {
            const injDate = new Date(inj.diagnosedDate!);
            data.forEach(d => {
                if (d.weekStart) {
                    const weekStart = new Date(d.weekStart);
                    const weekEnd = new Date(weekStart);
                    weekEnd.setDate(weekEnd.getDate() + 7);
                    if (injDate >= weekStart && injDate < weekEnd) {
                        marks.push({ week: d.name, type: 'injury', label: `Lesión: ${inj.type}`, icon: AlertCircle });
                    }
                }
            });
        });

        competitions?.forEach(comp => {
            const compDate = new Date(comp.date);
            data.forEach(d => {
                if (d.weekStart) {
                    const weekStart = new Date(d.weekStart);
                    const weekEnd = new Date(weekStart);
                    weekEnd.setDate(weekEnd.getDate() + 7);
                    if (compDate >= weekStart && compDate < weekEnd) {
                        marks.push({ week: d.name, type: 'competition', label: `Comp: ${comp.name}`, icon: Trophy });
                    }
                }
            });
        });

        therapyLogs?.filter(log => log.type === 'Recovery' || log.event === 'Therapy').forEach(log => {
            const logDate = new Date(log.date);
            data.forEach(d => {
                if (d.weekStart) {
                    const weekStart = new Date(d.weekStart);
                    const weekEnd = new Date(weekStart);
                    weekEnd.setDate(weekEnd.getDate() + 7);
                    if (logDate >= weekStart && logDate < weekEnd) {
                        if (!marks.some(m => m.week === d.name && m.type === 'therapy')) {
                            marks.push({ week: d.name, type: 'therapy', label: 'Terapia/Recuperación', icon: Stethoscope });
                        }
                    }
                }
            });
        });

        return marks;
    }, [data, injuries, competitions, therapyLogs]);

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden group/chart">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-lg font-black text-white uppercase tracking-tighter flex items-center gap-2">
                        <BarChart3 size={18} className="text-cyan-400" /> Macrociclo Maestro
                    </h3>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Timeline 8 Semanas • Carga vs ACWR</p>
                </div>
                <div className="flex gap-3 text-[9px] font-black uppercase">
                    <span className="flex items-center gap-1.5 text-cyan-400"><div className="w-2 h-2 bg-cyan-500 rounded-full shadow-[0_0_8px_rgba(34,211,238,0.5)]"></div> Carga</span>
                    <span className="flex items-center gap-1.5 text-indigo-400"><div className="w-2 h-2 bg-indigo-500 rounded-sm"></div> ACWR</span>
                </div>
            </div>

            <div className="h-64 w-full">
                {data.length > 0 && (
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={data} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorRealMacro" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} strokeOpacity={0.5} />
                            <XAxis
                                dataKey="name"
                                tick={{ fontSize: 10, fill: '#64748b', fontWeight: '900' }}
                                axisLine={false}
                                tickLine={false}
                                interval={0}
                            />
                            <YAxis yAxisId="left" hide domain={[0, 'auto']} />
                            <YAxis yAxisId="right" orientation="right" hide domain={[0, 2.5]} />

                            <Tooltip
                                contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '16px', padding: '12px', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                                labelStyle={{ color: '#94a3b8', fontSize: '10px', fontWeight: '900', marginBottom: '8px', textTransform: 'uppercase' }}
                                content={({ active, payload, label }) => {
                                    if (active && payload && payload.length) {
                                        const weekMilestones = milestones.filter(m => m.week === label);
                                        return (
                                            <div className="bg-slate-950 border border-slate-800 p-3 rounded-2xl shadow-2xl">
                                                <p className="text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">{label}</p>
                                                {payload.map((p: any, i: number) => (
                                                    <div key={i} className="flex items-center justify-between gap-4 mb-1">
                                                        <span className="text-[10px] font-bold text-slate-300 uppercase">{p.name === 'realLoad' ? 'Carga Real' : p.name === 'acwr' ? 'ACWR' : 'Proyección'}</span>
                                                        <span className={`text-xs font-black ${p.name === 'acwr' ? 'text-indigo-400' : 'text-cyan-400'}`}>{p.value}</span>
                                                    </div>
                                                ))}
                                                {weekMilestones.length > 0 && (
                                                    <div className="mt-2 pt-2 border-t border-slate-800">
                                                        {weekMilestones.map((m, i) => (
                                                            <div key={i} className="flex items-center gap-2 mt-1">
                                                                <m.icon size={12} className={m.type === 'injury' ? 'text-red-500' : m.type === 'competition' ? 'text-yellow-500' : 'text-blue-500'} />
                                                                <span className="text-[10px] font-bold text-white">{m.label}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />

                            <Area
                                yAxisId="left"
                                type="monotone"
                                dataKey="realLoad"
                                name="realLoad"
                                stroke="#22d3ee"
                                strokeWidth={4}
                                fillOpacity={1}
                                fill="url(#colorRealMacro)"
                                activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2, fill: '#22d3ee' }}
                            />

                            <Line
                                yAxisId="right"
                                type="monotone"
                                dataKey="acwr"
                                name="acwr"
                                stroke="#6366f1"
                                strokeWidth={3}
                                dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#0f172a' }}
                                activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2, fill: '#6366f1' }}
                            />

                            <Area
                                yAxisId="left"
                                type="monotone"
                                dataKey="projectedLoad"
                                name="projectedLoad"
                                stroke="#475569"
                                strokeWidth={2}
                                strokeDasharray="6 4"
                                fill="transparent"
                            />

                            <ReferenceLine yAxisId="right" y={1.5} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'right', value: 'RIESGO', fill: '#ef4444', fontSize: 8, fontWeight: 'bold' }} />
                            <ReferenceLine yAxisId="right" y={0.8} stroke="#3b82f6" strokeDasharray="3 3" label={{ position: 'right', value: 'BAJO', fill: '#3b82f6', fontSize: 8, fontWeight: 'bold' }} />

                            <ReferenceLine yAxisId="left" x="ACTUAL" stroke="#22d3ee" strokeDasharray="4 4" strokeWidth={2} />

                            {milestones.filter(m => m.type === 'injury').map((m, i) => (
                                <ReferenceLine key={`inj-${i}`} yAxisId="left" x={m.week} stroke="#ef4444" strokeWidth={2} strokeOpacity={0.8} />
                            ))}
                            {milestones.filter(m => m.type === 'competition').map((m, i) => (
                                <ReferenceLine key={`comp-${i}`} yAxisId="left" x={m.week} stroke="#eab308" strokeWidth={2} strokeOpacity={0.8} />
                            ))}
                        </ComposedChart>
                    </ResponsiveContainer>
                )}
            </div>

            <div className="flex justify-between items-center mt-4">
                <div className="flex gap-2">
                    <span className="text-[9px] font-black text-slate-500 uppercase flex items-center gap-1"><AlertCircle size={10} className="text-red-500" /> Zona de Riesgo {'>'} 1.5</span>
                </div>
                <div className="bg-indigo-500/10 border border-indigo-500/20 px-4 py-1.5 rounded-2xl flex items-center gap-2">
                    <Activity size={12} className="text-indigo-400" />
                    <span className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider">Modulado por IA</span>
                </div>
            </div>
        </div>
    );
};
