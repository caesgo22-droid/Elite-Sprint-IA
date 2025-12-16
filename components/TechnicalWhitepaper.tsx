
import * as React from 'react';
import { ShieldCheck, X, Cpu, Scale, Eye, FileText, Database, GitBranch, Activity, Server, BookOpen, Link, Wifi, WifiOff } from 'lucide-react';
import { DRILL_DATABASE, PHASE_TEMPLATES } from '../services/trainingDatabase';
import { useApp } from '../contexts/AppContext';

export const TechnicalWhitepaper: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { logs, analysisHistory, userProfile } = useApp();

  // Dynamic System Metrics (Live)
  const SYSTEM_METRICS = {
      drillCount: DRILL_DATABASE.length,
      phaseCount: Object.keys(PHASE_TEMPLATES).length,
      aiModel: "Gemini 2.5 Flash",
      physicsEngine: "ElitePhysicsEngine v1.0 (Stateful)",
      visionModel: "Google MediaPipe Pose (33 Landmarks)",
      updateFrequency: "Real-time",
      activeLogs: logs.length, // Real Data
      videosAnalyzed: analysisHistory.length, // Real Data
      userStatus: userProfile.injuries.length > 0 ? "Injury Protocol" : "Performance Protocol" // Real Data
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col">
        
        {/* Header Ejecutivo */}
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-slate-700 p-6 flex justify-between items-start z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="text-cyan-400" size={24} />
                <h2 className="text-xl font-bold text-white tracking-tight">System Architecture (Live Audit)</h2>
            </div>
            <p className="text-xs text-slate-400 uppercase tracking-widest font-mono">
                Elite Sprint Coach AI | Status: ONLINE | Mode: {SYSTEM_METRICS.userStatus}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition-colors"><X className="text-slate-400" /></button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto p-6 space-y-8 text-slate-300 text-sm leading-relaxed custom-scrollbar">
          
          {/* Executive Summary */}
          <div className="bg-gradient-to-r from-cyan-900/20 to-slate-900 border border-cyan-500/20 p-5 rounded-xl">
            <h3 className="text-cyan-100 font-bold mb-2 text-base">Propósito del Sistema</h3>
            <p className="text-slate-300">
              Esta plataforma opera como un <strong>Sistema de Soporte a la Decisión (DSS)</strong> de Nivel V. 
              No utiliza generación aleatoria; emplea una arquitectura <em>Omni-Consciente</em> que cruza sus {SYSTEM_METRICS.activeLogs} registros de carrera y {SYSTEM_METRICS.videosAnalyzed} análisis biomecánicos en tiempo real para emular el razonamiento de un Staff Técnico de World Athletics.
            </p>
          </div>

          {/* 1. Live System Specs (Dynamic Data) */}
          <section>
            <h3 className="text-white font-bold flex items-center gap-2 mb-4 border-b border-slate-800 pb-2">
              <Server size={16} className="text-emerald-400" /> Especificaciones Técnicas (Live Status)
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <div className="text-[10px] text-slate-500 uppercase font-bold">Neural Engine</div>
                    <div className="text-emerald-400 font-mono font-bold">{SYSTEM_METRICS.aiModel}</div>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <div className="text-[10px] text-slate-500 uppercase font-bold">Computer Vision</div>
                    <div className="text-white font-mono font-bold">{SYSTEM_METRICS.visionModel}</div>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <div className="text-[10px] text-slate-500 uppercase font-bold">Physics Core</div>
                    <div className="text-white font-mono font-bold">{SYSTEM_METRICS.physicsEngine}</div>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <div className="text-[10px] text-slate-500 uppercase font-bold">Drill Database</div>
                    <div className="text-cyan-400 font-mono font-bold">{SYSTEM_METRICS.drillCount} Activos</div>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <div className="text-[10px] text-slate-500 uppercase font-bold">Periodization</div>
                    <div className="text-white font-mono font-bold">{SYSTEM_METRICS.phaseCount} Modelos (Bondarchuk)</div>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <div className="text-[10px] text-slate-500 uppercase font-bold">Logs Ingested</div>
                    <div className="text-purple-400 font-mono font-bold">{SYSTEM_METRICS.activeLogs}</div>
                </div>
            </div>
          </section>

          {/* HYBRID ARCHITECTURE */}
          <section className="bg-slate-950/50 p-4 rounded-xl border border-slate-800">
              <h3 className="text-white font-bold flex items-center gap-2 mb-3">
                  <GitBranch size={16} className="text-blue-400" /> Protocolo Híbrido (Online vs Offline)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="border border-emerald-900/30 bg-emerald-900/10 p-3 rounded-lg">
                      <div className="flex items-center gap-2 mb-2 font-bold text-emerald-400 text-xs uppercase"><Wifi size={14}/> Modo Online (Gemini AI)</div>
                      <p className="text-[11px] text-slate-300 leading-snug">
                          Utiliza <strong>LLMs (Large Language Models)</strong> para interpretar el contexto visual completo. Detecta matices sutiles (tensión facial, fluidez) y genera feedback natural y complejo.
                      </p>
                  </div>
                  <div className="border border-slate-700 bg-slate-900 p-3 rounded-lg">
                      <div className="flex items-center gap-2 mb-2 font-bold text-slate-400 text-xs uppercase"><WifiOff size={14}/> Modo Offline (Local Expert)</div>
                      <p className="text-[11px] text-slate-300 leading-snug">
                          Ejecuta <strong>Heurística Determinista</strong> localmente. Utiliza los mismos datos de física (ángulos, GCT) pero aplica reglas estrictas "If/Then" basadas en biomecánica. Menos conversacional, igual de preciso numéricamente.
                      </p>
                  </div>
              </div>
          </section>

          {/* NEW SECTION: SCIENTIFIC BASIS */}
          <section className="space-y-4">
             <h3 className="text-white font-bold flex items-center gap-2 mb-3 border-b border-slate-800 pb-2">
                <BookOpen size={16} className="text-yellow-400" /> Bases Técnicas & Bibliografía
             </h3>
             <p className="text-xs text-slate-400 italic mb-2">Los algoritmos de planificación y biomecánica se derivan estrictamente de la siguiente literatura científica:</p>
             
             <div className="grid gap-3">
                 <ReferenceCard 
                    title="The Mechanics of Sprinting and Hurdling" 
                    author="Ralph Mann, Ph.D. (2018)" 
                    tags={['Biomecánica', 'Modelo Cinemático']}
                    desc="Base para el 'Motor de Física'. Utilizado para determinar los ángulos ideales de la tibia y caderas en velocidad máxima."
                 />
                 <ReferenceCard 
                    title="Running: Biomechanics and Exercise Physiology" 
                    author="Frans Bosch & Ronald Klomp" 
                    tags={['Transferencia', 'Stiffness']}
                    desc="Fundamento de los drills correctivos y el concepto de 'Whip from the hip' aplicado en el análisis de video."
                 />
                 <ReferenceCard 
                    title="The Training Load - Injury Paradox" 
                    author="Tim Gabbett (2016)" 
                    tags={['Carga ACWR', 'Prevención']}
                    desc="Modelo matemático (Acute:Chronic Workload Ratio) implementado en el sistema de semáforo de riesgo de lesiones."
                 />
                 <ReferenceCard 
                    title="Sprint acceleration mechanics: The major role of hamstrings" 
                    author="J.B. Morin et al. (2015)" 
                    tags={['Fuerza Horizontal', 'Cinética']}
                    desc="Utilizado para inferir la eficiencia de aplicación de fuerza horizontal (Force Application Index)."
                 />
                 <ReferenceCard 
                    title="Transfer of Training in Sports" 
                    author="Anatoliy Bondarchuk" 
                    tags={['Periodización', 'Fases']}
                    desc="Estructura de los microciclos generados por la IA (GPP, SPP, Competición)."
                 />
             </div>
          </section>

          {/* 3. Load Engineering */}
          <section>
            <h3 className="text-white font-bold flex items-center gap-2 mb-3">
              <Scale size={16} className="text-orange-400" /> Ingeniería de Cargas & ACWR
            </h3>
            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 text-xs font-mono grid gap-2">
                <div className="flex justify-between">
                    <span>ACWR &lt; 0.8</span>
                    <span className="text-yellow-500">Riesgo de Desentrenamiento (Low Load)</span>
                </div>
                <div className="flex justify-between border-y border-slate-800 py-1 bg-emerald-900/10">
                    <span>0.8 - 1.3</span>
                    <span className="text-emerald-400 font-bold">ZONA ÓPTIMA (Sweet Spot)</span>
                </div>
                <div className="flex justify-between">
                    <span>ACWR &gt; 1.5</span>
                    <span className="text-red-400">Alto Riesgo de Lesión (Spike)</span>
                </div>
            </div>
          </section>

          {/* 5. Disclaimer */}
          <section className="bg-slate-950 p-5 rounded-xl border border-slate-800 mt-8">
            <h3 className="text-slate-200 font-bold flex items-center gap-2 mb-2 text-xs uppercase tracking-wider">
              <FileText size={14} /> Disclaimer Profesional
            </h3>
            <p className="text-xs text-slate-500 text-justify leading-relaxed">
              Esta herramienta es un software de análisis y planificación basado en algoritmos. Aunque utiliza bases científicas de alto nivel (World Athletics, ALTIS, Journal of Sports Sciences), <strong>NO sustituye el criterio médico, fisioterapéutico o de un entrenador presencial certificado.</strong> Las mediciones biomecánicas mediante video 2D son estimaciones y dependen de la calidad de la captura. El usuario asume la responsabilidad total sobre la ejecución de las cargas y ejercicios prescritos.
            </p>
          </section>

        </div>
        
        {/* Footer */}
        <div className="sticky bottom-0 bg-slate-900 p-4 border-t border-slate-700 text-center">
          <button onClick={onClose} className="bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-8 rounded-xl transition-colors w-full sm:w-auto text-sm">
            Cerrar Documentación
          </button>
        </div>
      </div>
    </div>
  );
};

const ReferenceCard = ({ title, author, tags, desc }: any) => (
    <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg flex flex-col gap-2 hover:border-slate-600 transition-colors">
        <div className="flex justify-between items-start">
            <div>
                <h4 className="font-bold text-slate-200 text-sm">{title}</h4>
                <span className="text-xs text-slate-500">{author}</span>
            </div>
            <Link size={14} className="text-slate-600"/>
        </div>
        <p className="text-xs text-slate-400 leading-snug">{desc}</p>
        <div className="flex gap-2 mt-1">
            {tags.map((t: string) => (
                <span key={t} className="text-[9px] bg-slate-900 border border-slate-700 px-2 py-0.5 rounded text-slate-400 uppercase tracking-wide">{t}</span>
            ))}
        </div>
    </div>
);
