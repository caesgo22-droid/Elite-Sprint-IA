
import * as React from 'react';
import { useMemo } from 'react';
import { Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ComposedChart } from 'recharts';
import { BarChart3 } from 'lucide-react';
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
        recentHistory.forEach((plan, i) => {
            const weekDate = new Date(plan.createdAt);
            chartData.push({
                name: `Sem ${-1 * (recentHistory.length - i)}`,
                realLoad: calcLoad(plan),
                projectedLoad: null,
                isCurrent: false,
                fullDate: weekDate.toLocaleDateString(),
                weekStart: weekDate
            });
        });
        const currentLoad = currentPlan ? calcLoad(currentPlan) : 0;
        const now = new Date();
        chartData.push({
            name: 'ACTUAL',
            realLoad: currentLoad,
            projectedLoad: currentLoad,
            isCurrent: true,
            fullDate: 'Esta Semana',
            weekStart: now
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
            const futureDate = new Date();
            futureDate.setDate(now.getDate() + (i * 7));
            chartData.push({
                name: `Sem +${i}`,
                realLoad: null,
                projectedLoad: Math.round(nextLoad),
                isCurrent: false,
                fullDate: 'Proyección',
                weekStart: futureDate
            });
            lastLoad = nextLoad;
        }
        return chartData;
    }, [history, currentPlan]);

    const milestones = useMemo(() => {
        const marks: { week: string; type: 'injury' | 'competition' | 'therapy'; label: string }[] = [];

        injuries?.filter(inj => inj.diagnosedDate).forEach(inj => {
            const injDate = new Date(inj.diagnosedDate!);
            data.forEach(d => {
                if (d.weekStart) {
                    const weekStart = new Date(d.weekStart);
                    const weekEnd = new Date(weekStart);
                    weekEnd.setDate(weekEnd.getDate() + 7);
                    if (injDate >= weekStart && injDate < weekEnd) {
                        marks.push({ week: d.name, type: 'injury', label: `🔴 Lesión` });
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
                        marks.push({ week: d.name, type: 'competition', label: `🏆 ${comp.name}` });
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
                            marks.push({ week: d.name, type: 'therapy', label: '💊 Ter' });
                        }
                    }
                }
            });
        });

        return marks;
    }, [data, injuries, competitions, therapyLogs]);

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-black text-white uppercase tracking-tighter">Macrociclo (8 Semanas)</h3>
                <div className="flex gap-2 text-[8px] font-bold uppercase">
                    <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 bg-cyan-500 rounded-full"></div> Real</span>
                    <span className="flex items-center gap-1">🔴 Lesión</span>
                    <span className="flex items-center gap-1">💊 Ter</span>
                </div>
            </div>
            <div className="h-48 w-full">
                {data.length > 0 && (
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorReal" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                            <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 'bold' }} axisLine={false} tickLine={false} interval={0} />
                            <YAxis hide domain={[0, 'auto']} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '12px' }}
                                labelStyle={{ color: '#94a3b8', fontSize: '9px', fontWeight: 'bold' }}
                                formatter={(value: any, name: string, props: any) => {
                                    const weekMilestones = milestones.filter(m => m.week === props.payload.name);
                                    if (weekMilestones.length > 0) {
                                        return [`${value} ${weekMilestones.map(m => m.label).join(' ')}`, name === 'realLoad' ? 'Carga' : 'Futuro'];
                                    }
                                    return [value, name === 'realLoad' ? 'Carga' : 'Futuro'];
                                }}
                            />
                            <Area
                                type="monotone"
                                dataKey="realLoad"
                                name="Carga"
                                stroke="#22d3ee"
                                strokeWidth={4}
                                fillOpacity={1}
                                fill="url(#colorReal)"
                                activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2, fill: '#22d3ee' }}
                            />
                            <Area
                                type="monotone"
                                dataKey="projectedLoad"
                                name="Futuro"
                                stroke="#94a3b8"
                                strokeWidth={2}
                                strokeDasharray="5 5"
                                fill="transparent"
                            />
                            <ReferenceLine x="ACTUAL" stroke="#22d3ee" strokeDasharray="3 3" />
                            {milestones.filter(m => m.type === 'injury').map((m, i) => (
                                <ReferenceLine key={`inj-${i}`} x={m.week} stroke="#ef4444" strokeWidth={2} strokeOpacity={0.7} />
                            ))}
                            {milestones.filter(m => m.type === 'competition').map((m, i) => (
                                <ReferenceLine key={`comp-${i}`} x={m.week} stroke="#eab308" strokeWidth={2} strokeOpacity={0.7} />
                            ))}
                        </ComposedChart>
                    </ResponsiveContainer>
                )}
            </div>
            <div className="flex justify-center mt-2">
                <span className="text-[10px] text-cyan-400 font-bold bg-cyan-900/20 px-3 py-1 rounded-full border border-cyan-500/30">SEMANA ACTUAL</span>
            </div>
        </div>
    );
};
