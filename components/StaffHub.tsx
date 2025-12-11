import * as React from 'react';
import { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { Users, Plus, Trash2, Mail, Phone, Edit2, Save } from 'lucide-react';
import { Coach } from '../types';

// EXPORTACIÓN CRÍTICA: Debe decir "export const StaffHub"
export const StaffHub: React.FC = () => {
  const { userProfile, updateProfile } = useApp();
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [tempStaff, setTempStaff] = useState<Coach[]>(userProfile.coaches || []);

  // Sync with global state when it changes
  useEffect(() => {
      setTempStaff(userProfile.coaches || []);
  }, [userProfile.coaches]);

  const handleAdd = () => {
      const newCoach: Coach = { 
          id: Date.now().toString(), 
          name: '', 
          role: 'Head Coach', 
          email: '', 
          phone: '', 
          notes: '' 
      };
      setTempStaff([...tempStaff, newCoach]);
      setIsEditing(newCoach.id);
  };

  const handleUpdate = (id: string, field: keyof Coach, value: string) => {
      setTempStaff(tempStaff.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const handleSave = () => {
      // Filter out empty entries
      const validStaff = tempStaff.filter(c => c.name.trim() !== "");
      updateProfile({ ...userProfile, coaches: validStaff });
      setIsEditing(null);
  };

  const handleDelete = (id: string) => {
      if(window.confirm("¿Eliminar a este miembro del equipo?")) {
          const updated = tempStaff.filter(c => c.id !== id);
          setTempStaff(updated);
          updateProfile({ ...userProfile, coaches: updated });
      }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="bg-gradient-to-br from-blue-900 to-slate-900 p-6 rounded-2xl border border-blue-800/50 relative overflow-hidden shadow-lg">
          <div className="relative z-10">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Users className="text-blue-400" /> Staff Técnico
              </h2>
              <p className="text-blue-200 text-sm mt-1">Gestión del equipo multidisciplinario.</p>
          </div>
          <div className="absolute right-[-20px] top-[-20px] opacity-10 pointer-events-none">
              <Users size={120} />
          </div>
      </div>

      <div className="grid gap-4">
          {tempStaff.map((coach) => (
              <div key={coach.id} className={`bg-slate-900 border rounded-xl p-4 transition-all duration-300 ${isEditing === coach.id ? 'border-blue-500 shadow-lg shadow-blue-900/20' : 'border-slate-800'}`}>
                  {isEditing === coach.id ? (
                      <div className="space-y-3">
                          <div className="flex justify-between items-center mb-2 border-b border-slate-800 pb-2">
                              <span className="text-xs font-bold text-blue-400 uppercase">Editando Perfil</span>
                              <button onClick={() => handleDelete(coach.id)} className="text-red-400 hover:text-red-300 p-1 transition-colors"><Trash2 size={16}/></button>
                          </div>
                          
                          <div>
                              <label className="text-xs text-slate-500 uppercase font-bold mb-1 block">Nombre</label>
                              <input type="text" value={coach.name} onChange={e => handleUpdate(coach.id, 'name', e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white text-sm focus:border-blue-500 outline-none" autoFocus />
                          </div>

                          <div>
                              <label className="text-xs text-slate-500 uppercase font-bold mb-1 block">Rol</label>
                              <select value={coach.role} onChange={e => handleUpdate(coach.id, 'role', e.target.value as any)} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white text-sm focus:border-blue-500 outline-none">
                                  <option value="Head Coach">Head Coach</option>
                                  <option value="Assistant">Asistente</option>
                                  <option value="Physio">Fisioterapeuta</option>
                                  <option value="Biomechanist">Biomecánico</option>
                                  <option value="Strength Coach">Prep. Físico</option>
                                  <option value="Nutritionist">Nutricionista</option>
                                  <option value="Sport Psychologist">Psicólogo Deportivo</option>
                              </select>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                              <div>
                                  <label className="text-xs text-slate-500 uppercase font-bold mb-1 block">Email</label>
                                  <input type="email" value={coach.email} onChange={e => handleUpdate(coach.id, 'email', e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white text-xs focus:border-blue-500 outline-none" />
                              </div>
                              <div>
                                  <label className="text-xs text-slate-500 uppercase font-bold mb-1 block">Teléfono</label>
                                  <input type="tel" value={coach.phone} onChange={e => handleUpdate(coach.id, 'phone', e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white text-xs focus:border-blue-500 outline-none" />
                              </div>
                          </div>

                          <div>
                              <label className="text-xs text-slate-500 uppercase font-bold mb-1 block">Notas</label>
                              <textarea placeholder="Enfoque principal..." value={coach.notes} onChange={e => handleUpdate(coach.id, 'notes', e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white text-xs h-16 focus:border-blue-500 outline-none" />
                          </div>

                          <button onClick={handleSave} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 mt-2 transition-colors"><Save size={16}/> Guardar Cambios</button>
                      </div>
                  ) : (
                      <div className="flex justify-between items-start">
                          <div className="flex items-start gap-4">
                              <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 text-slate-400 font-bold text-lg shrink-0">
                                  {coach.name ? coach.name.charAt(0).toUpperCase() : '?'}
                              </div>
                              <div>
                                  <h3 className="font-bold text-white text-lg leading-tight">{coach.name || 'Nuevo Miembro'}</h3>
                                  <span className={`inline-block mt-1 text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${coach.role === 'Head Coach' ? 'bg-emerald-900/30 text-emerald-400 border-emerald-900' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                                      {coach.role}
                                  </span>
                                  
                                  <div className="flex gap-4 mt-3 text-slate-400">
                                      {coach.email && <a href={`mailto:${coach.email}`} className="hover:text-white transition-colors flex items-center gap-1 text-xs"><Mail size={14}/> Email</a>}
                                      {coach.phone && <a href={`tel:${coach.phone}`} className="hover:text-white transition-colors flex items-center gap-1 text-xs"><Phone size={14}/> Llamar</a>}
                                  </div>
                                  {coach.notes && <div className="mt-3 bg-slate-950/50 p-2 rounded-lg border border-slate-800"><p className="text-xs text-slate-500 italic">"{coach.notes}"</p></div>}
                              </div>
                          </div>
                          <button onClick={() => setIsEditing(coach.id)} className="text-slate-500 hover:text-white p-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"><Edit2 size={16}/></button>
                      </div>
                  )}
              </div>
          ))}

          {tempStaff.length === 0 && (
              <div className="text-center py-12 text-slate-500 bg-slate-900/30 rounded-2xl border border-dashed border-slate-800">
                  <Users size={48} className="mx-auto mb-4 opacity-20"/>
                  <p className="text-sm font-medium">No tienes equipo registrado.</p>
                  <p className="text-xs mt-1 max-w-xs mx-auto text-slate-600">Agrega a tus entrenadores para que la IA pueda personalizar sus consejos según los roles de tu staff.</p>
              </div>
          )}

          <button onClick={handleAdd} className="w-full py-4 border-2 border-dashed border-slate-700 hover:border-blue-500 hover:bg-slate-900/50 rounded-xl text-slate-400 hover:text-blue-400 flex items-center justify-center gap-2 font-bold transition-all duration-300 group">
              <Plus size={20} className="group-hover:scale-110 transition-transform"/> Agregar Miembro
          </button>
      </div>
    </div>
  );
};