
import React from 'react';
import { AppState } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Users, CalendarDays, Trophy, Medal, Home, Download } from 'lucide-react';

interface DashboardProps {
  data: AppState;
}

export const Dashboard: React.FC<DashboardProps> = ({ data }) => {
  // Calculate total attendance for leaderboard (HOME GAMES ONLY)
  const leaderBoard = data.members.map(member => {
    let totalAttended = 0;
    let totalBonus = 0;
    
    // Iterate through games, filter only Home
    data.games.filter(g => g.location === 'Home').forEach(game => {
        const attendees = data.attendance[game.id];
        if (attendees && attendees[member.id]) {
            totalAttended++;
            if (game.isBonus) totalBonus++;
        }
    });

    return {
      name: `${member.firstName} ${member.lastName}`,
      attended: totalAttended,
      bonus: totalBonus,
      role: member.role
    };
  }).sort((a, b) => b.attended - a.attended).slice(0, 10);

  // Chart Data: Average Attendance per Sport (HOME GAMES ONLY)
  const sportStats = data.sports.map(sport => {
    const sportHomeGames = data.games.filter(g => g.sportId === sport.id && g.location === 'Home');
    if (sportHomeGames.length === 0) return { name: sport.name, avg: 0 };

    let totalPresence = 0;
    sportHomeGames.forEach(game => {
       const attendees = data.attendance[game.id];
       if (attendees) {
           totalPresence += Object.values(attendees).filter(Boolean).length;
       }
    });

    const avg = Math.round(totalPresence / sportHomeGames.length);
    return { name: sport.name, avg };
  });

  // Count only home games for display
  const homeGamesCount = data.games.filter(g => g.location === 'Home').length;

  const handleExportCSV = () => {
    // Create a comprehensive CSV
    // Format: Member Name, Role, Total Home Games, Total Bonus, [List of Sports %]
    
    // Header
    let csvContent = "data:text/csv;charset=utf-8,";
    const header = ["First Name", "Last Name", "Role", "Total Home Attendance", "Attendance %", "Bonus Points"];
    
    // Add sport specific headers
    data.sports.forEach(s => header.push(`${s.name} %`));
    
    csvContent += header.join(",") + "\r\n";

    // Rows
    data.members.forEach(member => {
        const homeGames = data.games.filter(g => g.location === 'Home');
        let attendedCount = 0;
        let bonusCount = 0;
        
        homeGames.forEach(g => {
            if(data.attendance[g.id]?.[member.id]) {
                attendedCount++;
                if(g.isBonus) bonusCount++;
            }
        });
        
        const totalPerc = homeGames.length > 0 ? (attendedCount / homeGames.length * 100).toFixed(1) : "0.0";
        
        const row = [
            member.firstName, 
            member.lastName, 
            member.role, 
            attendedCount, 
            `${totalPerc}%`,
            bonusCount
        ];

        // Sport specifics
        data.sports.forEach(s => {
            const sportHome = data.games.filter(g => g.sportId === s.id && g.location === 'Home');
            let sAttended = 0;
            sportHome.forEach(g => {
                if(data.attendance[g.id]?.[member.id]) sAttended++;
            });
            const sPerc = sportHome.length > 0 ? (sAttended / sportHome.length * 100).toFixed(1) : "0.0";
            row.push(`${sPerc}%`);
        });

        csvContent += row.join(",") + "\r\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Bear_Pit_Data_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-[#154734] bg-green-50 p-3 rounded-lg border border-green-100 flex-1">
            <Home className="w-4 h-4 shrink-0" />
            <span>Statistics are calculated based on <strong>Home Games</strong> only.</span>
          </div>
          <button 
            onClick={handleExportCSV}
            className="bg-[#154734] text-white px-4 py-2 rounded-lg font-bold hover:bg-[#0f3325] flex items-center gap-2 shadow-sm transition-colors"
          >
            <Download className="w-4 h-4" /> Export Data (CSV)
          </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4 border-l-4 border-l-[#154734]">
            <div className="p-3 bg-green-100 text-[#154734] rounded-lg">
                <Users className="w-6 h-6" />
            </div>
            <div>
                <p className="text-sm text-gray-500">Total Members</p>
                <p className="text-2xl font-bold text-gray-900">{data.members.length}</p>
            </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4 border-l-4 border-l-[#FFB81C]">
            <div className="p-3 bg-yellow-100 text-yellow-600 rounded-lg">
                <CalendarDays className="w-6 h-6" />
            </div>
            <div>
                <p className="text-sm text-gray-500">Tracked Home Games</p>
                <p className="text-2xl font-bold text-gray-900">{homeGamesCount}</p>
            </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="p-3 bg-gray-100 text-gray-600 rounded-lg">
                <Trophy className="w-6 h-6" />
            </div>
            <div>
                <p className="text-sm text-gray-500">Active Sports</p>
                <p className="text-2xl font-bold text-gray-900">{data.sports.length}</p>
            </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
                <Medal className="w-6 h-6" />
            </div>
            <div>
                <p className="text-sm text-gray-500">Top Attendee</p>
                <p className="text-lg font-bold text-gray-900 truncate max-w-[120px]">{leaderBoard[0]?.name || 'N/A'}</p>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-[#154734] mb-4">Avg. Attendance (Home Games)</h3>
            <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sportStats}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" hide />
                        <YAxis />
                        <Tooltip 
                            cursor={{fill: '#f3f4f6'}}
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Legend />
                        <Bar dataKey="avg" name="Avg. Members" fill="#154734" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 justify-center text-xs text-gray-500">
                {sportStats.map((s, i) => (
                    <span key={i} className="bg-gray-100 px-2 py-1 rounded">{s.name}</span>
                ))}
            </div>
        </div>

        {/* Leaderboard */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-[#154734] mb-4">Top 10 Leaderboard (Home Games)</h3>
            <div className="overflow-hidden">
                <table className="w-full text-sm text-left text-gray-500">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                        <tr>
                            <th className="px-4 py-3">Rank</th>
                            <th className="px-4 py-3">Name</th>
                            <th className="px-4 py-3 text-center">Games</th>
                            <th className="px-4 py-3 text-center">Bonus</th>
                        </tr>
                    </thead>
                    <tbody>
                        {leaderBoard.map((member, index) => (
                            <tr key={index} className="bg-white border-b hover:bg-gray-50">
                                <td className="px-4 py-3 font-medium text-gray-900">
                                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                                </td>
                                <td className="px-4 py-3 text-gray-900">
                                    {member.name}
                                    <span className="ml-2 text-xs text-gray-400">
                                        ({member.role === 'Admin' ? 'Adm' : member.role === 'Officer' ? 'Off' : 'Mem'})
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-center font-bold text-[#154734]">{member.attended}</td>
                                <td className="px-4 py-3 text-center text-[#FFB81C] font-bold">{member.bonus}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      </div>
    </div>
  );
};
