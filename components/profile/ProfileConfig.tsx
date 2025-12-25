import * as React from 'react';
import { useRef, useState } from 'react';
import { UserCog, X, User, Target, Calendar, Trophy, MapPin, Trash2, Plus, History, Zap, Info } from 'lucide-react';
import { UserProfile, Injury, Coach } from '../../types';

interface ProfileConfigProps {
    userProfile: UserProfile;
    tempProfile: UserProfile;
    setTempProfile: (profile: UserProfile) => void;
    onSave: () => void;
    onClose: () => void;
}

export const ProfileConfig: React.FC<ProfileConfigProps> = ({
    userProfile,
    tempProfile,
    setTempProfile,
    onSave,
    onClose
}) => {
    const coachEmailRef = useRef<HTMLInputElement>(null);
    const [newCompName, setNewCompName] = useState("");
    const [newCompDate, setNewCompDate] = useState("");

    const toggleEventSelection = (e: string) => {
        const current = tempProfile.events || [];
        if (current.includes(e)) {
            setTempProfile({ ...tempProfile, events: current.filter(ev => ev !== e) });
        } else {
            setTempProfile({ ...tempProfile, events: [...current, e] });
        }
    };

    const toggleTrainingDay = (day: string) => {
        const current = [...new Set(tempProfile.trainingDays || [])];
        if (current.includes(day)) {
            setTempProfile({ ...tempProfile, trainingDays: current.filter(d => d !== day) });
        } else {
            setTempProfile({ ...tempProfile, trainingDays: [...current, day] });
        }
    };

    const updatePB = (event: '100m' | '200m' | '400m', field: 'time' | 'date', value: string) => {
        const newPBs = { ...tempProfile.pbs, [event]: { ...tempProfile.pbs[event], [field]: value } };
        setTempProfile({ ...tempProfile, pbs: newPBs });
    };

    const updateInjury = (index: number, field: keyof Injury, value: any) => {
        const updated = [...(tempProfile.injuries || [])];
        updated[index] = { ...updated[index], [field]: value };
        setTempProfile({ ...tempProfile, injuries: updated });
    };

    const addCompetition = () => {
        if (!newCompName || !newCompDate) return;
        const newComp = { id: Date.now().toString(), name: newCompName, date: newCompDate };
        const updated = [...(tempProfile.competitions || []), newComp].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        setTempProfile({ ...tempProfile, competitions: updated });
        setNewCompName("");
        setNewCompDate("");
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-10">
            <div className="flex justify-between items-center mb-4">
                <div className="flex flex-col">
                    <h2 className="text-xl font-black text-white uppercase tracking-tight">Perfil Holístico</h2>
                    {tempProfile.lastEditedBy && (
                        <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest mt-1">
                            ✓ Editado por: {tempProfile.lastEditedBy} ({new Date(tempProfile.lastEditedAt!).toLocaleDateString()})
                        </p>
                    )}
                </div>
                <button onClick={onClose} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"><X /></button>
            </div>
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-6 max-h-[75vh] overflow-y-auto">
                <section className="space-y-4">
                    <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-2"><UserCog size={14} /> Identidad Atlética</h3>
                    <div>
                        <label className="text-xs text-slate-400 block mb-1">Nombre</label>
                        <input type="text" value={tempProfile.name} onChange={e => setTempProfile({ ...tempProfile, name: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-cyan-500 outline-none" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div><label className="text-xs text-slate-400 block mb-1">Edad</label><input type="number" value={tempProfile.age} onChange={e => setTempProfile({ ...tempProfile, age: parseInt(e.target.value) })} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-cyan-500 outline-none" /></div>
                        <div><label className="text-xs text-slate-400 block mb-1">Altura (cm)</label><input type="number" value={tempProfile.height || ''} onChange={e => setTempProfile({ ...tempProfile, height: parseInt(e.target.value) })} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-cyan-500 outline-none" /></div>
                        <div><label className="text-xs text-slate-400 block mb-1">Peso (kg)</label><input type="number" value={tempProfile.weight || ''} onChange={e => setTempProfile({ ...tempProfile, weight: parseInt(e.target.value) })} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-cyan-500 outline-none" /></div>
                        <div>
                            <label className="text-xs text-slate-400 block mb-1">Nivel</label>
                            <select value={tempProfile.experienceLevel} onChange={e => setTempProfile({ ...tempProfile, experienceLevel: e.target.value as any })} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-cyan-500 outline-none">
                                <option value="Beginner">Principiante</option>
                                <option value="Intermediate">Intermedio</option>
                                <option value="Advanced">Avanzado</option>
                                <option value="Elite">Elite / Pro</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 block mb-1">Años de Exp.</label>
                            <input type="number" value={tempProfile.yearsExperience} onChange={e => setTempProfile({ ...tempProfile, yearsExperience: parseInt(e.target.value) })} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-cyan-500 outline-none" />
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 block mb-1">Horas/Día</label>
                            <input type="number" value={tempProfile.hoursPerDay || 2} onChange={e => setTempProfile({ ...tempProfile, hoursPerDay: parseInt(e.target.value) })} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-cyan-500 outline-none" />
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 block mb-1">Horario Pref.</label>
                            <select value={tempProfile.preferredTime} onChange={e => setTempProfile({ ...tempProfile, preferredTime: e.target.value as any })} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-cyan-500 outline-none">
                                <option value="Morning">Mañana</option>
                                <option value="Afternoon">Tarde</option>
                                <option value="Night">Noche</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-slate-400 block mb-1">Condiciones Médicas / Alergias</label>
                        <textarea value={tempProfile.medicalConditions || ''} onChange={e => setTempProfile({ ...tempProfile, medicalConditions: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white h-20 focus:border-cyan-500 outline-none resize-none" placeholder="Ej: Asma, Alergia al polen..." />
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
                                <input type="text" value={tempProfile.pbs?.[ev as keyof typeof tempProfile.pbs]?.time || ''} onChange={e => updatePB(ev, 'time', e.target.value)} className="flex-1 bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:border-orange-500 outline-none" placeholder="Tiempo (ej: 10.50)" />
                                <input type="text" value={tempProfile.pbs?.[ev as keyof typeof tempProfile.pbs]?.date || ''} onChange={e => updatePB(ev, 'date', e.target.value)} className="w-32 bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:border-orange-500 outline-none" placeholder="Fecha" />
                            </div>
                        ))}
                    </div>
                </section>

                <section className="space-y-4">
                    <h3 className="text-sm font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2"><MapPin size={14} /> Próximas Competencias</h3>
                    <div className="space-y-2">
                        {tempProfile.competitions?.map((comp) => (
                            <div key={comp.id} className="flex justify-between items-center bg-slate-800/40 p-3 rounded-lg border border-slate-700/50">
                                <div>
                                    <div className="text-xs font-bold text-white">{comp.name}</div>
                                    <div className="text-[10px] text-slate-400">{comp.date}</div>
                                </div>
                                <button onClick={() => setTempProfile({ ...tempProfile, competitions: tempProfile.competitions.filter(c => c.id !== comp.id) })} className="text-red-500 hover:bg-red-500/10 p-1 rounded-full transition-colors"><Trash2 size={14} /></button>
                            </div>
                        ))}
                        <div className="flex gap-2">
                            <input type="text" value={newCompName} onChange={e => setNewCompName(e.target.value)} placeholder="Evento" className="flex-1 bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:border-blue-500 outline-none" />
                            <input type="date" value={newCompDate} onChange={e => setNewCompDate(e.target.value)} className="bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:border-blue-500 outline-none" />
                            <button onClick={addCompetition} className="bg-blue-600 hover:bg-blue-500 p-2 rounded-lg text-white transition-colors"><Plus size={16} /></button>
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
                                    <button onClick={() => setTempProfile({ ...tempProfile, injuries: tempProfile.injuries.filter((_, i) => i !== idx) })} className="text-red-500 hover:text-red-400 transition-colors"><X size={14} /></button>
                                </div>
                                <textarea
                                    value={injury.description || ''}
                                    onChange={e => updateInjury(idx, 'description', e.target.value)}
                                    className="w-full bg-slate-900/50 border border-slate-700/50 rounded p-2 text-[10px] text-slate-300 min-h-[40px] resize-none outline-none focus:border-red-500/50"
                                    placeholder="Descripción o detalles..."
                                />
                                <div className="grid grid-cols-3 gap-2 mt-1">
                                    <select value={injury.severity} onChange={e => updateInjury(idx, 'severity', e.target.value)} className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[10px] text-white outline-none">
                                        <option value="Leve">Leve</option>
                                        <option value="Moderada">Moderada</option>
                                        <option value="Grave">Grave</option>
                                    </select>
                                    <select value={injury.status} onChange={e => updateInjury(idx, 'status', e.target.value)} className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[10px] text-white outline-none">
                                        <option value="Activa">Activa</option>
                                        <option value="Recuperación">Recuperación</option>
                                        <option value="Resuelta">Resuelta</option>
                                    </select>
                                    <select value={injury.grade || ''} onChange={e => updateInjury(idx, 'grade', parseInt(e.target.value))} className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[10px] text-white outline-none">
                                        <option value="">Grado?</option>
                                        <option value="1">G1</option>
                                        <option value="2">G2</option>
                                        <option value="3">G3</option>
                                    </select>
                                </div>
                            </div>
                        ))}
                        <button onClick={() => setTempProfile({ ...tempProfile, injuries: [...(tempProfile.injuries || []), { type: '', location: '', severity: 'Leve', status: 'Activa' }] })} className="w-full py-2 border border-dashed border-slate-700 rounded-lg text-[10px] font-bold text-slate-500 hover:border-slate-500 hover:text-slate-400 transition-colors uppercase">
                            + Añadir Lesión
                        </button>
                    </div>
                </section>

                <button onClick={onSave} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-4 rounded-xl shadow-lg transition-all active:scale-[0.98] uppercase tracking-widest text-xs">Guardar Perfil</button>
            </div>
        </div>
    );
};
