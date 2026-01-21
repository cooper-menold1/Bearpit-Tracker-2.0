
import React from 'react';
import { AppState, Role } from '../types';
import { Trophy, Medal, Star } from 'lucide-react';

interface PointsTableProps {
  data: AppState;
}

export const PointsTable: React.FC<PointsTableProps> = ({ data }) => {
  const pointsData = data.members.map(member => {
    // Base Points
    let basePoints = 0;
    if (member.role === Role.ADMIN || member.role === Role.OFFICER) {
        basePoints = 5;
    }

    // Attendance Points
    let gamePoints = 0;
    let bonusPoints = 0;

    data.games.forEach(game => {
        if (data.attendance[game.id]?.[member.id]) {
            gamePoints += 1; // 1 point for attending
            if (game.isBonus) {
                bonusPoints += 1; // +1 extra if bonus
            }
        }
    });

    return {
        ...member,
        basePoints,
        gamePoints,
        bonusPoints,
        totalPoints: basePoints + gamePoints + bonusPoints
    };
  }).sort((a, b) => b.totalPoints - a.totalPoints);

  return (
    <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-[#FFB81C] p-2 rounded-lg text-[#154734]">
            <Trophy className="w-6 h-6" />
        </div>
        <div>
            <h2 className="text-xl font-bold text-[#154734]">Points Standings</h2>
            <p className="text-sm text-gray-500">
                1 pt per game • +1 pt per bonus game • +5 pts start for Officers/Admins
            </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-[#154734] text-white uppercase text-xs">
            <tr>
              <th className="px-4 py-3 rounded-tl-lg">Rank</th>
              <th className="px-4 py-3">Member</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3 text-center">Base Pts</th>
              <th className="px-4 py-3 text-center">Game Pts</th>
              <th className="px-4 py-3 text-center">Bonus Pts</th>
              <th className="px-4 py-3 text-right font-bold rounded-tr-lg">Total Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 border border-gray-200">
            {pointsData.map((row, idx) => (
                <tr key={row.id} className={`hover:bg-gray-50 ${idx < 3 ? 'bg-yellow-50/30' : ''}`}>
                    <td className="px-4 py-3 font-bold text-gray-500">
                        {idx === 0 ? <Medal className="w-5 h-5 text-[#FFB81C]" /> : 
                         idx === 1 ? <Medal className="w-5 h-5 text-gray-400" /> :
                         idx === 2 ? <Medal className="w-5 h-5 text-amber-700" /> : 
                         `#${idx + 1}`}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                        {row.firstName} {row.lastName}
                    </td>
                    <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider ${
                            row.role === Role.ADMIN ? 'bg-purple-100 text-purple-700' :
                            row.role === Role.OFFICER ? 'bg-indigo-100 text-indigo-700' : 
                            'bg-gray-100 text-gray-600'
                        }`}>
                            {row.role}
                        </span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-500">{row.basePoints}</td>
                    <td className="px-4 py-3 text-center text-gray-500">{row.gamePoints}</td>
                    <td className="px-4 py-3 text-center text-[#FFB81C] font-bold">{row.bonusPoints > 0 ? `+${row.bonusPoints}` : '-'}</td>
                    <td className="px-4 py-3 text-right font-bold text-lg text-[#154734]">
                        {row.totalPoints}
                    </td>
                </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
