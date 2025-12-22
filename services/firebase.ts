import * as firebaseApp from "firebase/app";
import * as firebaseAuth from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, getDocs, query, orderBy, deleteDoc, Firestore, where, limit } from "firebase/firestore";
import { getEnv } from "../utils/env";

const firebaseConfig = {
  apiKey: getEnv("FIREBASE_API_KEY") || getEnv("VITE_FIREBASE_API_KEY"),
  authDomain: getEnv("FIREBASE_AUTH_DOMAIN") || getEnv("VITE_FIREBASE_AUTH_DOMAIN"),
  projectId: getEnv("FIREBASE_PROJECT_ID") || getEnv("VITE_FIREBASE_PROJECT_ID"),
  storageBucket: getEnv("FIREBASE_STORAGE_BUCKET") || getEnv("VITE_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: getEnv("FIREBASE_MESSAGING_SENDER_ID") || getEnv("VITE_FIREBASE_MESSAGING_SENDER_ID"),
  appId: getEnv("FIREBASE_APP_ID") || getEnv("VITE_FIREBASE_APP_ID")
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
let connectionError = "";

try {
  // Check if config is valid to prevent crash
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
    console.log("✅ Firebase initialized successfully");
  } else {
    console.warn("🔥 Firebase config missing. App will run in offline mode (UI Only).");
    connectionError = "Falta Configuración";
  }

} catch (error: any) {
  console.error("🔥 FIREBASE INITIALIZATION ERROR:", error);
  connectionError = error.message || "Error Crítico";
}

export { auth, db, googleProvider, isInitialized, connectionError };

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

// ===== NEW: Staff Communication Functions =====

export const assignTask = async (athleteId: string, task: any) => {
  if (!db || !isInitialized) return;
  try {
    await setDoc(doc(db, "users", athleteId, "assignedTasks", task.id), task);
  } catch (e) { console.error("Error assigning task:", e); }
};

export const getAssignedTasks = async (athleteId: string): Promise<any[]> => {
  if (!db || !isInitialized) return [];
  try {
    const q = query(collection(db, "users", athleteId, "assignedTasks"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data());
  } catch (e) { console.error(e); return []; }
};

export const updateTaskStatus = async (athleteId: string, taskId: string, status: string, completedAt?: string) => {
  if (!db || !isInitialized) return;
  try {
    const taskRef = doc(db, "users", athleteId, "assignedTasks", taskId);
    await setDoc(taskRef, { status, ...(completedAt && { completedAt }) }, { merge: true });
  } catch (e) { console.error(e); }
};

export const sendStaffMessage = async (message: any) => {
  if (!db || !isInitialized) return;
  try {
    // Save to both sender and recipient for easy querying
    await setDoc(doc(db, "users", message.from, "messages", message.id), message);
    await setDoc(doc(db, "users", message.to, "messages", message.id), message);
  } catch (e) { console.error("Error sending message:", e); }
};

export const getStaffMessages = async (userId: string, otherUserId: string): Promise<any[]> => {
  if (!db || !isInitialized) return [];
  try {
    const q = query(
      collection(db, "users", userId, "messages"),
      where("from", "in", [userId, otherUserId]),
      where("to", "in", [userId, otherUserId]),
      orderBy("timestamp", "asc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data());
  } catch (e) {
    console.error(e);
    // Fallback: get all messages and filter client-side
    try {
      const allQ = query(collection(db, "users", userId, "messages"), orderBy("timestamp", "asc"));
      const allSnapshot = await getDocs(allQ);
      return allSnapshot.docs
        .map(d => d.data())
        .filter((m: any) =>
          (m.from === userId && m.to === otherUserId) ||
          (m.from === otherUserId && m.to === userId)
        );
    } catch (e2) { return []; }
  }
};

export const markMessageAsRead = async (userId: string, messageId: string) => {
  if (!db || !isInitialized) return;
  try {
    await setDoc(doc(db, "users", userId, "messages", messageId), { read: true }, { merge: true });
  } catch (e) { console.error(e); }
};

export const addVideoAnnotation = async (analysisId: string, annotation: any) => {
  if (!db || !isInitialized) return;
  try {
    await setDoc(doc(db, "analysisAnnotations", analysisId, "annotations", annotation.id), annotation);
  } catch (e) { console.error("Error adding annotation:", e); }
};

export const getVideoAnnotations = async (analysisId: string): Promise<any[]> => {
  if (!db || !isInitialized) return [];
  try {
    const q = query(collection(db, "analysisAnnotations", analysisId, "annotations"), orderBy("videoTimestamp", "asc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data());
  } catch (e) { console.error(e); return []; }
};

export const logActivity = async (userId: string, event: any) => {
  if (!db || !isInitialized) return;
  try {
    await setDoc(doc(db, "users", userId, "activityFeed", event.id), event);
  } catch (e) { console.error(e); }
};

export const getActivityFeed = async (userId: string, limitCount: number = 20): Promise<any[]> => {
  if (!db || !isInitialized) return [];
  try {
    const q = query(
      collection(db, "users", userId, "activityFeed"),
      orderBy("timestamp", "desc"),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data());
  } catch (e) { console.error(e); return []; }
};
