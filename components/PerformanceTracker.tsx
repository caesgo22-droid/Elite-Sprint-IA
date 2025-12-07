import * as React from 'react';
import { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { PerformanceLog } from '../types';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { Plus, Trash2, Edit2, Save, X, Calculator, Timer, Activity, TrendingUp, Filter } from 'lucide-react';

const PerformanceTracker: React.FC = () => {
  const { logs, addLog, editLog, deleteLog, userProfile } = useApp();
  
  // Tab State
  const [activeTab, setActiveTab] = useState<'history' | 'strategy'>('history');

  // Form State (History)
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTime, setNewTime] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [location, setLocation] = useState('');
  const [type, setType] = useState<'Training' | 'Competition'>('Training');
  const [event, setEvent] = useState<'100m' | '200m' | '400m'>((userProfile.events?.[0] as any) || '100m');
  const [note, setNote] = useState('');

  // Filter State
  const [timeRange, setTimeRange] = useState<'1M' | '3M' | '6M' | '1Y' | 'All'>('All');
  const [eventFilter, setEventFilter] = useState<'All' | '100m' | '200m' | '400m'>('All');

  // Race Model State
  const [strategyEvent, setStrategyEvent] = useState<'100m' | '200m' | '400m'>('100m');
  const [targetTime, setTargetTime] = useState('');
  const [raceModel, setRaceModel] = useState<any>(null);

  const resetForm = () => {
    setNewTime('');
    setNote('');
    setLocation('');
    setDate(new Date().toISOString().split('T')[0]);
    setEditingId(null);
    setShowAddForm(false);
  };

  const handleSave = () => {
    const normalizedTime = newTime.replace(',', '.');
    const timeValue = parseFloat(normalizedTime);

    if (!normalizedTime || isNaN(timeValue)) {
        alert("Por favor ingresa un tiempo válido (ej: 10.50)");
        return;
    }
    
    const logData: PerformanceLog = {
        id: editingId || Date.now().toString(),
        date,
        time: timeValue,
        event,
        type,
        location: location || 'Pista Local',
        notes: note
    };

    if (editingId) editLog(logData);
    else addLog(logData);
    
    resetForm();
  };

  const handleEditLoad = (log: PerformanceLog) => {
    setEditingId(log.id);
    setNewTime(log.time.toString());
    setDate(log.date);
    setLocation(log.location);
    setType(log.type);
    setEvent(log.event);
    setNote(log.notes);
    setShowAddForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (id: string) => {
    if(window.confirm("¿Estás seguro de borrar este registro?")) {
        deleteLog(id);
        if (editingId === id) resetForm();
    }
  }

  const getFilteredLogs = () => {
    const now = new Date();
    let filtered = logs;

    if (timeRange !== 'All') {
      const cutoff = new Date();
      if (timeRange === '1M') cutoff.setMonth(now.getMonth() - 1);
      if (timeRange === '3M') cutoff.setMonth(now.getMonth() - 3);
      if (timeRange === '6M') cutoff.setMonth(now.getMonth() - 6);
      if (timeRange === '1Y') cutoff.setFullYear(now.getFullYear() - 1);
      filtered = filtered.filter(l => new Date(l.date) >= cutoff);
    }

    if (eventFilter !== 'All') {
        filtered = filtered.filter(l => l.event === eventFilter);
    }

    return filtered.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const displayLogs = getFilteredLogs();

  // FIX 1: TRANSFORM DATA FOR MULTI-LINE CHART
  const chartData = displayLogs.map(l => ({
      date: l.date,
      time: l.time, // For single line fallback
      t100: l.event === '100m' ? l.time : null,
      t200: l.event === '200m' ? l.time : null,
      t400: l.event === '400m' ? l.time : null,
      event: l.event,
      type: l.type
  }));

  // FIX 2: ROBUST PB DISPLAY
  const getCurrentPB = () => {
      if (eventFilter !== 'All') {
          return userProfile.pbs[eventFilter]?.time || '--';
      }
      // If All, show PB of the main event (first in list)
      const mainEvent = userProfile.events[0] as '100m'|'200m'|'400m';
      return userProfile.pbs[mainEvent]?.time || '--';
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 border border-slate-700 p-2 rounded shadow-xl">
          <p className="text-slate-300 text-xs mb-1">{label}</p>
          {payload.map((p: any, i: number) => (
              p.value && (
                <div key={i} className="mb-1">
                    <p className="font-bold text-white" style={{color: p.color}}>
                        {p.value}s <span className="text-[10px] text-slate-400">({p.name === 'time' ? p.payload.event : p.name.substring(1)})</span>
                    </p>
                    {p.payload.type === 'Competition' && <span className="text-[9px] text-yellow-500 font-bold uppercase block">Competición</span>}
                </div>
              )
          ))}
        </div>
      );
    }
    return null;
  };

  // --- RACE STRATEGY LOGIC ---
  const calculateModel = () => {
      const t = parseFloat(targetTime);
      if(!t || isNaN(t)) return;

      if (strategyEvent === '100m') {
          const drive30m = t * 0.415; 
          const fly10m = (t - 1.0) / 10 * 0.91; 
          const maxVelKmh = (10 / fly10m) * 3.6;
          const heightM = userProfile.height ? userProfile.height / 100 : 1.75;
          const steps = Math.round(100 / (heightM * 1.25));

          setRaceModel({
              type: '100m',
              metrics: [
                  { label: "Paso 30m (Drive)", value: `${drive30m.toFixed(2)}s`, note: "Crítico para aceleración" },
                  { label: "Fly 10m (Max V)", value: `${fly10m.toFixed(2)}s`, note: `${maxVelKmh.toFixed(1)} km/h` },
                  { label: "Frecuencia Est.", value: `${steps} Pasos`, note: "Zancada óptima" }
              ],
              quote: "Paciencia en el drive, relajación en el top speed."
          });
      } else if (strategyEvent === '200m') {
          const split1 = t * 0.525; // Curve
          const split2 = t * 0.475; // Straight
          setRaceModel({
              type: '200m',
              metrics: [
                  { label: "Paso 100m (Curva)", value: `${split1.toFixed(2)}s`, note: "Ataque controlado" },
                  { label: "2do 100m (Lanzado)", value: `${split2.toFixed(2)}s`, note: "Resistencia velocidad" },
                  { label: "Diferencial", value: `${(split1 - split2).toFixed(2)}s`, note: "Ganancia por lanzado" }
              ],
              quote: "Flotar en la curva, atacar la salida, sobrevivir la recta."
          });
      } else if (strategyEvent === '400m') {
          const split1 = (t / 2) - 1.5; 
          const split2 = (t / 2) + 1.5; 
          const diff = split2 - split1;
          setRaceModel({
              type: '400m',
              metrics: [
                  { label: "Paso 200m", value: `${split1.toFixed(2)}s`, note: "Velocidad Controlada" },
                  { label: "2do 200m", value: `${split2.toFixed(2)}s`, note: "Zona de Agallas" },
                  { label: "Diferencial", value: `+${diff.toFixed(2)}s`, note: "Objetivo < 3.0s" }
              ],
              quote: "El 400m no se corre con las piernas, se corre con las agallas."
          });
      }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      <div className="flex justify-between items-center">
        <div>
           <h2 className="text-2xl font-bold">Rendimiento</h2>
           <p className="text-slate-400 text-sm">Nivel V Analytics</p>
        </div>
        <div className="text-right">
           <div className="text-xs text-slate-500 uppercase">PB ({eventFilter === 'All' ? 'Principal' : eventFilter})</div>
           <div className="text-xl font-mono font-bold text-emerald-400">{getCurrentPB()}s</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex p-1 bg-slate-900/50 rounded-xl border border-slate-800">
          <button onClick={() => setActiveTab('history')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'history' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}>Historial</button>
          <button onClick={() => setActiveTab('strategy')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'strategy' ? 'bg-cyan-900/20 text-cyan-400 shadow' : 'text-slate-500 hover:text-slate-300'}`}>Estrategia de Carrera</button>
      </div>

      {activeTab === 'history' ? (
        <>
            {/* Filters */}
            <div className="space-y-2">
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {['All', '100m', '200m', '400m'].map(ev => (
                        <button key={ev} onClick={() => setEventFilter(ev as any)} className={`px-3 py-1.5 text-xs font-bold rounded-full border transition-colors ${eventFilter === ev ? 'bg-emerald-900/30 border-emerald-500 text-emerald-400' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>
                            {ev}
                        </button>
                    ))}
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {['1M', '3M', '6M', 'All'].map(range => (
                        <button key={range} onClick={() => setTimeRange(range as any)} className={`px-3 py-1 text-[10px] font-bold rounded-md transition-colors ${timeRange === range ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                            {range}
                        </button>
                    ))}
                </div>
            </div>

            {/* Chart */}
            <div className="h-64 w-full bg-slate-900/30 rounded-xl border border-slate-800 p-4 relative">
                {displayLogs.length < 2 ? (
                <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm">Agrega más registros para ver tendencias.</div>
                ) : (
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis dataKey="date" tick={{fontSize: 10, fill: '#64748b'}} axisLine={false} tickLine={false} tickFormatter={(val) => val.substring(5)} />
                        <YAxis domain={['auto', 'auto']} tick={{fontSize: 10, fill: '#64748b'}} axisLine={false} tickLine={false} width={30} />
                        <Tooltip content={<CustomTooltip />} cursor={{stroke: '#334155'}} />
                        
                        {/* FIX: Conditional Rendering for Lines */}
                        {eventFilter === 'All' ? (
                            <>
                                <Line connectNulls type="monotone" dataKey="t100" stroke="#22d3ee" strokeWidth={2} dot={{fill: '#22d3ee', r: 2}} name="100m" />
                                <Line connectNulls type="monotone" dataKey="t200" stroke="#10b981" strokeWidth={2} dot={{fill: '#10b981', r: 2}} name="200m" />
                                <Line connectNulls type="monotone" dataKey="t400" stroke="#f59e0b" strokeWidth={2} dot={{fill: '#f59e0b', r: 2}} name="400m" />
                            </>
                        ) : (
                            <Line connectNulls type="monotone" dataKey="time" stroke="#22d3ee" strokeWidth={2} dot={{fill: '#22d3ee', r: 3}} name="time" />
                        )}
                    </LineChart>
                </ResponsiveContainer>
                )}
            </div>

            {/* Collapsible Form Toggle */}
            {!showAddForm && (
                <button onClick={() => setShowAddForm(true)} className="w-full py-3 border border-dashed border-slate-700 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 transition-colors flex items-center justify-center gap-2 text-sm font-medium">
                    <Plus size={16}/> Agregar Nuevo Registro
                </button>
            )}

            {/* Add/Edit Form */}
            {showAddForm && (
                <div className={`bg-slate-900/50 border rounded-xl p-4 space-y-3 transition-colors ${editingId ? 'border-cyan-500/50 bg-slate-900/80 shadow-lg shadow-cyan-900/10' : 'border-slate-800'} animate-in slide-in-from-top-2`}>
                    <div className="flex justify-between items-center">
                        <h3 className={`font-semibold ${editingId ? 'text-cyan-400' : 'text-slate-200'}`}>{editingId ? 'Editando Registro' : 'Nuevo Registro'}</h3>
                        <button onClick={resetForm} className="text-slate-500 hover:text-white"><X size={16} /></button>
                    </div>
                    
                    <div className="flex gap-2">
                        <select value={event} onChange={(e) => setEvent(e.target.value as any)} className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-3 text-sm text-white outline-none w-24">
                            <option value="100m">100m</option><option value="200m">200m</option><option value="400m">400m</option>
                        </select>
                        <select value={type} onChange={(e) => setType(e.target.value as any)} className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-3 text-sm text-white outline-none flex-1">
                            <option value="Training">Entreno</option><option value="Competition">Competencia</option>
                        </select>
                    </div>
                    <div className="flex gap-2">
                        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-3 text-sm text-slate-300 w-1/2 outline-none" />
                        <input type="text" inputMode="decimal" placeholder="10.50" value={newTime} onChange={(e) => setNewTime(e.target.value)} className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-3 text-sm text-white w-1/2 outline-none font-mono text-lg font-bold placeholder-slate-600" />
                    </div>
                    <div className="flex gap-2 items-center">
                        <input type="text" placeholder="Notas (Viento, Clima...)" value={note} onChange={(e) => setNote(e.target.value)} className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-3 text-sm text-slate-300 outline-none" />
                        <button onClick={handleSave} disabled={!newTime} className="bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg p-3"><Save size={20} /></button>
                    </div>
                </div>
            )}

            {/* History List */}
            <div className="space-y-2">
                <h3 className="font-semibold text-slate-400 text-xs uppercase tracking-wider mb-2">Historial ({displayLogs.length})</h3>
                {[...displayLogs].reverse().map(log => (
                <div key={log.id} className={`flex justify-between items-center bg-slate-900/30 p-3 rounded-lg border hover:bg-slate-900/50 transition-colors group ${editingId === log.id ? 'border-cyan-500 bg-slate-900' : 'border-slate-800/50'}`}>
                    <div>
                    <div className="flex items-center gap-2">
                        <span className={`font-mono font-bold text-lg ${log.type === 'Competition' ? 'text-yellow-400' : 'text-white'}`}>{log.time.toFixed(2)}s</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-slate-800 text-slate-400">{log.event}</span>
                        {log.type === 'Competition' && <span className="text-[10px] bg-yellow-900/30 text-yellow-500 px-1.5 py-0.5 rounded font-bold">COMP</span>}
                    </div>
                    <div className="flex gap-2 text-xs text-slate-500 mt-1"><span>{log.date}</span>{log.notes && <span>• {log.notes}</span>}</div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => handleEditLoad(log)} className="p-2 text-slate-500 hover:text-white"><Edit2 size={14} /></button>
                        <button onClick={() => handleDelete(log.id)} className="p-2 text-slate-500 hover:text-red-400"><Trash2 size={14} /></button>
                    </div>
                </div>
                ))}
            </div>
        </>
      ) : (
        <div className="space-y-6 animate-in slide-in-from-right-4">
            {/* Race Strategy View */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-2xl p-6 shadow-2xl">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-cyan-900/30 rounded-xl text-cyan-400"><Calculator size={24}/></div>
                    <div><h3 className="font-bold text-white text-lg">Modelado de Carrera</h3><p className="text-slate-400 text-xs">Ingeniería inversa de tu objetivo.</p></div>
                </div>

                <div className="flex bg-slate-950 p-1 rounded-lg mb-4">
                    {['100m', '200m', '400m'].map(e => (
                        <button key={e} onClick={() => { setStrategyEvent(e as any); setRaceModel(null); }} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${strategyEvent === e ? 'bg-cyan-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>{e}</button>
                    ))}
                </div>
                
                <div className="flex gap-3 mb-6">
                    <input type="number" placeholder="Tiempo Meta (ej: 10.80)" value={targetTime} onChange={(e) => setTargetTime(e.target.value)} className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white font-mono text-lg outline-none focus:border-cyan-500 transition-colors" />
                    <button onClick={calculateModel} className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold px-6 rounded-xl transition-colors">Calcular</button>
                </div>

                {raceModel && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                        <div className="grid grid-cols-2 gap-3">
                            {raceModel.metrics.slice(0, 2).map((m: any, i: number) => (
                                <div key={i} className="bg-slate-950/50 p-3 rounded-xl border border-slate-700">
                                    <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase mb-1"><Timer size={12}/> {m.label}</div>
                                    <div className="text-2xl font-mono font-bold text-white">{m.value}</div>
                                    <div className="text-[10px] text-slate-500">{m.note}</div>
                                </div>
                            ))}
                        </div>
                        {raceModel.metrics[2] && (
                            <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-700 flex items-center justify-between">
                                 <div><div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase mb-1"><TrendingUp size={12}/> {raceModel.metrics[2].label}</div><div className="text-xl font-bold text-white">{raceModel.metrics[2].value}</div></div>
                                 <div className="text-right max-w-[150px]"><p className="text-[10px] text-slate-400 italic">"{raceModel.quote}"</p></div>
                            </div>
                        )}
                    </div>
                )}
            </div>
            
            <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-4">
                <h4 className="font-bold text-slate-300 text-sm mb-2">Coaching Táctico ({strategyEvent})</h4>
                <ul className="space-y-2 text-xs text-slate-400">
                    {strategyEvent === '100m' && (<><li>• <strong className="text-slate-200">0-30m:</strong> Paciencia. No busques la meta, empuja el suelo.</li><li>• <strong className="text-slate-200">60-100m:</strong> Relajación. Apretar los dientes te hace lento.</li></>)}
                    {strategyEvent === '200m' && (<><li>• <strong className="text-slate-200">Curva:</strong> Ataca agresivo 0-40m, luego flota.</li><li>• <strong className="text-slate-200">Salida:</strong> Catapulta centrífuga hacia la recta.</li></>)}
                    {strategyEvent === '400m' && (<><li>• <strong className="text-slate-200">1er 200m:</strong> Rápido pero controlado (90-95%).</li><li>• <strong className="text-slate-200">Zona 300m:</strong> Activa brazos agresivamente.</li></>)}
                </ul>
            </div>
        </div>
      )}
    </div>
  );
};

export default PerformanceTracker;