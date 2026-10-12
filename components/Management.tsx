import React, { useState, useEffect } from 'react';
import { Member, Game, Role, Sport, BonusPoint, ClubEvent, EventSignup } from '../types';
import { POINT_CATEGORIES } from '../constants';
import { parseOutlookCSV } from '../utils/importUtils';
import { Plus, Trash2, Pencil, Save, X, Calendar as CalendarIcon, MapPin, Upload, Trophy, History, Info, Sparkles, Mail, Copy, Check, FileSpreadsheet, Search } from 'lucide-react';
import { buildBulkMailto, downloadMailMergeCSV } from '../utils/emailTemplate';
import { matchSignups } from '../utils/signupImport';
import { GameCalendar } from './GameCalendar';
import { SettingsModal } from './SettingsModal';
import { AutoFillModal } from './AutoFillModal';
import { BugLog } from './BugLog';
import { gamePointValue } from '../utils/fanTier';

// Inline helper to avoid import issues
const convertInputToCST = (dateStr: string, timeStr: string, sourceTimeZone: string): { date: string, time: string } => {
    if (!dateStr || !timeStr) return { date: dateStr, time: timeStr };

    const [year, month, day] = dateStr.split('-').map(Number);
    const [hours, minutes] = timeStr.split(':').map(Number);

    let estimated = new Date(Date.UTC(year, month - 1, day, hours, minutes));

    const getPartsInZone = (d: Date, zone: string) => {
        const fmt = new Intl.DateTimeFormat('en-US', {
            timeZone: zone,
            year: 'numeric', month: 'numeric', day: 'numeric',
            hour: 'numeric', minute: 'numeric', second: 'numeric',
            hour12: false
        });
        const parts = fmt.formatToParts(d);
        const part = (type: string) => Number(parts.find(p => p.type === type)?.value);
        let h = part('hour');
        if (h === 24) h = 0;
        return {
            y: part('year'),
            m: part('month'),
            d: part('day'),
            h: h,
            min: part('minute')
        };
    };

    for (let i = 0; i < 3; i++) {
        const currentParts = getPartsInZone(estimated, sourceTimeZone);
        const currentAsUTC = Date.UTC(currentParts.y, currentParts.m - 1, currentParts.d, currentParts.h, currentParts.min);
        const targetAsUTC = Date.UTC(year, month - 1, day, hours, minutes);
        const diff = targetAsUTC - currentAsUTC;
        if (Math.abs(diff) < 1000) break;
        estimated = new Date(estimated.getTime() + diff);
    }

    const cstParts = getPartsInZone(estimated, 'America/Chicago');
    const pad = (n: number) => n.toString().padStart(2, '0');
    return {
        date: `${cstParts.y}-${pad(cstParts.m)}-${pad(cstParts.d)}`,
        time: `${pad(cstParts.h)}:${pad(cstParts.min)}`
    };
};

interface ManagementProps {
    members: Member[];
    games: Game[];
    sports: Sport[];
    bonusPoints: BonusPoint[];
    onAddMember: (m: Member) => void;
    onDeleteMember: (id: string) => void;
    onAddGame: (g: Game) => void;
    onDeleteGame: (id: string) => void;
    onUpdateProfile: (updates: Partial<Member>, memberId?: string, actingPassword?: string) => Promise<string | null | void> | void;
    onAddBonusPoint: (memberId: string, points: number, reason: string, category?: string) => void;
    onDeleteBonusPoint: (id: string) => void;
    onBulkAwardPoints?: (memberIds: string[], points: number, reason: string, category: string) => void;
    clubEvents?: ClubEvent[];
    eventSignups?: EventSignup[];
    onAddClubEvent?: (event: Omit<ClubEvent, 'id'>) => void;
    onDeleteClubEvent?: (id: string) => void;
    onAddSport?: (name: string) => Promise<string>;
    userRole?: Role;
}

