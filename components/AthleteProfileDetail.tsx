import * as React from 'react';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../contexts/AppContext';
import { getStaffBriefings, addStaffBriefing, addBriefingReply } from '../services/firebase';
import { ArrowLeft, CalendarCheck, Maximize2, Dumbbell, Plus, Trophy, Zap, Settings } from 'lucide-react';
import { UserProfile, StaffBriefing, StaffReply } from '../types';
import { MacrocycleChart } from './MacrocycleChart';
import { AthletePassport } from './AthletePassport';
import { ProfileConfig } from './ProfileConfig';

interface AthleteProfileDetailProps {
    uid: string;
    athleteRef: any;
    switchAthlete: (id: string | null) => void;
    adminProfile: UserProfile;
    t: any;
    navigate: any;
}

export const AthleteProfileDetail: React.FC<AthleteProfileDetailProps> = ({
    uid,
    athleteRef,
    switchAthlete,
    adminProfile,
    t,
    navigate
}) => {
    // Use logs from athleteRef if available (passed from Dashboard) to ensure consistency with Roster ACWR
    const { userProfile, currentPlan, planHistory, logs: contextLogs, acwrStats, updateProfile, analysisHistory, logActivity } = useApp();
    const logs = athleteRef?.logs || contextLogs;

    const [briefings, setBriefings] = useState<StaffBriefing[]>([]);
    const [newBriefing, setNewBriefing] = useState('');
    const [showBriefingForm, setShowBriefingForm] = useState(false);
    const [replyContent, setReplyContent] = useState<Record<string, string>>({});
    const photoInputRef = useRef<HTMLInputElement>(null);
    const [showProfileConfig, setShowProfileConfig] = useState(false);
    const [tempTargetProfile, setTempTargetProfile] = useState<UserProfile | null>(null);
    const [selectedAnalysisId, setSelectedAnalysisId] = useState<string>('');

    useEffect(() => {
        getStaffBriefings(uid).then(setBriefings);
    }, [uid]);

    const handlePostBriefing = async () => {
        if (!newBriefing.trim()) return;
        const brief: StaffBriefing = {
            id: Date.now().toString(),
            athleteId: uid,
            authorId: adminProfile.uid || 'admin',
            authorName: adminProfile.name || 'Staff',
            role: adminProfile.role || 'Coach',
            content: newBriefing,
            type: 'General',
            timestamp: new Date().toISOString(),
            attachments: selectedAnalysisId ? [{
                type: 'analysis',
                id: selectedAnalysisId,
                title: analysisHistory.find(a => a.id === selectedAnalysisId)?.timestamp ? new Date(analysisHistory.find(a => a.id === selectedAnalysisId)!.timestamp).toLocaleDateString() : 'Análisis'
            }] : [],
            replies: []
        };
        await addStaffBriefing(uid, brief);
        setBriefings([brief, ...briefings]);
        setNewBriefing('');
        setSelectedAnalysisId('');
        setShowBriefingForm(false);
    };

    const handleReply = async (briefingId: string) => {
        const content = replyContent[briefingId];
        if (!content?.trim()) return;
        const reply: StaffReply = {
            id: Date.now().toString(),
            authorName: adminProfile.name || 'Staff',
            role: adminProfile.role || 'Coach',
            content: content,
            timestamp: new Date().toISOString()
        };
        await addBriefingReply(uid, briefingId, reply);
        setBriefings(briefings.map(b => b.id === briefingId ? { ...b, replies: [...(b.replies || []), reply] } : b));
        setReplyContent({ ...replyContent, [briefingId]: '' });
    };

    const profile = athleteRef?.profile || userProfile;

    const handleEditProfile = () => {
        setTempTargetProfile(profile);
        setShowProfileConfig(true);
    };

    const handleSaveProfile = () => {
        if (tempTargetProfile) {
            const updatedProfile = {
                ...tempTargetProfile,
                lastEditedBy: `Coach ${adminProfile.name}`,
                lastEditedAt: new Date().toISOString()
            };

            updateProfile(updatedProfile);

            // Log the activity of coach editing profile
            logActivity(uid, {
                id: Date.now().toString(),
                userId: uid,
                type: 'profile',
                title: 'Perfil Editado por Staff',
                description: `El Coach ${adminProfile.name} ha actualizado la ficha técnica del atleta.`,
                timestamp: new Date().toISOString()
            });

            setShowProfileConfig(false);
        }
    };

    if (!profile) return null;

    const trainingDaysCount = useMemo(() => {
        const days = profile.trainingDays || [];
        // Normalizer map to prevent duplicates between different languages/abbreviations
        const normalizer: Record<string, string> = {
            'lun': 'mon', 'lunes': 'mon', 'mon': 'mon', 'monday': 'mon',
            'mar': 'tue', 'martes': 'tue', 'tue': 'tue', 'tuesday': 'tue',
            'mie': 'wed', 'miercoles': 'wed', 'wed': 'wed', 'wednesday': 'wed',
            'jue': 'thu', 'jueves': 'thu', 'thu': 'thu', 'thursday': 'thu',
            'vie': 'fri', 'viernes': 'fri', 'fri': 'fri', 'friday': 'fri',
            'sab': 'sat', 'sabado': 'sat', 'sat': 'sat', 'saturday': 'sat',
            'dom': 'sun', 'domingo': 'sun', 'sun': 'sun', 'sunday': 'sun'
        };
        const uniqueNormalized = new Set(
            days.map(d => normalizer[d.toLowerCase().trim()] || d.toLowerCase().trim())
        );
        return uniqueNormalized.size;
    }, [profile.trainingDays]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Athlete Profile Header Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-6 shadow-2xl relative overflow-hidden">
                {/* Back Button */}
                <button onClick={() => switchAthlete(null)} className="absolute top-6 left-6 p-2 bg-slate-800/50 rounded-full text-slate-400 hover:text-white transition-colors z-20">
                    <ArrowLeft size={20} />
                </button>

                {/* Edit Profile Button (Coach only) */}
                <button onClick={handleEditProfile} className="absolute top-6 right-6 p-2 bg-slate-800/50 rounded-full text-slate-400 hover:text-white transition-colors z-20">
                    <Settings size={20} />
                </button>

                <div className="mt-8 relative z-10">
                    <div className="flex flex-col md:flex-row items-start gap-8 mb-6">
                        {/* Athlete Snapshot Card */}
                        <div className="flex-shrink-0">
                            <AthletePassport
                                profile={profile}
                                history={athleteRef?.aHist || analysisHistory}
                                acwr={athleteRef ? { ratio: athleteRef.acwrRatio, status: athleteRef.risk === 'High' ? 'Alto Riesgo' : athleteRef.risk === 'Low' ? 'Carga Baja' : 'Óptimo' } : acwrStats}
                            />
                        </div>

                        <div className="text-center md:text-left flex-1 pt-4">
                            <div className="flex flex-col md:flex-row md:items-center gap-3 mb-2">
                                <h2 className="text-4xl font-bold text-white uppercase tracking-tighter">{profile.name || 'Invitado'}</h2>
                                <div className="flex gap-2 flex-wrap justify-center md:justify-start">
                                    <span className={`px-3 py-1 bg-slate-800/80 rounded-full text-[9px] font-bold border uppercase ${acwrStats.status === 'Alto Riesgo' ? 'text-red-400 border-red-500/50 bg-red-500/10' :
                                        acwrStats.status === 'Carga Baja' ? 'text-blue-400 border-blue-500/50 bg-blue-500/10' : 'text-cyan-400 border-cyan-500/50 bg-cyan-500/10'
                                        }`}>
                                        ACWR: {acwrStats.ratio.toFixed(2)} {acwrStats.status.toUpperCase()}
                                    </span>
                                </div>
                            </div>
                            <div className="flex flex-wrap justify-center md:justify-start gap-4 text-[10px] font-medium text-slate-400 uppercase">
                                <span className="flex items-center gap-1"><CalendarCheck size={12} className="text-cyan-400" /> {profile.age || 20} AÑOS</span>
                                <span className="flex items-center gap-1"><Maximize2 size={12} className="text-cyan-400" /> {profile.height || '--'} CM</span>
                                <span className="flex items-center gap-1"><Dumbbell size={12} className="text-cyan-400" /> {profile.weight || '--'} KG</span>
                                <span className="flex items-center gap-1 text-emerald-400"><Zap size={12} className="text-emerald-400" /> {trainingDaysCount} DÍAS/SEM</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                        <div className="bg-slate-800/50 border border-slate-700/50 p-4 rounded-2xl">
                            <div className="text-[9px] text-slate-500 font-semibold uppercase mb-1">Próx. Competencia</div>
                            <div className="text-xs font-semibold text-white uppercase truncate">{profile.competitions?.[0] ? profile.competitions[0].name : 'No programada'}</div>
                            <div className="text-[9px] text-yellow-500 font-bold mt-1 uppercase">{profile.competitions?.[0] ? profile.competitions[0].date : '-'}</div>
                        </div>
                        <div className="bg-slate-800/50 border border-slate-700/50 p-4 rounded-2xl">
                            <div className="text-[9px] text-slate-500 font-semibold uppercase mb-1">Lesiones Activas</div>
                            <div className="text-xs font-semibold text-red-400">{profile.injuries?.filter(i => i.status === 'Activa').length || 0} Reportadas</div>
                            <div className="mt-1 flex flex-wrap gap-1">
                                {profile.injuries?.filter(i => i.status === 'Activa').slice(0, 2).map((inj, i) => (
                                    <span key={i} className="text-[8px] text-slate-300 bg-red-500/10 px-1 rounded truncate">{inj.type}</span>
                                ))}
                            </div>
                        </div>
                        <div className="bg-slate-800/50 border border-slate-700/50 p-4 rounded-2xl">
                            <div className="text-[9px] text-slate-500 font-semibold uppercase mb-1">Enfoque Actual</div>
                            <div className="text-xs font-semibold text-white">{currentPlan?.phase || 'Plan General'}</div>
                            <div className="text-[9px] text-emerald-400 font-bold mt-1">Sincronizado</div>
                        </div>
                        <div className="bg-slate-800/50 border border-slate-700/50 p-4 rounded-2xl">
                            <div className="text-[9px] text-slate-500 font-semibold uppercase mb-1">Último Registro</div>
                            <div className="text-xs font-semibold text-white">{athleteRef?.lastActive || 'Inactivo'}</div>
                            <div className="text-[9px] text-slate-500 font-bold mt-1 uppercase">Sincronizado</div>
                        </div>
                    </div>

                    {/* Pruebas/Eventos en que Compite */}
                    {(() => {
                        const athleteEvents = Object.entries(profile.pbs || {})
                            .filter(([_, pb]) => pb && (pb as any).time && parseFloat((pb as any).time) > 0)
                            .map(([event]) => event);

                        return athleteEvents.length > 0 && (
                            <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <Trophy size={16} className="text-yellow-500" />
                                    <h3 className="text-sm font-semibold text-white uppercase tracking-tight">Pruebas en que Compite</h3>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {athleteEvents.map((event, i) => (
                                        <div key={i} className="flex items-center gap-2 bg-slate-900/50 border border-yellow-500/20 px-3 py-2 rounded-xl">
                                            <span className="text-xs font-semibold text-white">{event}</span>
                                            {profile.pbs[event as '100m' | '200m' | '400m']?.time && (
                                                <span className="text-[9px] font-medium text-yellow-500">PB: {profile.pbs[event as '100m' | '200m' | '400m'].time}s</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}
                </div>

                <input
                    type="file"
                    ref={photoInputRef}
                    hidden
                    accept="image/*"
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                                const base64 = reader.result as string;
                                updateProfile({ ...profile, photoURL: base64 });
                            };
                            reader.readAsDataURL(file);
                        }
                    }}
                />
            </div>

            <div className="space-y-6">
                <MacrocycleChart
                    history={planHistory}
                    currentPlan={currentPlan}
                    injuries={profile.injuries}
                    competitions={profile.competitions}
                    therapyLogs={logs}
                />
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-black text-white uppercase tracking-tighter">Bitácora de Staff</h3>
                    <button onClick={() => setShowBriefingForm(!showBriefingForm)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest text-white">
                        <Plus size={14} /> Nueva Nota
                    </button>
                </div>
                {showBriefingForm && (
                    <div className="mb-6 bg-slate-800/50 p-4 rounded-2xl border border-indigo-500/20">
                        <textarea value={newBriefing} onChange={e => setNewBriefing(e.target.value)} placeholder="Notas internas sobre el atleta..." className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white focus:border-indigo-500 outline-none h-24 mb-3" />

                        {/* Attachment Selector */}
                        <div className="mb-3">
                            <label className="text-[10px] text-slate-400 font-bold uppercase mb-1 block">Anexar Análisis Video</label>
                            <select
                                value={selectedAnalysisId}
                                onChange={(e) => setSelectedAnalysisId(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
                            >
                                <option value="">-- Sin anexo --</option>
                                {analysisHistory.slice(0, 5).map(analysis => (
                                    <option key={analysis.id} value={analysis.id}>
                                        {new Date(analysis.timestamp).toLocaleDateString()} - Score: {analysis.overallScore}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex justify-end gap-2 text-[10px] font-black uppercase">
                            <button onClick={() => setShowBriefingForm(false)} className="text-slate-400 px-4 py-2">Cancelar</button>
                            <button onClick={handlePostBriefing} className="bg-indigo-600 text-white px-4 py-2 rounded-xl">Publicar</button>
                        </div>
                    </div>
                )}
                <div className="space-y-4">
                    {briefings.map(b => (
                        <div key={b.id} className="bg-slate-800 border border-slate-700 p-4 rounded-2xl">
                            <div className="flex justify-between items-center text-[8px] font-black uppercase text-slate-500 mb-2">
                                <span>{b.role} • {b.authorName}</span>
                                <span>{new Date(b.timestamp).toLocaleDateString()}</span>
                            </div>
                            <p className="text-xs text-white mb-4">{b.content}</p>

                            {/* Render Attachments */}
                            {b.attachments && b.attachments.length > 0 && (
                                <div className="mb-4 flex gap-2">
                                    {b.attachments.map((att, i) => (
                                        <div key={i} className="bg-slate-900/50 border border-indigo-500/30 rounded p-2 flex items-center gap-2 cursor-pointer hover:bg-slate-900 transition-colors" onClick={() => navigate('/analysis', { state: { analysisId: att.id } })}>
                                            <div className="p-1 bg-indigo-500/20 rounded text-indigo-400"><Zap size={10} /></div>
                                            <div>
                                                <div className="text-[8px] text-indigo-300 font-bold uppercase tracking-wider">Video Análisis</div>
                                                <div className="text-[10px] text-white font-medium">{att.title}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="space-y-2 ml-4 border-l-2 border-slate-700 pl-4">
                                {b.replies?.map(r => (
                                    <div key={r.id}>
                                        <div className="text-[8px] font-black text-indigo-400">{r.authorName} <span className="text-slate-600 ml-1">{new Date(r.timestamp).toLocaleTimeString()}</span></div>
                                        <div className="text-[10px] text-slate-300">{r.content}</div>
                                    </div>
                                ))}
                                <div className="flex gap-2 mt-2">
                                    <input value={replyContent[b.id] || ''} onChange={e => setReplyContent({ ...replyContent, [b.id]: e.target.value })} placeholder="Respuesta rápida..." className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[9px] text-white outline-none focus:border-indigo-500" />
                                    <button onClick={() => handleReply(b.id)} className="bg-slate-700 text-white px-2 rounded text-[8px] font-black">OK</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {showProfileConfig && tempTargetProfile && (
                <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto">
                    <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative mt-20 mb-20">
                        <ProfileConfig
                            userProfile={profile}
                            tempProfile={tempTargetProfile}
                            setTempProfile={setTempTargetProfile}
                            onSave={handleSaveProfile}
                            onClose={() => setShowProfileConfig(false)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};
