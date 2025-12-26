// Macrocycle Chart - Optimized for 8-week visualization
import * as React from 'react';
import { useMemo, useState } from 'react';
import { Injury } from '../../types';
import { getSessionLoad } from '../../utils/loadCalculator';
import { Trophy, Activity, AlertCircle, Stethoscope, Info } from 'lucide-react';

interface MacrocycleChartProps {
    history: any[];
    currentPlan: any;
    injuries?: Injury[];
    competitions?: { id: string; name: string; date: string }[];
    therapyLogs?: any[];
    isStaff?: boolean;
    onUpdatePlan?: (updatedPlan: any) => void;
    acwrStats?: any; // Using any to avoid strict type issues with customized extended interface if not fully propagated, but effectively ACWROutput
}

// Helper to calculate smooth bezier curves
const getPathFromPoints = (points: { x: number; y: number }[], closeBottom = false, height = 480) => {
    if (points.length === 0) return "";

    const first = points[0];
    let d = `M ${first.x} ${first.y}`;

    for (let i = 0; i < points.length - 1; i++) {
        const p0 = i > 0 ? points[i - 1] : points[0];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = i !== points.length - 2 ? points[i + 2] : p2;

        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;

        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;

        d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }

    if (closeBottom) {
        d += ` L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;
    }

    return d;
};

export const MacrocycleChart: React.FC<MacrocycleChartProps> = ({
    history,
    currentPlan,
    injuries,
    competitions,
    therapyLogs,
    isStaff = false,
    onUpdatePlan,
    acwrStats
}) => {
    const [tooltip, setTooltip] = useState<{ x: number; y: number; content: React.ReactNode } | null>(null);
    const [editMode, setEditMode] = useState(false);

    // 1. Process Data
    const { chartPoints, milestones, metrics, maxLoad, rawPoints } = useMemo(() => {
        const rawPoints: any[] = [];

        // 1. History & Current (From United Source of Truth)
        if (acwrStats && (acwrStats as any).history) {
            const historyStats = (acwrStats as any).history as any[];

            // Optimize: Sample every 7th day for clarity, or just dump the last 30 days
            // Let's show the last 56 days (8 weeks)
            const daysToShow = 56;
            const relevantFn = (i: number) => i > historyStats.length - daysToShow;

            historyStats.forEach((day: any, i: number) => {
                if (relevantFn(i)) {
                    const date = new Date(day.dateStr);
                    const isToday = date.toDateString() === new Date().toDateString();

                    const diffDays = Math.floor((new Date().getTime() - date.getTime()) / (1000 * 3600 * 24));
                    const weekNum = Math.floor(diffDays / 7);
                    const isMonday = date.getDay() === 1;

                    rawPoints.push({
                        type: isToday ? 'current' : 'history',
                        load: day.acute * 7, // Visualizing Weekly Volume Equivalent
                        chronicLine: day.chronic * 7,
                        date: date,
                        label: isToday ? 'Actual' : (isMonday ? `S-${weekNum}` : '') // Label Weeks (S-1, S-2...)
                    });
                }
            });
        } else {
            // Fallback if no history (shouldn't happen with new logic, but safe render)
            rawPoints.push({
                type: 'current',
                load: 0,
                chronicLine: 0,
                date: new Date(),
                label: 'Actual'
            });
        }

        // 2. Projected (Future)
        let lastPoint = rawPoints[rawPoints.length - 1];
        let lastChronic = lastPoint ? lastPoint.chronicLine / 7 : 0; // Back to daily for math
        let lastAcute = lastPoint ? lastPoint.load / 7 : 0;

        const phase = currentPlan?.phase || 'General Prep';

        // Create 3 Weeks of Projection
        for (let i = 1; i <= 3; i++) {
            let targetLoad = lastAcute;

            if (phase.includes('Specific') || phase.includes('Pre-Comp')) {
                if (i === 3) targetLoad *= 0.7; // Deload
                else targetLoad *= 1.05; // Build
            } else if (phase.includes('Competition')) {
                targetLoad *= 0.85; // Maintenance
            } else if (phase.includes('Transition')) {
                targetLoad *= 0.6;
            } else {
                targetLoad *= 1.02; // General build
            }

            lastChronic = (lastChronic * 0.75) + (targetLoad * 0.25);

            rawPoints.push({
                type: 'projected',
                load: Math.round(targetLoad * 7),
                chronicLine: Math.round(lastChronic * 7),
                date: new Date(Date.now() + (i * 7 * 24 * 60 * 60 * 1000)),
                label: `S+${i}`
            });

            lastAcute = targetLoad;
        }

        // Metrics from Source of Truth
        const acwr = acwrStats?.ratio || 0;
        const currentLoad = (acwrStats?.acuteLoad || 0) * 7;
        const planLoad = 2200;
        const loadDeviation = planLoad > 0 ? ((currentLoad - planLoad) / planLoad) * 100 : 0;

        // Scaling
        const maxDataLoad = Math.max(...rawPoints.map(p => p.load), 100);
        const maxLimitVis = Math.max(...rawPoints.map(p => p.chronicLine * 1.5), 100);
        const scaleMax = Math.max(maxDataLoad, maxLimitVis) * 1.1;

        const width = 800;
        const height = 480;
        const marginX = 50;
        const effectiveWidth = width - (marginX * 2);

        const chartPoints = rawPoints.map((p, i) => {
            const chronic = p.chronicLine;
            const minLoad = chronic * 0.8;
            const maxLoad = chronic * 1.5;

            return {
                ...p,
                x: marginX + (i * (effectiveWidth / (rawPoints.length - 1))),
                y: height - ((p.load / scaleMax) * (height - 50)) - 30,
                yMin: height - ((minLoad / scaleMax) * (height - 50)) - 30,
                yMax: height - ((maxLoad / scaleMax) * (height - 50)) - 30,
                minLoad,
                maxLoad
            };
        });

        // Milestones
        const computedMilestones: any[] = [];

        // Helper to find closest point to date
        const findClosestPoint = (date: Date) => {
            const time = date.getTime();
            let closest = null;
            let minDiff = Infinity;

            chartPoints.forEach(p => {
                const diff = Math.abs(p.date.getTime() - time);
                if (diff < minDiff && diff < (3 * 24 * 60 * 60 * 1000)) { // Within 3 days
                    minDiff = diff;
                    closest = p;
                }
            });
            return closest;
        };

        injuries?.filter(inj => inj.diagnosedDate).forEach(inj => {
            const date = new Date(inj.diagnosedDate!);
            const p = findClosestPoint(date);
            if (p) {
                computedMilestones.push({
                    type: 'injury',
                    x: (p as any).x,
                    y: (p as any).y,
                    label: inj.type,
                    date: date.toLocaleDateString()
                });
            }
        });

        competitions?.forEach(comp => {
            const date = new Date(comp.date);
            const p = findClosestPoint(date);
            if (p) {
                computedMilestones.push({
                    type: 'competition',
                    x: (p as any).x,
                    y: (p as any).y - 40,
                    label: comp.name,
                    date: date.toLocaleDateString()
                });
            }
        });

        therapyLogs?.filter(log => log.type === 'Recovery' || log.event === 'Therapy').forEach(log => {
            const date = new Date(log.date);
            const p = findClosestPoint(date);
            if (p && !computedMilestones.find(m => m.type === 'therapy' && m.x === (p as any).x)) {
                computedMilestones.push({
                    type: 'therapy',
                    x: (p as any).x,
                    y: (p as any).y,
                    label: 'Terapia',
                    date: date.toLocaleDateString()
                });
            }
        });

        return {
            chartPoints,
            milestones: computedMilestones,
            metrics: { currentLoad, planLoad, loadDeviation, acwr },
            maxLoad: scaleMax,
            rawPoints // Export rawPoints
        };
    }, [history, currentPlan, injuries, competitions, therapyLogs, acwrStats]);

    // Paths
    const realPoints = chartPoints.filter(p => p.type !== 'projected');
    const projectedPoints = [
        chartPoints.find(p => p.type === 'current') || chartPoints[chartPoints.length - 1],
        ...chartPoints.filter(p => p.type === 'projected')
    ].filter(Boolean);

    const fullPathPoints = chartPoints.map(p => ({ x: p.x, y: p.y }));
    const areaPath = getPathFromPoints(fullPathPoints, true);

    const realLinePath = getPathFromPoints(realPoints.map(p => ({ x: p.x, y: p.y })));
    const projectedLinePath = getPathFromPoints(projectedPoints.map(p => ({ x: p.x, y: p.y })));
    const minLimitPath = getPathFromPoints(chartPoints.map(p => ({ x: p.x, y: p.yMin })));
    const maxLimitPath = getPathFromPoints(chartPoints.map(p => ({ x: p.x, y: p.yMax })));

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden flex flex-col min-h-[500px]">
            {/* Header */}
            <div className="flex justify-between items-center z-10 relative mb-4">
                <div>
                    <h2 className="text-[10px] font-bold tracking-widest text-cyan-400 uppercase mb-0.5">Entrenamiento</h2>
                    <h1 className="text-xl font-black tracking-tight text-white leading-tight">Macrociclo (8S)</h1>
                </div>
            </div>

            {/* Edit Mode Toggle (Coach Only) */}
            {isStaff && (
                <div className="absolute top-4 right-4 z-20 flex gap-2">
                    <button
                        onClick={() => setEditMode(!editMode)}
                        className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-all ${editMode ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:text-white'}`}
                    >
                        {editMode ? 'Modo Edición: ON' : 'Editar Plan'}
                    </button>
                    <button className="p-1.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400 hover:text-white">
                        <Info size={16} />
                    </button>
                </div>
            )}

            {/* Legend */}
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[9px] font-bold uppercase tracking-wide text-slate-400 bg-slate-900/50 p-2 rounded-xl border border-slate-700/50 backdrop-blur-sm justify-between mb-4 z-10 relative">
                <div className="flex items-center space-x-1">
                    <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                    <span>Plan</span>
                </div>
                <div className="flex items-center space-x-1">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.5)]"></span>
                    <span className="text-slate-200">Real</span>
                </div>
                <div className="flex items-center space-x-1">
                    <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                    <span>Transición</span>
                </div>
                <div className="flex items-center space-x-1">
                    <span className="w-3 h-0 border-t-2 border-dashed border-red-500/50"></span>
                    <span>Max (1.5)</span>
                </div>
                <div className="flex items-center space-x-1">
                    <span className="w-3 h-0 border-t-2 border-dashed border-yellow-500/50"></span>
                    <span>Min (0.8)</span>
                </div>
            </div>

            {/* Chart Area */}
            <div className="flex-grow relative w-full overflow-visible z-10 flex flex-col justify-center -mt-1 -mb-1">
                <div className="h-full w-full relative px-1">
                    <svg viewBox="0 0 1000 480" className="w-full h-full drop-shadow-2xl">
                        <defs>
                            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.5" />
                                <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
                            </linearGradient>
                            {/* Safe Zone Gradient Background */}
                            <linearGradient id="safeZone" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#10b981" stopOpacity="0.05" />
                                <stop offset="100%" stopColor="#10b981" stopOpacity="0.01" />
                            </linearGradient>
                            <linearGradient id="projectedGradient" x1="0%" x2="0%" y1="0%" y2="100%">
                                <stop offset="0%" stopColor="#818cf8" stopOpacity="0.2" />
                                <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
                            </linearGradient>
                            <linearGradient id="actualGradient" x1="0%" x2="0%" y1="0%" y2="100%">
                                <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.4" />
                                <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.05" />
                            </linearGradient>
                            <linearGradient id="injuryZoneGradient" x1="0%" x2="0%" y1="0%" y2="100%">
                                <stop offset="0%" stopColor="#f87171" stopOpacity="0.3" />
                                <stop offset="100%" stopColor="#f87171" stopOpacity="0.05" />
                            </linearGradient>
                            <filter id="glow" height="140%" width="140%" x="-20%" y="-20%">
                                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                                <feMerge>
                                    <feMergeNode in="coloredBlur" />
                                    <feMergeNode in="SourceGraphic" />
                                </feMerge>
                            </filter>
                        </defs>

                        {/* Phase Background Regions */}
                        <g className="opacity-[0.03]">
                            {chartPoints.map((p, i) => {
                                if (i === chartPoints.length - 1) return null;
                                const nextP = chartPoints[i + 1];
                                // We'll infer phase based on weeks to race or just label
                                // Simple mapping for visualization:
                                const weeksOut = (chartPoints.length - 1 - i) / 7; // Approx
                                let color = "#3b82f6"; // General (Blue)
                                const pName = currentPlan?.phase || 'General Prep';

                                if (pName.includes('Transition')) color = "#a855f7"; // Transition (Purple)
                                else if (weeksOut <= 2) color = "#ef4444"; // Comp (Red)
                                else if (weeksOut <= 6) color = "#f59e0b"; // Pre-Comp (Orange)
                                else if (weeksOut <= 12) color = "#10b981"; // Specific (Green)

                                return (
                                    <rect key={i} x={p.x} y="40" width={nextP.x - p.x} height="400" fill={color} />
                                );
                            })}
                        </g>

                        {/* Grid Lines */}
                        <g className="stroke-slate-800/60" strokeDasharray="0" strokeWidth="1">
                            {chartPoints.map((p, i) => (
                                <line key={i} x1={p.x} x2={p.x} y1="40" y2="440" />
                            ))}
                        </g>

                        {/* Injury Zones Background */}
                        {milestones.filter(m => m.type === 'injury').map((m, i) => (
                            <rect key={i} x={m.x - 20} y="50" width="40" height="400" fill="url(#injuryZoneGradient)" className="animate-pulse" />
                        ))}

                        {/* Dynamic ACWR Limits */}
                        <path d={maxLimitPath} fill="none" stroke="#f87171" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.6" />

                        <path d={minLimitPath} fill="none" stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.6" />


                        {/* Current Week Vertical Line */}
                        {chartPoints.find(p => p.type === 'current') && (
                            <g>
                                <line
                                    x1={chartPoints.find(p => p.type === 'current')!.x}
                                    x2={chartPoints.find(p => p.type === 'current')!.x}
                                    y1="40" y2="440"
                                    className="stroke-white" opacity="0.8" strokeDasharray="6 4" strokeWidth="2"
                                />
                                <rect
                                    x={chartPoints.find(p => p.type === 'current')!.x - 30}
                                    y="15" width="60" height="20" rx="10"
                                    className="fill-slate-800 stroke-slate-700" strokeWidth="1"
                                />
                                <text
                                    x={chartPoints.find(p => p.type === 'current')!.x}
                                    y="28" textAnchor="middle"
                                    className="fill-white text-[9px] font-bold uppercase tracking-widest"
                                >
                                    Actual
                                </text>
                            </g>
                        )}

                        {/* Projected Area */}
                        <path d={areaPath} fill="url(#projectedGradient)" />

                        {/* Paths */}
                        <path d={projectedLinePath} fill="none" opacity="0.6" stroke="#818cf8" strokeDasharray="5 5" strokeWidth="2" />
                        <path d={realLinePath} fill="none" filter="url(#glow)" stroke="#22d3ee" strokeWidth="3" />

                        {/* Points */}
                        {rawPoints.map((p, i) => {
                            const point = chartPoints[i];
                            const isCurrent = p.type === 'current';
                            return (
                                <g key={i}
                                    className="cursor-pointer group"
                                    onMouseEnter={() => setTooltip({
                                        x: point.x, y: point.y, content: (
                                            <div>
                                                <div className="text-[10px] font-bold text-slate-400">{p.date.toLocaleDateString()}</div>
                                                <div className="font-black text-cyan-400 text-xs">{Math.round(p.load)} Load</div>
                                            </div>
                                        )
                                    })}
                                    onMouseLeave={() => setTooltip(null)}
                                >
                                    <circle
                                        cx={point.x} cy={point.y}
                                        r={isCurrent ? 4 : 3}
                                        className={isCurrent ? "fill-cyan-400 stroke-white" : "fill-slate-900 stroke-cyan-400"}
                                        strokeWidth="2"
                                    />
                                    {/* X Label */}
                                    <text
                                        x={point.x} y="465" textAnchor="middle"
                                        className={`text-[9px] font-medium uppercase ${isCurrent ? 'fill-cyan-400 font-bold' : 'fill-slate-500'}`}
                                    >
                                        {p.label}
                                    </text>
                                </g>
                            );
                        })}

                        {/* Milestones */}
                        {milestones.map((m, i) => (
                            <g key={i} transform={`translate(${m.x}, ${m.y})`} className="cursor-pointer group">
                                {m.type === 'injury' && (
                                    <>
                                        <line className="stroke-red-500" strokeDasharray="2 2" strokeWidth="1" x1="0" x2="0" y1="0" y2="60" />
                                        <circle className="fill-red-500/10 stroke-red-500" cx="0" cy="0" r="10" strokeWidth="1.5" />
                                        <text className="fill-red-500 text-[8px] font-bold" textAnchor="middle" x="0" y="3">I</text>
                                    </>
                                )}
                                {m.type === 'therapy' && (
                                    <>
                                        <line className="stroke-emerald-500" strokeDasharray="2 2" strokeWidth="1" x1="0" x2="0" y1="0" y2="40" />
                                        <circle className="fill-emerald-500/10 stroke-emerald-500" cx="0" cy="0" r="9" strokeWidth="1.5" />
                                        <text className="fill-emerald-500 text-[8px] font-bold" textAnchor="middle" x="0" y="3">T</text>
                                    </>
                                )}
                                {m.type === 'competition' && (
                                    <>
                                        <line className="stroke-yellow-500" strokeDasharray="2 2" strokeWidth="1" x1="0" x2="0" y1="0" y2="40" />
                                        <circle className="fill-yellow-500/10 stroke-yellow-500" cx="0" cy="0" r="12" strokeWidth="1.5" />
                                        <Trophy size={14} x={-7} y={-7} className="text-yellow-500" />
                                    </>
                                )}

                                {/* Hover Tooltip SVG */}
                                <g className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" transform="translate(-40, -40)">
                                    <rect className="fill-slate-800 stroke-slate-600 drop-shadow-md" height="24" rx="4" strokeWidth="1" width="80"></rect>
                                    <text className="fill-gray-100 text-[9px] font-semibold" textAnchor="middle" x="40" y="16">{m.label}</text>
                                </g>
                            </g>
                        ))}

                    </svg>

                    {/* JS Tooltip Overlay */}
                    {tooltip && (
                        <div
                            className="absolute bg-slate-900 border border-slate-700 p-2 rounded-xl shadow-xl pointer-events-none z-50 animate-in fade-in zoom-in-95 duration-200"
                            style={{ left: tooltip.x + 20, top: tooltip.y - 40 }}
                        >
                            {tooltip.content}
                        </div>
                    )}
                </div>
            </div>

            {/* Footer Stats */}
            <footer className="p-4 pt-1 z-10 shrink-0 border-t border-slate-800 mt-4">
                <div className="grid grid-cols-2 gap-3">
                    {/* Carga Actual */}
                    <div className="p-3 rounded-2xl bg-slate-800/50 border border-slate-700 flex flex-col justify-between h-28">
                        <div className="flex items-center space-x-2 mb-1 text-slate-400">
                            <Activity size={16} />
                            <span className="text-[9px] font-bold uppercase tracking-wider">Carga Actual</span>
                        </div>
                        <div className="flex items-center space-x-3 mt-1">
                            <div className="flex flex-col gap-1 p-1 bg-slate-700 rounded-full">
                                <div className="w-2 h-2 rounded-full bg-red-500/20 border border-red-500/30"></div>
                                <div className="w-2 h-2 rounded-full bg-yellow-500/20 border border-yellow-500/30"></div>
                                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.8)] border border-white/20"></div>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xl font-black text-white leading-none">{(metrics.currentLoad / 1000).toFixed(1)}k</span>
                                <div className="flex items-center gap-1 mt-0.5">
                                    <span className="text-[8px] text-slate-500 uppercase">Plan:</span>
                                    <span className="text-[9px] font-bold text-slate-400">{(metrics.planLoad / 1000).toFixed(1)}k</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="text-[8px] text-slate-500 uppercase">Desv:</span>
                                    <span className={`text-[9px] font-bold ${metrics.loadDeviation > 0 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                                        {metrics.loadDeviation > 0 ? '+' : ''}{Math.round(metrics.loadDeviation)}%
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ACWR Gauge */}
                    <div className="p-3 rounded-2xl bg-slate-800/50 border border-slate-700 flex flex-col justify-between h-28 relative overflow-hidden">
                        <div className="flex items-center space-x-2 mb-0 text-slate-400 relative z-10">
                            <Activity size={16} />
                            <span className="text-[9px] font-bold uppercase tracking-wider">Riesgo (ACWR)</span>
                        </div>

                        <div className="relative flex flex-col items-center justify-end h-full pb-0 z-10">
                            <svg className="w-full h-16 overflow-visible" viewBox="0 0 100 55">
                                <defs>
                                    <linearGradient id="gaugeGradient" x1="0%" x2="100%" y1="0%" y2="0%">
                                        <stop offset="0%" stopColor="#34d399" />
                                        <stop offset="50%" stopColor="#fbbf24" />
                                        <stop offset="100%" stopColor="#f87171" />
                                    </linearGradient>
                                </defs>
                                <path className="opacity-50" d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#334155" strokeLinecap="round" strokeWidth="6" />
                                <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="url(#gaugeGradient)" strokeLinecap="round" strokeWidth="6" />

                                {/* Needle */}
                                <g transform={`rotate(${Math.min(180, Math.max(0, (metrics.acwr * 90) - 90))}, 50, 50)`}>
                                    <polygon className="fill-white" points="50,50 47,15 53,15" />
                                    <circle className="fill-white" cx="50" cy="50" r="3" />
                                </g>

                                <text className="text-[7px] fill-emerald-500 font-bold" textAnchor="middle" x="15" y="62">0.8</text>
                                <text className="text-[7px] fill-red-500 font-bold" textAnchor="middle" x="85" y="62">1.5</text>
                                <text className="text-[7px] fill-slate-500 font-bold" textAnchor="middle" x="50" y="35">1.0</text>
                                <line x1="30" y1="46" x2="30" y2="54" stroke="#fbbf24" strokeWidth="0.5" />
                                <text className="text-[5px] fill-yellow-500 font-bold" textAnchor="middle" x="30" y="60">1.3</text>
                            </svg>
                            <div className="absolute -bottom-1 text-center w-full">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${metrics.acwr > 1.3 ? 'text-red-400 bg-red-400/10' : metrics.acwr < 0.8 ? 'text-yellow-400 bg-yellow-400/10' : 'text-emerald-400 bg-emerald-400/10'}`}>
                                    {metrics.acwr.toFixed(2)} - {metrics.acwr > 1.3 ? 'Alto' : metrics.acwr < 0.8 ? 'Bajo' : 'Estable'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </footer>

            {/* Editable Plan Section (Coach Only) */}
            {editMode && currentPlan && currentPlan.sessions && (
                <div className="mt-6 space-y-3 border-t border-slate-800 pt-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Editar Sesiones del Plan</h3>
                        <button
                            onClick={() => {
                                if (onUpdatePlan && currentPlan) {
                                    onUpdatePlan(currentPlan);
                                    setEditMode(false);
                                }
                            }}
                            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-xs font-bold text-white uppercase tracking-wider transition-colors"
                        >
                            Guardar Cambios
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {currentPlan.sessions.map((session: any, idx: number) => (
                            <div key={idx} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <div className="text-xs font-bold text-cyan-400 uppercase">{session.day}</div>
                                        <div className="text-[10px] text-slate-500 uppercase mt-0.5">{session.type}</div>
                                    </div>
                                    <select
                                        value={session.intensity}
                                        onChange={(e) => {
                                            const updated = { ...currentPlan };
                                            updated.sessions[idx].intensity = e.target.value;
                                            if (onUpdatePlan) onUpdatePlan(updated);
                                        }}
                                        className="px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs text-white"
                                    >
                                        <option value="Low">Baja</option>
                                        <option value="Medium">Media</option>
                                        <option value="High">Alta</option>
                                        <option value="Max">Máxima</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <div>
                                        <label className="text-[9px] text-slate-400 uppercase font-bold block mb-1">Ejercicios</label>
                                        <textarea
                                            value={session.drills?.join(', ') || ''}
                                            onChange={(e) => {
                                                const updated = { ...currentPlan };
                                                updated.sessions[idx].drills = e.target.value.split(',').map((d: string) => d.trim());
                                                if (onUpdatePlan) onUpdatePlan(updated);
                                            }}
                                            className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-[10px] text-white resize-none"
                                            rows={2}
                                            placeholder="Ejercicio 1, Ejercicio 2..."
                                        />
                                    </div>

                                    <div>
                                        <label className="text-[9px] text-slate-400 uppercase font-bold block mb-1">Notas del Staff</label>
                                        <textarea
                                            value={session.staffNotes || ''}
                                            onChange={(e) => {
                                                const updated = { ...currentPlan };
                                                updated.sessions[idx].staffNotes = e.target.value;
                                                if (onUpdatePlan) onUpdatePlan(updated);
                                            }}
                                            className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-[10px] text-white resize-none"
                                            rows={2}
                                            placeholder="Instrucciones especiales..."
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
