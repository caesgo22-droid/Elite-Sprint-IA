import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { UserProfile, TrainingPlan, PerformanceLog, ChatMessage, BiomechanicalAnalysis, NexusInsight, LoadStats } from '../types';
import { auth, saveUserProfile, saveTrainingPlan, addPerformanceLog, updatePerformanceLog, deletePerformanceLog, fetchUserData, saveAnalysisToHistory, getAnalysisHistory, isInitialized, archivePlan, getPlanHistory, deleteAnalysisFromHistory } from '../services/firebase';
import { getDownloadURL, ref, uploadBytes, deleteObject } from 'firebase/storage';
import { useToasts } from './ToastContext';
import * as firebaseAuth from 'firebase/auth';
import { calculateACWR } from '../utils/loadCalculator';
import { Language, TRANSLATIONS } from '../utils/translations';

const { onAuthStateChanged } = firebaseAuth as any;
type User = any;

interface AppContextType {
  user: User | null;
  loadingAuth: boolean;
  language: Language;
  setLanguage: (lang: Language) => void;
  t: any;

  // IDENTITY (The Logged In User - e.g., The Coach)
  adminProfile: UserProfile;

  // DATA CONTEXT (The Profile being viewed - e.g., The Athlete)
  userProfile: UserProfile;

  updateProfile: (profile: UserProfile) => void;
  updateCompetitions: (competitions: { id: string; name: string; date: string }[]) => void;
  currentPlan: TrainingPlan | null;
  setPlan: (plan: TrainingPlan) => void;
  updateSession: (dayName: string, updates: Partial<any>) => void;
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
  acwrStats: LoadStats | null;
  planHistory: TrainingPlan[];
  nexusInsight: NexusInsight | null;
  setNexusInsight: (insight: NexusInsight | null) => void;
  deleteAnalysis: (id: string) => void;
  resetPlan: () => Promise<void>;

  viewingAthleteId: string | null;
  switchAthlete: (uid: string | null) => void;
  refreshUserData: () => void;
  updateRoster: (newRoster: string[]) => void;
  loginAsGuest: () => void;
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

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { showToast } = useToasts();
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [language, setLanguage] = useState<Language>('es');

  // STAFF STATE
  const [viewingAthleteId, setViewingAthleteId] = useState<string | null>(null);

  // App State
  // adminProfile = The Authenticated User (Identity)
  const [adminProfile, setAdminProfile] = useState<UserProfile>(defaultProfile);
  // userProfile = The Effective Profile (Data Context) - Can be Admin or Athlete
  const [userProfile, setUserProfile] = useState<UserProfile>(defaultProfile);

