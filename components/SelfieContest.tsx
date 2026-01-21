import React, { useMemo, useState } from 'react';
import { AppState, Selfie, Member, Role } from '../types';
import { Heart, Camera, Trophy, Download, ChevronDown } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';

interface SelfieContestProps {
    data: AppState;
    currentMember: Member;
    onVote: (selfieId: string, memberId: string) => void;
}

export const SelfieContest: React.FC<SelfieContestProps> = ({ data, currentMember, onVote }) => {
    const currentMemberId = currentMember.id;
    const isOfficerPlus = currentMember.role === Role.OFFICER || currentMember.role === Role.ADMIN;

    // 0. Games that HAVE selfies
    const gamesWithSelfies = useMemo(() => {
        const gameIdsWithSelfies = new Set(data.selfies.map(s => s.gameId));
        return data.games
            .filter(g => gameIdsWithSelfies.has(g.id))
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [data.games, data.selfies]);

    // 1. Selection State
    const [selectedGameId, setSelectedGameId] = useState<string | null>(null);

    const contestGame = useMemo(() => {
        if (selectedGameId) {
            return gamesWithSelfies.find(g => g.id === selectedGameId) || gamesWithSelfies[0] || null;
        }
        return gamesWithSelfies[0] || null;
    }, [gamesWithSelfies, selectedGameId]);

    // 2. Get selfies for that game
    const contestSelfies = useMemo(() => {
        if (!contestGame) return [];
        return data.selfies.filter(s => s.gameId === contestGame.id);
    }, [contestGame, data.selfies]);

    // 3. Calculate Votes
    const selfiesWithVotes = useMemo(() => {
        return contestSelfies.map(selfie => {
            const votes = data.selfieVotes?.filter(v => v.selfieId === selfie.id).length || 0;
            const hasVoted = data.selfieVotes?.some(v => v.selfieId === selfie.id && v.memberId === currentMemberId);
            return { ...selfie, votes, hasVoted };
        }).sort((a, b) => b.votes - a.votes);
    }, [contestSelfies, data.selfieVotes, currentMemberId]);

    const handleVote = async (selfieId: string, hasVoted: boolean) => {
        onVote(selfieId, currentMemberId);
    };

    const handleDownload = (selfie: Selfie) => {
        const game = data.games.find(g => g.id === selfie.gameId);
        const member = data.members.find(m => m.id === selfie.memberId);
        const fileName = `${game?.opponent || 'Game'}_${member?.firstName || 'Member'}_Selfie.jpg`;

        const link = document.createElement('a');
        link.href = selfie.imageData;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (!contestGame) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl shadow-sm border border-gray-200">
                <Camera className="w-12 h-12 text-gray-300 mb-4" />
                <h3 className="text-lg font-bold text-gray-600">No Active Contests</h3>
                <p className="text-gray-400">Check back after the next game!</p>
            </div>
        );
    }

    // Get Leader (Top Voted)
    const leader = selfiesWithVotes[0];

    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-[#154734] flex items-center gap-2">
                        <Camera className="w-6 h-6" /> Best Selfie Contest
                    </h2>
                    <p className="text-gray-500 text-sm mt-1">
                        Voting open for: <span className="font-bold text-[#154734]">{contestGame.opponent}</span> ({contestGame.date})
                    </p>
                </div>

                {gamesWithSelfies.length > 1 && (
                    <div className="relative min-w-[200px]">
                        <select
                            value={contestGame.id}
                            onChange={(e) => setSelectedGameId(e.target.value)}
                            className="appearance-none w-full bg-white border-2 border-gray-100 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-700 outline-none focus:border-[#154734]/20 transition-all cursor-pointer shadow-sm pr-10"
                        >
                            {gamesWithSelfies.map(g => (
                                <option key={g.id} value={g.id}>
                                    {g.opponent} - {g.date}
                                </option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                )}
            </div>

            {/* Winner Spotlight (if any votes) */}
            {leader && leader.votes > 0 && (
                <div className="relative bg-gradient-to-r from-[#FFB81C] to-yellow-400 rounded-xl p-1 shadow-lg transform hover:scale-[1.01] transition-transform">
                    <div className="absolute -top-3 -right-3 bg-white p-2 rounded-full shadow-md z-10">
                        <Trophy className="w-6 h-6 text-[#154734]" />
                    </div>
                    <div className="bg-white rounded-lg p-4 flex flex-col sm:flex-row items-center gap-6 h-full">
                        <div className="w-full sm:w-1/3 aspect-video rounded-lg overflow-hidden relative shadow-inner">
                            <img src={leader.imageData} alt="Top Selfie" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 text-center sm:text-left">
                            <h3 className="text-lg font-bold text-gray-800">Current Leader</h3>
                            <div className="flex items-center justify-center sm:justify-start gap-2 mt-2">
                                <Heart className="w-5 h-5 text-red-500 fill-red-500" />
                                <span className="text-2xl font-bold text-[#154734]">{leader.votes}</span>
                                <span className="text-gray-500">votes</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {selfiesWithVotes.map(selfie => (
                    <div key={selfie.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden group">
                        <div className="aspect-square relative overflow-hidden bg-gray-100">
                            <img
                                src={selfie.imageData}
                                alt="Contest Entry"
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                            />
                            {/* Overlay Gradient */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        </div>

                        <div className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-red-50 rounded-full">
                                    <Heart className={`w-4 h-4 ${selfie.votes > 0 ? 'text-red-500 fill-red-500' : 'text-gray-400'}`} />
                                </div>
                                <span className="font-bold text-gray-700">{selfie.votes}</span>
                                {data.bonusPoints.some(b => b.reason.includes(`Selfie of the week: ${contestGame.id}`) && b.memberId === selfie.memberId) && (
                                    <div className="bg-yellow-100 text-yellow-700 p-1.5 rounded-lg ml-2" title="Winner!">
                                        <Trophy className="w-4 h-4" />
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleVote(selfie.id, !!selfie.hasVoted)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm transition-all ${selfie.hasVoted
                                        ? 'bg-red-500 text-white shadow-md hover:bg-red-600'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                >
                                    <Heart className={`w-4 h-4 ${selfie.hasVoted ? 'fill-current' : ''}`} />
                                    {selfie.hasVoted ? 'Voted' : 'Vote'}
                                </button>

                                {isOfficerPlus && (
                                    <button
                                        onClick={() => handleDownload(selfie)}
                                        className="p-2 bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-[#154734] rounded-full transition-all"
                                        title="Download Selfie"
                                    >
                                        <Download className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
