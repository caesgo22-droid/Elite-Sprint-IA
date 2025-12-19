
import * as React from 'react';
import { useState } from 'react';
import { auth, googleProvider, saveUserProfile, db, isInitialized } from '../services/firebase';
import { useApp } from '../contexts/AppContext';
import * as firebaseAuth from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { Zap, Mail, Lock, LogIn, ArrowRight, UserCircle2, Briefcase } from 'lucide-react';

const { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } = firebaseAuth as any;

export const AuthScreen: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState<'athlete' | 'staff'>('athlete');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { loginAsGuest } = useApp();

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      const res = await signInWithPopup(auth, googleProvider);

      // CRITICAL FIX: Ensure Firestore document exists after Google Login
      if (res.user && db) {
        const userRef = doc(db, "users", res.user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          // Create profile if it doesn't exist (First time Google Login)
          await saveUserProfile(res.user.uid, {
            email: res.user.email?.toLowerCase() || '',
            role: 'athlete', // Default to athlete for Google Login, user can switch later
            name: res.user.displayName || 'Atleta Google',
            events: ['100m'],
            pbs: { '100m': {}, '200m': {}, '400m': {} },
            injuries: [],
            coaches: [],
            trainingDays: ['Mon', 'Tue', 'Thu', 'Fri'],
            roster: []
          });
        } else {
          // Ensure email is synced and lowercase in existing profile
          await saveUserProfile(res.user.uid, {
            email: res.user.email?.toLowerCase()
          });
        }
      }
    } catch (err: any) {
      console.error("Google Login Error:", err);
      let msg = "Error con Google: " + err.message;

      if (err.message.includes("auth/unauthorized-domain")) {
        msg = "⚠️ Dominio no autorizado. Agrega esta URL en Firebase Console.";
      } else if (err.message.includes("auth/popup-closed-by-user")) {
        msg = "Inicio de sesión cancelado.";
      }

      setError(msg);
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const safeEmail = email.trim().toLowerCase(); // FORCE LOWERCASE

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, safeEmail, password);
      } else {
        const res = await createUserWithEmailAndPassword(auth, safeEmail, password);
        // Initialize profile with role and email
        if (res.user) {
          await saveUserProfile(res.user.uid, {
            email: safeEmail,
            role: role,
            name: role === 'staff' ? 'Coach' : 'Atleta',
            // Add defaults to prevent crashes
            events: ['100m'],
            pbs: { '100m': {}, '200m': {}, '400m': {} },
            injuries: [],
            coaches: [],
            trainingDays: ['Mon', 'Tue', 'Thu', 'Fri'],
            roster: [] // For staff
          });
        }
      }
    } catch (err: any) {
      let msg = err.message;
      if (msg.includes("auth/invalid-credential") || msg.includes("auth/wrong-password")) {
        msg = "Correo o contraseña incorrectos.";
      } else if (msg.includes("auth/email-already-in-use")) {
        msg = "Este correo ya está registrado.";
      } else if (msg.includes("auth/weak-password")) {
        msg = "La contraseña debe tener al menos 6 caracteres.";
      }
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Background FX */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-cyan-600/10 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[100px]"></div>
      </div>

      <div className="z-10 w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-xl shadow-cyan-900/20 mb-4 animate-in zoom-in duration-500">
            <Zap size={32} className="text-white" fill="currentColor" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            ELITE SPRINT <span className="text-cyan-400">AI</span>
          </h1>
          <p className="text-slate-400 text-sm">World Athletics Level V Intelligence</p>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 backdrop-blur-md rounded-2xl p-8 shadow-2xl">
          <form onSubmit={handleEmailAuth} className="space-y-4">

            {/* ROLE SELECTOR (Only on Sign Up) */}
            {!isLogin && (
              <div className="grid grid-cols-2 gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => setRole('athlete')}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${role === 'athlete' ? 'bg-cyan-900/30 border-cyan-500 text-cyan-400' : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-600'}`}
                >
                  <UserCircle2 size={24} />
                  <span className="text-xs font-bold uppercase">Atleta</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRole('staff')}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${role === 'staff' ? 'bg-blue-900/30 border-blue-500 text-blue-400' : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-600'}`}
                >
                  <Briefcase size={24} />
                  <span className="text-xs font-bold uppercase">Staff / Coach</span>
                </button>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-3.5 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:border-cyan-500 outline-none transition-colors"
                  placeholder="usuario@elite.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Contraseña</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-3.5 text-slate-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:border-cyan-500 outline-none transition-colors"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="text-red-400 text-xs bg-red-900/20 p-3 rounded-lg border border-red-900/50 leading-relaxed">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-cyan-900/20 active:scale-95 flex items-center justify-center gap-2"
            >
              {loading ? 'Cargando...' : (isLogin ? 'Iniciar Sesión' : 'Crear Cuenta')}
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>

          <div className="my-6 flex items-center gap-4">
            <div className="h-px bg-slate-800 flex-1"></div>
            <span className="text-slate-500 text-xs">O continúa con</span>
            <div className="h-px bg-slate-800 flex-1"></div>
          </div>

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full bg-white text-slate-900 font-bold py-3 rounded-xl hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"></path>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
            </svg>
            Google
          </button>

          {!isInitialized && (
            <button
              onClick={loginAsGuest}
              className="w-full mt-4 bg-slate-800 text-cyan-400 font-bold py-3 rounded-xl border border-cyan-500/20 hover:bg-slate-700 transition-colors flex items-center justify-center gap-2 animate-in slide-in-from-bottom-2 duration-700"
            >
              <Zap size={18} fill="currentColor" />
              Modo Demo (Previsualizar App)
            </button>
          )}

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-cyan-400 hover:text-cyan-300 text-sm font-medium transition-colors"
            >
              {isLogin ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia Sesión'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
