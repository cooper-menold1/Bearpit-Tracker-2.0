import React, { useState, useMemo } from 'react';
import { AppState, BonusPoint, Role } from '../types';
import { Trophy, Medal, Filter, TrendingUp, Users, CalendarRange } from 'lucide-react';
import { POINT_CATEGORIES } from '../constants';
import { semesterOf, currentSemester, listSemesters } from '../utils/semester';
import { computeLifetimeTiers, gamePointValue, isEventCheckin, checkinCategory } from '../utils/fanTier';

const GAME_ATTENDANCE = 'Game Attendance';
const ALL_CATEGORIES = 'all';

interface LeaderboardProps {
    data: AppState;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ data }) => {
    const [filterSportId, setFilterSportId] = useState<string>('all');
    const [leaderboardType, setLeaderboardType] = useState<'points' | 'attendance'>('points');
    const [semesterKey, setSemesterKey] = useState<string>(currentSemester().key);
    const [category, setCategory] = useState<string>(ALL_CATEGORIES);

    const semesters = useMemo(
        () => listSemesters([...data.games.map(g => g.date), ...(data.bonusPoints || []).map(b => b.date)]),
        [data.games, data.bonusPoints]
    );
    // Leaderboard spots are earned per semester; lifetime points only set the fan level badge.

    // Category view only ranks by points; the sport filter only applies to game points.
    const categoryView = leaderboardType === 'points' && category !== ALL_CATEGORIES;
    const showSportFilter = !categoryView || category === GAME_ATTENDANCE;

    // Fan levels depend only on lifetime data, not the filters.
    const lifetimeTiers = useMemo(() => computeLifetimeTiers(data), [data]);

    const leaderboard = useMemo(() => {
        // Games passing the sport + semester filters (semester computed once per game).
        const games = data.games.filter(game =>
            (filterSportId === 'all' || game.sportId === filterSportId)
            && semesterOf(game.date).key === semesterKey
        );
        // Bonus points in the selected semester, grouped by member (original order kept).
        const bonusByMember = new Map<string, BonusPoint[]>();
        data.bonusPoints?.forEach(bp => {
            if (semesterOf(bp.date).key !== semesterKey) return;
            const list = bonusByMember.get(bp.memberId);
            if (list) list.push(bp);
            else bonusByMember.set(bp.memberId, [bp]);
        });

        const rows = data.members.map(member => {
            let gamePoints = 0;
            let gamesAttended = 0;
            let eventPoints = 0;
            const eventByCategory: Record<string, number> = {};

            // 1. Calculate Game Points & Attendance
            games.forEach(game => {
                if (data.attendance[game.id]?.[member.id]) {
                    if (isEventCheckin(game)) {
                        // Event check-ins (tabling etc.) score in their own category, not as a game.
                        const pts = gamePointValue(game);
                        eventPoints += pts;
                        const c = checkinCategory(game);
                        eventByCategory[c] = (eventByCategory[c] || 0) + pts;
                        return;
                    }
                    gamePoints += gamePointValue(game);
                    gamesAttended++;
                }
            });

            // 2. Calculate Bonus Points (Manual)
            let bonusPoints = 0;
            const byCategory: Record<string, number> = { ...eventByCategory, [GAME_ATTENDANCE]: gamePoints };
            bonusByMember.get(member.id)?.forEach(bp => {
                bonusPoints += bp.points;
                const cat = bp.category || 'Other';
                byCategory[cat] = (byCategory[cat] || 0) + bp.points;
            });
            // Bonus points aren't tied to a sport, so a sport filter drops them.
            if (filterSportId !== 'all') bonusPoints = 0;
            // Event check-ins are tied to a sport's game row, so they stay; shown with bonus points.
            bonusPoints += eventPoints;

            return {
                ...member,
                gamePoints,
                bonusPoints,
                gamesAttended,
                categoryPoints: byCategory[category] || 0,
                fanLevel: lifetimeTiers.get(member.id)!,
                totalPoints: gamePoints + bonusPoints
            };
        });

        if (categoryView) {
            return rows.filter(r => r.categoryPoints !== 0).sort((a, b) => b.categoryPoints - a.categoryPoints);
        }
        return rows
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
    }, [data, lifetimeTiers, filterSportId, leaderboardType, semesterKey, category]);

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

                <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
                    <CalendarRange className="w-4 h-4 text-gray-500" />
                    <select
                        aria-label="Semester"
                        value={semesterKey}
                        onChange={(e) => setSemesterKey(e.target.value)}
                        className="bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#154734] outline-none"
                    >
                        {semesters.map(s => (
                            <option key={s.key} value={s.key}>{s.label}</option>
                        ))}
                    </select>
                    {showSportFilter && (
                        <>
                            <Filter className="w-4 h-4 text-gray-500" />
                            <select
                                aria-label="Filter by sport"
                                value={filterSportId}
                                onChange={(e) => setFilterSportId(e.target.value)}
                                className="bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#154734] outline-none"
                            >
                                <option value="all">All Sports</option>
                                {data.sports.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </>
                    )}
                </div>
            </div>

            {leaderboardType === 'points' && (
                <div className="flex gap-2 overflow-x-auto pb-1 -mt-2">
                    {[ALL_CATEGORIES, GAME_ATTENDANCE, ...POINT_CATEGORIES].map(c => (
                        <button
                            key={c}
                            onClick={() => setCategory(c)}
                            className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap border transition-colors ${category === c ? 'bg-[#154734] text-white border-[#154734]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#154734]'}`}
                        >
                            {c === ALL_CATEGORIES ? 'All Categories' : c}
                        </button>
                    ))}
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-[#154734] text-white uppercase text-xs">
                            <tr>
                                <th className="px-6 py-3 w-16 text-center">Rank</th>
                                <th className="px-6 py-3">Member</th>
                                {categoryView ? (
                                    <th className="px-6 py-3 text-right font-bold">{category} Points</th>
                                ) : leaderboardType === 'attendance' ? (
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
                                        <span className={`ml-2 text-[10px] uppercase px-1.5 py-0.5 rounded font-bold ${member.fanLevel.index > 0 ? 'bg-[#FFB81C]/20 text-yellow-800' : 'bg-gray-100 text-gray-400'}`}>
                                            {member.fanLevel.name}
                                        </span>
                                        {member.role !== Role.MEMBER && (
                                            <span className="ml-2 text-[10px] uppercase bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded font-bold">
                                                {member.role}
                                            </span>
                                        )}
                                    </td>

                                    {categoryView ? (
                                        <td className="px-6 py-4 text-right font-bold text-lg text-[#154734]">
                                            {member.categoryPoints}
                                        </td>
                                    ) : leaderboardType === 'attendance' ? (
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
                            {leaderboard.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-gray-400 italic">No points in this category yet.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
