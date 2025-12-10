import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserProfile, TrainingPlan, PerformanceLog, ChatMessage, BiomechanicalAnalysis } from '../types';
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
  acwrStats: LoadStats | null;
  planHistory: TrainingPlan[];
}

const defaultProfile: UserProfile = {
  name: 'Atleta',
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
  // NEW: Default coaches
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

  // App State
  const [userProfile, setUserProfile] = useState<UserProfile>(defaultProfile);
  const [currentPlan, setCurrentPlan] = useState<TrainingPlan | null>(null);
  const [planHistory, setPlanHistory] = useState<TrainingPlan[]>([]);
  const [logs, setLogs] = useState<PerformanceLog[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [lastAnalysis, setLastAnalysis] = useState<BiomechanicalAnalysis | null>(null);
  const [analysisHistory, setAnalysisHistory] = useState<BiomechanicalAnalysis[]>([]);
  const [acwrStats, setAcwrStats] = useState<LoadStats | null>(null);

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
        try {
          const data = await fetchUserData(currentUser.uid);
          if (data.profile) {
             const loadedProfile = data.profile as any;
             // Migration helpers
             if (loadedProfile.event && !loadedProfile.events) loadedProfile.events = [loadedProfile.event];
             if (!loadedProfile.coaches) loadedProfile.coaches = []; // Ensure coaches exist
             
             setUserProfile({ ...defaultProfile, ...loadedProfile });
          }
          if (data.currentPlan) setCurrentPlan(data.currentPlan);
          if (data.logs) setLogs(data.logs);

          const analysisHist = await getAnalysisHistory(currentUser.uid);
          setAnalysisHistory(analysisHist as BiomechanicalAnalysis[]);
          
          const pHist = await getPlanHistory(currentUser.uid);
          setPlanHistory(pHist as TrainingPlan[]);

        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      } else {
        setUserProfile(defaultProfile);
        setCurrentPlan(null);
        setLogs([]);
      }
      setLoadingAuth(false);
    });

    return () => unsubscribe();
  }, []);

  // Update ACWR whenever plans change
  useEffect(() => {
      if (currentPlan || planHistory.length > 0) {
          const allPlans = currentPlan ? [currentPlan, ...planHistory] : planHistory;
          const stats = calculateACWR(allPlans);
          setAcwrStats(stats);
      }
  }, [currentPlan, planHistory]);

  const updateProfile = (profile: UserProfile) => {
    setUserProfile(profile);
    if (user && isInitialized) saveUserProfile(user.uid, profile);
  };
  
  const updateCompetitions = (competitions: { id: string; name: string; date: string }[]) => {
    const newProfile = { ...userProfile, competitions };
    setUserProfile(newProfile);
    if (user && isInitialized) saveUserProfile(user.uid, newProfile);
  };

  const setPlan = (plan: TrainingPlan) => {
    if (currentPlan && user && isInitialized) {
        archivePlan(user.uid, currentPlan);
        setPlanHistory(prev => [currentPlan, ...prev]);
    }
    setCurrentPlan(plan);
    if (user && isInitialized) saveTrainingPlan(user.uid, plan);
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
    if (user && isInitialized) saveTrainingPlan(user.uid, newPlan);
  };

  const addLog = (log: PerformanceLog) => {
    setLogs(prev => [...prev, log]);
    if (user && isInitialized) addPerformanceLog(user.uid, log);
  };
  
  const editLog = (updatedLog: PerformanceLog) => {
    setLogs(prev => prev.map(log => log.id === updatedLog.id ? updatedLog : log));
    if (user && isInitialized) updatePerformanceLog(user.uid, updatedLog);
  };

  const deleteLog = (id: string) => {
    setLogs(prev => prev.filter(l => l.id !== id));
    if (user && isInitialized) deletePerformanceLog(user.uid, id);
  };

  const addChatMessage = (msg: ChatMessage) => setChatHistory(prev => [...prev, msg]);

  const saveAnalysis = (analysis: BiomechanicalAnalysis) => {
    setLastAnalysis(analysis);
    setAnalysisHistory(prev => [analysis, ...prev]);
    if (user && isInitialized) saveAnalysisToHistory(user.uid, analysis);
  };

  return (
    <AppContext.Provider value={{
      user, loadingAuth, userProfile, updateProfile, updateCompetitions, currentPlan, setPlan, updateSession, logs, addLog, editLog, deleteLog, chatHistory, addChatMessage, lastAnalysis, setLastAnalysis, analysisHistory, saveAnalysis, acwrStats, planHistory
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
};