// ... imports ...
export const PlanManager: React.FC = () => {
  // ... (existing code) ...

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
        <h2 className="text-2xl font-bold mb-4">Perfil Holístico</h2>
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-6">
          {/* ... Identity Sections ... */}
          
          <button onClick={handleSaveProfile} className="w-full bg-cyan-600 text-white font-bold py-4 rounded-xl mt-4 shadow-lg shadow-cyan-900/20">Guardar Perfil Completo</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-16">
      {/* ... Header ... */}

      {!currentPlan ? (
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="text-center"><h3 className="text-lg font-bold text-white">Biomarcadores Diarios</h3><p className="text-slate-400 text-xs mt-1">El Consejo de Expertos analizará tu estado.</p></div>
          {/* ... ACWR Gauge ... */}
          
          <div className="space-y-4 max-w-sm mx-auto pt-4 border-t border-slate-800">
            {/* UPDATED BIOMARKERS WITH GUIDE WORDS */}
            <BiomarkerSlider label="Fatiga" value={fatigue} setter={setFatigue} color="cyan" minLabel="Fresco" maxLabel="Exhausto" />
            <BiomarkerSlider label="Sueño" value={sleep} setter={setSleep} color="indigo" minLabel="Pésimo" maxLabel="Excelente" />
            <BiomarkerSlider label="Dolor" value={soreness} setter={setSoreness} color="red" minLabel="Sin Dolor" maxLabel="Incapacitante" />
            <BiomarkerSlider label="Estrés" value={stress} setter={setStress} color="yellow" minLabel="Zen" maxLabel="Ansioso" />
            <BiomarkerSlider label="Hidratación" value={hydration} setter={setHydration} color="blue" minLabel="Deshidratado" maxLabel="Óptima" />
          </div>

          <button onClick={handleGenerate} disabled={loading} className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-3 shadow-lg shadow-cyan-900/20 active:scale-95"> {loading ? <Loader2 className="animate-spin" /> : <Zap fill="currentColor" />} {loading ? 'Consultando Expertos...' : 'Generar Plan Elite'} </button>
          
          {/* ... History ... */}
        </div>
      ) : (
        <div className="space-y-6">
           {/* ... Plan View ... */}
        </div>
      )}
      
      {/* ... Modals ... */}
    </div>
  );
};