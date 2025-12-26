import React, { createContext, useContext, ReactNode } from 'react';
import { UserProfile, TrainingPlan, PerformanceLog, ChatMessage, BiomechanicalAnalysis, NexusInsight, ACWROutput, RosterItem } from '../types';
import { UserProvider, useUser } from './UserContext';
import { TrainingProvider, useTraining } from './TrainingContext';
import { LiveProvider, useLive } from './LiveContext';

// Legacy Interface (Aggregated)
interface DataContextType {
    // From UserContext
    userProfile: UserProfile;
    updateProfile: (profile: UserProfile) => void;
    updateCompetitions: (competitions: { id: string; name: string; date: string }[]) => void;
    viewingAthleteId: string | null;
    switchAthlete: (uid: string | null) => void;
    refreshUserData: () => void;
    rosterData: RosterItem[];
    loadingRoster: boolean;

    // From TrainingContext
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

    // From LiveContext
    chatHistory: ChatMessage[];
    addChatMessage: (msg: ChatMessage) => void;
    logActivity: (userId: string, event: any) => Promise<void>;
}

// 1. Create Context (Empty, as we won't use this Provider's value directly, but the hook composes it)
const DataContext = createContext<DataContextType | undefined>(undefined);

// 2. The Provider actually just nests the new Providers
export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    return (
        <UserProvider>
            <TrainingProvider>
                <LiveProvider>
                    {children}
                </LiveProvider>
            </TrainingProvider>
        </UserProvider>
    );
};

// 3. The Hook composes the values
export const useData = (): DataContextType => {
    const user = useUser();
    const training = useTraining();
    const live = useLive();

    return {
        ...user,
        ...training,
        ...live
    };
};

// Support export for AppContext legacy import
export default DataContext;
