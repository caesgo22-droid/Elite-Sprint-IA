
import * as React from 'react';
import { useState } from 'react';
import { CheckSquare, MessageCircle, MessageSquare, ChevronRight, Play, ScanLine, UserCog, Wrench, Zap, Activity, Trophy, BatteryCharging, Dumbbell } from 'lucide-react';

export const DrillItem: React.FC<{ name: string, colorClass: string }> = ({ name, colorClass }) => (
    <li className="flex items-center justify-between group text-sm text-slate-300 py-1">
        <div className="flex items-start gap-3">
            <span className={`flex-shrink-0 w-1.5 h-1.5 mt-2 rounded-full ${colorClass}`}></span>
            <span>{name}</span>
        </div>
        <a
            href={`https://www.youtube.com/results?search_query=track+and+field+drill+${name.replace(/\s/g, '+')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-500 hover:text-red-500 transition-colors p-2 bg-slate-800/50 rounded-full hover:bg-slate-800 visible"
            title="Ver video de referencia"
        >
            <Play size={14} fill="currentColor" />
        </a>
    </li>
);

interface SessionCardProps {
    session: any;
    expandedDay: string | null;
    setExpandedDay: (day: string | null) => void;
    setSessionFeedbackModal: (session: any) => void;
    onShowRecovery: (session: any) => void;
    isStaff: boolean;
    updateSessionNote: (day: string, note: string) => void;
}

export const SessionCard = React.memo(({
    session,
    expandedDay,
    setExpandedDay,
    setSessionFeedbackModal,
    onShowRecovery,
    isStaff,
    updateSessionNote
}: SessionCardProps) => {
    const isExpanded = expandedDay === session.day;
    const isDone = session.feedback?.completed;
    const intensityColor = session.intensity === 'Max' ? 'text-red-400 border-red-900/50 bg-red-900/20' : session.intensity === 'High' ? 'text-orange-400 border-orange-900/50 bg-orange-900/20' : session.intensity === 'Medium' ? 'text-yellow-400 border-yellow-900/50 bg-yellow-900/20' : 'text-emerald-400 border-emerald-900/50 bg-emerald-900/20';

    const [note, setNote] = useState(session.coachNotes || "");
    const [isEditingNote, setIsEditingNote] = useState(false);

    const saveNote = (e: any) => {
        e.stopPropagation();
        updateSessionNote(session.day, note);
        setIsEditingNote(false);
    };

    const shareSession = (e: React.MouseEvent) => {
        e.stopPropagation();
        const routine = session.mainSet ? session.mainSet.join(', ') : session.trackRoutine?.join(', ') || 'N/A';
        const text = `*ELITE SPRINT AI - Sesión (${session.day})*\n\n*Enfoque:* ${session.focus}\n*KPI Técnico:* ${session.biomechanicsKpi || 'N/A'}\n*Rutina:* ${routine}\n*Intensidad:* ${session.intensity}\n${session.coachNotes ? `*Nota Coach:* ${session.coachNotes}` : ''}`;
        const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    };

    return (
        <div onClick={() => setExpandedDay(isExpanded ? null : session.day)} className={`bg-slate-900/40 border rounded-xl overflow-hidden transition-all duration-300 ${isDone ? 'border-emerald-900/40' : 'border-slate-800'} ${isExpanded ? 'ring-1 ring-cyan-500/50 bg-slate-800/60' : 'hover:bg-slate-800/40'}`}>
            <div className="p-4 flex justify-between items-center cursor-pointer select-none">
                <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center font-bold text-sm bg-slate-800 border border-slate-700 ${isDone ? 'text-emerald-400 border-emerald-900/50' : 'text-slate-200'}`}> {isDone ? <CheckSquare size={18} /> : <span className="text-[10px] text-slate-400 uppercase leading-none">{session.day.substring(0, 3)}</span>} </div>
                    <div>
                        <h4 className={`font-bold text-lg tracking-tight ${isDone ? 'text-slate-400 line-through' : 'text-slate-100'}`}>{session.focus}</h4>
                        <div className="flex items-center gap-2 mt-1">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wide ${intensityColor}`}>{session.intensity}</span>
                            {session.coachNotes && <span className="text-[10px] bg-blue-900/30 text-blue-300 px-2 py-0.5 rounded border border-blue-500/30 flex items-center gap-1"><MessageSquare size={10} /> Nota</span>}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={shareSession} className="text-emerald-500 bg-emerald-900/20 p-2 rounded-full mr-1 hover:bg-emerald-900/40 z-10 relative">
                        <MessageCircle size={18} />
                    </button>
                    <ChevronRight size={20} className={`transition-transform ${isExpanded ? 'rotate-90 text-cyan-400' : 'text-slate-500'}`} />
                </div>
            </div>
            {isExpanded && (
                <div className="px-5 pb-5 space-y-5 border-t border-slate-700/50 pt-4 animate-in slide-in-from-top-2">
                    {session.biomechanicsKpi && (
                        <div className="flex items-start gap-3 bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                            <ScanLine className="text-cyan-400 mt-0.5 flex-shrink-0" size={16} />
                            <div>
                                <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider block mb-1">KPI Técnico del Día</span>
                                <p className="text-sm text-slate-200 leading-snug font-medium">"{session.biomechanicsKpi}"</p>
                                <div className="flex gap-2 mt-2">
                                    {session.footwear && <span className="text-[8px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded border border-slate-700 font-bold uppercase tracking-widest">👟 {session.footwear === 'Spikes' ? 'Clavos' : 'Planas'}</span>}
                                    {session.wind && <span className="text-[8px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded border border-slate-700 font-bold uppercase tracking-widest">💨 {session.wind === 'Tail' ? 'A favor' : session.wind === 'Head' ? 'En contra' : 'Neutral'}</span>}
                                </div>
                            </div>
                        </div>
                    )}
                    {(isStaff || session.coachNotes) && (
                        <div className="bg-blue-900/10 border-l-2 border-blue-500 pl-3 py-2 rounded-r relative group" onClick={e => e.stopPropagation()}>
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1"><UserCog size={12} /> Instrucción del Staff</span>
                                {isStaff && !isEditingNote && <button onClick={() => setIsEditingNote(true)} className="text-slate-500 hover:text-white"><Wrench size={12} /></button>}
                            </div>
                            {isStaff && isEditingNote ? (
                                <div className="flex gap-2">
                                    <input type="text" value={note} onChange={e => setNote(e.target.value)} className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white" placeholder="Ej: Enfócate en el recobro..." autoFocus />
                                    <button onClick={saveNote} className="bg-blue-600 px-2 rounded text-xs font-bold text-white">OK</button>
                                </div>
                            ) : (
                                <p className="text-sm text-slate-300 italic">{session.coachNotes || (isStaff ? "Añadir nota técnica..." : "")}</p>
                            )}
                        </div>
                    )}
                    {session.warmup && session.warmup.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-2 text-emerald-400 text-[10px] font-bold uppercase tracking-wider"><Zap size={12} /> Calentamiento</div>
                            <ul className="space-y-1">
                                {session.warmup.map((item: string, i: number) => <DrillItem key={i} name={item} colorClass="bg-emerald-500" />)}
                            </ul>
                        </div>
                    )}
                    {session.drills && session.drills.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-2 text-cyan-400 text-[10px] font-bold uppercase tracking-wider"><Activity size={12} /> Técnica / Drills</div>
                            <ul className="space-y-1">
                                {session.drills.map((item: string, i: number) => <DrillItem key={i} name={item} colorClass="bg-cyan-500" />)}
                            </ul>
                        </div>
                    )}
                    {session.mainSet && session.mainSet.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-2 text-orange-400 text-[10px] font-bold uppercase tracking-wider"><Trophy size={12} /> Bloque Principal</div>
                            <ul className="space-y-1 border-l-2 border-orange-500/30 pl-3">
                                {session.mainSet.map((item: string, i: number) => <DrillItem key={i} name={item} colorClass="bg-orange-500" />)}
                            </ul>
                        </div>
                    )}
                    {session.trackRoutine && !session.mainSet && session.trackRoutine.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-3 text-cyan-400 text-xs font-bold uppercase tracking-wider"><Zap size={14} /> Rutina de Pista</div>
                            <ul className="space-y-2">
                                {session.trackRoutine.map((item: string, i: number) => <DrillItem key={i} name={item} colorClass="bg-cyan-500" />)}
                            </ul>
                        </div>
                    )}
                    {session.gymRoutine && session.gymRoutine.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-3 text-purple-400 text-xs font-bold uppercase tracking-wider"><Dumbbell size={14} /> Fuerza / Gym</div>
                            <ul className="space-y-2">
                                {session.gymRoutine.map((item: string, i: number) => <DrillItem key={i} name={item} colorClass="bg-purple-500" />)}
                            </ul>
                        </div>
                    )}
                    {session.cooldown && session.cooldown.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-2 text-blue-400 text-[10px] font-bold uppercase tracking-wider"><BatteryCharging size={12} /> Vuelta a la Calma</div>
                            <ul className="space-y-1">
                                {session.cooldown.map((item: string, i: number) => <DrillItem key={i} name={item} colorClass="bg-blue-500" />)}
                            </ul>
                        </div>
                    )}
                    <div className="pt-2 border-t border-slate-800 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <button onClick={(e) => { e.stopPropagation(); setSessionFeedbackModal(session); }} className={`w-full py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${isDone ? 'bg-slate-800 text-slate-300 hover:text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200 col-span-2'}`}>
                            <CheckSquare size={16} /> {isDone ? 'Editar Feedback' : 'Registrar Sesión'}
                        </button>
                        {isDone && (
                            <button onClick={(e) => { e.stopPropagation(); onShowRecovery(session); }} className="w-full bg-emerald-900/20 border border-emerald-500/30 hover:bg-emerald-900/40 text-emerald-400 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors">
                                <BatteryCharging size={16} /> Recuperación
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
});
