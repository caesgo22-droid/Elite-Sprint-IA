import React, { useRef } from 'react';
import { useApp } from '../../contexts/AppContext';
import { ChevronLeft, MapPin, Calendar, Medal, Timer, Share2, Printer, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const AthleteCV: React.FC = () => {
    const { userProfile } = useApp();
    const navigate = useNavigate();
    const contentRef = useRef<HTMLDivElement>(null);

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="pb-20 animate-in fade-in duration-500 bg-slate-50 min-h-screen text-slate-900 overflow-x-hidden">
            {/* Header / Actions - Hidden on Print */}
            <div className="fixed top-0 left-0 right-0 z-50 bg-slate-900/90 backdrop-blur-md p-4 flex justify-between items-center print:hidden border-b border-slate-700">
                <button onClick={() => navigate('/')} className="p-2 bg-slate-800 rounded-full text-white hover:bg-slate-700 transition-colors">
                    <ChevronLeft size={24} />
                </button>
                <h1 className="text-white font-black uppercase tracking-widest text-sm">Official Athlete CV</h1>
                <div className="flex gap-2">
                    <button onClick={handlePrint} className="p-2 bg-blue-600 rounded-full text-white hover:bg-blue-500 transition-colors">
                        <Printer size={20} />
                    </button>
                </div>
            </div>

            {/* Printable Content */}
            <div ref={contentRef} className="max-w-4xl mx-auto mt-20 p-6 md:p-12 print:mt-0 print:p-0">

                {/* ID Header */}
                <div className="flex flex-col md:flex-row gap-8 items-start mb-12 border-b-2 border-slate-900 pb-8">
                    <div className="w-32 h-32 md:w-48 md:h-48 shrink-0 bg-slate-200 rounded-xl overflow-hidden shadow-2xl border-4 border-white print:border-slate-900">
                        {userProfile.photoURL ? (
                            <img src={userProfile.photoURL} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-4xl font-black text-slate-400 bg-slate-100">
                                {userProfile.name?.charAt(0).toUpperCase()}
                            </div>
                        )}
                    </div>

                    <div className="flex-1 space-y-2">
                        <div className="bg-slate-900 text-white inline-block px-3 py-1 rounded text-xs font-black uppercase tracking-widest mb-2">
                            {userProfile.role === 'athlete' ? 'Elite Athlete' : 'Staff Member'}
                        </div>
                        <h1 className="text-5xl md:text-6xl font-black text-slate-900 uppercase tracking-tighter leading-none">
                            {userProfile.name}
                        </h1>
                        <div className="flex flex-wrap gap-4 text-slate-600 font-medium mt-4">
                            <div className="flex items-center gap-2">
                                <MapPin size={18} className="text-blue-600" />
                                <span>San José, Costa Rica</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Calendar size={18} className="text-blue-600" />
                                <span>{new Date().getFullYear() - userProfile.age} (Age {userProfile.age})</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Medal size={18} className="text-blue-600" />
                                <span>Primary Event: <strong>{userProfile.events?.[0] || '100m Sprint'}</strong></span>
                            </div>
                        </div>
                    </div>

                    <div className="hidden md:block text-right space-y-1">
                        <div className="text-sm font-bold text-slate-400 uppercase tracking-widest">Gravity ID</div>
                        <div className="font-mono text-xs text-slate-500">{userProfile.uid?.substring(0, 8)}</div>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
                    <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 text-center">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Height</div>
                        <div className="text-3xl font-black text-slate-900">{userProfile.height} <span className="text-sm font-bold text-slate-400">cm</span></div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 text-center">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Weight</div>
                        <div className="text-3xl font-black text-slate-900">{userProfile.weight} <span className="text-sm font-bold text-slate-400">kg</span></div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 text-center">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Experience</div>
                        <div className="text-3xl font-black text-slate-900">{userProfile.yearsExperience}+ <span className="text-sm font-bold text-slate-400">yrs</span></div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 text-center">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Level</div>
                        <div className="text-3xl font-black text-blue-600">{userProfile.experienceLevel}</div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Main PB Column */}
                    <div className="md:col-span-2 space-y-8">
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-6 flex items-center gap-3">
                                <Timer className="text-blue-600" /> Personal Bests
                            </h2>
                            <div className="space-y-4">
                                {['100m', '200m', '400m'].map(evt => {
                                    const pb = userProfile.pbs?.[evt as any];
                                    return (
                                        <div key={evt} className="flex items-center justify-between p-6 bg-slate-900 text-white rounded-2xl shadow-xl">
                                            <div className="text-xl font-black italic tracking-tighter">{evt}</div>
                                            <div className="border-b border-dashed border-slate-700 flex-1 mx-6 opacity-30"></div>
                                            <div className="text-4xl font-black tracking-tighter text-yellow-400">
                                                {pb?.time || 'NT'}
                                                <span className="text-xs font-bold text-slate-500 ml-1">s</span>
                                            </div>
                                            <div className="text-[10px] font-bold text-slate-500 uppercase ml-4 text-right w-20">
                                                {pb?.date || 'No Data'}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div>
                            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-6 flex items-center gap-3">
                                <Trophy className="text-blue-600" /> Event History
                            </h2>
                            <div className="border-l-4 border-slate-200 pl-6 space-y-8">
                                {userProfile.competitions && userProfile.competitions.length > 0 ? (
                                    userProfile.competitions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(comp => (
                                        <div key={comp.id} className="relative">
                                            <div className="absolute -left-[33px] top-1 w-4 h-4 bg-blue-600 rounded-full border-4 border-white shadow-md"></div>
                                            <h3 className="text-lg font-bold text-slate-900">{comp.name}</h3>
                                            <div className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-1">{comp.date}</div>
                                            <div className="inline-block px-2 py-0.5 bg-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-600 rounded">
                                                Priority {comp.priority || 'B'}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-slate-400 italic">No historical competition data added yet.</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* About / Bio Column */}
                    <div className="space-y-8">
                        <div className="bg-slate-100 p-8 rounded-[2rem]">
                            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-4">About Athlete</h3>
                            <p className="text-sm text-slate-600 leading-relaxed font-medium">
                                Determined and highly disciplined sprinter focusing on the short sprints. Currently training in a high-performance environment with integrated biomechanical analysis. Demonstrates strong potential in acceleration mechanics and max velocity maintenance.
                            </p>

                            <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight mt-8 mb-2">Key Attributes</h4>
                            <div className="flex flex-wrap gap-2">
                                {['Explosive Start', 'Top Speed Mechanics', 'Coachability', 'Mental Resilience'].map(tag => (
                                    <span key={tag} className="px-3 py-1 bg-white border border-slate-200 rounded-full text-[10px] font-bold uppercase tracking-wider text-slate-700">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>

                        <div className="bg-blue-600 text-white p-8 rounded-[2rem] shadow-xl">
                            <h3 className="text-lg font-black uppercase tracking-tight mb-4">Contact</h3>
                            <div className="space-y-4 text-sm font-medium opacity-90">
                                <div>
                                    <div className="text-[10px] uppercase opacity-70 mb-0.5">Email</div>
                                    <div className="font-bold">{userProfile.email}</div>
                                </div>
                                <div>
                                    <div className="text-[10px] uppercase opacity-70 mb-0.5">Phone</div>
                                    <div className="font-bold">{userProfile.phone || '--'}</div>
                                </div>
                                <div className="pt-4 border-t border-white/20">
                                    <div className="text-[10px] uppercase opacity-70 mb-0.5">Coach</div>
                                    <div className="font-bold">{userProfile.coaches?.[0]?.name || 'Unattached'}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-12 pt-8 border-t border-slate-200 flex justify-between items-center text-slate-400 text-xs uppercase tracking-widest">
                    <div>Generated by Elite Sprint AI</div>
                    <div>{new Date().toLocaleDateString()}</div>
                </div>
            </div>
        </div>
    );
};
