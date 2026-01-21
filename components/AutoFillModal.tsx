import React, { useState, useEffect } from 'react';
import { X, Search, Check, AlertCircle, Loader2, Calendar as CalendarIcon, Info, Trophy, ChevronRight, Plus, MapPin } from 'lucide-react';
import { Game, Sport, Role } from '../types';
import { fetchSchedule, ScrapedGame, resolveSportMappings } from '../utils/scraper';

interface AutoFillModalProps {
    isOpen: boolean;
    onClose: () => void;
    existingSports: Sport[];
    existingGames: Game[];
    onAddGame: (game: Game) => void;
    onAddSport: (name: string) => Promise<string>; // Should return the new sport ID
    userRole?: Role;
}

type Step = 'fetch' | 'resolve-sports' | 'review-games';

export const AutoFillModal: React.FC<AutoFillModalProps> = ({ isOpen, onClose, existingSports, existingGames, onAddGame, onAddSport, userRole }) => {
    const [step, setStep] = useState<Step>('fetch');
    const [loading, setLoading] = useState(false);
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());

    const [scrapedGames, setScrapedGames] = useState<ScrapedGame[]>([]);
    const [sportMappings, setSportMappings] = useState<Record<string, { sportId?: string, status: 'mapped' | 'new' | 'ignore' }>>({});
    const [gameStatuses, setGameStatuses] = useState<Record<number, { status: 'new' | 'update' | 'same', existingGameId?: string }>>({});
    const [selectedGames, setSelectedGames] = useState<Set<number>>(new Set());
    const [activeTab, setActiveTab] = useState<'new' | 'updates'>('new');

    const reset = () => {
        setStep('fetch');
        setLoading(false);
        setScrapedGames([]);
        setSportMappings({});
        setGameStatuses({});
        setSelectedGames(new Set());
        setActiveTab('new');
    };

    useEffect(() => {
        if (!isOpen) reset();
    }, [isOpen]);

    const handleFetch = async () => {
        setLoading(true);
        try {
            const games = await fetchSchedule(year, month);
            setScrapedGames(games);

            const initialMappings = resolveSportMappings(games, existingSports);
            setSportMappings(initialMappings);

            // If all sports are mapped or ignored (clubs), skip to review
            const needsResolution = Object.values(initialMappings).some(m => m.status === 'new');
            if (needsResolution) {
                setStep('resolve-sports');
            } else {
                setStep('review-games');
                // Auto-select games for mapped sports, BUT skip duplicates
                const toSelect = new Set<number>();
                const statuses: Record<number, { status: 'new' | 'update' | 'same', existingGameId?: string }> = {};

                games.forEach((g, idx) => {
                    const sportId = initialMappings[g.sportName]?.sportId;
                    const existing = existingGames.find(ex => ex.date === g.date && ex.sportId === sportId);

                    if (!existing) {
                        statuses[idx] = { status: 'new' };
                        if (initialMappings[g.sportName]?.status === 'mapped') {
                            toSelect.add(idx);
                        }
                    } else {
                        const isSame =
                            existing.opponent.toLowerCase() === g.opponent.toLowerCase() &&
                            (existing.time === g.time || (!existing.time && !g.time)) &&
                            existing.location === g.location;

                        if (isSame) {
                            statuses[idx] = { status: 'same', existingGameId: existing.id };
                        } else {
                            statuses[idx] = { status: 'update', existingGameId: existing.id };
                        }
                    }
                });
                setGameStatuses(statuses);
                setSelectedGames(toSelect);

                // If no new games but updates exist, switch to updates tab
                const hasNew = Object.values(statuses).some(s => s.status === 'new');
                if (!hasNew) setActiveTab('updates');
            }
        } catch (err: any) {
            console.error('Fetch error:', err);
            const detailedError = `DIAGNOSTIC INFO:\n- Message: ${err.message || 'Unknown'}\n- Component: AutoFillModal\n- Action: handleFetch\n- Month/Year: ${month}/${year}\n\nPlease copy this info and tell the assistant!`;
            alert(`Error fetching schedule:\n\n${detailedError}`);
        } finally {
            setLoading(false);
        }
    };

    const handleImport = async () => {
        setLoading(true);
        try {
            // 1. Create any "new" sports first
            const finalMappings = { ...sportMappings };
            for (const name in finalMappings) {
                if (finalMappings[name].status === 'new') {
                    const newId = await onAddSport(name);
                    finalMappings[name] = { sportId: newId, status: 'mapped' };
                }
            }

            // 2. Add selected games
            for (const idx of Array.from(selectedGames)) {
                const g = scrapedGames[idx];
                const status = gameStatuses[idx];
                const sportId = finalMappings[g.sportName]?.sportId;
                if (!sportId) continue;

                onAddGame({
                    id: status.existingGameId || `scraped_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    sportId: sportId,
                    date: g.date,
                    time: g.time,
                    opponent: g.opponent,
                    location: g.location,
                    isBonus: false,
                    pointsValue: 1,
                    description: g.description
                });
            }

            alert(`Success! Processed ${selectedGames.size} games.`);
            onClose();
        } catch (err) {
            alert("Error importing games.");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="bg-[#154734] p-6 text-white flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Search className="w-5 h-5" />
                            Auto Fill Baylor Schedule
                        </h2>
                        <p className="text-white/70 text-sm mt-1">Automatically find and add games from baylorbears.com</p>
                    </div>
                    <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                    {step === 'fetch' && (
                        <div className="space-y-6 py-8">
                            <div className="flex flex-col items-center text-center space-y-4">
                                <div className="w-16 h-16 bg-green-100 text-[#154734] rounded-full flex items-center justify-center">
                                    <CalendarIcon className="w-8 h-8" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">Select Month to Scrape</h3>
                                    <p className="text-gray-500 text-sm">We'll check the official composite calendar for events.</p>
                                </div>
                            </div>

                            <div className="flex gap-4 max-w-xs mx-auto">
                                <select
                                    value={month}
                                    onChange={(e) => setMonth(Number(e.target.value))}
                                    className="flex-1 border-2 border-gray-200 rounded-xl p-3 font-bold focus:border-[#154734] outline-none transition-colors"
                                >
                                    {Array.from({ length: 12 }).map((_, i) => (
                                        <option key={i + 1} value={i + 1}>
                                            {new Date(2000, i).toLocaleString('default', { month: 'long' })}
                                        </option>
                                    ))}
                                </select>
                                <select
                                    value={year}
                                    onChange={(e) => setYear(Number(e.target.value))}
                                    className="w-32 border-2 border-gray-200 rounded-xl p-3 font-bold focus:border-[#154734] outline-none transition-colors"
                                >
                                    {[2024, 2025, 2026].map(y => (
                                        <option key={y} value={y}>{y}</option>
                                    ))}
                                </select>
                            </div>

                            <button
                                onClick={handleFetch}
                                disabled={loading}
                                className="w-full bg-[#154734] text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#0f3325] transition-all disabled:opacity-50 shadow-lg shadow-green-900/10 active:scale-95"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Fetch Schedule"}
                            </button>
                        </div>
                    )}

                    {step === 'resolve-sports' && (
                        <div className="space-y-4">
                            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl flex gap-3 text-yellow-800 text-sm">
                                <AlertCircle className="w-5 h-5 shrink-0" />
                                <div>
                                    <p className="font-bold">Unknown Sports Detected</p>
                                    <p>Some sports found in the schedule aren't in your tracker yet. Please map or add them.</p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {(Object.entries(sportMappings) as [string, any][]).filter(([_, m]) => m.status !== 'mapped').map(([name, mapping]) => (
                                    <div key={name} className="bg-white border-2 border-gray-100 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div>
                                            <div className="font-bold text-[#154734]">{name}</div>
                                            <div className="text-xs text-gray-400">Scraped Sport Name</div>
                                            {name.toLowerCase().includes('club') && (
                                                <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-bold mt-1 inline-block uppercase">Club Sport</span>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <select
                                                className="text-sm border rounded-lg p-2 outline-none focus:ring-2 focus:ring-[#154734]"
                                                value={mapping.status === 'ignore' ? 'ignore' : (mapping.sportId || 'new')}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    const newMappings = { ...sportMappings };
                                                    if (val === 'ignore') {
                                                        newMappings[name] = { status: 'ignore' };
                                                    } else if (val === 'new') {
                                                        newMappings[name] = { status: 'new' };
                                                    } else {
                                                        newMappings[name] = { status: 'mapped', sportId: val };
                                                    }
                                                    setSportMappings(newMappings);
                                                }}
                                            >
                                                {userRole !== Role.OFFICER && <option value="new">+ Add as New Sport</option>}
                                                <option value="ignore">Ignore / Hide Games</option>
                                                <optgroup label="Map to Existing:">
                                                    {existingSports.map(s => (
                                                        <option key={s.id} value={s.id}>{s.name}</option>
                                                    ))}
                                                </optgroup>
                                            </select>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={() => {
                                    setStep('review-games');
                                    // Set initial selected games based on resolved mappings, skip duplicates
                                    const toSelect = new Set<number>();
                                    const statuses: Record<number, { status: 'new' | 'update' | 'same', existingGameId?: string }> = {};

                                    scrapedGames.forEach((g, idx) => {
                                        const sportId = sportMappings[g.sportName]?.sportId;
                                        const existing = existingGames.find(ex => ex.date === g.date && ex.sportId === sportId);

                                        if (!existing) {
                                            statuses[idx] = { status: 'new' };
                                            if (sportMappings[g.sportName]?.status === 'mapped') {
                                                toSelect.add(idx);
                                            }
                                        } else {
                                            const isSame =
                                                existing.opponent.toLowerCase() === g.opponent.toLowerCase() &&
                                                (existing.time === g.time || (!existing.time && !g.time)) &&
                                                existing.location === g.location;

                                            if (isSame) {
                                                statuses[idx] = { status: 'same', existingGameId: existing.id };
                                            } else {
                                                statuses[idx] = { status: 'update', existingGameId: existing.id };
                                            }
                                        }
                                    });
                                    setGameStatuses(statuses);
                                    setSelectedGames(toSelect);

                                    const hasNew = Object.values(statuses).some(s => s.status === 'new');
                                    if (!hasNew) setActiveTab('updates');
                                }}
                                className="w-full bg-[#154734] text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#0f3325] transition-all"
                            >
                                Continue to Games <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                    )}

                    {step === 'review-games' && (
                        <div className="space-y-4">
                            <div className="flex flex-col gap-4">
                                <div className="flex bg-gray-200 p-1 rounded-xl">
                                    <button
                                        onClick={() => setActiveTab('new')}
                                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'new' ? 'bg-white text-[#154734] shadow-sm' : 'text-gray-500'}`}
                                    >
                                        New Games ({(Object.values(gameStatuses) as any[]).filter(s => s.status === 'new').length})
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('updates')}
                                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'updates' ? 'bg-white text-[#154734] shadow-sm' : 'text-gray-500'}`}
                                    >
                                        Updates ({(Object.values(gameStatuses) as any[]).filter(s => s.status === 'update').length})
                                    </button>
                                </div>

                                <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                    <span>
                                        {activeTab === 'new' ? 'Will be added as new events' : 'Will update existing events with new info'}
                                    </span>
                                    <button
                                        onClick={() => {
                                            const visibleIndices = scrapedGames.map((_, i) => i).filter(i => {
                                                const s = gameStatuses[i];
                                                return activeTab === 'new' ? s?.status === 'new' : s?.status === 'update';
                                            });
                                            if (visibleIndices.every(i => selectedGames.has(i))) {
                                                const next = new Set(selectedGames);
                                                visibleIndices.forEach(i => next.delete(i));
                                                setSelectedGames(next);
                                            } else {
                                                const next = new Set(selectedGames);
                                                visibleIndices.forEach(i => next.add(i));
                                                setSelectedGames(next);
                                            }
                                        }}
                                        className="text-[#154734] hover:underline"
                                    >
                                        {scrapedGames.map((_, i) => i).filter(i => {
                                            const s = gameStatuses[i];
                                            return activeTab === 'new' ? s?.status === 'new' : s?.status === 'update';
                                        }).every(i => selectedGames.has(i)) ? 'Deselect Tab' : 'Select Tab'}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                {scrapedGames.filter((_, idx): boolean => {
                                    const s = gameStatuses[idx] as { status: string } | undefined;
                                    if ((sportMappings[scrapedGames[idx].sportName] as any)?.status === 'ignore') return false;
                                    return (activeTab === 'new' ? s?.status === 'new' : s?.status === 'update') || false;
                                }).length === 0 ? (
                                    <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-8 text-center space-y-2">
                                        <div className="text-sm font-bold text-gray-400">No {activeTab} games found</div>
                                        <p className="text-xs text-gray-400">Check the other tab or select a different month.</p>
                                    </div>
                                ) : (
                                    scrapedGames.map((game, idx) => {
                                        const s = gameStatuses[idx];
                                        if (!s) return null;
                                        if (sportMappings[game.sportName]?.status === 'ignore') return null;
                                        if (activeTab === 'new' && s.status !== 'new') return null;
                                        if (activeTab === 'updates' && s.status !== 'update') return null;

                                        const existing = s.existingGameId ? existingGames.find(ex => ex.id === s.existingGameId) : null;

                                        return (
                                            <div
                                                key={idx}
                                                className={`bg-white border-2 rounded-xl p-3 flex items-center gap-4 transition-all cursor-pointer hover:border-[#154734]/30 ${selectedGames.has(idx) ? 'border-[#154734] bg-green-50/30' : 'border-gray-100'}`}
                                                onClick={() => {
                                                    const next = new Set(selectedGames);
                                                    if (next.has(idx)) next.delete(idx);
                                                    else next.add(idx);
                                                    setSelectedGames(next);
                                                }}
                                            >
                                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${selectedGames.has(idx) ? 'bg-[#154734] border-[#154734]' : 'border-gray-300'}`}>
                                                    {selectedGames.has(idx) && <Check className="w-4 h-4 text-white" />}
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <div className="font-bold text-gray-900 truncate flex items-center gap-2">
                                                                {game.opponent}
                                                                {game.description && <span className="bg-[#FFB81C] text-[#154734] text-[8px] px-1 rounded font-black uppercase">Theme</span>}
                                                                {s.status === 'update' && <span className="bg-blue-100 text-blue-600 text-[8px] px-1 rounded font-black uppercase">New Info</span>}
                                                            </div>
                                                            <div className="text-xs text-gray-500">
                                                                {game.sportName} • {new Date(game.date).toLocaleDateString()} at {game.time}
                                                            </div>
                                                            {s.status === 'update' && existing && (
                                                                <div className="mt-2 text-[10px] bg-blue-50/50 p-2 rounded border border-blue-100/50">
                                                                    <div className="font-bold text-blue-800 mb-1">Current Tracker Info:</div>
                                                                    <div className="grid grid-cols-2 gap-x-2 text-blue-700/80">
                                                                        <span>Opponent: {existing.opponent}</span>
                                                                        <span>Time: {existing.time || 'TBA'}</span>
                                                                        <span>Loc: {existing.location}</span>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${game.location === 'Home' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                            {game.location}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            <div className="pt-4 sticky bottom-0 bg-gray-50 pb-2">
                                <button
                                    onClick={handleImport}
                                    disabled={loading || selectedGames.size === 0}
                                    className="w-full bg-[#154734] text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#0f3325] transition-all disabled:opacity-50"
                                >
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : `${activeTab === 'new' ? 'Add' : 'Update'} ${selectedGames.size} Selected Games`}
                                </button>
                                <button
                                    onClick={() => setStep('fetch')}
                                    className="w-full text-gray-500 text-sm font-bold py-2 hover:text-gray-700"
                                >
                                    Start Over
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
