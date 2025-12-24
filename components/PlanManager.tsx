import * as React from 'react';
import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { UserCog, RotateCcw } from 'lucide-react';
import { TrainingSession, UserProfile } from '../types';
import { MacrocycleChart } from './MacrocycleChart';
import { SessionCard } from './SessionCard';
import { useTrainingPlan } from '../hooks/useTrainingPlan';
import { ProfileConfig } from './ProfileConfig';
import { FeedbackModal } from './FeedbackModal';
import { RecoveryProtocolView } from './RecoveryProtocolView';

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
        logs
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
            <ProfileConfig
                userProfile={userProfile}
                tempProfile={tempProfile}
                setTempProfile={setTempProfile}
                onSave={handleSaveProfile}
                onClose={() => setShowProfileConfig(false)}
            />
        );
    }

    return (
        <div key={currentPlan?.id || 'no-plan'} className="space-y-6 animate-in fade-in duration-500 pb-16">
            <div className="flex justify-between items-end border-b border-slate-800/50 pb-4">
                <div>
                    <h2 className="text-2xl font-black text-white uppercase tracking-tight">Macrociclo</h2>
                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Nivel V World Athletics</p>
                </div>
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
                    <button onClick={() => setShowProfileConfig(true)} className="p-2.5 bg-slate-900 border border-slate-800 rounded-full text-slate-400 hover:text-white transition-all">
                        <UserCog size={20} />
                    </button>
                </div>
            </div>

            {userProfile.lastEditedBy && !isStaff && (
                <div className="bg-indigo-600/20 border border-indigo-500/30 p-3 rounded-2xl flex items-center justify-between animate-in slide-in-from-top-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-[0_0_15px_rgba(79,70,229,0.4)]">
                            <UserCog size={16} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest leading-tight">Nota de tu Coach</p>
                            <p className="text-xs text-slate-200">Tu ficha técnica ha sido optimizada por {userProfile.lastEditedBy}.</p>
                        </div>
                    </div>
                </div>
            )}

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
                                <input type="number" value={restingHR} onChange={e => setRestingHR(parseInt(e.target.value))} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white focus:border-cyan-500 outline-none" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">HRV (ms)</label>
                                <input type="number" value={hrv} onChange={e => setHrv(parseInt(e.target.value))} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white focus:border-cyan-500 outline-none" />
                            </div>
                        </div>
                        {errorMsg && (
                            <div className="p-3 bg-red-900/40 border border-red-500/50 rounded-lg text-red-200 text-xs font-bold text-center animate-pulse">
                                ⚠️ {errorMsg}
                            </div>
                        )}
                    </div>
                    <button onClick={handleGenerate} disabled={loading} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-4 rounded-xl shadow-lg transition-all active:scale-[0.98] disabled:opacity-50">
                        {loading ? 'Generando...' : 'Generar Plan Elite'}
                    </button>
                </div>
            ) : (
                <div className="space-y-6">
                    <MacrocycleChart
                        history={planHistory}
                        currentPlan={currentPlan}
                        injuries={userProfile.injuries}
                        competitions={userProfile.competitions}
                        therapyLogs={logs}
                        isStaff={isStaff}
                        onUpdatePlan={isStaff ? (updated) => updateTrainingPlan(userProfile.uid || '', updated) : undefined}
                    />
                    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-700 shadow-xl">
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
                            <SessionCard
                                key={idx}
                                session={session}
                                expandedDay={expandedDay}
                                setExpandedDay={setExpandedDay}
                                setSessionFeedbackModal={setSessionFeedbackModal}
                                onShowRecovery={calculateSessionRecovery}
                                isStaff={isStaff}
                                updateSessionNote={(day, note) => updateSession(day, { coachNotes: note })}
                            />
                        ))}
                    </div>
                </div>
            )}
            {sessionFeedbackModal && (
                <FeedbackModal
                    session={sessionFeedbackModal}
                    onClose={() => setSessionFeedbackModal(null)}
                    onSave={updateSession}
                />
            )}
            {viewingRecovery && (
                <RecoveryProtocolView
                    data={viewingRecovery}
                    onClose={closeRecoveryView}
                />
            )}
        </div>
    );
};

export default PlanManager;