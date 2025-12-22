
import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { useApp } from '../contexts/AppContext';
import { chatWithCoach } from '../services/geminiService';
import { Send, User, Bot, Loader2, Wrench, Users } from 'lucide-react';
import { ChatMessage } from '../types';

export const LiveCoach: React.FC = () => {
  const { userProfile, currentPlan, logs, lastAnalysis, chatHistory, addChatMessage, updateSession, acwrStats, planHistory, analysisHistory } = useApp();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showStaffSelector, setShowStaffSelector] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, loading]);

  const handleSend = async (textOverride?: string, roleplayContext?: string) => {
    const textToSend = textOverride || input;
    if (!textToSend.trim() || loading) return;

    // If roleplay, inject instruction prefix
    const finalMessage = roleplayContext ? `[CONSULTA A STAFF - ${roleplayContext}]: ${textToSend}` : textToSend;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: textToSend, // Display original text
      timestamp: Date.now()
    };
    addChatMessage(userMsg);
    setInput('');
    setLoading(true);
    setShowStaffSelector(false);

    const apiHistory = chatHistory.filter(m => !m.isToolLog).map(m => ({
      role: m.sender === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }]
    }));

    // OMNI-CONTEXT: Preparing the full dossier
    const context = {
      profile: userProfile,
      plan: currentPlan,
      planHistory: planHistory, // Past cycles
      logs: logs, // Race times history
      lastAnalysis: lastAnalysis,
      analysisHistory: analysisHistory, // Technical evolution
      acwr: acwrStats
    };

    const response = await chatWithCoach(apiHistory, finalMessage, context);

    if (response.functionCall) {
      const fc = response.functionCall;
      if (fc.name === 'modifySession') {
        const args = fc.args as any;
        updateSession(args.day, { focus: args.newFocus, trackRoutine: args.newRoutine, intensity: args.newIntensity });
        addChatMessage({ id: (Date.now() + 1).toString(), sender: 'coach', text: `✅ Plan actualizado.`, timestamp: Date.now(), isToolLog: true });
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

  const StaffSelector = () => (
    <div className="absolute bottom-16 left-4 right-4 bg-slate-900 border border-slate-700 rounded-xl p-3 shadow-2xl animate-in slide-in-from-bottom-5 z-20">
      <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Consultar a:</h4>
      <div className="grid grid-cols-2 gap-2">
        {userProfile.coaches?.length > 0 ? userProfile.coaches.map((c, idx) => {
          // Handle both string (legacy) and Coach object formats
          const coachName = typeof c === 'string' ? c : c.name;
          const coachRole = typeof c === 'string' ? 'Coach' : c.role;
          const coachId = typeof c === 'string' ? `coach-${idx}` : c.id;

          return (
            <button
              key={coachId}
              onClick={() => handleSend(input, `${coachName} (${coachRole})`)}
              disabled={!input.trim()}
              className="text-left p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs transition-colors border border-slate-700 hover:border-cyan-500"
            >
              <div className="font-bold text-white">{coachName}</div>
              <div className="text-cyan-400">{coachRole}</div>
            </button>
          );
        }) : <div className="col-span-2 text-xs text-slate-500 text-center py-2">No hay staff registrado. Ve a Staff y agrega miembros.</div>}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-[calc(100dvh-140px)] relative">
      <div className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-slate-950 to-transparent z-10 pointer-events-none" />

      <div className="flex-1 overflow-y-auto space-y-5 pb-4 pt-4 px-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-800">
        {chatHistory.length === 0 && (
          <div className="flex flex-col items-center justify-center mt-20 text-center animate-in fade-in duration-700">
            <div className="w-20 h-20 bg-gradient-to-br from-cyan-900/40 to-slate-900 rounded-full flex items-center justify-center mb-6 border border-cyan-500/20 shadow-[0_0_30px_rgba(8,145,178,0.2)]">
              <Bot size={40} className="text-cyan-400" />
            </div>
            <h3 className="text-xl font-black text-white px-8 uppercase tracking-tight mb-2">Coach Inteligente</h3>
            <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
              Toda la potencia de Gemini Pro analizando tu biomecánica. <br />
              <span className="text-cyan-500 font-bold">Pregunta sobre tu técnica o plan.</span>
            </p>
          </div>
        )}

        {chatHistory.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
            <div className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed shadow-lg ${msg.sender === 'user'
              ? 'bg-gradient-to-br from-cyan-600 to-cyan-700 text-white rounded-br-none border border-cyan-500/20'
              : msg.isToolLog
                ? 'bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 backdrop-blur-sm'
                : 'bg-slate-900/80 backdrop-blur-md text-slate-200 rounded-bl-none border border-slate-700/50'
              }`}>
              {msg.isToolLog && <Wrench size={12} className="inline mr-2 text-emerald-400" />}
              {msg.text}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start animate-in fade-in">
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl rounded-bl-none p-4 flex items-center gap-3 shadow-sm backdrop-blur-sm">
              <Loader2 size={16} className="animate-spin text-cyan-400" />
              <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">Analizando...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} className="h-4" />
      </div>

      <div className="mt-auto px-1 pt-2 pb-1 relative z-20">
        {showStaffSelector && <StaffSelector />}

        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-700 rounded-[2rem] p-2 flex items-center gap-2 shadow-2xl">
          <button onClick={() => setShowStaffSelector(!showStaffSelector)} className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border transition-all ${showStaffSelector ? 'bg-cyan-500 text-white border-cyan-500 shadow-lg shadow-cyan-900/50' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700'}`}>
            <Users size={18} />
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Escribe a tu coach o staff..."
            className="flex-1 bg-transparent border-none outline-none text-sm text-white placeholder-slate-500 min-w-0 font-medium px-2"
          />
          <button onClick={() => handleSend()} disabled={loading || !input.trim()} className="w-10 h-10 rounded-full bg-gradient-to-r from-cyan-600 to-blue-600 flex items-center justify-center text-white disabled:opacity-50 disabled:grayscale hover:shadow-lg hover:shadow-cyan-500/20 transition-all transform active:scale-95">
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};
