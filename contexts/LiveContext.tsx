import React, { createContext, useContext, useState, useMemo, ReactNode } from 'react';
import { ChatMessage } from '../types';
import { useAuth } from './AuthContext';
import { logActivity, isInitialized } from '../services/firebase';

interface LiveContextType {
    chatHistory: ChatMessage[];
    addChatMessage: (msg: ChatMessage) => void;
    logActivity: (userId: string, event: any) => Promise<void>;
}

const LiveContext = createContext<LiveContextType | undefined>(undefined);

export const LiveProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);

    const addChatMessage = (msg: ChatMessage) => setChatHistory(prev => [...prev, msg]);

    const handleLogActivity = async (userId: string, event: any) => {
        if (isInitialized) await logActivity(userId, event);
    };

    const value = useMemo(() => ({
        chatHistory,
        addChatMessage,
        logActivity: handleLogActivity
    }), [chatHistory]);

    return (
        <LiveContext.Provider value={value}>
            {children}
        </LiveContext.Provider>
    );
};

export const useLive = () => {
    const context = useContext(LiveContext);
    if (!context) throw new Error("useLive must be used within LiveProvider");
    return context;
};
