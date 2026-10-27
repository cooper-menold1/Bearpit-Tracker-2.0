import React, { useMemo, useState } from 'react';
import { AttendanceRecord, Game, GameRole, Member, Role, Sport } from '../types';
import { POINT_CATEGORIES } from '../constants';
import { GAME_ROLE_PRESETS, isGameRoleConfirmed } from '../utils/fanTier';
import { parseLocalDate } from '../utils/dateUtils';
import { X, Plus, Trash2, CheckCircle2, Clock, Users } from 'lucide-react';

const CUSTOM = 'custom';

interface GameRosterProps {
    game: Game;
    sports: Sport[];
    members: Member[];
    attendance: AttendanceRecord;
    gameRoles: GameRole[]; // roles for this game only
    onAdd: (role: Omit<GameRole, 'id' | 'createdAt'>) => void;
    onDelete: (id: string) => void;
    onClose: () => void;
}

// Game-day roster for one game: officers assign members a job (chant
// leader, setup crew, hospitality...) before or after the game. A role's
// points only count once that member also checks in to the game, so
// unconfirmed roles show here as "pending".
export const GameRoster: React.FC<GameRosterProps> = ({ game, sports, members, attendance, gameRoles, onAdd, onDelete, onClose }) => {
    const [memberId, setMemberId] = useState('');
    const [preset, setPreset] = useState('0');
    const [customRole, setCustomRole] = useState('');
    const [category, setCategory] = useState(GAME_ROLE_PRESETS[0].category);
    const [points, setPoints] = useState(GAME_ROLE_PRESETS[0].points);

    const rosterCandidates = useMemo(() => members
        .filter(m => m.role !== Role.PROSPECTIVE && m.role !== Role.INACTIVE)
        .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)),
        [members]);

    const memberName = (id: string) => {
        const m = members.find(mem => mem.id === id);
        return m ? `${m.firstName} ${m.lastName}` : 'Unknown Member';
    };

    const pickPreset = (value: string) => {
        setPreset(value);
        if (value === CUSTOM) return;
        const p = GAME_ROLE_PRESETS[Number(value)];
        setCategory(p.category);
        setPoints(p.points);
    };

    const roleName = preset === CUSTOM ? customRole.trim() : GAME_ROLE_PRESETS[Number(preset)].role;

    const handleAdd = () => {
        if (!memberId || !roleName || !points) {
            alert('Pick a member, a role, and non-zero points.');
            return;
        }
        if (gameRoles.some(r => r.memberId === memberId && r.role.toLowerCase() === roleName.toLowerCase())) {
            alert(`${memberName(memberId)} already has that role for this game.`);
            return;
        }
        onAdd({ gameId: game.id, memberId, role: roleName, category, points });
        setMemberId('');
    };

    const sorted = [...gameRoles].sort((a, b) => a.role.localeCompare(b.role) || memberName(a.memberId).localeCompare(memberName(b.memberId)));
    const pendingCount = gameRoles.filter(r => !isGameRoleConfirmed(r, attendance)).length;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div role="dialog" aria-modal="true" aria-label="Game-day roster" className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                <div className="bg-[#154734] p-4 flex justify-between items-center text-white shrink-0">
                    <div>
                        <h3 className="font-bold text-lg leading-none flex items-center gap-2"><Users className="w-5 h-5" /> Game-day roster</h3>
                        <p className="text-white/80 text-sm mt-1">
                            {sports.find(s => s.id === game.sportId)?.name || 'Game'} vs {game.opponent} · {parseLocalDate(game.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                    </div>
                    <button type="button" aria-label="Close" onClick={onClose} className="text-white/70 hover:text-white"><X className="w-5 h-5" /></button>
                </div>

                <div className="p-4 overflow-y-auto flex-1 bg-gray-50 space-y-2">
                    <p className="text-xs text-gray-500">
                        Points count once the member also checks in to this game. Until then the role is pending.
                        {pendingCount > 0 && <span className="font-bold text-amber-700"> {pendingCount} pending.</span>}
                    </p>
                    {sorted.length === 0 ? (
                        <div className="text-center py-6 text-gray-500 italic text-sm">No one on the roster yet.</div>
                    ) : sorted.map(r => {
                        const confirmed = isGameRoleConfirmed(r, attendance);
                        return (
                            <div key={r.id} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="font-bold text-gray-900 truncate">{memberName(r.memberId)}</p>
                                    <p className="text-xs text-gray-500">{r.role} · {r.category} · +{r.points} pts</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {confirmed ? (
                                        <span className="flex items-center gap-1 text-xs font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full" title="Checked in, points awarded">
                                            <CheckCircle2 className="w-3 h-3" /> Confirmed
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1 text-xs font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full" title="Not checked in to this game yet, no points">
                                            <Clock className="w-3 h-3" /> Pending
                                        </span>
                                    )}
                                    <button
                                        type="button"
                                        aria-label={`Remove ${r.role} for ${memberName(r.memberId)}`}
                                        onClick={() => { if (window.confirm(`Remove ${memberName(r.memberId)} as ${r.role}?`)) onDelete(r.id); }}
                                        className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="p-4 border-t border-gray-200 bg-white shrink-0 space-y-2">
                    <select aria-label="Member" value={memberId} onChange={e => setMemberId(e.target.value)} className="w-full border p-2 rounded text-sm focus:ring-2 focus:ring-[#154734] outline-none">
                        <option value="">Select member...</option>
                        {rosterCandidates.map(m => <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}
                    </select>
                    <select aria-label="Role" value={preset} onChange={e => pickPreset(e.target.value)} className="w-full border p-2 rounded text-sm focus:ring-2 focus:ring-[#154734] outline-none">
                        {GAME_ROLE_PRESETS.map((p, i) => <option key={p.role} value={String(i)}>{p.role} ({p.category}, {p.points} pts)</option>)}
                        <option value={CUSTOM}>Custom role...</option>
                    </select>
                    {preset === CUSTOM && (
                        <input type="text" aria-label="Custom role name" placeholder="Role name, e.g. Flag runner" value={customRole} onChange={e => setCustomRole(e.target.value)} className="w-full border p-2 rounded text-sm focus:ring-2 focus:ring-[#154734] outline-none" />
                    )}
                    <div className="flex gap-2">
                        <select aria-label="Category" value={category} onChange={e => setCategory(e.target.value)} className="border p-2 rounded text-sm flex-1 focus:ring-2 focus:ring-[#154734] outline-none">
                            {POINT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <input type="number" aria-label="Points" value={points} onChange={e => setPoints(Number(e.target.value))} className="border p-2 rounded text-sm w-20 focus:ring-2 focus:ring-[#154734] outline-none" />
                    </div>
                    <button
                        onClick={handleAdd}
                        className="w-full bg-[#154734] text-white py-2.5 rounded-lg font-bold hover:bg-[#0f3325] flex items-center justify-center gap-2 shadow-md transition-transform active:scale-95"
                    >
                        <Plus className="w-4 h-4" /> Add to roster
                    </button>
                </div>
            </div>
        </div>
    );
};
