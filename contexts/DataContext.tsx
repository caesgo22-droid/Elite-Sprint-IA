import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { UserProfile, TrainingPlan, PerformanceLog, ChatMessage, BiomechanicalAnalysis, NexusInsight, ACWROutput } from '../types';
import {
    saveUserProfile, saveTrainingPlan, addPerformanceLog, updatePerformanceLog, deletePerformanceLog,
    fetchUserData, saveAnalysisToHistory, getAnalysisHistory, archivePlan, getPlanHistory,
    deleteAnalysisFromHistory, logActivity, isInitialized
} from '../services/firebase';
import { useToasts } from './ToastContext';
import { useAuth } from './AuthContext';
import { calculateACWR } from '../utils/loadCalculator';

const defaultACWR: ACWROutput = {
    acuteLoad: 0,
    chronicLoad: 0,
    ratio: 0,
    status: 'Óptimo',
    history: [],
    limits: { minMsg: '0.8', maxMsg: '1.5' }
};

interface DataContextType {
    userProfile: UserProfile;
    updateProfile: (profile: UserProfile) => void;
    updateCompetitions: (competitions: { id: string; name: string; date: string }[]) => void;

    currentPlan: TrainingPlan | null;
    setPlan: (plan: TrainingPlan) => void;
    updateTrainingPlan: (planId: string, updatedPlan: TrainingPlan) => void;
    updateSession: (dayName: string, updates: Partial<any>) => void;
    resetPlan: () => Promise<void>;
    planHistory: TrainingPlan[];

    logs: PerformanceLog[];
    addLog: (log: PerformanceLog) => void;
    editLog: (log: PerformanceLog) => void;
    deleteLog: (id: string) => void;

    chatHistory: ChatMessage[];
    addChatMessage: (msg: ChatMessage) => void;

    lastAnalysis: BiomechanicalAnalysis | null;
    setLastAnalysis: (analysis: BiomechanicalAnalysis) => void;
    analysisHistory: BiomechanicalAnalysis[];
    saveAnalysis: (analysis: BiomechanicalAnalysis) => void;
    updateAnalysis: (id: string, updates: Partial<BiomechanicalAnalysis>) => void;
    deleteAnalysis: (id: string) => void;
    deletedAnalyses: string[];

    acwrStats: ACWROutput | null;
    nexusInsight: NexusInsight | null;
    setNexusInsight: (insight: NexusInsight | null) => void;

    viewingAthleteId: string | null;
    switchAthlete: (uid: string | null) => void;
    refreshUserData: () => void;
    logActivity: (userId: string, event: any) => Promise<void>;
    rosterData: import('../types').RosterItem[];
    loadingRoster: boolean;
}

