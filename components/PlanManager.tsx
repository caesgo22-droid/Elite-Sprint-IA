import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { Loader2, UserCog, X, Target, Calendar, Plus, Trophy, History, MapPin, RotateCcw, Info, Trash2 } from 'lucide-react';
import { TrainingSession, UserProfile, Injury, Coach } from '../types';
import { MacrocycleChart } from './MacrocycleChart';
import { SessionCard } from './SessionCard';
import { useTrainingPlan } from '../hooks/useTrainingPlan'; // New Import

const PlanManager: React.FC = () => {
    // Context & Hook
    const { userProfile, adminProfile, updateProfile, resetPlan } = useApp();
    const {
        currentPlan,
        planHistory,
        loading,
        errorMsg,
        generatePlan,
        updateSession,
        viewingRecovery,
        calculateSessionRecovery,
        closeRecoveryView,
        logs // Added logs
    } = useTrainingPlan();

    // Local UI State
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const [showProfileConfig, setShowProfileConfig] = useState(false);
    const [focusEvent, setFocusEvent] = useState(userProfile.events?.[0] || '100m');

    // Generator Inputs
    const [fatigue, setFatigue] = useState(5);
    const [sleep, setSleep] = useState(7);
    const [soreness, setSoreness] = useState(3);
    const [stress, setStress] = useState(4);
    const [hydration, setHydration] = useState(7);
    const [restingHR, setRestingHR] = useState(userProfile.restingHR || 60);
    const [hrv, setHrv] = useState(userProfile.hrv || 50);

    const [expandedDay, setExpandedDay] = useState<string | null>(null);
    const [sessionFeedbackModal, setSessionFeedbackModal] = useState<TrainingSession | null>(null);
    const [tempProfile, setTempProfile] = useState<UserProfile>(userProfile);

    // Helpers
    const isStaff = adminProfile.role === 'staff';
    const coachEmailRef = useRef<HTMLInputElement>(null);
    const [newCompName, setNewCompName] = useState("");
    const [newCompDate, setNewCompDate] = useState("");

    useEffect(() => {
        const isEditing = searchParams.get('edit') === 'true';
        const isNewUser = !userProfile.name || userProfile.name === 'Atleta';
        setTempProfile(userProfile);
        if (isEditing || isNewUser) setShowProfileConfig(true);
    }, [location.search, userProfile]);

    const handleGenerate = () => {
        generatePlan({ fatigue, sleep, soreness, stress, hydration, restingHR, hrv, focusEvent });
    };

    const handleSaveProfile = () => {
        updateProfile(tempProfile);
        setShowProfileConfig(false);
        if (!tempProfile.events.includes(focusEvent)) setFocusEvent(tempProfile.events[0]);
    };

    // ... (Keep existing UI helpers: updateSessionNote, toggleEvent, etc. - can be moved to util if needed)
    const updateSessionNote = (day: string, note: string) => updateSession(day, { coachNotes: note });
    const toggleEventSelection = (e: string) => { const current = tempProfile.events || []; if (current.includes(e)) setTempProfile({ ...tempProfile, events: current.filter(ev => ev !== e) }); else setTempProfile({ ...tempProfile, events: [...current, e] }); };
    const toggleTrainingDay = (day: string) => {
        const current = [...new Set(tempProfile.trainingDays || [])];
        if (current.includes(day)) setTempProfile({ ...tempProfile, trainingDays: current.filter(d => d !== day) });
        else setTempProfile({ ...tempProfile, trainingDays: [...current, day] });
    };
    const updatePB = (event: '100m' | '200m' | '400m', field: 'time' | 'date', value: string) => {
        const newPBs = { ...tempProfile.pbs, [event]: { ...tempProfile.pbs[event], [field]: value } };
        setTempProfile({ ...tempProfile, pbs: newPBs });
    };
    const updateInjury = (index: number, field: keyof Injury, value: any) => { const updated = [...(tempProfile.injuries || [])]; updated[index] = { ...updated[index], [field]: value }; setTempProfile({ ...tempProfile, injuries: updated }); };
    const addCompetition = () => {
        if (!newCompName || !newCompDate) return;
        const newComp = { id: Date.now().toString(), name: newCompName, date: newCompDate };
        const updated = [...(tempProfile.competitions || []), newComp].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        setTempProfile({ ...tempProfile, competitions: updated });
        setNewCompName(""); setNewCompDate("");
    };

    const InfoButton = ({ title, text }: { title: string, text: string }) => (
        <div className="group relative inline-block ml-1">
            <Info size={10} className="text-slate-500 hover:text-cyan-400 cursor-help" />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-800 text-[9px] text-slate-200 p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl border border-slate-700 leading-tight">
                <div className="font-bold text-cyan-400 mb-1">{title}</div>
                {text}
            </div>
        </div>
    );

    const FeedbackModal = () => {
        if (!sessionFeedbackModal) return null;
        const [rpe, setRpe] = useState(sessionFeedbackModal.feedback?.rpe || 5);
        const [pain, setPain] = useState(sessionFeedbackModal.feedback?.painLevel || 0);
        const [dur, setDur] = useState(sessionFeedbackModal.feedback?.duration || 60);
        const [srf, setSrf] = useState(sessionFeedbackModal.feedback?.surface || 'Track');
        const [ftw, setFtw] = useState(sessionFeedbackModal.footwear || 'Flats');
        const [wnd, setWnd] = useState(sessionFeedbackModal.wind || 'Neutral');
        const [nts, setNts] = useState(sessionFeedbackModal.feedback?.notes || '');
        const save = () => {
            updateSession(sessionFeedbackModal.day, {
                footwear: ftw as any,
                wind: wnd as any,
                feedback: { completed: true, rpe, painLevel: pain, duration: dur, surface: srf as any, notes: nts, timestamp: new Date().toISOString() }
            });
            setSessionFeedbackModal(null);
        };
        return (
            <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSessionFeedbackModal(null)}>
                <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm space-y-6" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center bg-slate-800 -mx-6 -mt-6 p-4 rounded-t-2xl border-b border-slate-700">
                        <h3 className="font-bold text-white flex items-center gap-2 tracking-tight uppercase">Feedback Diario</h3>
                        <button onClick={() => setSessionFeedbackModal(null)} className="p-1 hover:bg-slate-700 rounded-full transition-colors"><X size={20} className="text-slate-400" /></button>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center">Esfuerzo Percibido (RPE) <InfoButton title="RPE" text="Escala de 1 a 10 donde 10 es esfuerzo máximo." /></label>
                                <span className="text-xs font-black text-cyan-400">{rpe}/10</span>
                            </div>
                            <input type="range" min="1" max="10" value={rpe} onChange={e => setRpe(parseInt(e.target.value))} className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500" />
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center">Nivel de Dolor <InfoButton title="Dolor" text="0 = Sin dolor, 10 = Extremo." /></label>
                                <span className="text-xs font-black text-red-400">{pain}/10</span>
                            </div>
                            <input type="range" min="0" max="10" value={pain} onChange={e => setPain(parseInt(e.target.value))} className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-red-500" />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Calzado</label>
                                <select value={ftw} onChange={e => setFtw(e.target.value as any)} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:border-cyan-500 outline-none">
                                    <option value="Flats">Zapatillas</option>
                                    <option value="Spikes">Clavos</option>
                                    <option value="Other">Otro</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Viento</label>
                                <select value={wnd} onChange={e => setWnd(e.target.value as any)} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:border-cyan-500 outline-none">
                                    <option value="Neutral">Neutral</option>
                                    <option value="Tail">A favor</option>
                                    <option value="Head">En contra</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-slate-400 block mb-1 uppercase tracking-widest">Notas / Sensaciones</label>
                            <textarea
                                value={nts}
                                onChange={e => setNts(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-4 text-xs text-white h-24 focus:border-cyan-500 outline-none transition-all placeholder-slate-700 resize-none shadow-inner"
                                placeholder="¿Cómo te sentiste?"
                            />
                        </div>
                    </div>

                    <button onClick={save} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-2xl transition-all active:scale-95 shadow-lg shadow-emerald-900/40 uppercase tracking-widest text-xs">
                        Guardar Registro
                    </button>
                </div>
            </div>
        );
    };

    const BiomarkerSlider = ({ label, value, setter, color, minLabel, maxLabel }: any) => (
        <div className="space-y-2">
            <div className="flex justify-between text-xs font-medium text-slate-300">
                <span className="flex items-center gap-1">{label}</span>
                <span className={`text-${color}-400 font-bold`}>{value}/10</span>
            </div>
            <input type="range" min="1" max="10" value={value} onChange={(e) => setter(parseInt(e.target.value))} className={`w-full accent-${color}-500 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer`} />
            <div className="flex justify-between text-[9px] text-slate-500 uppercase tracking-wider font-bold">
                <span>{minLabel}</span>
                <span>{maxLabel}</span>
            </div>
        </div>
    );

    if (showProfileConfig) {
        return (
            <div className="space-y-6 animate-in fade-in duration-500 pb-10">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-black text-white uppercase tracking-tight">Perfil Holístico</h2>
                    <button onClick={() => setShowProfileConfig(false)} className="p-2 bg-slate-800 rounded-full"><X /></button>
                </div>
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-6 max-h-[75vh] overflow-y-auto">
                    <section className="space-y-4">
                        <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-2"><UserCog size={14} /> Identidad Atlética</h3>
                        <div><label className="text-xs text-slate-400 block mb-1">Nombre</label><input type="text" value={tempProfile.name} onChange={e => setTempProfile({ ...tempProfile, name: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white" /></div>
                        <div className="grid grid-cols-2 gap-3">
                            <div><label className="text-xs text-slate-400 block mb-1">Edad</label><input type="number" value={tempProfile.age} onChange={e => setTempProfile({ ...tempProfile, age: parseInt(e.target.value) })} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white" /></div>
                            <div><label className="text-xs text-slate-400 block mb-1">Altura (cm)</label><input type="number" value={tempProfile.height || ''} onChange={e => setTempProfile({ ...tempProfile, height: parseInt(e.target.value) })} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white" /></div>
                            <div><label className="text-xs text-slate-400 block mb-1">Peso (kg)</label><input type="number" value={tempProfile.weight || ''} onChange={e => setTempProfile({ ...tempProfile, weight: parseInt(e.target.value) })} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white" /></div>
                            <div>
                                <label className="text-xs text-slate-400 block mb-1">Nivel</label>
                                <select value={tempProfile.experienceLevel} onChange={e => setTempProfile({ ...tempProfile, experienceLevel: e.target.value as any })} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white">
                                    <option value="Beginner">Principiante</option>
                                    <option value="Intermediate">Intermedio</option>
                                    <option value="Advanced">Avanzado</option>
                                    <option value="Elite">Elite / Pro</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-slate-400 block mb-1">Años de Exp.</label>
                                <input type="number" value={tempProfile.yearsExperience} onChange={e => setTempProfile({ ...tempProfile, yearsExperience: parseInt(e.target.value) })} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white" />
                            </div>
                            <div>
                                <label className="text-xs text-slate-400 block mb-1">Horas/Día</label>
                                <input type="number" value={tempProfile.hoursPerDay || 2} onChange={e => setTempProfile({ ...tempProfile, hoursPerDay: parseInt(e.target.value) })} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white" />
                            </div>
                            <div>
                                <label className="text-xs text-slate-400 block mb-1">Horario Pref.</label>
                                <select value={tempProfile.preferredTime} onChange={e => setTempProfile({ ...tempProfile, preferredTime: e.target.value as any })} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white">
                                    <option value="Morning">Mañana</option>
                                    <option value="Afternoon">Tarde</option>
                                    <option value="Night">Noche</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 block mb-1">Condiciones Médicas / Alergias</label>
                            <textarea value={tempProfile.medicalConditions || ''} onChange={e => setTempProfile({ ...tempProfile, medicalConditions: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white h-20" placeholder="Ej: Asma, Alergia al polen..." />
                        </div>
                    </section>
                    <section className="space-y-4">
                        <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-2"><User size={14} /> Equipo Técnico</h3>
                        <div className="space-y-2">
                            {tempProfile.coaches?.map((coach, idx) => (
                                <div key={idx} className="flex justify-between items-center bg-slate-800/40 p-3 rounded-lg border border-slate-700/50">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-white">{typeof coach === 'string' ? coach : coach.name}</span>
                                        {typeof coach === 'object' && coach.role && <span className="text-[10px] text-cyan-400 uppercase">{coach.role}</span>}
                                    </div>
                                    <button onClick={() => setTempProfile({ ...tempProfile, coaches: tempProfile.coaches.filter((_, i) => i !== idx) })} className="text-red-500 hover:text-red-400 transition-colors">
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}
                            <div className="flex gap-2">
                                <input
                                    type="email"
                                    placeholder="Email del Coach"
                                    ref={coachEmailRef}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            const val = coachEmailRef.current?.value;
                                            if (val) {
                                                const newCoach: Coach = {
                                                    id: Date.now().toString(),
                                                    name: val.split('@')[0],
                                                    role: 'Head Coach',
                                                    email: val
                                                };
                                                setTempProfile({ ...tempProfile, coaches: [...(tempProfile.coaches || []), newCoach] });
                                                coachEmailRef.current!.value = '';
                                            }
                                        }
                                    }}
                                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                                />
                                <button onClick={() => {
                                    const val = coachEmailRef.current?.value;
                                    if (val) {
                                        const newCoach: Coach = {
                                            id: Date.now().toString(),
                                            name: val.split('@')[0],
                                            role: 'Head Coach',
                                            email: val
                                        };
                                        setTempProfile({ ...tempProfile, coaches: [...(tempProfile.coaches || []), newCoach] });
                                        coachEmailRef.current!.value = '';
                                    }
                                }} className="bg-indigo-600 p-2 rounded-lg text-white hover:bg-indigo-500 transition-colors">
                                    <Plus size={16} />
                                </button>
                            </div>
                        </div>
                    </section>

                    <section className="space-y-4">
                        <h3 className="text-sm font-bold text-purple-400 uppercase tracking-wider flex items-center gap-2"><Target size={14} /> Especialidades</h3>
                        <div className="flex flex-wrap gap-2">
                            {['100m', '200m', '400m', 'Vallas'].map(event => (
                                <button key={event} onClick={() => toggleEventSelection(event)} className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${tempProfile.events?.includes(event) ? 'bg-purple-600 border-purple-400 text-white' : 'bg-slate-900 border-slate-700 text-slate-400'}`}>
                                    {event}
                                </button>
                            ))}
                        </div>
                    </section>

                    <section className="space-y-4">
                        <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2"><Calendar size={14} /> Días Disponibles</h3>
                        <div className="grid grid-cols-7 gap-1">
                            {['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'].map(day => (
                                <button key={day} onClick={() => toggleTrainingDay(day)} className={`py-3 rounded-lg text-[10px] font-bold border transition-all ${tempProfile.trainingDays?.includes(day) ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-slate-900 border-slate-700 text-slate-500'}`}>
                                    {day}
                                </button>
                            ))}
                        </div>
                    </section>

                    <section className="space-y-4">
                        <h3 className="text-sm font-bold text-orange-400 uppercase tracking-wider flex items-center gap-2"><Trophy size={14} /> Marcas Personales (PB)</h3>
                        <div className="space-y-3">
                            {['100m', '200m', '400m'].map((ev: any) => (
                                <div key={ev} className="flex items-center gap-3">
                                    <div className="w-16 text-xs font-bold text-slate-400 uppercase">{ev}</div>
                                    <input type="text" value={tempProfile.pbs?.[ev as keyof typeof tempProfile.pbs]?.time || ''} onChange={e => updatePB(ev, 'time', e.target.value)} className="flex-1 bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white" placeholder="Tiempo (ej: 10.50)" />
                                    <input type="text" value={tempProfile.pbs?.[ev as keyof typeof tempProfile.pbs]?.date || ''} onChange={e => updatePB(ev, 'date', e.target.value)} className="w-32 bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white" placeholder="Fecha" />
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="space-y-4">
                        <h3 className="text-sm font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2"><MapPin size={14} /> Próximas Competencias</h3>
                        <div className="space-y-2">
                            {tempProfile.competitions?.map((comp, idx) => (
                                <div key={comp.id} className="flex justify-between items-center bg-slate-800/40 p-3 rounded-lg border border-slate-700/50">
                                    <div>
                                        <div className="text-xs font-bold text-white">{comp.name}</div>
                                        <div className="text-[10px] text-slate-400">{comp.date}</div>
                                    </div>
                                    <button onClick={() => setTempProfile({ ...tempProfile, competitions: tempProfile.competitions.filter(c => c.id !== comp.id) })} className="text-red-500 hover:bg-red-500/10 p-1 rounded-full"><Trash2 size={14} /></button>
                                </div>
                            ))}
                            <div className="flex gap-2">
                                <input type="text" value={newCompName} onChange={e => setNewCompName(e.target.value)} placeholder="Evento" className="flex-1 bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white" />
                                <input type="date" value={newCompDate} onChange={e => setNewCompDate(e.target.value)} className="bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white" />
                                <button onClick={addCompetition} className="bg-blue-600 p-2 rounded-lg text-white"><Plus size={16} /></button>
                            </div>
                        </div>
                    </section>

                    <section className="space-y-4">
                        <h3 className="text-sm font-bold text-red-400 uppercase tracking-wider flex items-center gap-2"><History size={14} /> Historial de Lesiones</h3>
                        <div className="space-y-2">
                            {tempProfile.injuries?.map((injury, idx) => (
                                <div key={idx} className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/50 space-y-2">
                                    <div className="flex justify-between items-start">
                                        <input type="text" value={injury.type} onChange={e => updateInjury(idx, 'type', e.target.value)} className="bg-transparent font-bold text-xs text-white outline-none" placeholder="Tipo de lesión" />
                                        <button onClick={() => setTempProfile({ ...tempProfile, injuries: tempProfile.injuries.filter((_, i) => i !== idx) })} className="text-red-500"><X size={14} /></button>
                                    </div>
                                    <textarea
                                        value={injury.description || ''}
                                        onChange={e => updateInjury(idx, 'description', e.target.value)}
                                        className="w-full bg-slate-900/50 border border-slate-700/50 rounded p-2 text-[10px] text-slate-300 min-h-[40px] resize-none outline-none focus:border-cyan-500/50"
                                        placeholder="Descripción o detalles..."
                                    />
                                    <div className="grid grid-cols-3 gap-2 mt-1">
                                        <select value={injury.severity} onChange={e => updateInjury(idx, 'severity', e.target.value)} className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[10px] text-white">
                                            <option value="Leve">Leve</option>
                                            <option value="Moderada">Moderada</option>
                                            <option value="Grave">Grave</option>
                                        </select>
                                        <select value={injury.status} onChange={e => updateInjury(idx, 'status', e.target.value)} className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[10px] text-white">
                                            <option value="Activa">Activa</option>
                                            <option value="Recuperación">Recuperación</option>
                                            <option value="Resuelta">Resuelta</option>
                                        </select>
                                        <select value={injury.grade || ''} onChange={e => updateInjury(idx, 'grade', parseInt(e.target.value))} className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[10px] text-white">
                                            <option value="">Grado?</option>
                                            <option value="1">G1</option>
                                            <option value="2">G2</option>
                                            <option value="3">G3</option>
                                        </select>
                                    </div>
                                </div>
                            ))}
                            <button onClick={() => setTempProfile({ ...tempProfile, injuries: [...(tempProfile.injuries || []), { type: '', location: '', severity: 'Leve', status: 'Activa' }] })} className="w-full py-2 border border-dashed border-slate-700 rounded-lg text-[10px] font-bold text-slate-500 hover:border-slate-500 transition-colors uppercase">
                                + Añadir Lesión
                            </button>
                        </div>
                    </section>
                    <button onClick={handleSaveProfile} className="w-full bg-cyan-600 text-white font-bold py-4 rounded-xl shadow-lg">Guardar Perfil</button>
                </div>
            </div>
        );
    }

    return (
        <div key={currentPlan?.id || 'no-plan'} className="space-y-6 animate-in fade-in duration-500 pb-16">
            <div className="flex justify-between items-end border-b border-slate-800/50 pb-4">
                <div><h2 className="text-2xl font-black text-white uppercase tracking-tight">Macrociclo</h2><p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Nivel V World Athletics</p></div>
                <div className="flex items-center gap-2">
                    {currentPlan && (
                        <button
                            onClick={() => {
                                if (window.confirm('¿Estás seguro de reiniciar el plan? El actual se archivará.')) {
                                    resetPlan();
                                }
                            }}
                            className="bg-red-500/10 border border-red-500/30 text-red-500 px-3 py-1.5 rounded-full text-[9px] font-black uppercase flex items-center gap-1 hover:bg-red-500/20 transition-all"
                        >
                            <RotateCcw size={10} /> Reiniciar Plan
                        </button>
                    )}
                    <button onClick={() => setShowProfileConfig(true)} className="p-2 bg-slate-800 rounded-full text-slate-300 transition-transform active:scale-90"><UserCog size={18} /></button>
                </div>
            </div>
            {!currentPlan ? (
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-6">
                    <div className="space-y-4 max-w-sm mx-auto">
                        <BiomarkerSlider label="Fatiga" value={fatigue} setter={setFatigue} color="cyan" minLabel="Fresco" maxLabel="Exhausto" />
                        <BiomarkerSlider label="Sueño" value={sleep} setter={setSleep} color="indigo" minLabel="Pésimo" maxLabel="Excelente" />
                        <BiomarkerSlider label="Dolor Muscular" value={soreness} setter={setSoreness} color="red" minLabel="Ninguno" maxLabel="Intenso" />
                        <BiomarkerSlider label="Estrés" value={stress} setter={setStress} color="orange" minLabel="Bajo" maxLabel="Alto" />
                        <BiomarkerSlider label="Hidratación" value={hydration} setter={setHydration} color="blue" minLabel="Deshidratado" maxLabel="Óptimo" />
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Resting HR (ppm)</label>
                                <input type="number" value={restingHR} onChange={e => setRestingHR(parseInt(e.target.value))} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">HRV (ms)</label>
                                <input type="number" value={hrv} onChange={e => setHrv(parseInt(e.target.value))} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" />
                            </div>
                        </div>
                        {errorMsg && (
                            <div className="p-3 bg-red-900/40 border border-red-500/50 rounded-lg text-red-200 text-xs font-bold text-center animate-pulse">
                                ⚠️ {errorMsg}
                            </div>
                        )}
                    </div>
                    <button onClick={handleGenerate} disabled={loading} className="w-full bg-cyan-600 text-white font-bold py-4 rounded-xl"> {loading ? 'Generando...' : 'Generar Plan Elite'} </button>
                </div>
            ) : (
                <div className="space-y-6">
                    <MacrocycleChart
                        history={planHistory}
                        currentPlan={currentPlan}
                        injuries={userProfile.injuries}
                        competitions={userProfile.competitions}
                        therapyLogs={logs}
                    />
                    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-700">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-0.5 bg-cyan-900/30 text-cyan-400 border border-cyan-500/20 rounded text-[10px] font-bold uppercase">{currentPlan.phase}</span>
                            <div className="h-px bg-slate-800 flex-1"></div>
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">{currentPlan.weeklyGoal}</h3>
                        {currentPlan.rationale && (
                            <div className="mt-4 p-4 bg-slate-950/50 rounded-xl border border-slate-800/50">
                                <p className="text-xs text-slate-400 leading-relaxed italic"><span className="text-cyan-500 font-bold not-italic font-mono mr-2">LOGICA:</span>{currentPlan.rationale}</p>
                            </div>
                        )}
                    </div>
                    <div className="space-y-3">
                        {currentPlan.sessions.map((session: TrainingSession, idx: number) => (
                            <SessionCard key={idx} session={session} expandedDay={expandedDay} setExpandedDay={setExpandedDay} setSessionFeedbackModal={setSessionFeedbackModal} onShowRecovery={calculateSessionRecovery} isStaff={isStaff} updateSessionNote={updateSessionNote} />
                        ))}
                    </div>
                </div>
            )}
            {sessionFeedbackModal && <FeedbackModal />}
            {viewingRecovery && (
                <div className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-md flex items-center justify-center p-4" onClick={closeRecoveryView}>
                    <div className="bg-slate-900 border border-emerald-500/30 p-6 rounded-[2.5rem] w-full max-w-sm space-y-6 relative shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-black text-white uppercase tracking-tight">Protocolo Pro</h3>
                            <button onClick={closeRecoveryView} className="p-2 bg-slate-800 rounded-full text-white"><X size={20} /></button>
                        </div>
                        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                            <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Tipo de Estresor</div>
                            <div className="text-3xl font-black text-white uppercase">{viewingRecovery.sessionType}</div>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Nutrición & Hidratación</h4>
                                <div className="grid grid-cols-3 gap-2 mb-3">
                                    <div className="bg-slate-800 p-2 rounded-xl text-center">
                                        <div className="text-[8px] text-slate-400 uppercase font-bold">Carbos</div>
                                        <div className="text-xs font-black text-white">{viewingRecovery.nutrition.carbs}</div>
                                    </div>
                                    <div className="bg-slate-800 p-2 rounded-xl text-center">
                                        <div className="text-[8px] text-slate-400 uppercase font-bold">Prot</div>
                                        <div className="text-xs font-black text-white">{viewingRecovery.nutrition.protein}</div>
                                    </div>
                                    <div className="bg-slate-800 p-2 rounded-xl text-center">
                                        <div className="text-[8px] text-slate-400 uppercase font-bold">H2O</div>
                                        <div className="text-xs font-black text-white">{viewingRecovery.nutrition.hydration}</div>
                                    </div>
                                </div>
                                <p className="text-[11px] text-slate-300 italic mb-4 leading-snug">"{viewingRecovery.nutrition.notes}"</p>
                            </div>
                            <div>
                                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Protocolos Recomendados</h4>
                                <div className="grid grid-cols-1 gap-2">
                                    {viewingRecovery.protocols?.map((protocol: string, i: number) => (
                                        <div key={i} className="bg-slate-800/50 border border-slate-700 p-3 rounded-xl text-[10px] font-bold text-white uppercase flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                            {protocol}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <button onClick={closeRecoveryView} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 rounded-2xl uppercase tracking-widest text-xs transition-all">Entendido</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PlanManager;