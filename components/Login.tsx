import React, { useState, useEffect, useMemo } from 'react';
import { Member, Selfie } from '../types';
import { Lock, User, ArrowRight, AlertCircle, Camera, Eye, EyeOff, Music, FileText } from 'lucide-react';
import bearPitLogo from '../assets/bearpit_logo.png';

interface LoginProps {
    members: Member[];
    onLogin: (member: Member) => void;
    onGuest: () => void;
    onChants?: () => void;
    selfies?: Selfie[];
}

export const Login: React.FC<LoginProps> = ({ members, onLogin, onGuest, onChants, selfies = [] }) => {
    const [nameInput, setNameInput] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [step, setStep] = useState<'name' | 'password'>('name');
    const [error, setError] = useState('');
    const [matchedMember, setMatchedMember] = useState<Member | null>(null);

    const backgroundPhotos = useMemo(() => {
        if (!selfies || selfies.length === 0) return [];
        return [...selfies].sort(() => 0.5 - Math.random()).slice(0, 24);
    }, [selfies]);

    const handleNameSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        const trimmedName = nameInput.trim();

        if (!trimmedName) return;

        const memberMatch = members.find(m =>
            `${m.firstName} ${m.lastName}`.toLowerCase() === trimmedName.toLowerCase()
        );

        if (memberMatch) {
            setMatchedMember(memberMatch);
            setStep('password');
            return;
        }

        setError('Member not found. For attendance, please use the Attendance Login button.');
    };

    const handlePasswordSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!matchedMember) return;
        const memberPass = matchedMember.password || 'BPLT';
        if (password === memberPass) {
            onLogin(matchedMember);
        } else {
            setError('Incorrect password.');
        }
    };

    return (
        <div className="min-h-screen bg-[#154734] flex flex-col font-sans">

            {/* 1. HERO SECTION (Selfie Grid + Logo) */}
            <div className="relative h-[50vh] min-h-[400px] w-full bg-[#0a2e20] overflow-hidden border-b-8 border-[#FFB81C]">

                {/* Selfie Grid Background */}
                <div className="absolute inset-0 opacity-60">
                    {backgroundPhotos.length > 0 ? (
                        <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-1 p-1 h-full content-center">
                            {backgroundPhotos.map((photo, i) => (
                                <div key={i} className="aspect-square rounded-sm overflow-hidden relative bg-gray-800">
                                    <img
                                        src={photo.imageData}
                                        alt=""
                                        className="w-full h-full object-cover opacity-80"
                                    />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20"></div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#154734] via-transparent to-black/30"></div>
                </div>

                {/* Floating Logo Overlay */}
                <div className="absolute inset-0 flex items-center justify-center z-10 p-8">
                    <div className="relative transform hover:scale-105 transition-transform duration-500 max-w-2xl w-full">
                        <img
                            src={bearPitLogo}
                            alt="The Bear Pit"
                            className="w-full h-auto drop-shadow-2xl filter brightness-110"
                        />
                    </div>
                </div>
            </div>


            {/* 2. ACTION GRID */}
            <div className="flex-1 bg-[#154734] p-4 md:p-8">
                <div className="max-w-7xl mx-auto h-full flex flex-col justify-center">

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">

                        {/* Column 1: Gameday Chants */}
                        <button
                            onClick={onChants}
                            className="group relative h-80 md:h-96 rounded-xl overflow-hidden border-2 border-[#FFB81C]/30 hover:border-[#FFB81C] transition-all duration-300 shadow-xl hover:shadow-[#FFB81C]/20 bg-[#0f3325]"
                        >
                            <div className="absolute -right-12 -bottom-12 text-white/5 group-hover:text-white/10 transition-colors duration-500">
                                <Music className="w-64 h-64" />
                            </div>

                            <div className="absolute inset-0 p-8 flex flex-col justify-between z-10 text-left">
                                <div className="bg-[#FFB81C] w-16 h-16 rounded-full flex items-center justify-center text-[#154734] shadow-lg group-hover:scale-110 transition-transform">
                                    <FileText className="w-8 h-8" />
                                </div>
                                <div>
                                    <h2 className="text-3xl font-extrabold text-white mb-2 group-hover:text-[#FFB81C] transition-colors">
                                        Gameday Chants
                                    </h2>
                                    <p className="text-green-100/80 font-medium text-lg">
                                        View official cheers & chant sheets for today's game.
                                    </p>
                                </div>
                            </div>
                        </button>


                        {/* Column 2: Attendance Login */}
                        <button
                            onClick={onGuest}
                            className="group relative h-80 md:h-96 rounded-xl overflow-hidden border-2 border-[#FFB81C] hover:border-white transition-all duration-300 shadow-2xl hover:shadow-[0_0_30px_rgba(255,184,28,0.3)] bg-gradient-to-br from-[#1c5c44] to-[#0f3325]"
                        >
                            <div className="absolute -right-8 -top-8 text-[#FFB81C]/10 group-hover:text-[#FFB81C]/20 transition-colors">
                                <Camera className="w-48 h-48" />
                            </div>

                            <div className="absolute inset-0 p-8 flex flex-col items-center justify-center z-10 text-center">
                                <div className="bg-white w-20 h-20 rounded-full flex items-center justify-center text-[#154734] shadow-xl mb-6 group-hover:scale-110 transition-transform duration-300">
                                    <Camera className="w-10 h-10" />
                                </div>
                                <h2 className="text-4xl font-extrabold text-white mb-3 tracking-tight uppercase">
                                    Attendance<br /><span className="text-[#FFB81C]">Login</span>
                                </h2>
                                <span className="inline-block px-6 py-2 rounded-full border border-[#FFB81C] text-[#FFB81C] font-bold text-sm tracking-wider uppercase group-hover:bg-[#FFB81C] group-hover:text-[#154734] transition-all">
                                    Click to Check In
                                </span>
                            </div>
                        </button>


                        {/* Column 3: Member Login */}
                        <div className="h-80 md:h-96 rounded-xl overflow-hidden border border-gray-700 bg-white shadow-xl relative flex flex-col">
                            <div className="bg-gray-50 p-4 border-b border-gray-100 flex items-center gap-3">
                                <div className="bg-[#154734] p-2 rounded-lg text-white">
                                    <User className="w-5 h-5" />
                                </div>
                                <h3 className="text-xl font-bold text-[#154734]">Member Login</h3>
                            </div>

                            <div className="p-6 flex-1 flex flex-col justify-center">
                                {step === 'name' ? (
                                    <form onSubmit={handleNameSubmit} className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Name</label>
                                            <input
                                                type="text"
                                                value={nameInput}
                                                onChange={(e) => { setNameInput(e.target.value); setError(''); }}
                                                className="block w-full bg-gray-50 text-black border border-gray-200 rounded-lg p-3 focus:ring-2 focus:ring-[#154734] outline-none"
                                                placeholder="Enter your name..."
                                            />
                                        </div>
                                        {error && <p className="text-red-600 text-xs font-bold">{error}</p>}
                                        <button className="w-full py-3 bg-[#154734] text-white font-bold rounded-lg hover:bg-[#0f3325] transition-colors">
                                            Continue
                                        </button>
                                    </form>
                                ) : (
                                    <form onSubmit={handlePasswordSubmit} className="space-y-4 animate-in fade-in slide-in-from-right-4">
                                        <div className="text-center mb-2">
                                            <h3 className="text-lg font-bold text-[#154734]">{matchedMember?.firstName} {matchedMember?.lastName}</h3>
                                            <button type="button" onClick={() => { setStep('name'); setError(''); setPassword(''); }} className="text-xs text-gray-400 hover:text-gray-600 underline">Not you?</button>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Password</label>
                                            <input
                                                type="password"
                                                value={password}
                                                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                                                className="block w-full bg-gray-50 text-black border border-gray-200 rounded-lg p-3 focus:ring-2 focus:ring-[#154734] outline-none"
                                                placeholder="••••••••"
                                                autoFocus
                                            />
                                        </div>
                                        {error && <p className="text-red-600 text-xs font-bold">{error}</p>}
                                        <button className="w-full py-3 bg-[#154734] text-white font-bold rounded-lg hover:bg-[#0f3325] transition-colors">
                                            Login
                                        </button>
                                    </form>
                                )}
                            </div>
                            <div className="bg-gray-50 p-3 text-center border-t border-gray-100">
                                <p className="text-[10px] text-gray-400 uppercase">Authorized Personnel Only</p>
                            </div>
                        </div>

                    </div>
                </div>
            </div>

        </div>
    );
};
