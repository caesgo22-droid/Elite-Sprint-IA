import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { TrainingPlan, PerformanceLog, BiomechanicalAnalysis, ACWROutput, NexusInsight } from '../types';
import { useAuth } from './AuthContext';
import { useUser } from './UserContext'; // Depends on UserContext for viewingAthleteId
import {
    saveTrainingPlan, archivePlan, getPlanHistory, addPerformanceLog,
    updatePerformanceLog, deletePerformanceLog, getAnalysisHistory,
    saveAnalysisToHistory, deleteAnalysisFromHistory, isInitialized
} from '../services/firebase';
import { calculateACWR } from '../utils/loadCalculator';
import { useToasts } from './ToastContext';
import { doc, collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { TrainingPlanSchema, PerformanceLogSchema } from '../utils/validators';

const defaultACWR: ACWROutput = {
    acuteLoad: 0, chronicLoad: 0, ratio: 0, status: 'Óptimo', history: [], limits: { minMsg: '0.8', maxMsg: '1.5' }
};

interface TrainingContextType {
    currentPlan: TrainingPlan | null;
    setPlan: (plan: TrainingPlan) => void;
    updateTrainingPlan: (planId: string, updatedPlan: TrainingPlan) => void;
    updateSession: (dayName: string, updates: Partial<any>) => void;
    resetPlan: () => Promise<void>;
    planHistory: TrainingPlan[];

    logs: PerformanceLog[];
    addLog: (log: PerformanceLog) => Promise<void>;
    editLog: (log: PerformanceLog) => void;
    deleteLog: (id: string) => void;

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
}

const TrainingContext = createContext<TrainingContextType | undefined>(undefined);

export const TrainingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user, loadingAuth } = useAuth();
    const { viewingAthleteId } = useUser();
    const { showToast } = useToasts();

    const [currentPlan, setCurrentPlan] = useState<TrainingPlan | null>(null);
    const [planHistory, setPlanHistory] = useState<TrainingPlan[]>([]);
    const [logs, setLogs] = useState<PerformanceLog[]>([]);
    const [lastAnalysis, setLastAnalysis] = useState<BiomechanicalAnalysis | null>(null);
    const [analysisHistory, setAnalysisHistory] = useState<BiomechanicalAnalysis[]>([]);
    const [acwrStats, setAcwrStats] = useState<ACWROutput>(defaultACWR);
    const [nexusInsight, setNexusInsight] = useState<NexusInsight | null>(null);

    const [deletedAnalyses, setDeletedAnalyses] = useState<string[]>(() => {
        const saved = localStorage.getItem('deleted_biomech_analyses');
        return saved ? JSON.parse(saved) : [];
    });

    const targetId = viewingAthleteId || user?.uid;

    // --- Real-time Sync for Plan & Logs ---
    useEffect(() => {
        if (loadingAuth || !targetId) {
            // Reset state if no user
            if (!loadingAuth) {
                setCurrentPlan(null);
                setLogs([]);
                setPlanHistory([]);
                setAnalysisHistory([]);
            }
            return;
        }

        if (!db || !isInitialized) return;

        // 1. Subscribe to Plan (in User Doc)
        const planUnsub = onSnapshot(doc(db, "users", targetId), (docSnap) => {
            const userData = docSnap.exists() ? docSnap.data() : {};
            if (userData.currentPlan) {
                const result = TrainingPlanSchema.safeParse(userData.currentPlan);
                if (result.success) setCurrentPlan(result.data);
            } else {
                setCurrentPlan(null);
            }
        });

        // 2. Subscribe to Logs
        const logsUnsub = onSnapshot(query(collection(db, "users", targetId, "logs")), (snapshot) => {
            const newLogs = snapshot.docs.map(d => {
                const data = d.data();
                const result = PerformanceLogSchema.safeParse(data);
                return result.success ? result.data : { ...data, id: d.id };
            });
            // Firestore returns any order, usually. Should we soft-sort? Logs usually needs date sort.
            // But let's assume consumption handles sorting or we strict sort here.
            // Just raw default for now.
            setLogs(newLogs as PerformanceLog[]);
        });

        // 3. Fetch History (One-off)
        const loadHistory = async () => {
            try {
                const pHist = await getPlanHistory(targetId);
                setPlanHistory(pHist as TrainingPlan[]);
                const aHist = await getAnalysisHistory(targetId);
                setAnalysisHistory((aHist as BiomechanicalAnalysis[]).filter(a => !deletedAnalyses.includes(a.id)));
            } catch (e) { console.error(e); }
        };
        loadHistory();

        return () => {
            planUnsub();
            logsUnsub();
        };

    }, [targetId, loadingAuth, deletedAnalyses]);


    // ACWR Calc
    useEffect(() => {
        const allPlans = currentPlan ? [currentPlan, ...planHistory] : planHistory;
        const stats = calculateACWR(allPlans, logs);
        setAcwrStats(stats);
    }, [currentPlan, planHistory, logs]);


    // --- Actions ---

    // Plan Actions
    const setPlanFn = (plan: TrainingPlan) => {
        // Optimistic
        if (currentPlan && targetId && isInitialized) {
            archivePlan(targetId, currentPlan); // Fire and forget
            setPlanHistory(prev => [currentPlan, ...prev]);
        }
        setCurrentPlan(plan);
        if (targetId && isInitialized) saveTrainingPlan(targetId, plan);
    };

    const updateTrainingPlan = (planId: string, updatedPlan: TrainingPlan) => {
        setCurrentPlan(updatedPlan);
        if (targetId && isInitialized) saveTrainingPlan(targetId, updatedPlan);
    };

    const resetPlan = async () => {
        if (!currentPlan) return;
        if (targetId && isInitialized) {
            await archivePlan(targetId, currentPlan);
            setPlanHistory(prev => [currentPlan, ...prev]);
            await saveTrainingPlan(targetId, null);
        }
        setCurrentPlan(null);
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
        if (targetId && isInitialized) saveTrainingPlan(targetId, newPlan);
    };

    // Log Actions (Optimistic UI) - Copied from Phase 1 Logic
    const addLog = async (log: PerformanceLog) => {
        const newLogs = [...logs, log];
        setLogs(newLogs); // Instant

        if (targetId && isInitialized) {
            try {
                await addPerformanceLog(targetId, log);
            } catch (error) {
                console.error("Optimistic Rollback", error);
                setLogs(prev => prev.filter(l => l.id !== log.id));
                showToast("Error al guardar log", "error");
            }
        }
    };

    const editLog = (updatedLog: PerformanceLog) => {
        // Optimistic
        setLogs(prev => prev.map(l => l.id === updatedLog.id ? updatedLog : l));
        if (targetId && isInitialized) updatePerformanceLog(targetId, updatedLog);
    };

    const deleteLog = (id: string) => {
        setLogs(prev => prev.filter(l => l.id !== id));
        if (targetId && isInitialized) deletePerformanceLog(targetId, id);
    };

    // Analysis Actions
    const saveAnalysis = (analysis: BiomechanicalAnalysis) => {
        setLastAnalysis(analysis);
        setAnalysisHistory(prev => [analysis, ...prev]);
        if (targetId && isInitialized) saveAnalysisToHistory(targetId, analysis);
    };

    const updateAnalysis = (id: string, updates: Partial<BiomechanicalAnalysis>) => {
        setAnalysisHistory(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
        if (targetId && isInitialized) {
            const existing = analysisHistory.find(a => a.id === id);
            if (existing) saveAnalysisToHistory(targetId, { ...existing, ...updates });
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

    const value = useMemo(() => ({
        currentPlan, setPlan: setPlanFn, updateTrainingPlan, updateSession, resetPlan, planHistory,
        logs, addLog, editLog, deleteLog,
        lastAnalysis, setLastAnalysis, analysisHistory, saveAnalysis, updateAnalysis, deleteAnalysis,
        deletedAnalyses, acwrStats, nexusInsight, setNexusInsight
    }), [currentPlan, planHistory, logs, lastAnalysis, analysisHistory, deletedAnalyses, acwrStats, nexusInsight]);

    return (
        <TrainingContext.Provider value={value}>
            {children}
        </TrainingContext.Provider>
    );
};

export const useTraining = () => {
    const context = useContext(TrainingContext);
    if (!context) throw new Error("useTraining must be used within TrainingProvider");
    return context;
};