  const [currentPlan, setCurrentPlan] = useState<TrainingPlan | null>(null);
  const [planHistory, setPlanHistory] = useState<TrainingPlan[]>([]);
  const [logs, setLogs] = useState<PerformanceLog[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [lastAnalysis, setLastAnalysis] = useState<BiomechanicalAnalysis | null>(null);
  const [analysisHistory, setAnalysisHistory] = useState<BiomechanicalAnalysis[]>([]);
  const [acwrStats, setAcwrStats] = useState<LoadStats | null>(null);
  const [nexusInsight, setNexusInsight] = useState<NexusInsight | null>(null);

  const t = TRANSLATIONS[language];

  // Helper to process raw firebase data into clean state
  const processProfileData = (data: any) => {
    const p = data.profile || {};
    if (p.event && !p.events) p.events = [p.event];
    if (!p.coaches) p.coaches = [];
    if (!p.role) p.role = 'athlete';
    return { ...defaultProfile, ...p };
  };

  const loadDataForId = async (uid: string, isIdentityLoad: boolean = false) => {
    try {
      const data = await fetchUserData(uid);
      const profile = processProfileData(data);

      if (isIdentityLoad) {
        setAdminProfile(profile);
        // If we are not viewing anyone else, Admin is also the UserProfile
        if (!viewingAthleteId) {
          setUserProfile(profile);
        }
      } else {
        // We are loading a specific target (Athlete view)
        setUserProfile(profile);
      }

      // Only load deep data (plans, logs) if it's the Active Context
      if ((isIdentityLoad && !viewingAthleteId) || (!isIdentityLoad && viewingAthleteId === uid)) {
        setCurrentPlan(data.currentPlan);
        setLogs(data.logs || []);
        const analysisHist = await getAnalysisHistory(uid);
        setAnalysisHistory(analysisHist as BiomechanicalAnalysis[]);
        const pHist = await getPlanHistory(uid);
        setPlanHistory(pHist as TrainingPlan[]);
        setNexusInsight(null);
      }

    } catch (error) {
      console.error("Error fetching user data:", error);
    }
  };

  useEffect(() => {
    if (!isInitialized || !auth) {
      console.warn("Firebase not initialized.");
      setLoadingAuth(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser: User) => {
      setUser(currentUser);
      if (currentUser) {
        // 1. Always load the Identity (Admin/Self)
        await loadDataForId(currentUser.uid, true);

        // 2. If we were viewing someone, reload that data too
        if (viewingAthleteId) {
          await loadDataForId(viewingAthleteId, false);
        }
      } else {
        setAdminProfile(defaultProfile);
        setUserProfile(defaultProfile);
        setCurrentPlan(null);
        setLogs([]);
      }
      setLoadingAuth(false);
    });

    return () => unsubscribe();
  }, [viewingAthleteId]);

  useEffect(() => {
    if (currentPlan || planHistory.length > 0) {
      const allPlans = currentPlan ? [currentPlan, ...planHistory] : planHistory;
      const stats = calculateACWR(allPlans);
      setAcwrStats(stats);
    }
  }, [currentPlan, planHistory]);

  const switchAthlete = async (uid: string | null) => {
    try {
      setViewingAthleteId(uid);
      setLoadingAuth(true);

      if (!uid && user) {
        // Return to admin view
        await loadDataForId(user.uid, true);
      } else if (uid) {
        // Switch to athlete view - validate first
        const athleteData = await fetchUserData(uid);
        if (!athleteData) {
          console.error('❌ Athlete not found:', uid);
          setViewingAthleteId(null); // Reset on error
          showToast('No se pudo cargar el perfil del atleta', 'error');
          return;
        }
        // Load athlete data via effect
        await loadDataForId(uid, false);
      }
    } catch (error) {
      console.error('❌ Error switching athlete:', error);
      setViewingAthleteId(null);
      showToast('Error al cambiar de atleta', 'error');
    } finally {
      setLoadingAuth(false);
    }
  };

  const refreshUserData = () => {
    if (user) {
      loadDataForId(user.uid, true); // Refresh Identity
      if (viewingAthleteId) loadDataForId(viewingAthleteId, false); // Refresh View
    }
  };

  const loginAsGuest = () => {
    setUser({
      uid: 'guest-123',
      email: 'guest@elitesprint.ai',
      displayName: 'Atleta Invitado',
      isGuest: true
    });
    setAdminProfile({
      ...defaultProfile,
      name: 'Invitado',
      email: 'guest@elitesprint.ai'
    });
    setUserProfile({
      ...defaultProfile,
      name: 'Invitado',
      email: 'guest@elitesprint.ai'
    });
  };

  const targetId = viewingAthleteId || user?.uid;

  const updateProfile = (profile: UserProfile) => {
    setUserProfile(profile);
    // If updating self, also update adminProfile to keep sync
    if (!viewingAthleteId) setAdminProfile(profile);
    if (targetId && isInitialized) saveUserProfile(targetId, profile);
  };

  // SPECIAL: Update Roster (Only happens on Admin Profile)
  const updateRoster = (newRoster: string[]) => {
    const newAdmin = { ...adminProfile, roster: newRoster };
    setAdminProfile(newAdmin);
    if (user?.uid && isInitialized) saveUserProfile(user.uid, newAdmin);
  };

  const updateCompetitions = (competitions: { id: string; name: string; date: string }[]) => {
    const newProfile = { ...userProfile, competitions };
    setUserProfile(newProfile);
    if (targetId && isInitialized) saveUserProfile(targetId, newProfile);
  };

  // ... (Plan, Logs, etc functions remain same, they use targetId which is correct) ... 
  const setPlan = (plan: TrainingPlan) => {
    if (currentPlan && targetId && isInitialized) {
      archivePlan(targetId, currentPlan);
      setPlanHistory(prev => [currentPlan, ...prev]);
    }
    setCurrentPlan(plan);
    if (targetId && isInitialized) saveTrainingPlan(targetId, plan);
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

  const addLog = (log: PerformanceLog) => {
    setLogs(prev => [...prev, log]);
    if (targetId && isInitialized) addPerformanceLog(targetId, log);
  };

  const editLog = (updatedLog: PerformanceLog) => {
    setLogs(prev => prev.map(log => log.id === updatedLog.id ? updatedLog : log));
    if (targetId && isInitialized) updatePerformanceLog(targetId, updatedLog);
  };

  const deleteLog = (id: string) => {
    setLogs(prev => prev.filter(l => l.id !== id));
    if (targetId && isInitialized) deletePerformanceLog(targetId, id);
  };

  const addChatMessage = (msg: ChatMessage) => setChatHistory(prev => [...prev, msg]);

  const saveAnalysis = (analysis: BiomechanicalAnalysis) => {
    setLastAnalysis(analysis);
    setAnalysisHistory(prev => [analysis, ...prev]);
    if (targetId && isInitialized) saveAnalysisToHistory(targetId, analysis);
  };

  const updateAnalysis = (id: string, updates: Partial<BiomechanicalAnalysis>) => {
    setAnalysisHistory(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
    // Persist to Firebase
    if (targetId && isInitialized) {
      const existing = analysisHistory.find(a => a.id === id);
      if (existing) {
        saveAnalysisToHistory(targetId, { ...existing, ...updates });
      }
    }
  };

  const deleteAnalysis = (id: string) => {
    setAnalysisHistory(prev => prev.filter(a => a.id !== id));
    if (targetId && isInitialized) deleteAnalysisFromHistory(targetId, id);
  };

  const contextValue = useMemo(() => ({
    user,
    loadingAuth,
    language,
    setLanguage,
    t,
    adminProfile, // EXPORT IDENTITY
    userProfile,  // EXPORT DATA CONTEXT
    updateProfile,
    updateCompetitions,
    currentPlan,
    setPlan,
    updateSession,
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
    acwrStats,
    planHistory,
    nexusInsight,
    setNexusInsight,
    viewingAthleteId,
    switchAthlete,
    refreshUserData,
    updateRoster,
    loginAsGuest,
    deleteAnalysis,
    resetPlan
  }), [
    user,
    loadingAuth,
    language,
    adminProfile,
    userProfile,
    currentPlan,
    logs,
    chatHistory,
    lastAnalysis,
    analysisHistory,
    acwrStats,
    planHistory,
    nexusInsight,
    viewingAthleteId
  ]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
};