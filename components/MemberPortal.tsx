
import React, { useMemo, useState } from 'react';
import { Member, AppState, Game, Role } from '../types';
import { LogOut, Trophy, MapPin, Calendar as CalendarIcon, CheckCircle2, XCircle, LayoutList, X, Clock, Settings, Edit } from 'lucide-react';
import { GameCalendar } from './GameCalendar';
import { SettingsModal } from './SettingsModal';
import { Management } from './Management';
import { Leaderboard } from './Leaderboard';
import { SelfieContest } from './SelfieContest';
import { Heart } from 'lucide-react';

interface MemberPortalProps {
    member: Member;
    data: AppState;
    onLogout: () => void;
    onUpdateProfile: (updates: Partial<Member>) => void; // Updated signature
    // Passing these down for Officer editing capabilities
    onAddGame?: (g: Game) => void;
    onDeleteGame?: (id: string) => void;
    onVote: (selfieId: string, memberId: string) => void;
    sports?: any[];
}

export const MemberPortal: React.FC<MemberPortalProps> = ({ member, data, onLogout, onUpdateProfile, onAddGame, onDeleteGame, onVote, sports }) => {
    const [view, setView] = useState<'leaderboard' | 'vote' | 'stats' | 'calendar' | 'edit_calendar'>('leaderboard');
    const [selectedDay, setSelectedDay] = useState<Date | null>(null);
    const [showDayModal, setShowDayModal] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [statsMode, setStatsMode] = useState<'all' | 'my'>('all');

    const canEdit = member.role === Role.OFFICER || member.role === Role.ADMIN;

    const stats = useMemo(() => {
        const isMySports = statsMode === 'my';
        const mySportIds = [member.fallSportId, member.springSportId].filter(Boolean);

        // Filter games based on mode
        const relevantGames = data.games.filter(g => {
            const isHome = g.location === 'Home';
            if (!isHome) return false;
            if (isMySports) {
                return mySportIds.includes(g.sportId);
            }
            return true;
        });

        let attended = 0;
        relevantGames.forEach(g => {
            if (data.attendance[g.id]?.[member.id]) attended++;
        });

        // Denominator: Games that count towards requirement (exclude bonus)
        const denominatorGames = relevantGames.filter(g => !g.isBonus);

        // Percentage: (Attended / Required) * 100. Capped at 100? No, let it go over for extra credit feel.
        const percentage = denominatorGames.length > 0 ? Math.round((attended / denominatorGames.length) * 100) : (attended > 0 ? 100 : 0);

        // Stats by sport
        const bySport = data.sports.map(sport => {
            const sportHomeGames = data.games.filter(g => g.sportId === sport.id && g.location === 'Home');

            // Attended count includes bonus games
            let sportAttended = 0;
            sportHomeGames.forEach(g => {
                if (data.attendance[g.id]?.[member.id]) sportAttended++;
            });

            // Target based only on NON-bonus games
            const sportNonBonusGames = sportHomeGames.filter(g => !g.isBonus);
            const threshold = sport.attendanceThreshold || 0.5;
            const target = Math.ceil(sportNonBonusGames.length * threshold);

            // Needed: Target - Attended (can be 0 if enough bonus games make up for it)
            const needed = Math.max(0, target - sportAttended);

            // Percentage based on target being 100%
            // If target is 0 (no games), but attended > 0, give 100%.
            let sportPercentage = 0;
            if (target > 0) {
                sportPercentage = Math.round((sportAttended / target) * 100); // Wait, usually % is of total games, not target.
                // Actually, user said "do not add one to the total number of home games".
                // So "Attendance Percentage" usually means "Games Attended / Total Games".
                // If we exclude bonus from denominator, then it is Attended / NonBonusTotal.
            } else if (sportNonBonusGames.length > 0) {
                sportPercentage = Math.round((sportAttended / sportNonBonusGames.length) * 100);
            }

            // Let's stick to the "Total Games" view for percentage, but exclude bonus from denominator
            const sportDenominator = sportNonBonusGames.length;
            const displayPercentage = sportDenominator > 0 ? Math.round((sportAttended / sportDenominator) * 100) : (sportAttended > 0 ? 100 : 0);

            return {
                id: sport.id,
                name: sport.name,
                total: sportDenominator, // Show Total as Non-Bonus Total (Required Base)
                attended: sportAttended,
                percentage: displayPercentage,
                needed,
                isPrimary: mySportIds.includes(sport.id)
            };
        });

        return { attended, total: denominatorGames.length, percentage, bySport };
    }, [data, member.id, statsMode, member.fallSportId, member.springSportId]);

    // Get recent history (all games, including away/neutral, to show activity)
    const history = data.games
        .filter(g => data.attendance[g.id]?.[member.id])
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    // User requested Jan -> Dec (Oldest to Newest), so we remove the slice or keep it?
    // Usually history is recent, but user said "Jan 1 down to Dec 31".
    // I will remove the slice to show the full season history in order.

    const handleDayClick = (date: Date) => {
        setSelectedDay(date);
        setShowDayModal(true);
    };

    return (
        <div className="min-h-screen bg-gray-100">
            <header className="bg-[#154734] text-white shadow-lg sticky top-0 z-30">
                <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#FFB81C] text-[#154734] rounded-lg flex items-center justify-center font-bold text-xl shadow-sm">BP</div>
                        <div>
                            <h1 className="text-lg font-bold leading-tight">Bear Pit Tracker</h1>
                            <p className="text-xs text-[#FFB81C] font-medium">Member Portal</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setShowSettings(true)} className="flex items-center gap-2 text-sm bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full transition-colors">
                            <Settings className="w-4 h-4" /> Profile & Settings
                        </button>
                        <button onClick={onLogout} className="flex items-center gap-2 text-sm bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full transition-colors">
                            <LogOut className="w-4 h-4" /> Sign Out
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
                {/* Welcome Card */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-[#154734]">Welcome, {member.firstName}!</h2>
                        <p className="text-gray-600">
                            Role: <span className="font-medium text-[#154734]">{member.role}</span>
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2 bg-gray-100 p-1 rounded-lg">
                        <button
                            onClick={() => setView('leaderboard')}
                            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-bold transition-all ${view === 'leaderboard' ? 'bg-white text-[#154734] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <Trophy className="w-4 h-4" /> Leaderboard
                        </button>
                        <button
                            onClick={() => setView('vote')}
                            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-bold transition-all ${view === 'vote' ? 'bg-white text-[#154734] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <Heart className="w-4 h-4" /> Vote
                        </button>
                        <button
                            onClick={() => setView('stats')}
                            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-bold transition-all ${view === 'stats' ? 'bg-white text-[#154734] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <LayoutList className="w-4 h-4" /> My Stats
                        </button>
                        <button
                            onClick={() => setView('calendar')}
                            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-bold transition-all ${view === 'calendar' ? 'bg-white text-[#154734] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <CalendarIcon className="w-4 h-4" /> Calendar
                        </button>
                        {canEdit && (
                            <button
                                onClick={() => setView('edit_calendar')}
                                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-bold transition-all ${view === 'edit_calendar' ? 'bg-white text-[#154734] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                <Edit className="w-4 h-4" /> Manage
                            </button>
                        )}
                    </div>
                </div>

                {view === 'leaderboard' ? (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <Leaderboard data={data} />
                    </div>
                ) : view === 'vote' ? (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <SelfieContest data={data} currentMember={member} onVote={onVote} />
                    </div>
                ) : view === 'edit_calendar' && canEdit && sports && onAddGame && onDeleteGame ? (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-white p-4 rounded-xl border border-gray-200">
                            <Management
                                members={[]}
                                games={data.games}
                                sports={sports}
                                onAddMember={() => { }}
                                onDeleteMember={() => { }}
                                onAddGame={onAddGame}
                                onDeleteGame={onDeleteGame}
                                userRole={member.role}
                            />
                            <div className="mt-2 text-center text-xs text-gray-400">
                                Restricted View: Member management disabled in this portal.
                            </div>
                        </div>
                    </div>
                ) : view === 'stats' ? (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                        {/* Mode Toggle */}
                        <div className="flex justify-end">
                            <div className="bg-white p-1 rounded-lg border border-gray-200 flex gap-1 shadow-sm">
                                <button
                                    onClick={() => setStatsMode('all')}
                                    className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${statsMode === 'all' ? 'bg-[#154734] text-white' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    All Sports
                                </button>
                                <button
                                    onClick={() => setStatsMode('my')}
                                    className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${statsMode === 'my' ? 'bg-[#154734] text-white' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    My Sports
                                </button>
                            </div>
                        </div>

                        {/* Key Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-[#154734] rounded-xl p-6 text-white shadow-md border border-[#0f3325]">
                                <p className="text-[#FFB81C] text-sm font-bold uppercase tracking-wide">
                                    {statsMode === 'my' ? 'My Requirements Progress' : 'Home Game Attendance'}
                                </p>
                                <div className="mt-2 flex items-baseline gap-2">
                                    <span className="text-4xl font-bold">{stats.percentage}%</span>
                                </div>
                                <div className="mt-4 h-2 bg-black/30 rounded-full overflow-hidden">
                                    <div className="h-full bg-[#FFB81C] rounded-full" style={{ width: `${stats.percentage}%` }}></div>
                                </div>
                            </div>

                            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 flex flex-col justify-center">
                                <p className="text-gray-500 text-sm font-medium uppercase tracking-wide">Games Attended</p>
                                <div className="mt-2 flex items-baseline gap-1">
                                    <span className="text-3xl font-bold text-gray-900">{stats.attended}</span>
                                    <span className="text-gray-400">/ {stats.total} {statsMode === 'my' ? 'Required Games' : 'Home Games'}</span>
                                </div>
                            </div>

                            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                                <p className="text-gray-500 text-sm font-medium uppercase tracking-wide mb-4">
                                    {statsMode === 'my' ? 'My Sports Breakdown' : 'Breakdown by Sport'}
                                </p>
                                <div className="space-y-3 max-h-[150px] overflow-y-auto pr-2 scrollbar-thin">
                                    {stats.bySport
                                        .filter(s => statsMode === 'all' || s.isPrimary)
                                        .map(s => (
                                            <div key={s.name} className="flex flex-col gap-1">
                                                <div className="flex items-center justify-between text-sm">
                                                    <span className="text-gray-700 truncate font-medium">
                                                        {s.name} {s.isPrimary && <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded ml-1">PRIMARY</span>}
                                                    </span>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-gray-400 text-xs">{s.attended}/{s.total}</span>
                                                        <span className={`font-bold ${s.percentage >= 75 ? 'text-[#154734]' : s.percentage >= 50 ? 'text-yellow-600' : 'text-gray-400'}`}>
                                                            {s.percentage}%
                                                        </span>
                                                    </div>
                                                </div>
                                                {s.isPrimary && s.needed > 0 && (
                                                    <div className="text-[10px] text-red-500 font-bold flex items-center gap-1">
                                                        <XCircle className="w-3 h-3" /> Needs {s.needed} more game{s.needed > 1 ? 's' : ''} to meet requirement
                                                    </div>
                                                )}
                                                {s.isPrimary && s.needed === 0 && s.total > 0 && (
                                                    <div className="text-[10px] text-green-600 font-bold flex items-center gap-1">
                                                        <CheckCircle2 className="w-3 h-3" /> Requirement met
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                </div>
                            </div>
                        </div>

                        {/* Recent History */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                                <h3 className="font-bold text-gray-800">Recent Attendance History</h3>
                            </div>
                            <div className="divide-y divide-gray-100">
                                {history.length > 0 ? history.map(game => (
                                    <div key={game.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                                        <div className="flex items-center gap-4">
                                            <div className="bg-green-100 p-2 rounded-full text-[#154734]">
                                                <CheckCircle2 className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900">{game.opponent}</p>
                                                <div className="flex items-center gap-3 text-xs text-gray-500">
                                                    <span className="flex items-center gap-1"><CalendarIcon className="w-3 h-3" /> {game.date}</span>
                                                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {game.location}</span>
                                                </div>
                                            </div>
                                        </div>
                                        {game.isBonus && (
                                            <span className="bg-[#FFB81C]/20 text-yellow-800 text-xs px-2 py-1 rounded-full flex items-center gap-1 font-medium">
                                                <Trophy className="w-3 h-3 text-[#FFB81C]" /> Bonus
                                            </span>
                                        )}
                                    </div>
                                )) : (
                                    <div className="p-8 text-center text-gray-500">
                                        No attendance records found yet.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 h-[600px] max-h-[80vh]">
                        <GameCalendar
                            games={data.games}
                            sports={data.sports}
                            onDayClick={handleDayClick}
                        // No context menu for members
                        />
                    </div>
                )}

                {/* Read-Only Day Details Modal (Only used in read-only calendar view) */}
                {showDayModal && selectedDay && view !== 'edit_calendar' && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden">
                            <div className="bg-[#154734] p-4 flex justify-between items-center">
                                <div className="flex items-center gap-2 text-white">
                                    <div className="bg-[#FFB81C] text-[#154734] w-8 h-8 rounded flex items-center justify-center font-bold text-lg">
                                        {selectedDay.getDate()}
                                    </div>
                                    <div>
                                        <h3 className="font-bold leading-tight">{selectedDay.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h3>
                                        <p className="text-xs text-white/80 uppercase tracking-wide font-medium">{selectedDay.toLocaleDateString('en-US', { weekday: 'long' })}</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowDayModal(false)} className="text-white/70 hover:text-white">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-4 max-h-[60vh] overflow-y-auto bg-gray-50">
                                <div className="space-y-3">
                                    {(() => {
                                        const dateStr = `${selectedDay.getFullYear()}-${String(selectedDay.getMonth() + 1).padStart(2, '0')}-${String(selectedDay.getDate()).padStart(2, '0')}`;
                                        const daysGames = data.games.filter(g => g.date === dateStr);

                                        if (daysGames.length === 0) {
                                            return <div className="text-center py-8 text-gray-500 italic">No games scheduled for this day.</div>
                                        }

                                        return daysGames.map(game => (
                                            <div key={game.id} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                                                <div>
                                                    <div className="font-bold text-gray-900 flex items-center gap-2">
                                                        {game.opponent}
                                                        {game.isBonus && <Trophy className="w-3 h-3 text-[#FFB81C]" />}
                                                    </div>
                                                    <div className="text-xs text-gray-500 flex items-center gap-3 mt-1">
                                                        <span className="flex items-center gap-1 bg-gray-100 px-1.5 py-0.5 rounded">
                                                            <Clock className="w-3 h-3" /> {game.time || 'TBA'}
                                                        </span>
                                                        <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${game.location === 'Home' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                                            }`}>
                                                            <MapPin className="w-3 h-3" /> {game.location}
                                                        </span>
                                                        <span className="text-gray-400 italic">
                                                            {data.sports.find(s => s.id === game.sportId)?.name}
                                                        </span>
                                                    </div>
                                                    {game.description && (
                                                        <div className="mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded border border-gray-100">
                                                            {game.description}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ));
                                    })()}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <SettingsModal
                    isOpen={showSettings}
                    onClose={() => setShowSettings(false)}
                    member={member}
                    sports={data.sports}
                    onUpdateProfile={onUpdateProfile}
                />
            </main>
        </div>
    );
};
