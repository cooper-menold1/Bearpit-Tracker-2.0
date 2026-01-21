import React, { useState, useMemo } from 'react';
import { AppState, Role } from '../types';
import { Trophy, Medal, Filter, TrendingUp, Users } from 'lucide-react';

interface LeaderboardProps {
    data: AppState;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ data }) => {
    const [filterSportId, setFilterSportId] = useState<string>('all');
    const [leaderboardType, setLeaderboardType] = useState<'points' | 'attendance'>('points');

    const leaderboard = useMemo(() => {
        return data.members.map(member => {
            let gamePoints = 0;
            let gamesAttended = 0;

            // 1. Calculate Game Points & Attendance
            data.games.forEach(game => {
                // Apply Sport Filter
                if (filterSportId !== 'all' && game.sportId !== filterSportId) return;

                if (data.attendance[game.id]?.[member.id]) {
                    gamePoints += (game.pointsValue || 1); // Default to 1 if missing
                    gamesAttended++;
                }
            });

            // 2. Calculate Bonus Points (Manual)
            let bonusPoints = 0;
            if (filterSportId === 'all') {
                data.bonusPoints?.forEach(bp => {
                    if (bp.memberId === member.id) {
                        bonusPoints += bp.points;
                    }
                });
            }

            return {
                ...member,
                gamePoints,
                bonusPoints,
                gamesAttended,
                totalPoints: gamePoints + bonusPoints
            };
        })
            .sort((a, b) => {
                if (leaderboardType === 'points') {
                    return b.totalPoints - a.totalPoints;
                } else {
                    // Sort by attendance count, then total points as tiebreaker
                    if (b.gamesAttended !== a.gamesAttended) {
                        return b.gamesAttended - a.gamesAttended;
                    }
                    return b.totalPoints - a.totalPoints;
                }
            });
    }, [data, filterSportId, leaderboardType]);

    // Top 3 Styling
    const getRankStyle = (index: number) => {
        if (index === 0) return "bg-yellow-50 border-l-4 border-l-[#FFB81C]";
        if (index === 1) return "bg-gray-50 border-l-4 border-l-gray-400";
        if (index === 2) return "bg-orange-50 border-l-4 border-l-orange-400";
        return "bg-white border-l-4 border-l-transparent hover:bg-gray-50";
    };

    const getIcon = (index: number) => {
        if (index === 0) return <Trophy className="w-5 h-5 text-[#FFB81C]" />;
        if (index === 1) return <Medal className="w-5 h-5 text-gray-400" />;
        if (index === 2) return <Medal className="w-5 h-5 text-orange-400" />;
        return <span className="font-bold text-gray-500 w-5 text-center">{index + 1}</span>;
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <Trophy className="w-6 h-6 text-[#154734]" />
                    <h2 className="text-xl font-bold text-[#154734]">Standings</h2>
                </div>

                <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg self-start">
                    <button
                        onClick={() => setLeaderboardType('points')}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 transition-all ${leaderboardType === 'points' ? 'bg-white text-[#154734] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <TrendingUp className="w-3 h-3" /> Points
                    </button>
                    <button
                        onClick={() => setLeaderboardType('attendance')}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 transition-all ${leaderboardType === 'attendance' ? 'bg-white text-[#154734] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Users className="w-3 h-3" /> Attendance
                    </button>
                </div>

                <div className="flex items-center gap-2 self-start md:self-auto">
                    <Filter className="w-4 h-4 text-gray-500" />
                    <select
                        value={filterSportId}
                        onChange={(e) => setFilterSportId(e.target.value)}
                        className="bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#154734] outline-none"
                    >
                        <option value="all">All Sports</option>
                        {data.sports.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-[#154734] text-white uppercase text-xs">
                            <tr>
                                <th className="px-6 py-3 w-16 text-center">Rank</th>
                                <th className="px-6 py-3">Member</th>
                                {leaderboardType === 'attendance' ? (
                                    <>
                                        <th className="px-6 py-3 text-right font-bold">Games Attended</th>
                                        <th className="px-6 py-3 text-right">Points</th>
                                    </>
                                ) : (
                                    <>
                                        <th className="px-6 py-3 text-center">Games</th>
                                        {filterSportId === 'all' && <th className="px-6 py-3 text-center">Bonus</th>}
                                        <th className="px-6 py-3 text-right font-bold">Total Points</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {leaderboard.map((member, index) => (
                                <tr key={member.id} className={`transition-colors ${getRankStyle(index)}`}>
                                    <td className="px-6 py-4 flex justify-center items-center">
                                        {getIcon(index)}
                                    </td>
                                    <td className="px-6 py-4 font-medium text-gray-900">
                                        {member.firstName} {member.lastName}
                                        {member.role !== Role.MEMBER && (
                                            <span className="ml-2 text-[10px] uppercase bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded font-bold">
                                                {member.role}
                                            </span>
                                        )}
                                    </td>

                                    {leaderboardType === 'attendance' ? (
                                        <>
                                            <td className="px-6 py-4 text-right font-bold text-lg text-[#154734]">
                                                {member.gamesAttended}
                                            </td>
                                            <td className="px-6 py-4 text-right text-gray-500">
                                                {member.totalPoints}
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex flex-col items-center">
                                                    <span className="font-bold text-gray-700">{member.gamePoints}</span>
                                                    <span className="text-[10px] text-gray-400">({member.gamesAttended} games)</span>
                                                </div>
                                            </td>
                                            {filterSportId === 'all' && (
                                                <td className="px-6 py-4 text-center text-gray-500">
                                                    {member.bonusPoints > 0 ? `+${member.bonusPoints}` : member.bonusPoints}
                                                </td>
                                            )}
                                            <td className="px-6 py-4 text-right font-bold text-lg text-[#154734]">
                                                {member.totalPoints}
                                            </td>
                                        </>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
