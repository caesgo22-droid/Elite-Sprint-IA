import React, { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Battery, Moon, Activity, Zap, Thermometer, BrainCircuit, HeartPulse, CheckCircle2 } from 'lucide-react';
import { useRecoveryEngine } from '../hooks/useRecoveryEngine'; // Hook Import

export const DeepRecovery: React.FC = () => {
    const navigate = useNavigate();
    const {
        readiness,
        prescription,
        wellnessData,
        updateWellness,
        calculateDailyReadiness,
        resetRecovery
    } = useRecoveryEngine(); // New Hook

    // Removed local state (wellness, prescription) and handleCalculate fn

    const getScoreColor = (score: number) => {
        if (score >= 90) return 'text-emerald-400';
        if (score >= 70) return 'text-cyan-400';
        if (score >= 50) return 'text-yellow-400';
        return 'text-red-500';
    };

    return (
        <div className="pb-24 animate-in fade-in duration-500 min-h-screen bg-slate-950 text-white p-4">
            {/* Header */}
            <div className="flex items-center gap-4 border-b border-slate-800 pb-4 mb-6 sticky top-0 bg-slate-950/90 z-20 backdrop-blur-md pt-2">
                <button onClick={() => navigate('/')} className="p-2 bg-slate-900 rounded-full text-slate-400 hover:text-white transition-colors">
                    <ChevronLeft size={20} />
                </button>
                <div>
                    <h2 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-2">
                        <HeartPulse className="text-pink-500" /> Recovery Center
                    </h2>
                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Biological Optimization</p>
                </div>
            </div>

            {!prescription ? (
                <div className="max-w-md mx-auto space-y-8">
                    <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-[2rem]">
                        <h3 className="text-lg font-black uppercase tracking-tight mb-4 text-center">Daily Wellness Check</h3>
                        <p className="text-xs text-slate-400 text-center mb-8">Be honest. Accurate data = Better prescriptions.</p>

                        <div className="space-y-6">
                            <InputSlider
                                label="Sleep Duration"
                                value={wellnessData.sleepHours}
                                onChange={(v: number) => updateWellness('sleepHours', v)}
                                min={3} max={12} step={0.5} unit="h" icon={Moon} color="text-indigo-400"
                            />
                            <InputSlider
                                label="Sleep Quality (1-10)"
                                value={wellnessData.sleepQuality}
                                onChange={(v: number) => updateWellness('sleepQuality', v)}
                                min={1} max={10} step={1} unit="" icon={BrainCircuit} color="text-indigo-400"
                            />
                            <div className="h-px bg-slate-800 my-4"></div>
                            <InputSlider
                                label="Fatigue (10 = Exhausted)"
                                value={wellnessData.fatigue}
                                onChange={(v: number) => updateWellness('fatigue', v)}
                                min={1} max={10} step={1} unit="" icon={Battery} color="text-yellow-400"
                            />
                            <InputSlider
                                label="Muscle Soreness (10 = Pain)"
                                value={wellnessData.soreness}
                                onChange={(v: number) => updateWellness('soreness', v)}
                                min={1} max={10} step={1} unit="" icon={Activity} color="text-red-400"
                            />
                            <InputSlider
                                label="Mental Stress (10 = High)"
                                value={wellnessData.stress}
                                onChange={(v: number) => updateWellness('stress', v)}
                                min={1} max={10} step={1} unit="" icon={Zap} color="text-orange-400"
                            />
                        </div>

                        <button
                            onClick={calculateDailyReadiness}
                            className="w-full mt-8 bg-pink-600 hover:bg-pink-500 text-white font-black py-4 rounded-xl uppercase tracking-widest text-sm shadow-xl shadow-pink-900/20 transition-all active:scale-95"
                        >
                            Generate Prescription
                        </button>
                    </div>
                </div>
            ) : (
                <div className="max-w-md mx-auto space-y-6 animate-in slide-in-from-bottom-8">
                    {/* Results Card */}
                    <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 p-8 rounded-[2rem] text-center relative overflow-hidden">
                        <div className={`absolute top-0 left-0 w-full h-2 ${prescription.status === 'Optimal' ? 'bg-emerald-500' : prescription.status === 'Good' ? 'bg-cyan-500' : prescription.status === 'Fair' ? 'bg-yellow-500' : 'bg-red-500'}`}></div>

                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Readiness Score</h3>
                        <div className={`text-6xl font-black tracking-tighter mb-2 ${getScoreColor(prescription.readinessScore)} drop-shadow-lg`}>
                            {prescription.readinessScore}
                        </div>
                        <div className="inline-block px-3 py-1 rounded-lg bg-slate-800 text-[10px] font-black uppercase tracking-widest mb-6">
                            {prescription.status} State
                        </div>

                        <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800">
                            <p className="text-xs font-medium text-slate-300 italic">"{prescription.coachNote}"</p>
                        </div>
                    </div>

                    <h3 className="text-lg font-black uppercase tracking-tight flex items-center gap-2 px-2">
                        <Thermometer size={20} className="text-cyan-400" /> Prescribed Protocols
                    </h3>

                    <div className="space-y-3">
                        {prescription.protocols.map(p => (
                            <div key={p.id} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-start gap-4">
                                <div className={`p-3 rounded-xl ${p.priority === 'High' ? 'bg-pink-500/10 text-pink-400' : 'bg-slate-800 text-slate-400'}`}>
                                    {p.type === 'Cold' ? <Thermometer size={18} /> : p.type === 'Active' ? <Activity size={18} /> : <Zap size={18} />}
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-start">
                                        <h4 className="font-bold text-white text-sm">{p.title}</h4>
                                        <span className="text-[10px] font-black bg-slate-950 px-2 py-0.5 rounded text-slate-500">{p.durationMin} min</span>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-1">{p.description}</p>
                                </div>
                                <div className="self-center">
                                    <button className="w-8 h-8 rounded-full border-2 border-slate-700 flex items-center justify-center hover:bg-emerald-500 hover:border-emerald-500 hover:text-white transition-all text-transparent">
                                        <CheckCircle2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={resetRecovery}
                        className="w-full mt-4 text-slate-500 font-bold py-3 uppercase tracking-widest text-[10px]"
                    >
                        Recalculate
                    </button>
                </div>
            )}
        </div>
    );
};

const InputSlider = ({ label, value, onChange, min, max, step, unit, icon: Icon, color }: any) => (
    <div>
        <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
                <Icon size={14} className={color} />
                <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">{label}</label>
            </div>
            <span className={`text-sm font-black ${color}`}>{value}{unit}</span>
        </div>
        <input
            type="range"
            min={min} max={max} step={step}
            value={value}
            onChange={e => onChange(parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-white hover:accent-pink-500 transition-all"
        />
    </div>
);
