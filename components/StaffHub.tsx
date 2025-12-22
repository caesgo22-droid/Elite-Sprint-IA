import * as React from 'react';
import { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { Users, Plus, Trash2, Mail, Phone, Edit2, Save } from 'lucide-react';
import { Coach } from '../types';

const StaffHub: React.FC = () => {
    const { userProfile, updateProfile } = useApp();
    const [isEditing, setIsEditing] = useState<string | null>(null);

    // Normalize coaches: convert strings to Coach objects
    const normalizeCoaches = (coaches: (string | Coach)[]): Coach[] => {
        return coaches.map((c, idx) => {
            if (typeof c === 'string') {
                // Convert legacy string to Coach object
                return {
                    id: `legacy-${idx}-${Date.now()}`,
                    name: c,
                    role: 'Head Coach' as const,
                    email: c.includes('@') ? c : undefined
                };
            }
            return c;
        });
    };

    const [tempStaff, setTempStaff] = useState<Coach[]>(
        normalizeCoaches(userProfile.coaches || [])
    );

    useEffect(() => {
        setTempStaff(normalizeCoaches(userProfile.coaches || []));
    }, [userProfile.coaches]);

    const handleAdd = () => {
        const newCoach: Coach = { id: Date.now().toString(), name: '', role: 'Head Coach' };
        setTempStaff([...tempStaff, newCoach]);
        setIsEditing(newCoach.id);
    };

    const handleUpdate = (id: string, field: keyof Coach, value: string) => {
        setTempStaff(tempStaff.map(c => c.id === id ? { ...c, [field]: value } : c));
    };

    const handleSave = () => {
        updateProfile({ ...userProfile, coaches: tempStaff.filter(c => c.name.trim() !== "") });
        setIsEditing(null);
    };

    return (
        <div className="space-y-6 pb-20">
            <div className="bg-blue-900 p-6 rounded-2xl border border-blue-800/50">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2"><Users /> Staff Técnico</h2>
            </div>
            <div className="grid gap-4">
                {tempStaff.map(coach => (
                    <div key={coach.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                        {isEditing === coach.id ? (
                            <div className="space-y-3">
                                <input type="text" value={coach.name} onChange={e => handleUpdate(coach.id, 'name', e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white" />
                                <button onClick={handleSave} className="w-full bg-blue-600 text-white font-bold py-2 rounded-lg">Guardar</button>
                            </div>
                        ) : (
                            <div className="flex justify-between items-center">
                                <div className="font-bold text-white">{coach.name || 'Sin Nombre'}</div>
                                <button onClick={() => setIsEditing(coach.id)} className="text-slate-500"><Edit2 size={16} /></button>
                            </div>
                        )}
                    </div>
                ))}
                <button onClick={handleAdd} className="w-full py-4 border-2 border-dashed border-slate-700 rounded-xl text-slate-400">Agregar Miembro</button>
            </div>
        </div>
    );
};

export default StaffHub;