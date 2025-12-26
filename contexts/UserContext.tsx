import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { UserProfile, RosterItem, PerformanceLog, TrainingPlan } from '../types';
import { useAuth } from './AuthContext';
import { saveUserProfile, fetchUserData, isInitialized, subscribeToUserData, saveTrainingPlan, getPlanHistory, getAnalysisHistory } from '../services/firebase';
import { calculateACWR } from '../utils/loadCalculator';
import { useToasts } from './ToastContext';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { UserProfileSchema } from '../utils/validators';

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

interface UserContextType {
    userProfile: UserProfile;
    updateProfile: (profile: UserProfile) => void;
    updateCompetitions: (competitions: { id: string; name: string; date: string }[]) => void;
    viewingAthleteId: string | null;
    switchAthlete: (uid: string | null) => void;
    rosterData: RosterItem[];
    loadingRoster: boolean;
    refreshUserData: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user, adminProfile, updateAdminProfile, loadingAuth } = useAuth();
    const { showToast } = useToasts();

    const [viewingAthleteId, setViewingAthleteId] = useState<string | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile>(defaultProfile);
    const [rosterData, setRosterData] = useState<RosterItem[]>([]);
    const [loadingRoster, setLoadingRoster] = useState(false);

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

    const targetId = viewingAthleteId || user?.uid;

    // --- Real-time User Profile Sync ---
    useEffect(() => {
        if (loadingAuth || !targetId) return;

        // Note: This subscribes to the whole doc, but we only update state if profile changes.
        // We duplicates logic slightly from DataContext phase 2 but focused on Profile.
        // Ideally we use a helper that doesn't conflict.
        // Since we are replacing DataContext, this is the NEW home for this logic.

        if (!db || !isInitialized) return;

        const unsub = onSnapshot(doc(db, "users", targetId), (docSnap) => {
            const userData = docSnap.exists() ? docSnap.data() : {};
            if (userData.profile) {
                const result = UserProfileSchema.safeParse(userData.profile);
                if (result.success) {
                    const processed = processProfileData({ profile: result.data });
                    setUserProfile(processed);
                }
            }
        });

        return () => unsub();
    }, [targetId, loadingAuth]);


    const updateProfile = (profile: UserProfile) => {
        setUserProfile(profile);
        if (!viewingAthleteId) {
            updateAdminProfile(profile);
        }
        if (targetId && isInitialized) saveUserProfile(targetId, profile);
    };

    const updateCompetitions = (competitions: { id: string; name: string; date: string }[]) => {
        const newProfile = { ...userProfile, competitions };
        updateProfile(newProfile);
    };

    const switchAthlete = (uid: string | null) => {
        setViewingAthleteId(uid);
    };

    const refreshUserData = () => {
        // With real-time sync, this is mostly a no-op or force re-fetch if needed.
        // For now, we rely on the subscription.
    };

    // --- Roster Loading ---
    useEffect(() => {
        const loadRoster = async () => {
            if (!adminProfile?.roster || adminProfile.roster.length === 0) {
                setRosterData([]);
                return;
            }
            setLoadingRoster(true);
            const profiles: any[] = [];
            for (const uid of adminProfile.roster) {
                try {
                    const data = await fetchUserData(uid);
                    const pHist = await getPlanHistory(uid);
                    // Minimal calculation for roster view
                    let risk: 'High' | 'Low' | 'Optimal' = 'Optimal';
                    let acwrRatio = 0;
                    if (data.currentPlan) {
                        const acwr = calculateACWR([data.currentPlan as any, ...pHist as any], (data.logs || []) as any[]);
                        acwrRatio = acwr.ratio;
                        if (acwr.status === 'Alto Riesgo') risk = 'High';
                        else if (acwr.status === 'Carga Baja') risk = 'Low';
                    }

                    const lastLog = data.logs && data.logs.length > 0 ? data.logs[data.logs.length - 1] : null;
                    const lastActive = lastLog ? lastLog.date : 'Inactivo';

                    if (data.profile) {
                        profiles.push({ uid, profile: data.profile, risk, acwrRatio, pendingReviews: 0, lastActive });
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
    }, [adminProfile?.roster]);

    const value = useMemo(() => ({
        userProfile,
        updateProfile,
        updateCompetitions,
        viewingAthleteId,
        switchAthlete,
        rosterData,
        loadingRoster,
        refreshUserData
    }), [userProfile, viewingAthleteId, rosterData, loadingRoster]);

    return (
        <UserContext.Provider value={value}>
            {children}
        </UserContext.Provider>
    );
};

export const useUser = () => {
    const context = useContext(UserContext);
    if (!context) throw new Error("useUser must be used within UserProvider");
    return context;
};
