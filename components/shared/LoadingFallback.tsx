import * as React from 'react';
import { Zap } from 'lucide-react';

export const LoadingFallback: React.FC = () => {
    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
            <div className="text-center space-y-6 animate-in fade-in duration-500">
                {/* Animated Logo */}
                <div className="relative">
                    <div className="absolute inset-0 bg-cyan-500/20 blur-3xl rounded-full animate-pulse"></div>
                    <div className="relative bg-gradient-to-br from-cyan-500 to-blue-600 p-6 rounded-3xl shadow-2xl shadow-cyan-500/50">
                        <Zap size={48} className="text-white animate-pulse" />
                    </div>
                </div>

                {/* Loading Text */}
                <div className="space-y-2">
                    <h2 className="text-2xl font-black text-white uppercase tracking-tight">
                        Elite Sprint AI
                    </h2>
                    <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">
                        Cargando módulo...
                    </p>
                </div>

                {/* Progress Bar */}
                <div className="w-64 h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full animate-loading-bar"></div>
                </div>
            </div>

            <style>{`
        @keyframes loading-bar {
          0% { width: 0%; }
          50% { width: 70%; }
          100% { width: 100%; }
        }
        .animate-loading-bar {
          animation: loading-bar 1.5s ease-in-out infinite;
        }
      `}</style>
        </div>
    );
};

export default LoadingFallback;
