
import React, { useMemo, useState } from 'react';
import { Member, AppState, Game, Role, ClubEvent } from '../types';
import { LogOut, Trophy, MapPin, Calendar as CalendarIcon, CheckCircle2, LayoutList, X, Clock, Settings, Edit, Sparkles, TrendingUp, ClipboardList, Plus } from 'lucide-react';
import { GameCalendar } from './GameCalendar';
import { SettingsModal } from './SettingsModal';
import { Management } from './Management';
import { Leaderboard } from './Leaderboard';
import { FAN_TIERS } from '../constants';
import { formatLocalDate, parseLocalDate } from '../utils/dateUtils';
import { computeLifetimeStats, gamePointValue } from '../utils/fanTier';
import { semesterOf, currentSemester } from '../utils/semester';

const formatUpcomingDate = (dateStr: string) =>
    parseLocalDate(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

// "19:00" -> "7:00 PM"
const formatTime = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    if (Number.isNaN(h)) return time;
    return `${h % 12 || 12}:${String(m || 0).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

interface MemberPortalProps {
    member: Member;
    data: AppState;
    onLogout: () => void;
    onUpdateProfile: (updates: Partial<Member>, memberId?: string, actingPassword?: string) => Promise<string | null | void> | void;
    // Passing these down for Officer editing capabilities
    onAddGame?: (g: Game) => void;
    onDeleteGame?: (id: string) => void;
    onVote: (selfieId: string, memberId: string) => void;
    sports?: any[];
    onAddClubEvent?: (event: Omit<ClubEvent, 'id'>) => void;
    onDeleteClubEvent?: (id: string) => void;
    onSignUpForEvent?: (eventId: string, memberId: string) => void;
    onCancelSignup?: (signupId: string) => void;
}

export const MemberPortal: React.FC<MemberPortalProps> = ({ member, data, onLogout, onUpdateProfile, onAddGame, onDeleteGame, onVote, sports, onAddClubEvent, onDeleteClubEvent, onSignUpForEvent, onCancelSignup }) => {
    // 'vote' (selfie contest) tab removed 2026-10-02 while the selfie gallery is broken.
    const [view, setView] = useState<'leaderboard' | 'stats' | 'calendar' | 'events' | 'edit_calendar'>('leaderboard');
    const [selectedDay, setSelectedDay] = useState<Date | null>(null);
    const [showDayModal, setShowDayModal] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    const canEdit = member.role === Role.OFFICER || member.role === Role.ADMIN;

    // Points-focused breakdown (replaces the old home-game attendance-%
    // view -- see the 2026-09-21 leadership call notes: members should see
    // "here's the category you're getting points in, here's what you need
    // for the next level" instead of a single attendance percentage against
    // a spring/fall sport threshold).
    const stats = useMemo(() => {
        const { totalPoints, categories, categoriesEarned, tier, myBonusPoints } = computeLifetimeStats(member, data);

        // Recent activity feed: combine game check-ins + manual bonus point
        // entries into one "where are my points coming from" timeline.
        const gameHistory = data.games
            .filter(g => data.attendance[g.id]?.[member.id])
            .map(g => ({
                kind: 'game' as const,
                date: g.date,
                label: g.opponent,
                sub: g.location,
                points: gamePointValue(g),
                isBonus: g.isBonus,
            }));
        const bonusHistory = myBonusPoints.map(b => ({
            kind: 'bonus' as const,
            date: b.date,
            label: b.reason,
            sub: b.category || 'Other',
            points: b.points,
            isBonus: false,
        }));
        const activity = [...gameHistory, ...bonusHistory].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const thisSemester = currentSemester();
        const semesterPoints = activity
            .filter(a => semesterOf(a.date).key === thisSemester.key)
            .reduce((sum, a) => sum + a.points, 0);

        return { totalPoints, categories, categoriesEarned, tier, activity, semesterPoints, semesterLabel: thisSemester.label };
    }, [data, member.id, member.role]);

    // Next few games + club events, shown above the leaderboard.
    const upcoming = useMemo(() => {
        const today = formatLocalDate(new Date());
        const games = data.games
            .filter(g => g.date.slice(0, 10) >= today)
            .map(g => ({
                id: `g_${g.id}`,
                kind: 'game' as const,
                date: g.date.slice(0, 10),
                time: g.time,
                title: `${data.sports.find(s => s.id === g.sportId)?.name || 'Game'} vs ${g.opponent}`,
                sub: g.location,
                points: gamePointValue(g),
                isBonus: g.isBonus,
            }));
        const events = data.clubEvents
            .filter(e => e.date >= today)
            .map(e => ({
                id: `e_${e.id}`,
                kind: 'event' as const,
                date: e.date,
                time: e.time,
                title: e.title,
                sub: e.location || '',
                points: e.pointsValue,
                isBonus: false,
            }));
        return [...games, ...events]
            .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))
            .slice(0, 6);
    }, [data.games, data.clubEvents, data.sports]);

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
                            <h1 className="text-lg font-bold leading-tight">BearPit Tracker</h1>
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

            <main className="max-w-5xl mx-auto px-4 pt-6 pb-24 space-y-6">
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
                        <button
                            onClick={() => setView('events')}
                            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-bold transition-all ${view === 'events' ? 'bg-white text-[#154734] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <ClipboardList className="w-4 h-4" /> Sign Up
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
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                        {/* Upcoming -- so members don't have to dig through the calendar tab */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                    <CalendarIcon className="w-4 h-4" /> Upcoming Events
                                </h3>
                                <button onClick={() => setView('calendar')} className="text-xs font-bold text-[#154734] hover:underline">Full calendar</button>
                            </div>
                            <div className="divide-y divide-gray-100">
                                {upcoming.length > 0 ? upcoming.map(u => (
                                    <div key={u.id} className="px-6 py-3 flex items-center justify-between gap-4">
                                        <div className="min-w-0">
                                            <p className="font-bold text-gray-900 truncate">{u.title}</p>
                                            <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                                                <span className="flex items-center gap-1"><CalendarIcon className="w-3 h-3" /> {formatUpcomingDate(u.date)}{u.time ? ` · ${formatTime(u.time)}` : ''}</span>
                                                {u.sub && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {u.sub}</span>}
                                            </div>
                                        </div>
                                        {u.kind === 'event' ? (
                                            <button onClick={() => setView('events')} className="text-xs font-bold text-[#154734] bg-[#FFB81C] hover:bg-yellow-400 px-3 py-1.5 rounded-lg shrink-0">
                                                Sign Up
                                            </button>
                                        ) : (
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${u.isBonus ? 'bg-[#FFB81C]/20 text-yellow-800' : 'bg-[#154734]/10 text-[#154734]'}`}>
                                                +{u.points} pt{u.points === 1 ? '' : 's'}
                                            </span>
                                        )}
                                    </div>
                                )) : (
                                    <div className="p-6 text-center text-gray-500 text-sm">Nothing on the schedule yet. Check back soon.</div>
                                )}
                            </div>
                        </div>
                        <Leaderboard data={data} />
                    </div>
                ) : view === 'edit_calendar' && canEdit && sports && onAddGame && onDeleteGame ? (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-white p-4 rounded-xl border border-gray-200">
                            <Management
                                members={[]}
                                games={data.games}
                                sports={sports}
                                bonusPoints={[]}
                                onAddMember={() => { }}
                                onDeleteMember={() => { }}
                                onAddGame={onAddGame}
                                onDeleteGame={onDeleteGame}
                                onUpdateProfile={onUpdateProfile}
                                onAddBonusPoint={() => { }}
                                onDeleteBonusPoint={() => { }}
                                clubEvents={data.clubEvents}
                                eventSignups={data.eventSignups}
                                onAddClubEvent={onAddClubEvent}
                                onDeleteClubEvent={onDeleteClubEvent}
                                userRole={member.role}
                            />
                            <div className="mt-2 text-center text-xs text-gray-400">
                                Restricted View: Member management &amp; the Points Manager tab are disabled in this portal. Use Club Events here to create tabling signups.
                            </div>
                        </div>
                    </div>
                ) : view === 'stats' ? (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                        {/* Total Points */}
                        <div className="bg-[#154734] rounded-xl p-6 text-white shadow-md border border-[#0f3325] flex items-center justify-between">
                            <div className="flex gap-8">
                                <div>
                                    <p className="text-[#FFB81C] text-sm font-bold uppercase tracking-wide">{stats.semesterLabel}</p>
                                    <div className="mt-1 flex items-baseline gap-2">
                                        <span className="text-4xl font-bold">{stats.semesterPoints}</span>
                                        <span className="text-xs text-white/60">leaderboard</span>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-[#FFB81C] text-sm font-bold uppercase tracking-wide">Lifetime</p>
                                    <div className="mt-1 flex items-baseline gap-2">
                                        <span className="text-4xl font-bold">{stats.totalPoints}</span>
                                        <span className="text-xs text-white/60">fan level</span>
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[#FFB81C] text-sm font-bold uppercase tracking-wide">Fan Level</p>
                                <p className="mt-1 text-2xl font-extrabold">{stats.tier.name}</p>
                            </div>
                        </div>

                        {/* Progress to the next fan tier: points AND breadth */}
                        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                            {stats.tier.next ? (
                                <>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-bold text-gray-800">Next level: {stats.tier.next.name}</span>
                                        <span className="text-xs text-gray-500">{stats.totalPoints} / {FAN_TIERS.find(t => t.name === stats.tier.next!.name)!.minPoints} pts</span>
                                    </div>
                                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-[#154734] rounded-full transition-all" style={{ width: `${stats.tier.next.progressPct}%` }}></div>
                                    </div>
                                    <p className="text-sm text-gray-600 mt-3">
                                        {stats.tier.next.pointsNeeded > 0 && <>{stats.tier.next.pointsNeeded} more pts</>}
                                        {stats.tier.next.pointsNeeded > 0 && stats.tier.next.categoriesNeeded > 0 && ' and '}
                                        {stats.tier.next.categoriesNeeded > 0 && <>points in {stats.tier.next.categoriesNeeded} more categor{stats.tier.next.categoriesNeeded === 1 ? 'y' : 'ies'}</>}
                                        {' '}to reach {stats.tier.next.name}.
                                    </p>
                                </>
                            ) : (
                                <p className="font-bold text-[#154734]">You've reached the top level. Sic 'em!</p>
                            )}
                            <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-2">
                                {FAN_TIERS.map(t => (
                                    <div key={t.name} className={`rounded-lg p-2 text-center border ${t.name === stats.tier.name ? 'border-[#154734] bg-[#154734]/5' : 'border-gray-100'}`}>
                                        <p className="text-xs font-bold text-gray-800">{t.name}</p>
                                        <p className="text-[10px] text-gray-500">{t.minPoints === 0 ? 'Starting level' : `${t.minPoints}+ pts, ${t.minCategories} categories`}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Category Breakdown -- "here's the category you're getting points in" */}
                        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                            <p className="text-gray-500 text-sm font-medium uppercase tracking-wide mb-4 flex items-center gap-2">
                                <Sparkles className="w-4 h-4" /> Points by Category ({stats.categoriesEarned} earned)
                            </p>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {stats.categories.filter(cat => cat.name !== 'Other' || cat.points !== 0).map(cat => (
                                    <div key={cat.name} className={`border rounded-lg p-3 ${cat.points > 0 ? 'border-[#154734]/30' : 'border-gray-100'}`}>
                                        <span className="font-bold text-gray-800 text-sm">{cat.name}</span>
                                        <div className="flex items-baseline gap-1">
                                            <span className={`text-2xl font-bold ${cat.points > 0 ? 'text-[#154734]' : 'text-gray-300'}`}>{cat.points}</span>
                                            <span className="text-gray-400 text-xs">pts</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Recent Activity -- where points are coming from */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4" /> Recent Points Activity
                                </h3>
                            </div>
                            <div className="divide-y divide-gray-100 max-h-[70vh] overflow-y-auto">
                                {stats.activity.length > 0 ? stats.activity.map((a, idx) => (
                                    <div key={idx} className="p-4 flex items-center justify-between hover:bg-gray-50">
                                        <div className="flex items-center gap-4">
                                            <div className="bg-green-100 p-2 rounded-full text-[#154734]">
                                                <CheckCircle2 className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900">{a.label}</p>
                                                <div className="flex items-center gap-3 text-xs text-gray-500">
                                                    <span className="flex items-center gap-1"><CalendarIcon className="w-3 h-3" /> {a.date.slice(0, 10)}</span>
                                                    <span className="flex items-center gap-1">
                                                        {a.kind === 'game' ? <MapPin className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />} {a.sub}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {a.isBonus && (
                                                <span className="bg-[#FFB81C]/20 text-yellow-800 text-xs px-2 py-1 rounded-full flex items-center gap-1 font-medium">
                                                    <Trophy className="w-3 h-3 text-[#FFB81C]" /> Bonus
                                                </span>
                                            )}
                                            <span className={`text-sm font-bold ${a.points > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                {a.points > 0 ? '+' : ''}{a.points}
                                            </span>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="p-8 text-center text-gray-500">
                                        No points activity yet.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : view === 'events' ? (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-4">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                    <ClipboardList className="w-4 h-4" /> Sign Up for a Club Event
                                </h3>
                                <p className="text-xs text-gray-500 mt-1">Tabling shifts and other club events. Signing up claims a slot and awards the points automatically.</p>
                            </div>
                            <div className="divide-y divide-gray-100">
                                {[...data.clubEvents].sort((a, b) => a.date.localeCompare(b.date)).map(ev => {
                                    const taken = data.eventSignups.filter(s => s.eventId === ev.id).length;
                                    const mySignup = data.eventSignups.find(s => s.eventId === ev.id && s.memberId === member.id);
                                    const isFull = taken >= ev.maxSignups;
                                    return (
                                        <div key={ev.id} className="p-4 flex items-center justify-between gap-4 hover:bg-gray-50">
                                            <div>
                                                <p className="font-bold text-gray-900">{ev.title}</p>
                                                <div className="flex items-center gap-3 text-xs text-gray-500 mt-1 flex-wrap">
                                                    <span className="flex items-center gap-1"><CalendarIcon className="w-3 h-3" /> {ev.date}{ev.time ? ` · ${ev.time}` : ''}</span>
                                                    {ev.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {ev.location}</span>}
                                                    <span className="bg-[#154734]/10 text-[#154734] font-bold px-2 py-0.5 rounded-full">{ev.category} · +{ev.pointsValue} pts</span>
                                                    <span className={`font-bold ${isFull ? 'text-red-500' : 'text-gray-500'}`}>{taken}/{ev.maxSignups} slots filled</span>
                                                </div>
                                                {ev.description && <p className="text-xs text-gray-400 mt-1">{ev.description}</p>}
                                            </div>
                                            {mySignup ? (
                                                <button
                                                    onClick={() => onCancelSignup?.(mySignup.id)}
                                                    className="flex items-center gap-1 text-sm font-bold text-white bg-green-600 hover:bg-red-500 px-3 py-1.5 rounded-lg transition-colors shrink-0"
                                                    title="Click to cancel your signup"
                                                >
                                                    <CheckCircle2 className="w-4 h-4" /> You're In
                                                </button>
                                            ) : isFull ? (
                                                <span className="text-sm font-bold text-gray-400 px-3 py-1.5 shrink-0">Full</span>
                                            ) : (
                                                <button
                                                    onClick={() => onSignUpForEvent?.(ev.id, member.id)}
                                                    className="flex items-center gap-1 text-sm font-bold text-[#154734] bg-[#FFB81C] hover:bg-yellow-400 px-3 py-1.5 rounded-lg transition-colors shrink-0"
                                                >
                                                    <Plus className="w-4 h-4" /> Sign Up
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                                {data.clubEvents.length === 0 && (
                                    <div className="p-8 text-center text-gray-500">No club events posted yet — check back soon.</div>
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
                        <div role="dialog" aria-modal="true" aria-label="Day details" className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden">
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
                                <button type="button" aria-label="Close" onClick={() => setShowDayModal(false)} className="text-white/70 hover:text-white">
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
