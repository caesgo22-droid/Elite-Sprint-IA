
import * as firebaseApp from "firebase/app";
import * as firebaseAuth from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, getDocs, query, orderBy, deleteDoc, Firestore, where, limit } from "firebase/firestore";

// Helper to get env vars safely in Vite/Node
const getEnv = (key: string) => {
  // Check import.meta.env (Vite standard)
  if (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env[key]) {
    return (import.meta as any).env[key];
  }
  // Check process.env (Fallback)
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  return "";
};

const firebaseConfig = {
  apiKey: getEnv("VITE_FIREBASE_API_KEY"),
  authDomain: getEnv("VITE_FIREBASE_AUTH_DOMAIN"),
  projectId: getEnv("VITE_FIREBASE_PROJECT_ID"),
  storageBucket: getEnv("VITE_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: getEnv("VITE_FIREBASE_MESSAGING_SENDER_ID"),
  appId: getEnv("VITE_FIREBASE_APP_ID")
};

// Workaround for potential environment type mismatch for firebase/app
const { initializeApp, getApps, getApp } = firebaseApp as any;
const { getAuth, GoogleAuthProvider } = firebaseAuth as any;

// Singleton pattern to prevent multiple initializations
let app;
let auth: any = null;
let db: Firestore | null = null;
let googleProvider: any = null;
let isInitialized = false;

try {
  // Check if config is valid to prevent crash
  // IF keys are missing, we don't throw, we just log and stay uninitialized.
  if (firebaseConfig.apiKey) {
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApp();
    }

    auth = getAuth(app);
    db = getFirestore(app);
    googleProvider = new GoogleAuthProvider();
    isInitialized = true;
  } else {
    console.warn("🔥 Firebase config missing. App will run in offline mode (UI Only).");
  }

} catch (error) {
  console.error("🔥 FIREBASE INITIALIZATION ERROR:", error);
}

export { auth, db, googleProvider, isInitialized };

// --- Firestore Helpers (Safe Wrappers) ---

export const saveUserProfile = async (uid: string, profile: any) => {
  if (!db || !isInitialized) return;
  try { await setDoc(doc(db, "users", uid), { profile }, { merge: true }); } catch (e) { console.error(e); }
};

export const saveTrainingPlan = async (uid: string, plan: any) => {
  if (!db || !isInitialized) return;
  try { await setDoc(doc(db, "users", uid), { currentPlan: plan }, { merge: true }); } catch (e) { console.error(e); }
};

export const archivePlan = async (uid: string, plan: any) => {
  if (!db || !isInitialized) return;
  try {
    const planPayload = { ...plan, archivedAt: new Date().toISOString() };
    await addDoc(collection(db, "users", uid, "planHistory"), planPayload);
  } catch (e) { console.error(e); }
};

export const getPlanHistory = async (uid: string) => {
  if (!db || !isInitialized) return [];
  try {
    const q = query(collection(db, "users", uid, "planHistory"), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (e) { console.error(e); return []; }
};

export const addPerformanceLog = async (uid: string, log: any) => {
  if (!db || !isInitialized) return;
  try { await setDoc(doc(db, "users", uid, "logs", log.id), log); } catch (e) { console.error(e); }
};

export const updatePerformanceLog = async (uid: string, log: any) => {
  if (!db || !isInitialized) return;
  try { await setDoc(doc(db, "users", uid, "logs", log.id), log, { merge: true }); } catch (e) { console.error(e); }
};

export const deletePerformanceLog = async (uid: string, logId: string) => {
  if (!db || !isInitialized) return;
  try { await deleteDoc(doc(db, "users", uid, "logs", logId)); } catch (e) { console.error(e); }
};

export const saveAnalysisToHistory = async (uid: string, analysis: any) => {
  if (!db || !isInitialized) return;
  try {
    const analysisPayload = { ...analysis, savedAt: new Date().toISOString() };
    await addDoc(collection(db, "users", uid, "analysisHistory"), analysisPayload);
  } catch (e) { console.error(e); }
};

export const deleteAnalysisFromHistory = async (uid: string, analysisId: string) => {
  if (!db || !isInitialized) return;
  try { await deleteDoc(doc(db, "users", uid, "analysisHistory", analysisId)); } catch (e) { console.error(e); }
};

export const getAnalysisHistory = async (uid: string) => {
  if (!db || !isInitialized) return [];
  try {
    const q = query(collection(db, "users", uid, "analysisHistory"), orderBy("savedAt", "desc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (e) { console.error(e); return []; }
};

export const fetchUserData = async (uid: string) => {
  if (!db || !isInitialized) return { profile: null, currentPlan: null, logs: [] };
  try {
    const userDoc = await getDoc(doc(db, "users", uid));
    const logsQuery = query(collection(db, "users", uid, "logs"));
    const logsSnapshot = await getDocs(logsQuery);

    const logs = logsSnapshot.docs.map(d => d.data());
    const userData = userDoc.exists() ? userDoc.data() : {};

    return {
      profile: userData.profile || null,
      currentPlan: userData.currentPlan || null,
      logs: logs || []
    };
  } catch (e) { console.error(e); return { profile: null, currentPlan: null, logs: [] }; }
};

// --- STAFF / COACH FEATURES ---

export const findAthleteByEmail = async (email: string) => {
  if (!db || !isInitialized) return null;
  try {
    // 1. Try exact lowercase match (Standard)
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("profile.email", "==", email.toLowerCase()), limit(1));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return { uid: doc.id, ...doc.data() as any };
    }

    // 2. Fallback: Try with original casing if provided (Edge case for old accounts)
    if (email !== email.toLowerCase()) {
      const q2 = query(usersRef, where("profile.email", "==", email), limit(1));
      const s2 = await getDocs(q2);
      if (!s2.empty) {
        const doc = s2.docs[0];
        return { uid: doc.id, ...doc.data() as any };
      }
    }

    return null;
  } catch (e) {
    console.error("Error searching athlete:", e);
    return null;
  }
}

export const getStaffBriefings = async (athleteId: string) => {
  if (!db || !isInitialized) return [];
  try {
    const q = query(collection(db, "users", athleteId, "staffBriefings"), orderBy("timestamp", "desc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (e) { console.error(e); return []; }
};

export const addStaffBriefing = async (athleteId: string, briefing: any) => {
  if (!db || !isInitialized) return;
  try {
    await setDoc(doc(db, "users", athleteId, "staffBriefings", briefing.id), briefing);
  } catch (e) { console.error(e); }
};

export const addBriefingReply = async (athleteId: string, briefingId: string, reply: any) => {
  if (!db || !isInitialized) return;
  try {
    const briefingRef = doc(db, "users", athleteId, "staffBriefings", briefingId);
    const briefingSnap = await getDoc(briefingRef);
    if (briefingSnap.exists()) {
      const current = briefingSnap.data();
      const updatedReplies = [...(current.replies || []), reply];
      await setDoc(briefingRef, { replies: updatedReplies }, { merge: true });
    }
  } catch (e) { console.error(e); }
};