export const Management: React.FC<ManagementProps> = ({
    members = [],
    games = [],
    sports = [],
    bonusPoints = [],
    onAddMember,
    onDeleteMember,
    onAddGame,
    onDeleteGame,
    onUpdateProfile,
    onAddBonusPoint,
    onDeleteBonusPoint,
    onBulkAwardPoints,
    clubEvents = [],
    eventSignups = [],
    onAddClubEvent,
    onDeleteClubEvent,
    onAddSport,
    userRole
}) => {
    const [activeTab, setActiveTab] = useState<'members' | 'games' | 'points' | 'events' | 'bugs'>('games');
    const [selectedProfileMember, setSelectedProfileMember] = useState<Member | null>(null);
    const [showAutoFill, setShowAutoFill] = useState(false);

    // Bulk email: select members (e.g. everyone Member/Officer/Admin) and
    // compose one shared message -- for things like sending meeting notes
    // out, where the content is different every time so there's no saved
    // template the way the applicant welcome email has.
    const [emailSelectedIds, setEmailSelectedIds] = useState<Set<string>>(new Set());
    const [showEmailCompose, setShowEmailCompose] = useState(false);
    const [emailSubject, setEmailSubject] = useState('');
    const [emailBody, setEmailBody] = useState('');

    const currentMembersAndAbove = members.filter(m => m.role !== Role.PROSPECTIVE && m.role !== Role.INACTIVE);

    const toggleEmailSelected = (id: string) => {
        setEmailSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };
    const allCurrentSelected = currentMembersAndAbove.length > 0 && currentMembersAndAbove.every(m => emailSelectedIds.has(m.id));
    const toggleSelectAllCurrent = () => {
        setEmailSelectedIds(allCurrentSelected ? new Set() : new Set(currentMembersAndAbove.map(m => m.id)));
    };

    const emailSelectedWithEmail = members.filter(m => emailSelectedIds.has(m.id) && m.email);
    const emailSelectedMissingEmail = members.filter(m => emailSelectedIds.has(m.id) && !m.email).length;
    const bulkMemberMailtoHref = emailSubject.trim() && emailSelectedWithEmail.length > 0
        ? buildBulkMailto(emailSubject, emailBody, emailSelectedWithEmail.map(m => m.email!))
        : undefined;

    const [memberEmailsCopied, setMemberEmailsCopied] = useState(false);
    // Copies everyone Member/Officer/Admin's email regardless of the compose
    // panel's selection state -- paste into Outlook's To/Bcc field alongside
    // a template pasted in manually, as a fallback that doesn't depend on
    // mailto: links or a particular default mail app being set up correctly.
    const copyAllCurrentMemberEmails = () => {
        const emails = currentMembersAndAbove.filter(m => m.email).map(m => m.email!);
        navigator.clipboard.writeText(emails.join('; ')).then(() => {
            setMemberEmailsCopied(true);
            setTimeout(() => setMemberEmailsCopied(false), 2000);
        });
    };

    useEffect(() => {
        if (members.length === 0) setActiveTab('games');
    }, [members]);

    // Editing State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [memberSearch, setMemberSearch] = useState('');
    const filteredMembers = (() => {
        const q = memberSearch.trim().toLowerCase();
        if (!q) return members;
        return members.filter(m =>
            `${m.firstName} ${m.lastName}`.toLowerCase().includes(q)
            || (m.email || '').toLowerCase().includes(q)
            || m.role.toLowerCase().includes(q)
        );
    })();

    // New/Edit Member State
    const [memberForm, setMemberForm] = useState<Partial<Member>>({
        firstName: '', lastName: '', role: Role.MEMBER, yearsInBPLT: 0, password: '', email: '', fallSportId: '', springSportId: '', isChair: false
    });
    // New/Edit Game State
    const [gameForm, setGameForm] = useState({
        sportId: sports && sports.length > 0 ? sports[0].id : '',
        date: '',
        time: '',
        timeZone: 'America/Chicago', // Default to CST
        opponent: '',
        location: 'Home',
        isBonus: false,
        pointsValue: 1, // Default to 1 point per game
        description: ''
    });

    // Points Management State
    const [selectedMemberId, setSelectedMemberId] = useState<string>('');
    const [manualPoints, setManualPoints] = useState<number>(0);
    const [pointsReason, setPointsReason] = useState<string>('');
    const [pointsCategory, setPointsCategory] = useState<string>(POINT_CATEGORIES[0]);

    // Bulk Award State -- same category/points/reason applied to several
    // members at once, for things an officer notices rather than a member
    // self-reports (hospitality duty, photography, etc).
    const [showBulkAward, setShowBulkAward] = useState(false);
    const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set());
    const [bulkPoints, setBulkPoints] = useState<number>(1);
    const [bulkReason, setBulkReason] = useState<string>('');
    const [bulkCategory, setBulkCategory] = useState<string>(POINT_CATEGORIES[0]);
    const toggleBulkSelected = (id: string) => {
        setBulkSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };
    // Sign-up sheet import: pre-checks everyone on an exported Box/Excel
    // sheet so the officer only has to pick category/points/reason.
    const [importUnmatched, setImportUnmatched] = useState<string[] | null>(null);
    const handleImportSignupSheet = async (file: File) => {
        const { matched, unmatched } = matchSignups(await file.text(), members);
        setBulkSelectedIds(new Set(matched.map(m => m.id)));
        setImportUnmatched(unmatched);
    };
    // Members already credited for this exact reason -- guards against
    // importing the same sheet twice.
    const bulkAlreadyAwarded = bulkReason.trim()
        ? members.filter(m => bulkSelectedIds.has(m.id) && bonusPoints.some(b => b.memberId === m.id && b.reason.trim().toLowerCase() === bulkReason.trim().toLowerCase()))
        : [];

    const handleSubmitBulkAward = () => {
        if (bulkSelectedIds.size === 0 || bulkPoints === 0 || !bulkReason || !onBulkAwardPoints) {
            alert("Select at least one member, a reason, and non-zero points.");
            return;
        }
        const skip = new Set(bulkAlreadyAwarded.map(m => m.id));
        onBulkAwardPoints(Array.from(bulkSelectedIds).filter(id => !skip.has(id)), bulkPoints, bulkReason, bulkCategory);
        setImportUnmatched(null);
        setBulkSelectedIds(new Set());
        setBulkPoints(1);
        setBulkReason('');
    };

    // Club Events (tabling signups) State
    const [eventForm, setEventForm] = useState({
        title: '', category: 'Marketing',
        date: '', time: '', location: '', maxSignups: 2, pointsValue: 1, description: ''
    });
    const handleSubmitEvent = () => {
        if (!eventForm.title || !eventForm.date || !onAddClubEvent) {
            alert("Please fill in at least a title and date.");
            return;
        }
        onAddClubEvent({ ...eventForm });
        setEventForm({ title: '', category: eventForm.category, date: '', time: '', location: '', maxSignups: 2, pointsValue: 1, description: '' });
    };

    // Modal States
    const [showGameModal, setShowGameModal] = useState(false);
    const [showDayDetails, setShowDayDetails] = useState(false);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);

    // --- Form Handlers ---
    const resetMemberForm = () => {
        setMemberForm({
            firstName: '', lastName: '', role: Role.MEMBER, yearsInBPLT: 0, password: '', email: '', fallSportId: '', springSportId: '', isChair: false
        });
        setEditingId(null);
    };

    const resetGameForm = () => {
        setGameForm({
            sportId: sports && sports.length > 0 ? sports[0].id : '',
            date: '',
            time: '',
            timeZone: 'America/Chicago',
            opponent: '',
            location: 'Home',
            isBonus: false,
            pointsValue: 1,
            description: ''
        });
        setEditingId(null);
        setShowGameModal(false);
    };

    const handleSaveMember = () => {
        if (!memberForm.firstName || !memberForm.lastName) return;

        if (editingId) {
            const oldMember = members.find(m => m.id === editingId);
            if (oldMember) {
                onAddMember({
                    ...oldMember,
                    firstName: memberForm.firstName,
                    lastName: memberForm.lastName,
                    role: memberForm.role as Role,
                    yearsInBPLT: memberForm.yearsInBPLT || 0,
                    fallSportId: memberForm.fallSportId || '',
                    springSportId: memberForm.springSportId || '',
                    isChair: memberForm.isChair || false,
                });
            }
        } else {
            onAddMember({
                id: Date.now().toString(),
                firstName: memberForm.firstName,
                lastName: memberForm.lastName,
                role: memberForm.role as Role,
                yearsInBPLT: memberForm.yearsInBPLT || 0,
                password: 'BPLT', // Default password for new members
                email: memberForm.email || '',
                fallSportId: memberForm.fallSportId || '',
                springSportId: memberForm.springSportId || '',
                isChair: memberForm.isChair || false,
            });
        }
        resetMemberForm();
    };

    const handleEditMember = (m: Member) => {
        setMemberForm({
            firstName: m.firstName,
            lastName: m.lastName,
            role: m.role,
            yearsInBPLT: m.yearsInBPLT,
            email: m.email,
            fallSportId: m.fallSportId,
            springSportId: m.springSportId,
            isChair: m.isChair,
        });
        setEditingId(m.id);
    };

    const handleSaveGame = () => {
        try {
            console.log("Attempting to save game...", gameForm);

            if (!gameForm.date || !gameForm.opponent || !gameForm.sportId) {
                alert("Please fill in checking Date, Opponent, and Sport.");
                return;
            }

            // Convert Input Time + TimeZone -> CST Date/Time
            let cstDate = gameForm.date;
            let cstTime = gameForm.time;

            try {
                const converted = convertInputToCST(
                    gameForm.date,
                    gameForm.time,
                    gameForm.timeZone
                );
                cstDate = converted.date;
                cstTime = converted.time;
            } catch (dtError: any) {
                // Fallback to raw if logic crashes
                console.error("Date conversion failed", dtError);
            }

            const gameData: Game = {
                id: editingId || Date.now().toString(),
                sportId: gameForm.sportId,
                date: cstDate,
                time: cstTime,
                opponent: gameForm.opponent,
                location: gameForm.location as any,
                isBonus: gameForm.isBonus,
                pointsValue: 1, // unused: game points come from gamePointValue()
                description: gameForm.description
            };

            onAddGame(gameData);
            resetGameForm();
        } catch (e: any) {
            alert("Error handling save: " + e.message);
            console.error(e);
        }
    };

    const handleEditGame = (g: Game) => {
        setGameForm({
            sportId: g.sportId,
            date: g.date,
            time: g.time ? g.time.slice(0, 5) : '',
            timeZone: 'America/Chicago', // Existing games are stored in CST
            opponent: g.opponent,
            location: g.location,
            isBonus: g.isBonus,
            pointsValue: g.pointsValue || 1,
            description: g.description || ''
        });
        setEditingId(g.id);
        setShowGameModal(true);
    };

    const handleDayClick = (date: Date) => {
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        setSelectedDate(dateStr);
        setShowDayDetails(true);
    };

    // Points Handling
    const handleSubmitPoints = () => {
        if (!selectedMemberId || manualPoints === 0 || !pointsReason) {
            alert("Please fill in all fields.");
            return;
        }
        onAddBonusPoint(selectedMemberId, manualPoints, pointsReason, pointsCategory);
        setManualPoints(0);
        setPointsReason('');
    };

    // --- Import Logic ---
    // (Removed)

    return (
        <div className="flex flex-col h-full max-w-6xl mx-auto relative">
            <div className="flex gap-4 mb-4 border-b border-gray-200 shrink-0 overflow-x-auto">
                <button
                    onClick={() => { setActiveTab('games'); resetMemberForm(); }}
                    className={`pb-2 px-4 font-medium transition-colors whitespace-nowrap ${activeTab === 'games' ? 'text-[#154734] border-b-2 border-[#154734]' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Games
                </button>
                {members.length > 0 && (
                    <button
                        onClick={() => { setActiveTab('members'); resetGameForm(); }}
                        className={`pb-2 px-4 font-medium transition-colors whitespace-nowrap ${activeTab === 'members' ? 'text-[#154734] border-b-2 border-[#154734]' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Members
                    </button>
                )}
                <button
                    onClick={() => { setActiveTab('points'); resetGameForm(); }}
                    className={`pb-2 px-4 font-medium transition-colors whitespace-nowrap ${activeTab === 'points' ? 'text-[#154734] border-b-2 border-[#154734]' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Points Manager
                </button>
                <button
                    onClick={() => { setActiveTab('events'); resetGameForm(); }}
                    className={`pb-2 px-4 font-medium transition-colors whitespace-nowrap ${activeTab === 'events' ? 'text-[#154734] border-b-2 border-[#154734]' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Club Events
                </button>
                <button
                    onClick={() => { setActiveTab('bugs'); resetGameForm(); }}
                    className={`pb-2 px-4 font-medium transition-colors whitespace-nowrap ${activeTab === 'bugs' ? 'text-[#154734] border-b-2 border-[#154734]' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Bug Log
                </button>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col min-h-0">

                {/* --- GAMES TAB --- */}
                {activeTab === 'games' && (
                    <div className="h-[600px] max-h-[80vh] relative">
                        <GameCalendar
                            games={games}
                            sports={sports}
                            onDayClick={handleDayClick}
                            onEditGame={handleEditGame}
                            onDeleteGame={(id) => { if (window.confirm('Delete game?')) onDeleteGame(id); }}
                            headerActions={
                                <>
                                    <button
                                        onClick={() => setShowAutoFill(true)}
                                        className="bg-[#154734] text-[#FFB81C] px-3 py-1.5 rounded-lg border border-[#154734] shadow-sm font-bold text-xs flex items-center gap-2 hover:bg-[#0f3325]"
                                    >
                                        <Sparkles className="w-3 h-3" /> Auto Fill
                                    </button>
                                </>
                            }
                        />

                        {/* Auto-Fill Modal */}
                        <AutoFillModal
                            isOpen={showAutoFill}
                            onClose={() => setShowAutoFill(false)}
                            existingSports={sports}
                            existingGames={games}
                            onAddGame={onAddGame}
                            onAddSport={onAddSport || (async (name) => {
                                console.warn("onAddSport not provided, skipping sport creation");
                                return "sport_unknown";
                            })}
                            userRole={userRole}
                        />

                        {/* Day Details Modal (New) */}
                        {showDayDetails && selectedDate && (
                            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                                <div role="dialog" aria-modal="true" aria-label="Games on selected day" className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[80vh]">
                                    <div className="bg-[#154734] p-4 flex justify-between items-center text-white shrink-0">
                                        <div>
                                            <h3 className="font-bold text-lg leading-none">{new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long' })}</h3>
                                            <p className="text-white/80 text-sm">{new Date(selectedDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                                        </div>
                                        <button type="button" aria-label="Close" onClick={() => setShowDayDetails(false)} className="text-white/70 hover:text-white"><X className="w-5 h-5" /></button>
                                    </div>

                                    <div className="p-4 overflow-y-auto flex-1 bg-gray-50 space-y-3">
                                        {games.filter(g => g.date === selectedDate).length === 0 ? (
                                            <div className="text-center py-6 text-gray-500 italic text-sm">No games scheduled.</div>
                                        ) : (
                                            games.filter(g => g.date === selectedDate).map(game => (
                                                <div key={game.id} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm relative group">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <div className="font-bold text-gray-900 flex items-center gap-2">
                                                                {game.opponent}
                                                                {game.isBonus && <Trophy className="w-3 h-3 text-[#FFB81C]" />}
                                                            </div>
                                                            <div className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                                                                <span className="flex items-center gap-1 bg-gray-100 px-1.5 py-0.5 rounded">
                                                                    <History className="w-3 h-3" /> {game.time || 'TBA'}
                                                                </span>
                                                                <span className={`px-1.5 py-0.5 rounded ${game.location === 'Home' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                                    {game.location}
                                                                </span>
                                                                <span className="text-gray-500 font-medium">
                                                                    {sports.find(s => s.id === game.sportId)?.name}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                                            <button type="button" aria-label={`Edit game vs ${game.opponent}`} onClick={() => { handleEditGame(game); setShowDayDetails(false); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Pencil className="w-3 h-3" /></button>
                                                            <button type="button" aria-label={`Delete game vs ${game.opponent}`} onClick={() => { if (window.confirm('Delete?')) onDeleteGame(game.id); }} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-3 h-3" /></button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>

                                    <div className="p-4 border-t border-gray-200 bg-white shrink-0">
                                        <button
                                            onClick={() => {
                                                setGameForm(prev => ({ ...prev, date: selectedDate }));
                                                setEditingId(null);
                                                setShowDayDetails(false);
                                                setShowGameModal(true);
                                            }}
                                            className="w-full bg-[#154734] text-white py-3 rounded-lg font-bold hover:bg-[#0f3325] flex items-center justify-center gap-2 shadow-md transition-transform active:scale-95"
                                        >
                                            <Plus className="w-5 h-5" /> Add New Game
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Add/Edit Game Modal (Previously existing) */}
                        {showGameModal && (
                            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                                <div role="dialog" aria-modal="true" aria-label={editingId ? 'Edit game' : 'Add new game'} className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="font-bold text-lg text-[#154734]">{editingId ? 'Edit Game' : 'Add New Game'}</h3>
                                        <button type="button" aria-label="Close" onClick={resetGameForm} className="text-gray-500 hover:text-gray-600"><X className="w-5 h-5" /></button>
                                    </div>

                                    <div className="space-y-3">
                                        <select
                                            aria-label="Sport"
                                            value={gameForm.sportId}
                                            onChange={e => setGameForm({ ...gameForm, sportId: e.target.value })}
                                            className="w-full border p-2 rounded focus:ring-2 focus:ring-[#154734] outline-none"
                                        >
                                            {sports.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>

                                        <div className="flex gap-2">
                                            <input type="date" aria-label="Game date" value={gameForm.date} onChange={e => setGameForm({ ...gameForm, date: e.target.value })} className="border p-2 rounded flex-1 focus:ring-2 focus:ring-[#154734] outline-none" />
                                            <input type="time" aria-label="Game time" value={gameForm.time} onChange={e => setGameForm({ ...gameForm, time: e.target.value })} className="border p-2 rounded w-32 focus:ring-2 focus:ring-[#154734] outline-none" />
                                        </div>

                                        <div className="flex items-center gap-2 border p-2 rounded bg-gray-50">
                                            <span className="text-gray-500 text-xs font-bold uppercase tracking-wider">Time Zone</span>
                                            <select
                                                aria-label="Time zone"
                                                value={gameForm.timeZone}
                                                onChange={e => setGameForm({ ...gameForm, timeZone: e.target.value })}
                                                className="bg-transparent text-sm w-full outline-none font-medium text-gray-700"
                                            >
                                                <option value="America/Chicago">Central Time (Waco, TX)</option>
                                                <option value="America/New_York">Eastern Time</option>
                                                <option value="America/Denver">Mountain Time</option>
                                                <option value="America/Phoenix">Arizona (No DST)</option>
                                                <option value="America/Los_Angeles">Pacific Time</option>
                                                <option value="Pacific/Honolulu">Hawaii</option>
                                            </select>
                                        </div>

                                        <input type="text" aria-label="Opponent" placeholder="Opponent" value={gameForm.opponent} onChange={e => setGameForm({ ...gameForm, opponent: e.target.value })} className="w-full border p-2 rounded focus:ring-2 focus:ring-[#154734] outline-none" />

                                        <div className="flex gap-2">
                                            <select aria-label="Location" value={gameForm.location} onChange={e => setGameForm({ ...gameForm, location: e.target.value as any })} className="border p-2 rounded flex-1 focus:ring-2 focus:ring-[#154734] outline-none">
                                                <option value="Home">Home</option>
                                                <option value="Away">Away</option>
                                                <option value="Neutral">Neutral</option>
                                            </select>
                                            <div className="flex items-center gap-2 border p-2 rounded px-3 cursor-pointer hover:bg-gray-50" onClick={() => setGameForm({ ...gameForm, isBonus: !gameForm.isBonus })}>
                                                <div className={`w-4 h-4 rounded border flex items-center justify-center ${gameForm.isBonus ? 'bg-[#FFB81C] border-[#FFB81C]' : 'border-gray-300'}`}>
                                                    {gameForm.isBonus && <Trophy className="w-3 h-3 text-[white]" />}
                                                </div>
                                                <span className="text-sm font-medium">Bonus Game</span>
                                                <div className="group relative ml-1" onClick={(e) => e.stopPropagation()}>
                                                    <Info className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-gray-800 text-white text-xs p-2 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                                        Bonus games act as "Extra Credit". They count towards attendance but do not increase the required game count.
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <p className="text-xs text-gray-500">
                                            Worth {gamePointValue({ isBonus: gameForm.isBonus })} point{gameForm.isBonus ? 's' : ''}. Every game is 1 point, bonus games are 2.
                                        </p>

                                        <textarea aria-label="Notes or description" placeholder="Notes / Description" value={gameForm.description} onChange={e => setGameForm({ ...gameForm, description: e.target.value })} className="w-full border p-2 rounded text-sm h-20 focus:ring-2 focus:ring-[#154734] outline-none"></textarea>

                                        <div className="flex gap-3 pt-2">
                                            <button onClick={handleSaveGame} className="flex-1 bg-[#154734] text-white py-2.5 rounded-lg font-bold hover:shadow-lg transition-transform active:scale-95">Save Game</button>
                                            <button onClick={resetGameForm} className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg font-bold hover:bg-gray-200">Cancel</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* --- MEMBERS TAB --- */}
                {activeTab === 'members' && (
                    <div className="flex flex-col h-full gap-4">
                        {/* Members are no longer added here (they come in through the interest form);
                            this form only appears while editing an existing member via the pencil. */}
                        <div className="relative shrink-0">
                            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                value={memberSearch}
                                onChange={e => setMemberSearch(e.target.value)}
                                placeholder="Search members by name, email, or role..."
                                className="w-full border border-gray-300 rounded-lg pl-9 pr-9 py-2.5 text-sm focus:ring-2 focus:ring-[#154734] outline-none"
                            />
                            {memberSearch && (
                                <button onClick={() => setMemberSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" aria-label="Clear search">
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                        {memberSearch && (
                            <p className="text-xs text-gray-500 -mt-2 shrink-0">Showing {filteredMembers.length} of {members.length} members</p>
                        )}

                        {editingId && (
                        <div className="p-4 rounded-lg border flex flex-wrap gap-3 items-end shrink-0 bg-yellow-50 border-yellow-200">
                            <span className="text-xs font-bold text-yellow-800 w-full">Editing member</span>
                            <input type="text" aria-label="First name" value={memberForm.firstName} onChange={e => setMemberForm({ ...memberForm, firstName: e.target.value })} placeholder="First" className="border p-2 rounded text-sm w-32" />
                            <input type="text" aria-label="Last name" value={memberForm.lastName} onChange={e => setMemberForm({ ...memberForm, lastName: e.target.value })} placeholder="Last" className="border p-2 rounded text-sm w-32" />
                            <select aria-label="Member role" value={memberForm.role} onChange={e => setMemberForm({ ...memberForm, role: e.target.value as Role })} className="border p-2 rounded text-sm">
                                <option value={Role.ADMIN}>Admin</option>
                                <option value={Role.OFFICER}>Officer</option>
                                <option value={Role.MEMBER}>Member</option>
                                <option value={Role.PROSPECTIVE}>Prospective</option>
                                <option value={Role.INACTIVE}>Inactive</option>
                            </select>
                            <button onClick={handleSaveMember} className="bg-[#154734] text-white px-4 py-2 rounded text-sm font-bold">Save</button>
                            <button type="button" aria-label="Cancel editing member" onClick={resetMemberForm} className="bg-gray-200 px-3 py-2 rounded"><X className="w-4 h-4" /></button>
                        </div>
                        )}

                        <div className="flex items-center justify-between gap-3 flex-wrap shrink-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <button
                                    onClick={() => {
                                        if (!showEmailCompose) setEmailSelectedIds(new Set(currentMembersAndAbove.map(m => m.id)));
                                        setShowEmailCompose(v => !v);
                                    }}
                                    className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 px-3 py-2 rounded-lg text-sm font-bold hover:bg-amber-200"
                                >
                                    <Mail className="w-4 h-4" /> {showEmailCompose ? 'Close' : 'Email Members'}
                                </button>
                                {currentMembersAndAbove.some(m => m.email) && (
                                    <button
                                        onClick={copyAllCurrentMemberEmails}
                                        title="Copies every current Member/Officer/Admin's email, semicolon-separated -- paste into Outlook's To/Bcc field"
                                        className="inline-flex items-center gap-2 bg-gray-100 text-gray-700 px-3 py-2 rounded-lg text-sm font-bold hover:bg-gray-200"
                                    >
                                        {memberEmailsCopied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                                        {memberEmailsCopied ? 'Copied!' : 'Copy All Emails'}
                                    </button>
                                )}
                            </div>
                            {showEmailCompose && (
                                <span className="text-xs text-gray-500">
                                    Select recipients with the checkboxes below (defaults to everyone Member/Officer/Admin).
                                </span>
                            )}
                        </div>

                        {showEmailCompose && (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 shrink-0 space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-bold text-amber-900 text-sm">Compose (e.g. meeting notes)</h4>
                                    <button onClick={toggleSelectAllCurrent} className="text-xs font-bold text-amber-700 hover:text-amber-900 underline">
                                        {allCurrentSelected ? 'Deselect all Members+' : 'Select all Members+'}
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    value={emailSubject}
                                    onChange={e => setEmailSubject(e.target.value)}
                                    placeholder="Subject (e.g. Bear Pit Meeting Notes -- 8/31)"
                                    className="w-full border border-amber-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-amber-400 outline-none"
                                />
                                <textarea
                                    value={emailBody}
                                    onChange={e => setEmailBody(e.target.value)}
                                    placeholder="Paste the meeting notes / message here..."
                                    rows={8}
                                    className="w-full border border-amber-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-amber-400 outline-none"
                                />
                                <p className="text-xs text-amber-700">
                                    A very long message to a large group may not fully open in your email app -- if that
                                    happens, copy this text in manually.
                                </p>
                                <div className="flex items-center gap-3 flex-wrap">
                                    {emailSelectedWithEmail.length > 0 && (
                                        <button
                                            onClick={() => downloadMailMergeCSV(emailSelectedWithEmail.map(m => ({ firstName: m.firstName, lastName: m.lastName, email: m.email! })), 'bearpit-members-mail-merge.csv')}
                                            title="Download a CSV to use with Outlook/Word Mail Merge -- sends a real individual 'Dear [First Name]' email to each person"
                                            className="inline-flex items-center gap-2 bg-blue-100 text-blue-800 px-3 py-2 rounded-lg text-sm font-bold hover:bg-blue-200"
                                        >
                                            <FileSpreadsheet className="w-4 h-4" /> Export for Mail Merge ({emailSelectedWithEmail.length})
                                        </button>
                                    )}
                                    {bulkMemberMailtoHref ? (
                                        <a
                                            href={bulkMemberMailtoHref}
                                            title="Opens one email addressed (bcc) to everyone selected"
                                            className="inline-flex items-center gap-2 bg-[#154734] text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-[#0e3022]"
                                        >
                                            <Mail className="w-4 h-4" /> Open Email ({emailSelectedWithEmail.length} recipients)
                                        </a>
                                    ) : (
                                        <span className="text-xs text-gray-500">Add a subject and select at least one recipient with an email on file.</span>
                                    )}
                                    {emailSelectedMissingEmail > 0 && (
                                        <span className="text-xs text-amber-600">{emailSelectedMissingEmail} selected have no email and will be skipped</span>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex-1 overflow-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-700 sticky top-0">
                                    <tr>
                                        {showEmailCompose && (
                                            <th className="px-4 py-3 w-8">
                                                <input type="checkbox" checked={allCurrentSelected} onChange={toggleSelectAllCurrent} aria-label="Select all current members" />
                                            </th>
                                        )}
                                        <th className="px-4 py-3">Name</th>
                                        <th className="px-4 py-3">Role</th>
                                        <th className="px-4 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {filteredMembers.length === 0 && (
                                        <tr>
                                            <td colSpan={showEmailCompose ? 4 : 3} className="p-8 text-center text-gray-400 italic">No members match "{memberSearch}".</td>
                                        </tr>
                                    )}
                                    {filteredMembers.map(m => (
                                        <tr key={m.id} className="hover:bg-gray-50">
                                            {showEmailCompose && (
                                                <td className="px-4 py-3">
                                                    <input type="checkbox" checked={emailSelectedIds.has(m.id)} onChange={() => toggleEmailSelected(m.id)} aria-label={`Select ${m.firstName} ${m.lastName}`} />
                                                </td>
                                            )}
                                            <td className="px-4 py-3">
                                                <button
                                                    onClick={() => setSelectedProfileMember(m)}
                                                    className="font-medium text-[#154734] hover:underline hover:text-green-700 text-left"
                                                >
                                                    {m.firstName} {m.lastName}
                                                </button>
                                            </td>
                                            <td className="px-4 py-3">{m.role}</td>
                                            <td className="px-4 py-3 text-right flex justify-end gap-2">
                                                <button type="button" aria-label={`Edit ${m.firstName} ${m.lastName}`} onClick={() => handleEditMember(m)} className="text-gray-500 hover:text-blue-600"><Pencil className="w-4 h-4" /></button>
                                                <button type="button" aria-label={`Delete ${m.firstName} ${m.lastName}`} onClick={() => { if (window.confirm('Delete?')) onDeleteMember(m.id) }} className="text-gray-500 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* --- POINTS MANAGER TAB --- */}
                {activeTab === 'points' && (
                    <div className="flex flex-col h-full gap-4">
                        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm shrink-0">
                            <h3 className="font-bold text-[#154734] mb-4 flex items-center gap-2">
                                <Trophy className="w-5 h-5" /> Adjust Member Points
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                                <div>
                                    <label className="text-xs font-bold text-gray-500">Member</label>
                                    <select
                                        aria-label="Member"
                                        className="w-full border p-2 rounded"
                                        value={selectedMemberId}
                                        onChange={e => setSelectedMemberId(e.target.value)}
                                    >
                                        <option value="">Select Member...</option>
                                        {members.sort((a, b) => a.firstName.localeCompare(b.firstName)).map(m => (
                                            <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500">Category</label>
                                    <select
                                        className="w-full border p-2 rounded"
                                        value={pointsCategory}
                                        onChange={e => setPointsCategory(e.target.value)}
                                    >
                                        {POINT_CATEGORIES.map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500">Points (+/-)</label>
                                    <input
                                        type="number"
                                        aria-label="Points (+/-)"
                                        className="w-full border p-2 rounded"
                                        value={manualPoints}
                                        onChange={e => setManualPoints(Number(e.target.value))}
                                        placeholder="e.g. 5 or -5"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500">Reason</label>
                                    <input
                                        type="text"
                                        aria-label="Reason"
                                        className="w-full border p-2 rounded"
                                        value={pointsReason}
                                        onChange={e => setPointsReason(e.target.value)}
                                        placeholder="e.g. Helper at event, Penalty"
                                    />
                                </div>
                                <button
                                    onClick={handleSubmitPoints}
                                    className="bg-[#FFB81C] text-[#154734] font-bold py-2 px-4 rounded hover:bg-yellow-400"
                                >
                                    Apply Points
                                </button>
                            </div>
                            <button
                                onClick={() => setShowBulkAward(v => !v)}
                                className="mt-4 text-sm font-bold text-[#154734] hover:underline flex items-center gap-1"
                            >
                                {showBulkAward ? 'Hide' : 'Award the same points to multiple members at once →'}
                            </button>
                        </div>

                        {showBulkAward && (
                            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm shrink-0">
                                <h3 className="font-bold text-[#154734] mb-1 flex items-center gap-2">
                                    <Trophy className="w-5 h-5" /> Bulk Award
                                </h3>
                                <p className="text-xs text-gray-500 mb-4">
                                    For things members can't self-report and you notice as a group — e.g. everyone on hospitality duty at Saturday's game.
                                </p>
                                <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
                                    <label className="font-bold text-[#154734] cursor-pointer hover:underline">
                                        Import sign-up sheet (.csv) →
                                        <input type="file" accept=".csv,text/csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleImportSignupSheet(f); e.target.value = ''; }} />
                                    </label>
                                    <span className="text-xs text-gray-400">From Box/Excel: File → Save As / Download as CSV. Matches on email, then full name.</span>
                                </div>
                                {importUnmatched && (
                                    <div className={`mb-3 text-xs rounded-lg p-3 ${importUnmatched.length ? 'bg-yellow-50 text-yellow-900 border border-yellow-200' : 'bg-green-50 text-green-800 border border-green-200'}`}>
                                        Checked {bulkSelectedIds.size} member{bulkSelectedIds.size === 1 ? '' : 's'} from the sheet.
                                        {importUnmatched.length > 0 && <> Not matched to any member (check spelling, or add them first): <b>{importUnmatched.join(', ')}</b></>}
                                    </div>
                                )}
                                {bulkAlreadyAwarded.length > 0 && (
                                    <div className="mb-3 text-xs rounded-lg p-3 bg-blue-50 text-blue-900 border border-blue-200">
                                        Already credited for "{bulkReason.trim()}", will be skipped: <b>{bulkAlreadyAwarded.map(m => `${m.firstName} ${m.lastName}`).join(', ')}</b>
                                    </div>
                                )}
                                <div className="max-h-40 overflow-y-auto border rounded-lg p-2 mb-4 grid grid-cols-2 md:grid-cols-3 gap-1">
                                    {members.sort((a, b) => a.firstName.localeCompare(b.firstName)).map(m => (
                                        <label key={m.id} className="flex items-center gap-2 text-sm px-2 py-1 rounded hover:bg-gray-50 cursor-pointer">
                                            <input type="checkbox" checked={bulkSelectedIds.has(m.id)} onChange={() => toggleBulkSelected(m.id)} />
                                            {m.firstName} {m.lastName}
                                        </label>
                                    ))}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                    <div>
                                        <label className="text-xs font-bold text-gray-500">Category</label>
                                        <select className="w-full border p-2 rounded" value={bulkCategory} onChange={e => setBulkCategory(e.target.value)}>
                                            {POINT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-500">Points (+/-)</label>
                                        <input type="number" className="w-full border p-2 rounded" value={bulkPoints} onChange={e => setBulkPoints(Number(e.target.value))} />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-500">Reason</label>
                                        <input type="text" className="w-full border p-2 rounded" value={bulkReason} onChange={e => setBulkReason(e.target.value)} placeholder="e.g. Hospitality duty at BSB game" />
                                    </div>
                                    <button onClick={handleSubmitBulkAward} className="bg-[#FFB81C] text-[#154734] font-bold py-2 px-4 rounded hover:bg-yellow-400">
                                        Apply to {bulkSelectedIds.size - bulkAlreadyAwarded.length} Member{bulkSelectedIds.size - bulkAlreadyAwarded.length === 1 ? '' : 's'}
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex-1 overflow-auto">
                            <div className="p-4 border-b bg-gray-50 font-bold text-gray-700 flex justify-between items-center">
                                <span className="flex items-center gap-2"><History className="w-4 h-4" /> Recent Point Adjustments</span>
                            </div>
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-700 sticky top-0">
                                    <tr>
                                        <th className="px-6 py-3">Date</th>
                                        <th className="px-6 py-3">Member</th>
                                        <th className="px-6 py-3">Category</th>
                                        <th className="px-6 py-3">Reason</th>
                                        <th className="px-6 py-3 text-right">Points</th>
                                        <th className="px-6 py-3 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {bonusPoints.length > 0 ? bonusPoints.map(bp => {
                                        const m = members.find(mem => mem.id === bp.memberId);
                                        return (
                                            <tr key={bp.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 text-gray-500 text-xs">
                                                    {new Date(bp.date).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4 font-bold text-gray-900">
                                                    {m ? `${m.firstName} ${m.lastName}` : 'Unknown'}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="bg-[#154734]/10 text-[#154734] text-xs font-bold px-2 py-0.5 rounded-full">
                                                        {bp.category || 'Other'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-gray-600">{bp.reason}</td>
                                                <td className={`px-6 py-4 text-right font-bold ${bp.points > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                    {bp.points > 0 ? '+' : ''}{bp.points}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button type="button" aria-label="Delete point adjustment" onClick={() => onDeleteBonusPoint(bp.id)} className="text-gray-500 hover:text-red-500">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    }) : (
                                        <tr>
                                            <td colSpan={6} className="p-8 text-center text-gray-500 italic">No manual point adjustments recorded.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* --- CLUB EVENTS TAB (tabling signups etc) --- */}
                {activeTab === 'events' && (
                    <div className="flex flex-col h-full gap-4 overflow-y-auto">
                        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm shrink-0">
                            <h3 className="font-bold text-[#154734] mb-1 flex items-center gap-2">
                                <CalendarIcon className="w-5 h-5" /> Create Club Event
                            </h3>
                            <p className="text-xs text-gray-500 mb-4">
                                Tabling shifts, etc. Members sign up for an open slot from their portal and get the points automatically.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500">Title</label>
                                    <input type="text" className="w-full border p-2 rounded" value={eventForm.title} onChange={e => setEventForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Tabling - Fountain Mall" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500">Category</label>
                                    <select className="w-full border p-2 rounded" value={eventForm.category} onChange={e => setEventForm(f => ({ ...f, category: e.target.value }))}>
                                        {POINT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500">Location</label>
                                    <input type="text" className="w-full border p-2 rounded" value={eventForm.location} onChange={e => setEventForm(f => ({ ...f, location: e.target.value }))} placeholder="Optional" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500">Date</label>
                                    <input type="date" className="w-full border p-2 rounded" value={eventForm.date} onChange={e => setEventForm(f => ({ ...f, date: e.target.value }))} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500">Time</label>
                                    <input type="time" className="w-full border p-2 rounded" value={eventForm.time} onChange={e => setEventForm(f => ({ ...f, time: e.target.value }))} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500">Slots Open</label>
                                    <input type="number" min={1} className="w-full border p-2 rounded" value={eventForm.maxSignups} onChange={e => setEventForm(f => ({ ...f, maxSignups: Number(e.target.value) }))} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500">Points per Signup</label>
                                    <input type="number" className="w-full border p-2 rounded" value={eventForm.pointsValue} onChange={e => setEventForm(f => ({ ...f, pointsValue: Number(e.target.value) }))} />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-xs font-bold text-gray-500">Description</label>
                                    <input type="text" className="w-full border p-2 rounded" value={eventForm.description} onChange={e => setEventForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional details members should see" />
                                </div>
                            </div>
                            <button onClick={handleSubmitEvent} className="mt-4 bg-[#FFB81C] text-[#154734] font-bold py-2 px-4 rounded hover:bg-yellow-400 flex items-center gap-2">
                                <Plus className="w-4 h-4" /> Create Event
                            </button>
                        </div>

                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex-1 overflow-auto">
                            <div className="p-4 border-b bg-gray-50 font-bold text-gray-700 flex items-center gap-2">
                                <History className="w-4 h-4" /> Upcoming &amp; Past Events
                            </div>
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-700 sticky top-0">
                                    <tr>
                                        <th className="px-6 py-3">Date</th>
                                        <th className="px-6 py-3">Event</th>
                                        <th className="px-6 py-3">Category</th>
                                        <th className="px-6 py-3 text-center">Slots</th>
                                        <th className="px-6 py-3 text-center">Signed Up</th>
                                        <th className="px-6 py-3 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {clubEvents.length > 0 ? [...clubEvents].sort((a, b) => a.date.localeCompare(b.date)).map(ev => {
                                        const taken = eventSignups.filter(s => s.eventId === ev.id).length;
                                        return (
                                            <tr key={ev.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 text-gray-500 text-xs">{ev.date}{ev.time ? ` ${ev.time}` : ''}</td>
                                                <td className="px-6 py-4 font-bold text-gray-900">
                                                    {ev.title}
                                                    {ev.location && <div className="text-xs text-gray-400 font-normal flex items-center gap-1"><MapPin className="w-3 h-3" />{ev.location}</div>}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="bg-[#154734]/10 text-[#154734] text-xs font-bold px-2 py-0.5 rounded-full">{ev.category}</span>
                                                </td>
                                                <td className="px-6 py-4 text-center text-gray-500">{ev.maxSignups}</td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`font-bold ${taken >= ev.maxSignups ? 'text-green-600' : 'text-gray-700'}`}>{taken} / {ev.maxSignups}</span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button onClick={() => onDeleteClubEvent?.(ev.id)} className="text-gray-400 hover:text-red-500">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    }) : (
                                        <tr>
                                            <td colSpan={6} className="p-8 text-center text-gray-400 italic">No club events created yet.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* --- BUG LOG TAB --- */}
                {activeTab === 'bugs' && <BugLog />}
            </div>

            {selectedProfileMember && (
                <SettingsModal
                    isOpen={!!selectedProfileMember}
                    onClose={() => setSelectedProfileMember(null)}
                    member={selectedProfileMember}
                    sports={sports}
                    onUpdateProfile={onUpdateProfile}
                    adminMode={true}
                />
            )}
        </div>
    );
};