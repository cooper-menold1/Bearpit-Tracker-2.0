
import React, { useState, useMemo } from 'react';
import { Game, Member, AttendanceRecord, Role } from '../types';
import { Calendar, MapPin, Trophy, CheckCircle2, Circle } from 'lucide-react';
import { formatFriendlyDate } from '../utils/dateUtils';

interface SportSheetProps {
  sportName: string;
  sportId: string; // Added sportId to identify for report
  games: Game[];
  members: Member[];
  attendance: AttendanceRecord;
  attendanceThreshold?: number;
  onToggleAttendance: (gameId: string, memberId: string) => void;
  onUpdateThreshold?: (id: string, val: number) => void;
}

export const SportSheet: React.FC<SportSheetProps> = ({
  sportName, sportId, games, members, attendance, attendanceThreshold = 0.5, onToggleAttendance, onUpdateThreshold
}) => {
  const [filterRole, setFilterRole] = useState<'All' | Role>('All');
  const [filter, setFilter] = useState(''); // New state for text filter
  const [reportMode, setReportMode] = useState(false);
  const [tempThreshold, setTempThreshold] = useState(attendanceThreshold * 100);

  const sortedGames = useMemo(() => {
    return [...games].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [games]);

  // Filter members who have selected this sport
  // Logic: Fall sport OR Spring sport matches sportId
  const sportMembers = useMemo(() => {
    return members.filter(m => m.fallSportId === sportId || m.springSportId === sportId);
  }, [members, sportId]);

  // Calculate attendance % for a member in THIS sport's games
  const getAttendanceRate = (memberId: string) => {
    if (games.length === 0) return 0;
    let attended = 0;
    games.forEach(g => {
      if (attendance[g.id]?.[memberId]) attended++;
    });
    return attended / games.length;
  };

  const filteredMembers = useMemo(() => {
    let currentMembers = reportMode ? sportMembers : members;

    // Apply role filter
    if (filterRole !== 'All') {
      currentMembers = currentMembers.filter(m => m.role === filterRole);
    }

    // Apply text filter
    if (filter) {
      currentMembers = currentMembers.filter(m =>
        `${m.firstName} ${m.lastName}`.toLowerCase().includes(filter.toLowerCase())
      );
    }

    return currentMembers;
  }, [members, sportMembers, filterRole, filter, reportMode]);

  // Calculate Stats per Member (HOME GAMES ONLY)
  const memberStats = useMemo(() => {
    const homeGames = games.filter(g => g.location === 'Home');
    return filteredMembers.map(member => {
      let attendedCount = 0;
      homeGames.forEach(game => {
        if (attendance[game.id]?.[member.id]) {
          attendedCount++;
        }
      });
      const percentage = homeGames.length > 0 ? (attendedCount / homeGames.length) * 100 : 0;
      return {
        ...member,
        attendedCount,
        percentage,
      };
    });
  }, [filteredMembers, games, attendance]);

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-[#154734]">{sportName} Attendance</h2>
            <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setReportMode(false)}
                className={`px-3 py-1 text-sm font-bold rounded-md transition-colors ${!reportMode ? 'bg-white shadow text-[#154734]' : 'text-gray-500'}`}
              >
                All Members
              </button>
              <button
                onClick={() => setReportMode(true)}
                className={`px-3 py-1 text-sm font-bold rounded-md transition-colors ${reportMode ? 'bg-red-50 text-red-600 shadow border border-red-100' : 'text-gray-500'}`}
              >
                View Report
              </button>
            </div>
          </div>

          {reportMode && (
            <div className="flex items-center gap-2 text-sm">
              <span className="font-bold text-gray-600">Threshold:</span>
              <input
                type="number"
                value={tempThreshold}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setTempThreshold(val);
                  if (onUpdateThreshold) onUpdateThreshold(sportId, val / 100);
                }}
                className="w-16 border rounded px-1 py-0.5"
              />
              <span className="text-gray-500">%</span>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <select
            className="px-3 py-1 border rounded text-sm bg-white focus:ring-2 focus:ring-[#FFB81C]"
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value as any)}
          >
            <option value="All">All Members</option>
            <option value={Role.OFFICER}>Officers</option>
            <option value={Role.MEMBER}>Members</option>
          </select>
          <input
            type="text"
            placeholder="Filter by name..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-1 border rounded text-sm bg-white focus:ring-2 focus:ring-[#FFB81C]"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto relative bg-gray-50/30">
        {!reportMode ? (
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-gray-50 sticky top-0 z-20 shadow-sm">
              <tr>
                <th className="sticky left-0 z-30 bg-gray-50 border-b border-r border-gray-200 p-3 min-w-[250px] text-left font-semibold text-gray-700">
                  Event / Game
                </th>
                {memberStats.map(member => (
                  <th key={member.id} className="border-b border-gray-200 p-2 min-w-[80px] text-center font-medium text-gray-600">
                    <div className="flex flex-col items-center gap-1">
                      <span className="whitespace-nowrap text-xs font-bold text-gray-800">
                        {member.firstName}
                      </span>
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider">{member.lastName}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${member.role === Role.OFFICER ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                        {member.role === Role.OFFICER ? 'OFF' : 'MEM'}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
              {/* Summary Row at Top for quick visibility */}
              <tr className="bg-[#FFB81C]/10">
                <td className="sticky left-0 z-20 bg-[#FFB81C]/20 border-b border-r border-gray-200 p-2 text-right font-bold text-[#154734] text-xs uppercase tracking-wide">
                  Home Game Attendance %
                </td>
                {memberStats.map(member => (
                  <td key={member.id} className="border-b border-gray-200 p-2 text-center font-bold text-gray-800">
                    <div className={`${member.percentage >= 75 ? 'text-green-700' : member.percentage >= 50 ? 'text-yellow-700' : 'text-red-500'}`}>
                      {member.percentage.toFixed(0)}%
                    </div>
                  </td>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {sortedGames.map((game, idx) => {
                return (
                  <tr key={game.id} className={`hover:bg-gray-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                    <td className={`sticky left-0 z-10 border-r border-gray-200 p-3 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 font-medium text-gray-900">
                          {game.isBonus && <Trophy className="w-3 h-3 text-[#FFB81C]" />}
                          {game.opponent}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> {formatFriendlyDate(game.date)}
                          </span>
                          <span className={`flex items-center gap-1 px-1.5 rounded ${game.location === 'Home' ? 'bg-green-100 text-green-700' :
                            game.location === 'Away' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                            }`}>
                            <MapPin className="w-3 h-3" /> {game.location}
                          </span>
                        </div>
                      </div>
                    </td>
                    {filteredMembers.map(member => {
                      const isPresent = attendance[game.id]?.[member.id];
                      return (
                        <td
                          key={member.id}
                          className="p-2 text-center cursor-pointer select-none"
                          onClick={() => onToggleAttendance(game.id, member.id)}
                        >
                          <div className={`w-full h-full flex items-center justify-center p-2 rounded transition-all ${isPresent ? 'bg-green-100 text-[#154734] scale-110' : 'hover:bg-gray-200 text-gray-300'
                            }`}>
                            {isPresent ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-3 h-3" />}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          /* NEW REPORT VIEW */
          <div className="p-6 max-w-4xl mx-auto">
            <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-[#154734] text-white">
                  <tr>
                    <th className="px-6 py-4 font-bold">Priority Member List</th>
                    <th className="px-6 py-4 font-bold">Sport Selection</th>
                    <th className="px-6 py-4 font-bold text-center">Attendance %</th>
                    <th className="px-6 py-4 font-bold text-center">Home Games</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {memberStats
                    .sort((a, b) => {
                      // 1. Priority to those who picked this sport
                      const aPicked = a.fallSportId === sportId || a.springSportId === sportId;
                      const bPicked = b.fallSportId === sportId || b.springSportId === sportId;
                      if (aPicked && !bPicked) return -1;
                      if (!aPicked && bPicked) return 1;
                      // 2. Sort by lowest attendance
                      return a.percentage - b.percentage;
                    })
                    .map(member => {
                      const isPrimary = member.fallSportId === sportId || member.springSportId === sportId;
                      const homeGamesCount = games.filter(g => g.location === 'Home').length;
                      const statusColor = member.percentage >= 75 ? 'text-green-600' : member.percentage >= 50 ? 'text-yellow-600' : 'text-red-500';

                      return (
                        <tr key={member.id} className={`hover:bg-gray-50 ${isPrimary ? 'bg-amber-50/30' : ''}`}>
                          <td className="px-6 py-4">
                            <div className="font-bold text-gray-900">{member.firstName} {member.lastName}</div>
                            <div className="text-xs text-gray-500 uppercase tracking-widest">{member.role}</div>
                          </td>
                          <td className="px-6 py-4">
                            {isPrimary ? (
                              <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-xs font-bold border border-amber-200">
                                <Trophy className="w-3 h-3" /> Primary: {member.fallSportId === sportId ? 'Fall' : 'Spring'}
                              </span>
                            ) : (
                              <span className="text-gray-400 italic text-xs">Other Sport</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className={`text-lg font-black ${statusColor}`}>
                              {member.percentage.toFixed(0)}%
                            </div>
                            <div className="text-[10px] text-gray-400">Total Progress</div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="font-bold text-gray-700">{member.attendedCount} / {homeGamesCount}</div>
                            <div className="text-[10px] text-gray-400 font-medium">Attended/Tracked</div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            <div className="mt-6 p-4 bg-white rounded-lg border border-gray-200 text-sm italic text-gray-500 text-center">
              * The report highlights members who selected this sport as their primary focus (Fall/Spring) and displays them by lowest attendance first.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
