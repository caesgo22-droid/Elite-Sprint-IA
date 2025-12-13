
import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { UserProfile, TrainingPlan, PerformanceLog, ChatMessage, BiomechanicalAnalysis, NexusInsight } from '../types';
import { auth, saveUserProfile, saveTrainingPlan, addPerformanceLog, updatePerformanceLog, deletePerformanceLog, fetchUserData, saveAnalysisToHistory, getAnalysisHistory, isInitialized, archivePlan, getPlanHistory } from '../services/firebase';
import * as firebaseAuth from 'firebase/auth';
import { calculateACWR, LoadStats } from '../utils/loadCalculator';

const { onAuthStateChanged } = firebaseAuth as any;
type User = any;

interface AppContextType {
  user: User | null;
  loadingAuth: boolean;
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
  updateAnalysis: (id: string, updates: Partial<BiomechanicalAnalysis>) => void; // NEW FUNCTION
  acwrStats: LoadStats | null;
  planHistory: TrainingPlan[];
  nexusInsight: NexusInsight | null;
  setNexusInsight: (insight: NexusInsight | null) => void;
  
  // STAFF FEATURES
  viewingAthleteId: string | null;
  switchAthlete: (uid: string | null) => void;
  refreshUserData: () => void;
}

const defaultProfile: UserProfile = {
  name: 'Atleta',
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
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // STAFF STATE
  const [viewingAthleteId, setViewingAthleteId] = useState<string | null>(null);

  // App State
  const [userProfile, setUserProfile] = useState<UserProfile>(defaultProfile);
  const [currentPlan, setCurrentPlan] = useState<TrainingPlan | null>(null);
  const [planHistory, setPlanHistory] = useState<TrainingPlan[]>([]);
  const [logs, setLogs] = useState<PerformanceLog[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [lastAnalysis, setLastAnalysis] = useState<BiomechanicalAnalysis | null>(null);
  const [analysisHistory, setAnalysisHistory] = useState<BiomechanicalAnalysis[]>([]);
  const [acwrStats, setAcwrStats] = useState<LoadStats | null>(null);
  const [nexusInsight, setNexusInsight] = useState<NexusInsight | null>(null);

  const loadDataForId = async (uid: string) => {
      try {
          const data = await fetchUserData(uid);
          if (data.profile) {
             const loadedProfile = data.profile as any;
             // Migration helpers
             if (loadedProfile.event && !loadedProfile.events) loadedProfile.events = [loadedProfile.event];
             if (!loadedProfile.coaches) loadedProfile.coaches = [];
             if (!loadedProfile.role) loadedProfile.role = 'athlete'; // Default
             
             setUserProfile({ ...defaultProfile, ...loadedProfile });
          }
          setCurrentPlan(data.currentPlan);
          setLogs(data.logs || []);

          const analysisHist = await getAnalysisHistory(uid);
          setAnalysisHistory(analysisHist as BiomechanicalAnalysis[]);
          
          const pHist = await getPlanHistory(uid);
          setPlanHistory(pHist as TrainingPlan[]);
          
          // Clear insight when switching users
          setNexusInsight(null);

      } catch (error) {
          console.error("Error fetching user data:", error);
      }
  };

  // Auth Listener & Data Fetching
  useEffect(() => {
    if (!isInitialized || !auth) {
      console.warn("Firebase not initialized or keys missing. App running in offline mode.");
      setLoadingAuth(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser: User) => {
      setUser(currentUser);
      if (currentUser) {
          // If viewingAthleteId is set (Staff Mode), load that. Otherwise load own.
          await loadDataForId(viewingAthleteId || currentUser.uid);
      } else {
        setUserProfile(defaultProfile);
        setCurrentPlan(null);
        setLogs([]);
      }
      setLoadingAuth(false);
    });

    return () => unsubscribe();
  }, [viewingAthleteId]); // Re-run when viewingAthleteId changes

  // Update ACWR whenever plans change
  useEffect(() => {
      if (currentPlan || planHistory.length > 0) {
          const allPlans = currentPlan ? [currentPlan, ...planHistory] : planHistory;
          const stats = calculateACWR(allPlans);
          setAcwrStats(stats);
      }
  }, [currentPlan, planHistory]);

  const switchAthlete = (uid: string | null) => {
      setViewingAthleteId(uid);
      setLoadingAuth(true); // Trigger loading spinner briefly
      setTimeout(() => setLoadingAuth(false), 500); // Artificial delay for smooth UX transition
  };
  
  const refreshUserData = () => {
      if(user) loadDataForId(viewingAthleteId || user.uid);
  };

  // --- ACTIONS (Write to the Target ID) ---
  const targetId = viewingAthleteId || user?.uid;

  const updateProfile = (profile: UserProfile) => {
    setUserProfile(profile);
    if (targetId && isInitialized) saveUserProfile(targetId, profile);
  };
  
  const updateCompetitions = (competitions: { id: string; name: string; date: string }[]) => {
    const newProfile = { ...userProfile, competitions };
    setUserProfile(newProfile);
    if (targetId && isInitialized) saveUserProfile(targetId, newProfile);
  };

  const setPlan = (plan: TrainingPlan) => {
    if (currentPlan && targetId && isInitialized) {
        archivePlan(targetId, currentPlan);
        setPlanHistory(prev => [currentPlan, ...prev]);
    }
    setCurrentPlan(plan);
    if (targetId && isInitialized) saveTrainingPlan(targetId, plan);
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

  // NEW: Update existing analysis (e.g. for Coach Notes)
  const updateAnalysis = (id: string, updates: Partial<BiomechanicalAnalysis>) => {
      setAnalysisHistory(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
      // Note: Full Firestore update logic for array items inside a collection would require finding the doc ID.
      // This implementation updates local state. 
      // For persistent update of history items, we'd need to fetch the specific doc from 'analysisHistory' collection if we stored IDs.
      // Assuming 'analysis' id matches document id in 'analysisHistory' subcollection:
      if (targetId && isInitialized) {
          // This is a simplified placeholder. In a real app, you'd update the specific doc in firestore.
          // Since we don't have a dedicated updateAnalysis function in firebase.ts yet that takes ID, we skip persistence for this demo step or need to add it.
          // Ideally: updateDoc(doc(db, "users", targetId, "analysisHistory", id), updates);
      }
  };

  // Optimization: Memoize the context value
  const contextValue = useMemo(() => ({
    user,
    loadingAuth,
    userProfile,
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
    refreshUserData
  }), [
    user,
    loadingAuth,
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
