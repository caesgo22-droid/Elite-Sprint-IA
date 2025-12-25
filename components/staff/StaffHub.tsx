import React, { useState, useEffect } from 'react';
import { useApp } from '../../contexts/AppContext';
import { Users, UserPlus, Shield, Activity, Zap, MessageSquare, Clock, CheckCircle2, ChevronRight } from 'lucide-react';
import { Coach, ActivityEvent } from '../../types';
import { getActivityFeed } from '../../services/firebase';

export const StaffHub: React.FC = () => {
    const { userProfile, updateProfile } = useApp();
    const [activeTab, setActiveTab] = useState<'roster' | 'feed'>('roster');
    const [activityFeed, setActivityFeed] = useState<ActivityEvent[]>([]);

    useEffect(() => {
        const loadFeed = async () => {
            if (userProfile.uid) {
                const feed = await getActivityFeed(userProfile.uid, 10);
                setActivityFeed(feed);
            }
        };
        loadFeed();
    }, [userProfile.uid]);

    // Mock feed for demo if empty
    const displayFeed = activityFeed.length > 0 ? activityFeed : [
        { id: '1', userId: 'x', type: 'analysis', title: 'Video Analysis Complete', description: 'Coach Mike analyzed 100m Sprint', timestamp: new Date().toISOString() },
        { id: '2', userId: 'x', type: 'plan', title: 'Training Plan Updated', description: 'Head Coach approved Week 4 Cycle', timestamp: new Date(Date.now() - 86400000).toISOString() },
        { id: '3', userId: 'x', type: 'message', title: 'New Message', description: 'Physio Sarah sent a recovery note', timestamp: new Date(Date.now() - 172800000).toISOString() },
    ];

    const roles = ['Head Coach', 'Assistant', 'Physio', 'Biomechanist', 'Strength Coach', 'Nutritionist', 'Sport Psychologist'];

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-24">
            {/* Header */}
            <div className="flex justify-between items-end border-b border-slate-800 pb-6">
                <div>
                    <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Staff Command</h2>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2 flex items-center gap-2">
                        <Shield size={12} className="text-cyan-500" /> High Performance Unit
                    </p>
                </div>
                <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
                    <button
                        onClick={() => setActiveTab('roster')}
                        className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'roster' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        Roster
                    </button>
                    <button
                        onClick={() => setActiveTab('feed')}
                        className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'feed' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        Live Feed
                    </button>
                </div>
            </div>

            {/* Roster View */}
            {activeTab === 'roster' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Add New Card */}
                    <button className="group border-2 border-dashed border-slate-800 hover:border-indigo-500/50 rounded-[2rem] p-6 flex flex-col items-center justify-center gap-4 transition-all hover:bg-slate-900/50 min-h-[200px]">
                        <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center group-hover:scale-110 transition-transform shadow-xl">
                            <UserPlus className="text-slate-600 group-hover:text-indigo-400" size={24} />
                        </div>
                        <span className="text-xs font-black text-slate-500 uppercase tracking-widest group-hover:text-indigo-300">Invite Staff</span>
                    </button>

                    {/* Existing Staff */}
                    {userProfile.coaches?.map((coach, i) => (
                        <div key={i} className="relative bg-slate-900 border border-slate-800 rounded-[2rem] p-6 group hover:border-slate-700 transition-colors shadow-2xl">
                            <div className="flex items-start justify-between mb-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-lg font-black text-slate-400">
                                        {coach.name.charAt(0)}
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-white leading-tight">{coach.name}</h3>
                                        <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider mt-0.5">{coach.role}</p>
                                    </div>
                                </div>
                                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></span>
                            </div>

                            <div className="space-y-3">
                                <div className="bg-slate-950/50 rounded-xl p-3 flex items-center justify-between border border-slate-800/50 group-hover:border-slate-700/50 transition-colors">
                                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Status</span>
                                    <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1">
                                        Active <CheckCircle2 size={10} />
                                    </span>
                                </div>
                                <button className="w-full py-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 text-[10px] font-bold uppercase tracking-widest hover:bg-indigo-600 hover:text-white hover:border-indigo-500 transition-all flex items-center justify-center gap-2">
                                    <MessageSquare size={12} /> Direct Message
                                </button>
                            </div>
                        </div>
                    ))}

                    {/* Placeholder Cards for Demo */}
                    {(!userProfile.coaches || userProfile.coaches.length === 0) && (
                        <>
                            {/* Demo Card 1 */}
                            <div className="relative bg-slate-900 border border-slate-800 rounded-[2rem] p-6 group hover:border-slate-700 transition-colors shadow-2xl opacity-60">
                                <div className="flex items-start justify-between mb-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-indigo-900/20 border border-indigo-500/20 flex items-center justify-center text-lg font-black text-indigo-400">
                                            M
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-white leading-tight">Mike Ross</h3>
                                            <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider mt-0.5">Head Coach</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <p className="text-xs text-slate-500 italic text-center">Example Staff Card</p>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Live Feed View */}
            {activeTab === 'feed' && (
                <div className="space-y-4">
                    {displayFeed.map((event, i) => (
                        <div key={i} className="flex gap-4 p-4 rounded-2xl bg-slate-900/50 border border-slate-800/50 hover:bg-slate-900 hover:border-slate-700 transition-all group">
                            <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center border ${event.type === 'analysis' ? 'bg-cyan-900/20 border-cyan-500/30 text-cyan-400' :
                                event.type === 'plan' ? 'bg-purple-900/20 border-purple-500/30 text-purple-400' :
                                    'bg-emerald-900/20 border-emerald-500/30 text-emerald-400'
                                } `}>
                                {event.type === 'analysis' ? <Activity size={18} /> :
                                    event.type === 'plan' ? <Zap size={18} /> : <MessageSquare size={18} />}
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-start">
                                    <h4 className="text-sm font-bold text-white">{event.title}</h4>
                                    <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                                        <Clock size={10} /> {new Date(event.timestamp).toLocaleDateString()}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-400 mt-1">{event.description}</p>
                            </div>
                            <div className="self-center">
                                <ChevronRight size={16} className="text-slate-600 group-hover:text-white transition-colors" />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default StaffHub;