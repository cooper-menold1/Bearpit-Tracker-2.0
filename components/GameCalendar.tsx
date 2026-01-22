import React, { useState } from 'react';
import { Game, Sport } from '../types';
import { ChevronLeft, ChevronRight, Trophy, List, Calendar } from 'lucide-react';
import { formatLocalDate, parseLocalDate } from '../utils/dateUtils';

interface GameCalendarProps {
    games: Game[];
    sports: Sport[];
    onDayClick: (date: Date) => void;
    onDayContextMenu?: (e: React.MouseEvent, date: Date) => void;
    headerActions?: React.ReactNode;
}

export const GameCalendar: React.FC<GameCalendarProps> = ({ games, sports, onDayClick, onDayContextMenu, headerActions }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
    const [selectedSportId, setSelectedSportId] = useState<string>('');

    const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

    // Filter games by sport
    const filteredGames = selectedSportId
        ? games.filter(g => g.sportId === selectedSportId)
        : games;

    // Sort games for list view
    const sortedGames = [...filteredGames].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50 flex-wrap gap-2">
                <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold text-[#154734] flex items-center gap-2">
                        <div className="w-8 h-8 bg-[#154734] text-[#FFB81C] rounded flex items-center justify-center text-sm">
                            {currentDate.toLocaleString('default', { month: 'short' })}
                        </div>
                        {viewMode === 'calendar' ? currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'All Events'}
                    </h2>

                    {/* View Toggle */}
                    <div className="flex bg-gray-200 rounded-lg p-0.5">
                        <button
                            onClick={() => setViewMode('calendar')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'calendar' ? 'bg-white shadow-sm text-[#154734]' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <Calendar className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-[#154734]' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <List className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <select
                        value={selectedSportId}
                        onChange={(e) => setSelectedSportId(e.target.value)}
                        className="bg-white text-[#154734] px-3 py-1.5 rounded-lg border border-gray-300 shadow-sm font-bold text-xs outline-none focus:ring-1 focus:ring-[#154734] hover:bg-gray-50 transition-colors"
                    >
                        <option value="">All Sports</option>
                        {sports.sort((a, b) => a.name.localeCompare(b.name)).map(sport => (
                            <option key={sport.id} value={sport.id}>{sport.name}</option>
                        ))}
                    </select>
                    {headerActions}
                    {viewMode === 'calendar' && (
                        <div className="flex bg-white rounded-lg border border-gray-300 shadow-sm">
                            <button onClick={prevMonth} className="p-2 hover:bg-gray-100 text-gray-600 border-r border-gray-300">
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <button onClick={nextMonth} className="p-2 hover:bg-gray-100 text-gray-600">
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Content */}
            {viewMode === 'calendar' ? (
                <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                    {/* Grid Header */}
                    <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50 shrink-0 sticky top-0 z-10">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                            <div key={day} className="py-2 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Grid Body */}
                    <div className="flex-1 overflow-y-auto min-h-0"><div className="grid grid-cols-7 bg-gray-200 gap-px border-b border-gray-200 h-full">
                        {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                            <div key={`empty-${i}`} className="bg-gray-50/50 min-h-[100px]"></div>
                        ))}

                        {Array.from({ length: daysInMonth }).map((_, i) => {
                            const day = i + 1;
                            const cellDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                            const dateStr = formatLocalDate(cellDate);
                            const daysGames = filteredGames.filter(g => g.date === dateStr);
                            const todayStr = formatLocalDate(new Date());
                            const isToday = dateStr === todayStr;

                            return (
                                <div
                                    key={day}
                                    className={`bg-white min-h-[100px] p-2 hover:bg-blue-50 transition-colors cursor-pointer relative group flex flex-col gap-1`}
                                    onClick={() => onDayClick(cellDate)}
                                    onContextMenu={(e) => onDayContextMenu && onDayContextMenu(e, cellDate)}
                                >
                                    <div className="flex justify-between items-start">
                                        <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-[#FFB81C] text-[#154734]' : 'text-gray-400 group-hover:text-gray-700'}`}>
                                            {day}
                                        </span>
                                        {daysGames.length > 0 && <span className="w-2 h-2 bg-red-500 rounded-full md:hidden"></span>}
                                    </div>

                                    <div className="flex-1 flex flex-col gap-1 overflow-hidden">
                                        {daysGames.map(game => (
                                            <div
                                                key={game.id}
                                                className={`text-[10px] px-1.5 py-1 rounded border shadow-sm truncate flex items-center gap-1 ${game.location === 'Home' ? 'bg-green-50 border-green-200 text-green-800' :
                                                    game.location === 'Away' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-gray-50 border-gray-200 text-gray-800'
                                                    }`}
                                                title={`${game.opponent} (${game.time})`}
                                            >
                                                {game.isBonus && <Trophy className="w-2 h-2 text-[#FFB81C] shrink-0" />}
                                                <span className="truncate font-semibold">{game.opponent}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                        {Array.from({ length: (7 - (daysInMonth + firstDayOfMonth) % 7) % 7 }).map((_, i) => (
                            <div key={`end-empty-${i}`} className="bg-gray-50/50 min-h-[100px]"></div>
                        ))}
                    </div>
                </div>
                </div>
            ) : (
                <div className="flex-1 overflow-auto bg-gray-50">
                    <div className="max-w-4xl mx-auto p-6 space-y-4">
                        {sortedGames.map(game => {
                            const date = new Date(game.date);
                            const sport = sports.find(s => s.id === game.sportId);
                            return (
                                <div key={game.id} onClick={() => onDayClick(parseLocalDate(game.date))} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between hover:bg-blue-50 cursor-pointer transition-colors group">
                                    <div className="flex items-center gap-4">
                                        <div className="bg-[#154734] text-white w-14 h-14 rounded-lg flex flex-col items-center justify-center shrink-0">
                                            <span className="text-xs font-bold uppercase">{date.toLocaleString('default', { month: 'short' })}</span>
                                            <span className="text-xl font-bold">{date.getDate()}</span>
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-900 text-lg group-hover:text-[#154734]">{game.opponent}</h3>
                                            <div className="flex items-center gap-3 text-sm text-gray-500">
                                                <span className="flex items-center gap-1 font-medium text-gray-700">
                                                    {sport?.name || game.sportId}
                                                </span>
                                                <span>•</span>
                                                <span>{game.time}</span>
                                                <span>•</span>
                                                <span className={`${game.location === 'Home' ? 'text-green-600 font-bold' : 'text-red-500'}`}>{game.location}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        {game.isBonus && (
                                            <span className="bg-[#FFB81C]/20 text-yellow-800 text-xs px-3 py-1 rounded-full flex items-center gap-1 font-bold">
                                                <Trophy className="w-3 h-3 text-[#FFB81C]" /> Bonus
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        {sortedGames.length === 0 && (
                            <div className="text-center p-8 text-gray-500">No games found.</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
