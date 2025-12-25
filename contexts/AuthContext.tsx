import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { UserProfile } from '../types';
import { auth, saveUserProfile, fetchUserData, isInitialized } from '../services/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Language, TRANSLATIONS } from '../utils/translations';
import { useToasts } from './ToastContext';

interface AuthContextType {
    user: User | null;
    loadingAuth: boolean;
    language: Language;
    setLanguage: (lang: Language) => void;
    t: any;
    adminProfile: UserProfile;
    updateAdminProfile: (profile: UserProfile) => void;
    updateRoster: (newRoster: string[]) => void;
    loginAsGuest: () => void;
    refreshIdentity: () => void;
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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { showToast } = useToasts();
    const [user, setUser] = useState<User | null>(null);
    const [loadingAuth, setLoadingAuth] = useState(true);
    const [language, setLanguage] = useState<Language>('es');
    const [adminProfile, setAdminProfile] = useState<UserProfile>(defaultProfile);

    const t = TRANSLATIONS[language];

    const processProfileData = (data: any) => {
        const p = data.profile || {};
        if (p.event && !p.events) p.events = [p.event];
        if (!p.coaches) p.coaches = [];
        if (!p.role) p.role = 'athlete';
        return { ...defaultProfile, ...p };
    };

    const loadIdentity = async (uid: string) => {
        try {
            const data = await fetchUserData(uid);
            const profile = processProfileData(data);
            setAdminProfile(profile);
        } catch (error) {
            console.error("Error loading identity:", error);
        }
    };

    useEffect(() => {
        if (!isInitialized || !auth) {
            console.warn("Firebase not initialized.");
            setLoadingAuth(false);
            return;
        }

        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                await loadIdentity(currentUser.uid);
            } else {
                setAdminProfile(defaultProfile);
            }
            setLoadingAuth(false);
        });

        return () => unsubscribe();
    }, []);

    const loginAsGuest = () => {
        setUser({
            uid: 'guest-123',
            email: 'guest@elitesprint.ai',
            displayName: 'Atleta Invitado',
            emailVerified: true,
            isAnonymous: true,
            metadata: {},
            providerData: [],
            refreshToken: '',
            tenantId: null,
            delete: async () => { },
            getIdToken: async () => '',
            getIdTokenResult: async () => ({} as any),
            reload: async () => { },
            toJSON: () => ({}),
            phoneNumber: null,
            photoURL: null,
        } as unknown as User);

        setAdminProfile({
            ...defaultProfile,
            name: 'Invitado',
            email: 'guest@elitesprint.ai'
        });
    };

    const updateAdminProfile = (profile: UserProfile) => {
        setAdminProfile(profile);
        if (user?.uid && isInitialized) saveUserProfile(user.uid, profile);
    };

    const updateRoster = (newRoster: string[]) => {
        const newAdmin = { ...adminProfile, roster: newRoster };
        setAdminProfile(newAdmin);
        if (user?.uid && isInitialized) saveUserProfile(user.uid, newAdmin);
    };

    const refreshIdentity = () => {
        if (user) loadIdentity(user.uid);
    };

    const value = useMemo(() => ({
        user,
        loadingAuth,
        language,
        setLanguage,
        t,
        adminProfile,
        updateAdminProfile,
        updateRoster,
        loginAsGuest,
        refreshIdentity
    }), [user, loadingAuth, language, adminProfile]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used within AuthProvider");
    return context;
};
