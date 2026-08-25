
import React, { useState } from 'react';
import { Member, Selfie, Role } from '../types';
import { Music, QrCode, User } from 'lucide-react';
import LOGO_V2 from '../assets/bearpit_logo_v2.png';
import { supabase } from '../utils/supabaseClient';

interface LoginProps {
    members: Member[];
    onLogin: (member: Member, password: string) => void;
    onGuest: () => void;
    onChants: () => void;
    selfies: Selfie[];
}

export const Login: React.FC<LoginProps> = ({ members, onLogin, onGuest, onChants, selfies }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        // Password verification happens server-side now -- the client never
        // sees real password hashes (see rpc_login in the DB).
        const { data, error: rpcError } = await supabase.rpc('rpc_login', {
            p_identifier: email.trim(),
            p_password: password
        });

        setLoading(false);

        if (rpcError || !data || data.length === 0) {
            setError('Invalid credentials. If you do not have an email on file, try your full name.');
            return;
        }

        const row = data[0];
        const member: Member = {
            id: row.id,
            firstName: row.first_name,
            lastName: row.last_name,
            role: row.role as Role,
            yearsInBPLT: row.years_in_bplt,
            email: row.email,
            fallSportId: row.fall_sport_id,
            springSportId: row.spring_sport_id,
            isChair: row.is_chair,
        };

        onLogin(member, password);
    };

    const recentSelfies = selfies
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 30);

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
            <div className="sticky top-0 h-[65vh] w-full overflow-hidden flex items-start justify-center pt-16 bg-[#154734] z-0 shadow-2xl">
                <div className="absolute inset-0 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-0 opacity-40">
                    {recentSelfies.map(selfie => (
                        <div key={selfie.id} className="relative aspect-square overflow-hidden">
                            <img src={selfie.imageData} alt="Selfie" className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-700" />
                        </div>
                    ))}
                    {Array.from({ length: Math.max(0, 30 - recentSelfies.length) }).map((_, i) => (
                        <div key={`filler-${i}`} className="bg-green-900/20 w-full h-full animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
                    ))}
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-[#154734] via-[#154734]/60 to-transparent pointer-events-none" />
                <div className="relative z-10 px-8 transform hover:scale-105 transition-transform duration-500">
                    <img src={LOGO_V2} alt="The BearPit" className="w-full max-w-xl drop-shadow-2xl" />
                </div>
            </div>

            <div className="relative z-10 bg-gray-50 flex flex-col items-center w-full shadow-[0_-20px_50px_rgba(0,0,0,0.3)]">
                <div className="w-full max-w-7xl mx-auto px-4 py-12">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <button onClick={onChants} className="bg-[#154734] group relative overflow-hidden rounded-3xl shadow-2xl hover:shadow-[0_20px_60px_rgba(21,71,52,0.4)] transition-all duration-300 transform hover:-translate-y-2 border border-[#FFB81C]/20 flex flex-col h-[600px]">
                            <div className="absolute -right-12 -bottom-12 text-[#FFB81C] opacity-10 group-hover:opacity-20 transition-opacity duration-500 transform group-hover:rotate-12">
                                <Music className="w-80 h-80" />
                            </div>
                            <div className="absolute top-0 left-0 w-2 h-full bg-[#FFB81C] group-hover:w-4 transition-all duration-300" />
                            <div className="flex-1 flex flex-col items-center justify-center p-8 z-10 text-center space-y-8">
                                <div className="bg-[#FFB81C] p-8 rounded-full text-[#154734] shadow-lg group-hover:scale-110 transition-transform duration-300">
                                    <Music className="w-16 h-16" />
                                </div>
                                <div>
                                    <h3 className="text-4xl font-extrabold text-[#FFB81C] mb-4 tracking-tight">Gameday<br />Chants</h3>
                                    <p className="text-white/80 font-medium text-lg leading-relaxed">View lyrics and leading guides for today's game.</p>
                                </div>
                            </div>
                        </button>

                        <button onClick={onGuest} className="bg-[#154734] group relative overflow-hidden rounded-3xl shadow-2xl hover:shadow-[0_20px_60px_rgba(21,71,52,0.4)] transition-all duration-300 transform hover:-translate-y-2 border border-[#FFB81C]/20 flex flex-col h-[600px]">
                            <div className="absolute -right-12 -top-12 text-[#FFB81C] opacity-10 group-hover:opacity-20 transition-opacity duration-500 transform group-hover:-rotate-12">
                                <QrCode className="w-80 h-80" />
                            </div>
                            <div className="absolute top-0 left-0 w-2 h-full bg-[#FFB81C] group-hover:w-4 transition-all duration-300" />
                            <div className="flex-1 flex flex-col items-center justify-center p-8 z-10 text-center space-y-8">
                                <div className="bg-[#FFB81C] p-8 rounded-full text-[#154734] shadow-lg group-hover:scale-110 transition-transform duration-300">
                                    <QrCode className="w-16 h-16" />
                                </div>
                                <div>
                                    <h3 className="text-4xl font-extrabold text-[#FFB81C] mb-4 tracking-tight">Attendance<br />Login</h3>
                                    <p className="text-white/80 font-medium text-lg leading-relaxed">For Bearpit Leadership Members Only.</p>
                                </div>
                            </div>
                        </button>

                        <div className="bg-[#154734] rounded-3xl shadow-2xl border border-[#FFB81C]/20 p-8 h-[600px] flex flex-col justify-center relative overflow-hidden">
                            <div className="absolute -right-8 -bottom-8 text-[#FFB81C] opacity-5">
                                <User className="w-64 h-64" />
                            </div>
                            <div className="text-center mb-10 relative z-10">
                                <div className="bg-[#FFB81C] p-6 rounded-full text-[#154734] shadow-lg w-20 h-20 mx-auto flex items-center justify-center mb-6">
                                    <User className="w-10 h-10" />
                                </div>
                                <h3 className="text-3xl font-extrabold text-[#FFB81C] mb-2">Member Portal</h3>
                                <p className="text-white/70 text-sm">Enter Baylor Email or Full Name</p>
                            </div>
                            <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
                                <input
                                    type="text"
                                    placeholder="Email or Full Name"
                                    className="w-full p-4 bg-black/20 text-white placeholder-white/40 border border-[#FFB81C]/30 rounded-xl focus:ring-2 focus:ring-[#FFB81C] outline-none transition-all text-lg"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    autoComplete="off"
                                />
                                <input
                                    type="password"
                                    placeholder="Password"
                                    className="w-full p-4 bg-black/20 text-white placeholder-white/40 border border-[#FFB81C]/30 rounded-xl focus:ring-2 focus:ring-[#FFB81C] outline-none transition-all text-lg"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    autoComplete="new-password"
                                />
                                <button type="submit" disabled={loading} className="w-full bg-[#FFB81C] text-[#154734] py-4 rounded-xl font-extrabold text-xl hover:bg-white transition-colors shadow-lg mt-4 disabled:opacity-60">{loading ? 'Signing In...' : 'Sign In'}</button>
                                {error && <p className="text-red-300 text-sm text-center font-bold animate-pulse bg-red-900/20 p-2 rounded">{error}</p>}
                            </form>
                        </div>
                    </div>
                </div>

                <div className="w-full bg-[#0f3325] text-white py-32 px-4 border-t border-[#FFB81C]/10">
                    <div className="max-w-4xl mx-auto text-center space-y-10">
                        <div className="inline-block p-2 px-4 rounded-full bg-[#FFB81C]/10 text-[#FFB81C] font-bold tracking-widest uppercase text-sm mb-4">Spirit & Traditions</div>
                        <h2 className="text-5xl md:text-6xl font-extrabold text-white tracking-tight">More than a <span className="text-[#FFB81C]">student section.</span></h2>
                        <div className="prose prose-xl prose-invert mx-auto text-gray-300">
                            <p className="leading-relaxed text-white font-medium">The BearPit represents the official student section for Baylor Athletics and those dedicated to cheering for sports. The BearPit leadership Team is a group of students who are committed to creating the best home-court advantage for our Bears in all sports.</p>
                            <p className="leading-relaxed mt-8">The BearPit Leadership Team leads chants, traditions, and fan engagement throughout Baylor athletic events. Our goal is to serve as the bridge between Baylor students and student-athletes—encouraging, supporting, and amplifying the hard work our athletes put in every day.</p>
                            <p className="leading-relaxed mt-8 font-semibold text-[#FFB81C]">BearPit is a passionate community dedicated to creating an electrifying and hostile game-day environment that benefits our teams and fuels school spirit. Our organization is made up of some of the loudest and rowdiest students on campus who love Baylor sports and want to build community with fellow Baylor sports fans.</p>
                        </div>
                        <div className="pt-12">
                            <span className="inline-block px-12 py-4 border-2 border-[#FFB81C] text-[#FFB81C] rounded-full font-bold uppercase tracking-wider hover:bg-[#FFB81C] hover:text-[#154734] transition-all duration-300 cursor-default">Sic 'Em Bears</span>
                        </div>
                    </div>
                </div>
                <div className="bg-[#0a2319] w-full py-12 text-center text-white/20 text-sm border-t border-white/5">
                    <p>&copy; {new Date().getFullYear()} Baylor BearPit. All rights reserved.</p>
                </div>
            </div>
        </div>
    );
};
