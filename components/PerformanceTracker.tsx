import * as React from 'react';
import { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { PerformanceLog } from '../types';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { Plus, Trash2, Edit2, Save, X, Calculator, Timer, Activity, TrendingUp, Filter, Download } from 'lucide-react';

const PerformanceTracker: React.FC = () => {
  const { logs, addLog, editLog, deleteLog, userProfile } = useApp();
  // ... (State variables same as before) ...
  const [activeTab, setActiveTab] = useState<'history' | 'strategy'>('history');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTime, setNewTime] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [location, setLocation] = useState('');
  const [type, setType] = useState<'Training' | 'Competition'>('Training');
  const [event, setEvent] = useState<'100m' | '200m' | '400m'>((userProfile.events?.[0] as any) || '100m');
  const [note, setNote] = useState('');
  const [timeRange, setTimeRange] = useState<'1M' | '3M' | '6M' | '1Y' | 'All'>('All');
  const [eventFilter, setEventFilter] = useState<'All' | '100m' | '200m' | '400m'>('All');
  const [strategyEvent, setStrategyEvent] = useState<'100m' | '200m' | '400m'>('100m');
  const [targetTime, setTargetTime] = useState('');
  const [raceModel, setRaceModel] = useState<any>(null);

  const resetForm = () => {
    setNewTime(''); setNote(''); setLocation(''); setDate(new Date().toISOString().split('T')[0]); setEditingId(null); setShowAddForm(false);
  };

  const handleSave = () => {
    const normalizedTime = newTime.replace(',', '.');
    const timeValue = parseFloat(normalizedTime);
    if (!normalizedTime || isNaN(timeValue)) { alert("Tiempo inválido"); return; }
    const logData: PerformanceLog = { id: editingId || Date.now().toString(), date, time: timeValue, event, type, location: location || 'Pista', notes: note };
    if (editingId) editLog(logData); else addLog(logData);
    resetForm();
  };

  const handleEditLoad = (log: PerformanceLog) => {
    setEditingId(log.id); setNewTime(log.time.toString()); setDate(log.date); setLocation(log.location); setType(log.type); setEvent(log.event); setNote(log.notes); setShowAddForm(true); window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (id: string) => { if(window.confirm("¿Borrar?")) { deleteLog(id); if (editingId === id) resetForm(); } }

  const getFilteredLogs = () => {
    const now = new Date(); let filtered = logs;
    if (timeRange !== 'All') {
      const cutoff = new Date();
      if (timeRange === '1M') cutoff.setMonth(now.getMonth() - 1);
      if (timeRange === '3M') cutoff.setMonth(now.getMonth() - 3);
      if (timeRange === '6M') cutoff.setMonth(now.getMonth() - 6);
      if (timeRange === '1Y') cutoff.setFullYear(now.getFullYear() - 1);
      filtered = filtered.filter(l => new Date(l.date) >= cutoff);
    }
    if (eventFilter !== 'All') filtered = filtered.filter(l => l.event === eventFilter);
    return filtered.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const displayLogs = getFilteredLogs();

  const chartData = displayLogs.map(l => ({
      date: l.date, time: l.time,
      t100: l.event === '100m' ? l.time : null,
      t200: l.event === '200m' ? l.time : null,
      t400: l.event === '400m' ? l.time : null,
      event: l.event, type: l.type
  }));

  const getCurrentPB = () => {
      if (eventFilter !== 'All') return userProfile.pbs[eventFilter]?.time || '--';
      const mainEvent = userProfile.events[0] as '100m'|'200m'|'400m';
      return userProfile.pbs[mainEvent]?.time || '--';
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return ( <div className="bg-slate-900 border border-slate-700 p-2 rounded shadow-xl"> <p className="text-slate-300 text-xs mb-1">{label}</p> {payload.map((p: any, i: number) => ( p.value && ( <div key={i} className="mb-1"> <p className="font-bold text-white" style={{color: p.color}}> {p.value}s <span className="text-[10px] text-slate-400">({p.name === 'time' ? p.payload.event : p.name.substring(1)})</span> </p> {p.payload.type === 'Competition' && <span className="text-[9px] text-yellow-500 font-bold uppercase block">Competición</span>} </div> ) ))} </div> );
    }
    return null;
  };

  const calculateModel = () => {
      const t = parseFloat(targetTime); if(!t || isNaN(t)) return;
      if (strategyEvent === '100m') {
          const drive30m = t * 0.415; const fly10m = (t - 1.0) / 10 * 0.91; const maxVelKmh = (10 / fly10m) * 3.6;
          setRaceModel({ type: '100m', metrics: [ { label: "Paso 30m", value: `${drive30m.toFixed(2)}s`, note: "Drive" }, { label: "Fly 10m", value: `${fly10m.toFixed(2)}s`, note: `${maxVelKmh.toFixed(1)} km/h` }, { label: "Pasos Est.", value: `${Math.round(100 / ((userProfile.height || 175) / 100 * 1.25))}`, note: "Zancada" } ], quote: "Paciencia en el drive." });
      } else if (strategyEvent === '200m') {
          setRaceModel({ type: '200m', metrics: [ { label: "100m (Curva)", value: `${(t * 0.525).toFixed(2)}s`, note: "Ataque" }, { label: "2do 100m", value: `${(t * 0.475).toFixed(2)}s`, note: "Lanzado" }, { label: "Diff", value: `${((t*0.525) - (t*0.475)).toFixed(2)}s`, note: "Ganancia" } ], quote: "Flotar en la curva." });
      } else if (strategyEvent === '400m') {
          setRaceModel({ type: '400m', metrics: [ { label: "Paso 200m", value: `${((t/2)-1.5).toFixed(2)}s`, note: "Control" }, { label: "2do 200m", value: `${((t/2)+1.5).toFixed(2)}s`, note: "Agallas" }, { label: "Diff", value: `+3.0s`, note: "Objetivo" } ], quote: "Corre con las agallas." });
      }
  };

  // Export Function
  const handleExport = () => {
      if(logs.length === 0) return;
      const csv = "Fecha,Evento,Tiempo,Tipo,Ubicacion,Notas\n" + logs.map(l => `${l.date},${l.event},${l.time},${l.type},${l.location},"${l.notes}"`).join("\n");
      const link = document.createElement("a"); link.href = "data:text/csv;charset=utf-8," + encodeURI(csv); link.download = "sprint_logs.csv"; link.click();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      <div className="flex justify-between items-center">
        <div><h2 className="text-2xl font-bold">Rendimiento</h2><p className="text-slate-400 text-sm">Nivel V Analytics</p></div>
        <div className="text-right"><div className="text-xs text-slate-500 uppercase">PB ({eventFilter === 'All' ? 'Principal' : eventFilter})</div><div className="text-xl font-mono font-bold text-emerald-400">{getCurrentPB()}s</div></div>
      </div>

      <div className="flex p-1 bg-slate-900/50 rounded-xl border border-slate-800">
          <button onClick={() => setActiveTab('history')} className={`flex-1 py-2 text-xs font-bold rounded-lg ${activeTab === 'history' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}>Historial</button>
          <button onClick={() => setActiveTab('strategy')} className={`flex-1 py-2 text-xs font-bold rounded-lg ${activeTab === 'strategy' ? 'bg-cyan-900/20 text-cyan-400' : 'text-slate-500'}`}>Estrategia</button>
      </div>

      {activeTab === 'history' ? (
        <>
            <div className="flex justify-between items-center">
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {['All', '100m', '200m', '400m'].map(ev => (<button key={ev} onClick={() => setEventFilter(ev as any)} className={`px-3 py-1.5 text-xs font-bold rounded-full border ${eventFilter === ev ? 'bg-emerald-900/30 border-emerald-500 text-emerald-400' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>{ev}</button>))}
                </div>
                <button onClick={handleExport} className="text-slate-400 hover:text-white p-2" title="Exportar CSV"><Download size={18}/></button>
            </div>
            
            <div className="h-64 w-full bg-slate-900/30 rounded-xl border border-slate-800 p-4 relative">
                {displayLogs.length < 2 ? <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm">Agrega más registros.</div> : (
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis dataKey="date" tick={{fontSize: 10}} axisLine={false} tickLine={false} tickFormatter={(v) => v.substring(5)} />
                        <YAxis domain={['auto', 'auto']} tick={{fontSize: 10}} axisLine={false} tickLine={false} width={30} />
                        <Tooltip content={<CustomTooltip />} />
                        {eventFilter === 'All' ? (<><Line connectNulls type="monotone" dataKey="t100" stroke="#22d3ee" strokeWidth={2} dot={{r:0}} /><Line connectNulls type="monotone" dataKey="t200" stroke="#10b981" strokeWidth={2} dot={{r:0}} /><Line connectNulls type="monotone" dataKey="t400" stroke="#f59e0b" strokeWidth={2} dot={{r:0}} /></>) : (<Line connectNulls type="monotone" dataKey="time" stroke="#22d3ee" strokeWidth={2} />)}
                    </LineChart>
                </ResponsiveContainer>
                )}
            </div>

            {!showAddForm && <button onClick={() => setShowAddForm(true)} className="w-full py-3 border border-dashed border-slate-700 rounded-xl text-slate-400 hover:text-white flex items-center justify-center gap-2 text-sm"><Plus size={16}/> Agregar Nuevo Registro</button>}
            
            {showAddForm && (
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between"><h3 className="text-slate-200">Nuevo Registro</h3><button onClick={resetForm}><X size={16}/></button></div>
                    <div className="flex gap-2"><select value={event} onChange={(e) => setEvent(e.target.value as any)} className="bg-slate-950 border border-slate-700 rounded p-2 text-white"><option value="100m">100m</option><option value="200m">200m</option><option value="400m">400m</option></select><input type="text" placeholder="10.50" value={newTime} onChange={(e) => setNewTime(e.target.value)} className="bg-slate-950 border border-slate-700 rounded p-2 text-white w-full font-mono font-bold"/></div>
                    <button onClick={handleSave} className="w-full bg-cyan-600 text-white rounded p-2"><Save size={16}/></button>
                </div>
            )}

            <div className="space-y-2">
                {[...displayLogs].reverse().map(log => (
                <div key={log.id} className="flex justify-between items-center bg-slate-900/30 p-3 rounded-lg border border-slate-800/50">
                    <div><span className="font-mono font-bold text-white mr-2">{log.time.toFixed(2)}s</span><span className="text-xs text-slate-500">{log.event} • {log.date}</span></div>
                    <div className="flex gap-2"><button onClick={() => handleEditLoad(log)}><Edit2 size={14}/></button><button onClick={() => handleDelete(log.id)}><Trash2 size={14}/></button></div>
                </div>
                ))}
            </div>
        </>
      ) : (
        <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6">
                <h3 className="font-bold text-white mb-4">Modelado de Carrera</h3>
                <div className="flex bg-slate-950 p-1 rounded mb-4">{['100m', '200m', '400m'].map(e => (<button key={e} onClick={() => { setStrategyEvent(e as any); setRaceModel(null); }} className={`flex-1 py-1 text-xs font-bold rounded ${strategyEvent === e ? 'bg-cyan-600' : 'text-slate-500'}`}>{e}</button>))}</div>
                <div className="flex gap-3 mb-4"><input type="number" placeholder="Meta (10.80)" value={targetTime} onChange={(e) => setTargetTime(e.target.value)} className="flex-1 bg-slate-950 border border-slate-700 rounded px-4 py-2 text-white" /><button onClick={calculateModel} className="bg-cyan-600 px-4 rounded text-white font-bold">Calc</button></div>
                {raceModel && <div className="grid grid-cols-2 gap-3">{raceModel.metrics.map((m: any, i: number) => (<div key={i} className="bg-slate-950 p-3 rounded border border-slate-700"> <div className="text-xs text-slate-400">{m.label}</div> <div className="text-xl font-bold text-white">{m.value}</div> </div>))}</div>}
            </div>
        </div>
      )}
    </div>
  );
};

export default PerformanceTracker;