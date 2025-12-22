import * as React from 'react';
import { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { assignTask, getAssignedTasks, updateTaskStatus } from '../services/firebase';
import { AssignedTask } from '../types';
import { CheckCircle2, Circle, Clock, AlertCircle, Plus, X, Calendar } from 'lucide-react';

const TaskManager: React.FC<{ athleteId: string }> = ({ athleteId }) => {
    const { user, userProfile } = useApp();
    const [tasks, setTasks] = useState<AssignedTask[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [newTask, setNewTask] = useState({
        title: '',
        description: '',
        type: 'General' as 'Drill' | 'Video' | 'Recovery' | 'General',
        priority: 'Medium' as 'Low' | 'Medium' | 'High',
        dueDate: ''
    });

    useEffect(() => {
        loadTasks();
    }, [athleteId]);

    const loadTasks = async () => {
        const data = await getAssignedTasks(athleteId);
        setTasks(data);
    };

    const handleCreateTask = async () => {
        if (!newTask.title.trim()) return;

        const task: AssignedTask = {
            id: Date.now().toString(),
            athleteId,
            assignedBy: user?.uid || '',
            assignedByName: userProfile.name || 'Staff',
            title: newTask.title,
            description: newTask.description,
            dueDate: newTask.dueDate,
            status: 'Pending',
            type: newTask.type,
            priority: newTask.priority,
            createdAt: new Date().toISOString()
        };

        await assignTask(athleteId, task);
        setTasks([task, ...tasks]);
        setNewTask({ title: '', description: '', type: 'General', priority: 'Medium', dueDate: '' });
        setShowForm(false);
    };

    const handleToggleStatus = async (task: AssignedTask) => {
        const newStatus = task.status === 'Completed' ? 'Pending' : 'Completed';
        const completedAt = newStatus === 'Completed' ? new Date().toISOString() : undefined;
        await updateTaskStatus(athleteId, task.id, newStatus, completedAt);
        setTasks(tasks.map(t => t.id === task.id ? { ...t, status: newStatus, completedAt } : t));
    };

    const pendingTasks = tasks.filter(t => t.status !== 'Completed');
    const completedTasks = tasks.filter(t => t.status === 'Completed');

    const priorityColors = {
        Low: 'text-blue-400 border-blue-500/30',
        Medium: 'text-yellow-400 border-yellow-500/30',
        High: 'text-red-400 border-red-500/30'
    };

    const typeIcons = {
        Drill: '🏃',
        Video: '📹',
        Recovery: '💆',
        General: '📋'
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-black text-white uppercase tracking-tight">Tareas Asignadas</h3>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="bg-cyan-600 hover:bg-cyan-500 text-white p-2 rounded-xl transition-colors"
                >
                    {showForm ? <X size={20} /> : <Plus size={20} />}
                </button>
            </div>

            {showForm && (
                <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700 animate-in slide-in-from-top-2">
                    <input
                        type="text"
                        placeholder="Título de la tarea..."
                        value={newTask.title}
                        onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white placeholder-slate-500 mb-3"
                    />
                    <textarea
                        placeholder="Descripción (opcional)..."
                        value={newTask.description}
                        onChange={e => setNewTask({ ...newTask, description: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white placeholder-slate-500 mb-3 h-20 resize-none"
                    />
                    <div className="grid grid-cols-3 gap-2 mb-3">
                        <select
                            value={newTask.type}
                            onChange={e => setNewTask({ ...newTask, type: e.target.value as any })}
                            className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-xs"
                        >
                            <option value="General">General</option>
                            <option value="Drill">Drill</option>
                            <option value="Video">Video</option>
                            <option value="Recovery">Recuperación</option>
                        </select>
                        <select
                            value={newTask.priority}
                            onChange={e => setNewTask({ ...newTask, priority: e.target.value as any })}
                            className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-xs"
                        >
                            <option value="Low">Baja</option>
                            <option value="Medium">Media</option>
                            <option value="High">Alta</option>
                        </select>
                        <input
                            type="date"
                            value={newTask.dueDate}
                            onChange={e => setNewTask({ ...newTask, dueDate: e.target.value })}
                            className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-xs"
                        />
                    </div>
                    <button
                        onClick={handleCreateTask}
                        className="w-full bg-cyan-600 text-white py-2 rounded-lg font-bold hover:bg-cyan-500"
                    >
                        Asignar Tarea
                    </button>
                </div>
            )}

            <div className="space-y-3">
                {pendingTasks.length === 0 && completedTasks.length === 0 && (
                    <div className="text-center py-8 text-slate-600 text-sm">
                        No hay tareas asignadas aún.
                    </div>
                )}

                {pendingTasks.map(task => (
                    <div
                        key={task.id}
                        className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 hover:border-cyan-500/50 transition-all"
                    >
                        <div className="flex items-start gap-3">
                            <button
                                onClick={() => handleToggleStatus(task)}
                                className="mt-1 text-slate-500 hover:text-cyan-400 transition-colors"
                            >
                                <Circle size={20} />
                            </button>
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-lg">{typeIcons[task.type]}</span>
                                    <h4 className="font-bold text-white">{task.title}</h4>
                                    <span className={`text-[9px] px-2 py-0.5 rounded-full border ${priorityColors[task.priority]}`}>
                                        {task.priority}
                                    </span>
                                </div>
                                {task.description && (
                                    <p className="text-sm text-slate-400 mb-2">{task.description}</p>
                                )}
                                <div className="flex items-center gap-4 text-[10px] text-slate-500">
                                    <span>Asignado por: {task.assignedByName}</span>
                                    {task.dueDate && (
                                        <span className="flex items-center gap-1">
                                            <Calendar size={10} />
                                            {new Date(task.dueDate).toLocaleDateString('es-ES')}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}

                {completedTasks.length > 0 && (
                    <details className="group">
                        <summary className="text-xs text-slate-500 uppercase font-bold cursor-pointer hover:text-slate-400">
                            Completadas ({completedTasks.length})
                        </summary>
                        <div className="space-y-2 mt-2">
                            {completedTasks.map(task => (
                                <div
                                    key={task.id}
                                    className="bg-slate-900/30 border border-slate-800 rounded-lg p-3 opacity-60"
                                >
                                    <div className="flex items-start gap-2">
                                        <button
                                            onClick={() => handleToggleStatus(task)}
                                            className="mt-0.5 text-emerald-400"
                                        >
                                            <CheckCircle2 size={16} />
                                        </button>
                                        <div>
                                            <h4 className="font-bold text-white text-sm line-through">{task.title}</h4>
                                            <span className="text-[9px] text-slate-600">
                                                Completado: {task.completedAt ? new Date(task.completedAt).toLocaleDateString('es-ES') : 'N/A'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </details>
                )}
            </div>
        </div>
    );
};

export default TaskManager;