const defaultProfile: UserProfile = {
    name: 'Usuario',
    email: '',
    role: 'athlete',
    age: 20,
    height: 180,
    weight: 75,
    events: ['100m'],
    pbs: {
        '100m': { time: '', date: '' },
        '200m': { time: '', date: '' },
        '400m': { time: '', date: '' }
    },
    experienceLevel: 'Intermediate',
    yearsExperience: 2,
    injuries: [],
    coaches: [],
    trainingDays: ['Mon', 'Tue', 'Thu', 'Fri'],
    hoursPerDay: 2,
    preferredTime: 'Afternoon',
    competitions: []
};

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user, adminProfile, updateAdminProfile, loadingAuth } = useAuth();
    const { showToast } = useToasts();

    const [viewingAthleteId, setViewingAthleteId] = useState<string | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile>(defaultProfile);

    const [currentPlan, setCurrentPlan] = useState<TrainingPlan | null>(null);
    const [planHistory, setPlanHistory] = useState<TrainingPlan[]>([]);

    const [logs, setLogs] = useState<PerformanceLog[]>([]);
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);

    const [lastAnalysis, setLastAnalysis] = useState<BiomechanicalAnalysis | null>(null);
    const [analysisHistory, setAnalysisHistory] = useState<BiomechanicalAnalysis[]>([]);

    const [acwrStats, setAcwrStats] = useState<ACWROutput>(defaultACWR);
    const [nexusInsight, setNexusInsight] = useState<NexusInsight | null>(null);

    const [deletedAnalyses, setDeletedAnalyses] = useState<string[]>(() => {
        const saved = localStorage.getItem('deleted_biomech_analyses');
        return saved ? JSON.parse(saved) : [];
    });

    const [isDataLoaded, setIsDataLoaded] = useState(false); // Guard against overwriting data with defaults

    // Sync userProfile with adminProfile if viewing self
    useEffect(() => {
        if (!viewingAthleteId) {
            setUserProfile(adminProfile);
        }
    }, [adminProfile, viewingAthleteId]);

    const processProfileData = (data: any) => {
        const p = data.profile || {};
        if (p.event && !p.events) p.events = [p.event];
        if (!p.coaches) p.coaches = [];
        if (!p.role) p.role = 'athlete';
        return { ...defaultProfile, ...p };
    };

    const loadData = async (uid: string) => {
        try {
            const data = await fetchUserData(uid);

            if (data.status === 'error') {
                console.error("Critical: Failed to load user data. Writes disabled to prevent data loss.");
                showToast("Error de conexión. Modo solo lectura activado.", "error");
                setIsDataLoaded(false);
                return;
            }

            const profile = processProfileData(data);

            setUserProfile(profile);
            setCurrentPlan(data.currentPlan);
            setLogs(data.logs || []);

            const analysisHist = await getAnalysisHistory(uid);
            const filteredHist = (analysisHist as BiomechanicalAnalysis[]).filter(a => !deletedAnalyses.includes(a.id));
            setAnalysisHistory(filteredHist);

            const pHist = await getPlanHistory(uid);
            setPlanHistory(pHist as TrainingPlan[]);

            setNexusInsight(null);
            setIsDataLoaded(true);
        } catch (error) {
            console.error("Error fetching data:", error);
            setIsDataLoaded(false);
        }
    };

    // Load data when viewingAthleteId changes or user logs in (and we are viewing self)
    useEffect(() => {
        if (loadingAuth) return;

        if (viewingAthleteId) {
            loadData(viewingAthleteId);
        } else if (user) {
            // Load 'deep' data for self. Identity profile is loaded by AuthContext, but Plans/Logs are here.
            loadData(user.uid);
        } else {
            // Clear data on logout
            setCurrentPlan(null);
            setLogs([]);
            setAnalysisHistory([]);
            setPlanHistory([]);
            setIsDataLoaded(false);
        }
    }, [viewingAthleteId, user, loadingAuth]);

    // ACWR Calculation
    useEffect(() => {
        const allPlans = currentPlan ? [currentPlan, ...planHistory] : planHistory;
        const stats = calculateACWR(allPlans, logs);
        setAcwrStats(stats);
    }, [currentPlan, planHistory, logs]);

    const switchAthlete = async (uid: string | null) => {
        setViewingAthleteId(uid);
        // Data loading is handled by useEffect
    };

    const targetId = viewingAthleteId || user?.uid;

    const updateProfile = (profile: UserProfile) => {
        setUserProfile(profile);
        if (!viewingAthleteId) {
            updateAdminProfile(profile);
        }
        // Guard: Only save if data was successfully loaded to avoid overwriting with defaults
        if (targetId && isInitialized && isDataLoaded) saveUserProfile(targetId, profile);
        else if (targetId && !isDataLoaded) console.warn("Save blocked: Data not loaded.");
    };

    const updateRosterEntry = (uid: string, newLogs: PerformanceLog[], newPlan: TrainingPlan | null, newPlanHistory: TrainingPlan[]) => {
        setRosterData(prev => prev.map(item => {
            if (item.uid === uid) {
                const allPlans = newPlan ? [newPlan, ...newPlanHistory] : newPlanHistory;
                const acwr = calculateACWR(allPlans, newLogs);
                const lastLog = newLogs.length > 0 ? newLogs[newLogs.length - 1] : null;
                return {
                    ...item,
                    acwrRatio: acwr.ratio,
                    risk: acwr.status === 'Alto Riesgo' ? 'High' : acwr.status === 'Carga Baja' ? 'Low' : 'Optimal',
                    lastActive: lastLog ? lastLog.date : 'Inactivo'
                };
            }
            return item;
        }));
    };

    const updateCompetitions = (competitions: { id: string; name: string; date: string }[]) => {
        const newProfile = { ...userProfile, competitions };
        updateProfile(newProfile);
    };

    const setPlanFn = (plan: TrainingPlan) => {
        if (currentPlan && targetId && isInitialized && isDataLoaded) {
            archivePlan(targetId, currentPlan);
            setPlanHistory(prev => [currentPlan, ...prev]);
        }
        setCurrentPlan(plan);
        if (targetId && isInitialized && isDataLoaded) saveTrainingPlan(targetId, plan);
        if (targetId) updateRosterEntry(targetId, logs, plan, currentPlan ? [currentPlan, ...planHistory] : planHistory);
    };

    const updateTrainingPlan = (planId: string, updatedPlan: TrainingPlan) => {
        setCurrentPlan(updatedPlan);
        if (targetId && isInitialized && isDataLoaded) saveTrainingPlan(targetId, updatedPlan);
        if (targetId) updateRosterEntry(targetId, logs, updatedPlan, planHistory);
    };

    const resetPlan = async () => {
        if (!currentPlan) return;
        if (targetId && isInitialized && isDataLoaded) {
            await archivePlan(targetId, currentPlan);
            setPlanHistory(prev => [currentPlan, ...prev]);
            await saveTrainingPlan(targetId, null);
        }
        setCurrentPlan(null);
        if (targetId) updateRosterEntry(targetId, logs, null, [currentPlan, ...planHistory]);
    };

    const updateSession = (dayName: string, updates: Partial<any>) => {
        if (!currentPlan) return;
        const normalize = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

        const updatedSessions = currentPlan.sessions.map(s => {
            if (normalize(s.day).includes(normalize(dayName)) || normalize(dayName).includes(normalize(s.day))) {
                return { ...s, ...updates };
            }
            return s;
        });

        const newPlan = { ...currentPlan, sessions: updatedSessions };
        setCurrentPlan(newPlan);
        if (targetId && isInitialized && isDataLoaded) saveTrainingPlan(targetId, newPlan);
        if (targetId) updateRosterEntry(targetId, logs, newPlan, planHistory);
    };

    const addLog = (log: PerformanceLog) => {
        const newLogs = [...logs, log];
        setLogs(newLogs);
        if (targetId && isInitialized && isDataLoaded) addPerformanceLog(targetId, log);
        if (targetId) updateRosterEntry(targetId, newLogs, currentPlan, planHistory);
    };

    const editLog = (updatedLog: PerformanceLog) => {
        const newLogs = logs.map(log => log.id === updatedLog.id ? updatedLog : log);
        setLogs(newLogs);
        if (targetId && isInitialized && isDataLoaded) updatePerformanceLog(targetId, updatedLog);
        if (targetId) updateRosterEntry(targetId, newLogs, currentPlan, planHistory);
    };

    const deleteLog = (id: string) => {
        const newLogs = logs.filter(l => l.id !== id);
        setLogs(newLogs);
        if (targetId && isInitialized) deletePerformanceLog(targetId, id);
        if (targetId) updateRosterEntry(targetId, newLogs, currentPlan, planHistory);
    };

    const addChatMessage = (msg: ChatMessage) => setChatHistory(prev => [...prev, msg]);

    const saveAnalysis = (analysis: BiomechanicalAnalysis) => {
        setLastAnalysis(analysis);
        setAnalysisHistory(prev => [analysis, ...prev]);
        if (targetId && isInitialized) saveAnalysisToHistory(targetId, analysis);
    };

    const updateAnalysis = (id: string, updates: Partial<BiomechanicalAnalysis>) => {
        setAnalysisHistory(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
        if (targetId && isInitialized) {
            const existing = analysisHistory.find(a => a.id === id);
            if (existing) {
                saveAnalysisToHistory(targetId, { ...existing, ...updates });
            }
        }
    };

    const deleteAnalysis = (id: string) => {
        setAnalysisHistory(prev => prev.filter(a => a.id !== id));
        setDeletedAnalyses(prev => {
            const next = [...prev, id];
            localStorage.setItem('deleted_biomech_analyses', JSON.stringify(next));
            return next;
        });
        if (targetId && isInitialized) deleteAnalysisFromHistory(targetId, id);
    };

    const handleLogActivity = async (userId: string, event: any) => {
        if (isInitialized) await logActivity(userId, event);
    };

    const refreshUserData = () => {
        if (viewingAthleteId) loadData(viewingAthleteId);
        else if (user) loadData(user.uid);
    }

    const [rosterData, setRosterData] = useState<any[]>([]);
    const [loadingRoster, setLoadingRoster] = useState(false);

    // Load Roster Data (Coach View)
    useEffect(() => {
        const loadRoster = async () => {
            if (!adminProfile?.roster || adminProfile.roster.length === 0) {
                setRosterData([]);
                return;
            }
            // Only load if we are staff/admin or if specifically requested (optimization: check role)
            // But checking adminProfile.roster presence is enough signal.

            setLoadingRoster(true);
            const profiles: any[] = [];
            for (const uid of adminProfile.roster) {
                try {
                    // Optimization: Could use Promise.all but might hit rate limits. Sequential is safer for now.
                    const data = await fetchUserData(uid);
                    const pHist = await getPlanHistory(uid);
                    const aHist = await getAnalysisHistory(uid);

                    let risk: 'High' | 'Low' | 'Optimal' = 'Optimal';
                    let acwrRatio = 0;
                    if (data.currentPlan) {
                        const acwr = calculateACWR([data.currentPlan as any, ...pHist as any], (data.logs || []) as any[]);
                        acwrRatio = acwr.ratio;
                        if (acwr.status === 'Alto Riesgo') risk = 'High';
                        else if (acwr.status === 'Carga Baja') risk = 'Low';
                    }

                    const fourteenDaysAgo = Date.now() - (14 * 24 * 60 * 60 * 1000);
                    const pendingReviews = (aHist as any[]).filter((a: any) => {
                        if (deletedAnalyses.includes(a.id)) return false;
                        const savedAt = a.savedAt ? new Date(a.savedAt).getTime() : 0;
                        return a.reviewStatus === 'Pending' && savedAt > fourteenDaysAgo;
                    }).length;

                    const lastLog = data.logs && data.logs.length > 0 ? data.logs[data.logs.length - 1] : null;
                    const lastActive = lastLog ? lastLog.date : 'Inactivo';

                    if (data.profile) {
                        profiles.push({ uid, profile: data.profile, risk, acwrRatio, pendingReviews, lastActive });
                    } else {
                        console.warn(`⚠️ Athlete ${uid} exists in roster but has no profile data. Skipping display.`);
                        console.warn(`Data received:`, data);
                    }
                } catch (e) {
                    console.error("Error loading roster item:", uid, e);
                }
            }
            setRosterData(profiles);
            setLoadingRoster(false);
        };

        if (adminProfile?.roster) {
            loadRoster();
        }
    }, [adminProfile?.roster, deletedAnalyses]); // Reload if roster changes or if we delete an analysis locally

    const value = useMemo(() => ({
        userProfile,
        updateProfile,
        updateCompetitions,
        currentPlan,
        setPlan: setPlanFn,
        updateTrainingPlan,
        updateSession,
        resetPlan,
        planHistory,
        logs,
        addLog,
        editLog,
        deleteLog,
        chatHistory,
        addChatMessage,
        lastAnalysis,
        setLastAnalysis,
        analysisHistory,
        saveAnalysis,
        updateAnalysis,
        deleteAnalysis,
        deletedAnalyses,
        acwrStats,
        nexusInsight,
        setNexusInsight,
        viewingAthleteId,
        switchAthlete,
        refreshUserData,
        logActivity: handleLogActivity,
        rosterData,
        loadingRoster
    }), [
        userProfile, currentPlan, planHistory, logs, chatHistory, lastAnalysis, analysisHistory,
        acwrStats, nexusInsight, viewingAthleteId, deletedAnalyses, rosterData, loadingRoster
    ]);

    return (
        <DataContext.Provider value={value}>
            {children}
        </DataContext.Provider>
    );
};

export const useData = () => {
    const context = useContext(DataContext);
    if (!context) throw new Error("useData must be used within DataProvider");
    return context;
};
