
import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { useApp } from '../contexts/AppContext';
import { chatWithCoach } from '../services/geminiService';
import { Send, User, Bot, Loader2, Wrench } from 'lucide-react';
import { ChatMessage } from '../types';

export const LiveCoach: React.FC = () => {
  const { userProfile, currentPlan, logs, lastAnalysis, chatHistory, addChatMessage, updateSession, acwrStats } = useApp();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, loading]);

  const handleSend = async (textOverride?: string) => {
    const textToSend = textOverride || input;
    if (!textToSend.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: textToSend,
      timestamp: Date.now()
    };
    addChatMessage(userMsg);
    setInput('');
    setLoading(true);

    const apiHistory = chatHistory.filter(m => !m.isToolLog).map(m => ({
      role: m.sender === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }]
    }));

    // Passing full Omni-context object
    const context = {
        profile: userProfile,
        plan: currentPlan,
        logs: logs,
        lastAnalysis: lastAnalysis,
        acwr: acwrStats
    };

    const response = await chatWithCoach(apiHistory, userMsg.text, context);

    if (response.functionCall) {
        const fc = response.functionCall;
        if (fc.name === 'modifySession') {
             const args = fc.args as any;
             updateSession(args.day, {
                 focus: args.newFocus,
                 trackRoutine: args.newRoutine,
                 intensity: args.newIntensity
             });

             const toolMsg: ChatMessage = {
                 id: (Date.now() + 1).toString(),
                 sender: 'coach',
                 text: `✅ He actualizado el plan para el día ${args.day}.`,
                 timestamp: Date.now(),
                 isToolLog: true
             };
             addChatMessage(toolMsg);
        }
    } else {
        const botMsg: ChatMessage = {
            id: (Date.now() + 1).toString(),
            sender: 'coach',
            text: response.text || "...",
            timestamp: Date.now()
        };
        addChatMessage(botMsg);
    }
    
    setLoading(false);
  };

  const QuickPrompts = () => (
    <div className="flex gap-2 overflow-x-auto py-2 px-1 scrollbar-hide">
      {['Analiza mi último video', 'Cambia el entreno de mañana', 'Estrategia 200m', 'Me duele la rodilla'].map(p => (
        <button 
          key={p}
          onClick={() => handleSend(p)}
          disabled={loading}
          className="whitespace-nowrap bg-slate-800 border border-slate-700 text-xs text-slate-300 px-3 py-1.5 rounded-full hover:bg-slate-700 hover:text-cyan-400 transition-colors"
        >
          {p}
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] relative">
      <div className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-slate-950 to-transparent z-10 pointer-events-none" />
      
      <div className="flex-1 overflow-y-auto space-y-4 pb-2 pt-2 px-1">
        {chatHistory.length === 0 && (
          <div className="text-center mt-20 text-slate-500 px-8">
            <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-800">
               <Bot size={32} className="text-cyan-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-300 mb-2">Coach Online</h3>
            <p className="text-sm leading-relaxed">Sincronizado con tu plan, videos y tiempos. Pregúntame sobre técnica, estrategia o salud.</p>
          </div>
        )}
        
        {chatHistory.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`
              max-w-[85%] rounded-2xl p-3 text-sm leading-relaxed shadow-sm
              ${msg.sender === 'user' 
                ? 'bg-cyan-700 text-white rounded-br-none' 
                : msg.isToolLog ? 'bg-emerald-900/30 border border-emerald-500/30 text-emerald-200' : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700'}
            `}>
              {msg.isToolLog && <Wrench size={12} className="inline mr-2" />}
              {msg.text}
            </div>
          </div>
        ))}
        
        {loading && (
           <div className="flex justify-start">
             <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-bl-none p-3 flex items-center gap-2 shadow-sm">
               <Loader2 size={14} className="animate-spin text-cyan-400" />
               <span className="text-xs text-slate-400 font-medium">Pensando...</span>
             </div>
           </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="mt-2 space-y-2">
        {chatHistory.length > 0 && <QuickPrompts />}
        
        <div className="bg-slate-900/90 backdrop-blur border border-slate-700 rounded-full p-1.5 flex items-center gap-2 shadow-lg">
          <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center shrink-0 border border-slate-700/50">
            <User size={16} className="text-slate-400" />
          </div>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Escribe a tu coach..."
            className="flex-1 bg-transparent border-none outline-none text-sm text-white placeholder-slate-500 min-w-0"
          />
          <button 
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            className="w-9 h-9 rounded-full bg-cyan-600 flex items-center justify-center text-white disabled:opacity-50 disabled:bg-slate-700 hover:bg-cyan-500 transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
