
import * as React from 'react';
import { createContext, useContext, useState, useCallback } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
    id: number;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((message: string, type: ToastType = 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    }, []);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[200] space-y-2 pointer-events-none w-full max-w-xs px-4">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`p-4 rounded-2xl shadow-2xl border backdrop-blur-xl animate-in slide-in-from-bottom-5 fade-in duration-300 pointer-events-auto flex items-center justify-center text-center text-xs font-black uppercase tracking-widest ${toast.type === 'success' ? 'bg-emerald-900/90 border-emerald-500/50 text-emerald-400' :
                                toast.type === 'error' ? 'bg-red-900/90 border-red-500/50 text-red-400' :
                                    toast.type === 'warning' ? 'bg-amber-900/90 border-amber-500/50 text-amber-400' :
                                        'bg-slate-900/90 border-indigo-500/50 text-indigo-400'
                            }`}
                    >
                        {toast.message}
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};

export const useToasts = () => {
    const context = useContext(ToastContext);
    if (!context) throw new Error('useToasts must be used within ToastProvider');
    return context;
};
