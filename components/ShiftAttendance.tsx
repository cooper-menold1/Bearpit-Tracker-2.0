import React, { useEffect, useState } from 'react';
import { CheckSquare, Square, Loader2, ClipboardCheck } from 'lucide-react';
import { AttendanceRecord, ClubEvent, EventSignup, Game, Member } from '../types';
import { isEventCheckin, checkinCategory, gamePointValue } from '../utils/fanTier';
import { supabase } from '../utils/supabaseClient';
import { todayInChicago, formatGameTime } from '../utils/dateUtils';

interface ShiftAttendanceProps {
    clubEvents: ClubEvent[];
    eventSignups: EventSignup[];
    members: Member[];
    // Used to flag members who already got this shift's points from a
    // rotating-code event check-in (same day, same category).
    games?: Game[];
    attendance?: AttendanceRecord;
}

// Club event shifts pay on attendance, not sign-up. On (or after) the event
// day an officer ticks who actually showed; ticking writes the bonus_points
// row and links it on the signup (event_signups.bonus_point_id), unticking
// removes it. No schema change needed. A signup that already has a
// bonus_point_id is "paid" -- that includes signups from before 2026-10-26,
// which were paid at sign-up and keep their points.
export const ShiftAttendance: React.FC<ShiftAttendanceProps> = ({ clubEvents, eventSignups, members, games = [], attendance = {} }) => {
    const today = todayInChicago();
    // Today's and past events that have signups, most recent first.
    const markable = clubEvents
        .filter(e => e.date <= today && eventSignups.some(s => s.eventId === e.id))
        .sort((a, b) => b.date.localeCompare(a.date) || (b.time || '').localeCompare(a.time || ''));
    const [eventId, setEventId] = useState('');
    const [busy, setBusy] = useState<Set<string>>(new Set());
    // signupId -> bonus_point_id written/cleared here, until the refetch
    // brings eventSignups up to date (null = just unmarked).
    const [paidOverride, setPaidOverride] = useState<Record<string, string | null>>({});
    // Fresh signups from the server win over local overrides.
    useEffect(() => { setPaidOverride({}); }, [eventSignups]);
    const ev = markable.find(e => e.id === eventId) || markable[0];

    if (!ev) return null;

    const paidIdOf = (s: EventSignup) => (s.id in paidOverride ? paidOverride[s.id] : s.bonusPointId) || null;
    const signups = eventSignups.filter(s => s.eventId === ev.id);
    // Event check-ins on the shift's day in the shift's category: a member
    // checked in there already got points for (very likely) the same shift.
    const sameDayCheckins = games.filter(g => isEventCheckin(g) && g.date.slice(0, 10) === ev.date && checkinCategory(g) === ev.category);
    const codeCheckinPoints = (memberId: string) => sameDayCheckins
        .filter(g => attendance[g.id]?.[memberId])
        .reduce((sum, g) => sum + gamePointValue(g), 0);
    const nameOf = (id: string) => {
        const m = members.find(x => x.id === id);
        return m ? `${m.firstName} ${m.lastName}` : 'Unknown member';
    };
    const setBusyFor = (id: string, on: boolean) => setBusy(prev => {
        const next = new Set(prev);
        if (on) next.add(id); else next.delete(id);
        return next;
    });

    const markAttended = async (s: EventSignup, skipConfirm = false) => {
        const viaCode = codeCheckinPoints(s.memberId);
        if (viaCode > 0 && !skipConfirm && !window.confirm(`${nameOf(s.memberId)} already got +${viaCode} ${ev.category} from a check-in code today. Pay this shift too?`)) return;
        setBusyFor(s.id, true);
        try {
            const { data: bp, error } = await supabase.from('bonus_points').insert({
                member_id: s.memberId,
                points: ev.pointsValue,
                reason: ev.title,
                category: ev.category,
                date: new Date().toISOString(),
            }).select('id').single();
            if (error) throw error;
            // Only link if nobody else marked it first; otherwise undo our row.
            const { data: linked, error: linkError } = await supabase.from('event_signups')
                .update({ bonus_point_id: bp.id }).eq('id', s.id).is('bonus_point_id', null).select('id');
            if (linkError || !linked?.length) {
                await supabase.from('bonus_points').delete().eq('id', bp.id);
                if (linkError) throw linkError;
            } else {
                setPaidOverride(prev => ({ ...prev, [s.id]: bp.id }));
            }
        } catch (e: any) {
            console.error('Marking attended failed', e);
            alert(`Marking attended didn't save: ${e?.message || 'unknown error'}. Please try again.`);
        } finally {
            setBusyFor(s.id, false);
        }
    };

    const unmarkAttended = async (s: EventSignup) => {
        const bonusPointId = paidIdOf(s);
        if (!bonusPointId) return;
        if (!window.confirm(`Remove ${nameOf(s.memberId)}'s ${ev.pointsValue} pt${ev.pointsValue === 1 ? '' : 's'} for this shift?`)) return;
        setBusyFor(s.id, true);
        try {
            const { error } = await supabase.from('event_signups').update({ bonus_point_id: null }).eq('id', s.id);
            if (error) throw error;
            setPaidOverride(prev => ({ ...prev, [s.id]: null }));
            const { error: bpError } = await supabase.from('bonus_points').delete().eq('id', bonusPointId);
            if (bpError) throw bpError;
        } catch (e: any) {
            console.error('Unmarking failed', e);
            alert(`Removing the points didn't save: ${e?.message || 'unknown error'}.`);
        } finally {
            setBusyFor(s.id, false);
        }
    };

    const unpaid = signups.filter(s => !paidIdOf(s));
    // "Mark all" leaves out anyone already paid through a check-in code.
    const unpaidNoCode = unpaid.filter(s => codeCheckinPoints(s.memberId) === 0);

    return (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm shrink-0">
            <h3 className="font-bold text-[#154734] mb-1 flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5" /> Mark Shift Attendance
            </h3>
            <p className="text-xs text-gray-500 mb-4">
                Signing up only holds a slot. Tick who actually showed up to give them the event's points.
            </p>
            <select className="w-full border p-2 rounded mb-3" value={ev.id} onChange={e => setEventId(e.target.value)} aria-label="Event">
                {markable.map(e => (
                    <option key={e.id} value={e.id}>{e.date}{e.time ? ` ${formatGameTime(e.time)}` : ''} · {e.title}</option>
                ))}
            </select>
            <div className="divide-y divide-gray-100 border rounded-lg">
                {signups.map(s => {
                    const paid = !!paidIdOf(s);
                    const viaCode = codeCheckinPoints(s.memberId);
                    const isBusy = busy.has(s.id);
                    return (
                        <button
                            key={s.id}
                            type="button"
                            disabled={isBusy}
                            onClick={() => (paid ? unmarkAttended(s) : markAttended(s))}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 disabled:opacity-60"
                        >
                            {isBusy ? <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                                : paid ? <CheckSquare className="w-5 h-5 text-[#154734]" />
                                : <Square className="w-5 h-5 text-gray-400" />}
                            <span className="flex-1 font-medium text-gray-900">{nameOf(s.memberId)}</span>
                            <span className={`text-xs font-bold ${paid ? 'text-green-700' : 'text-gray-400'}`}>
                                {paid ? `+${ev.pointsValue} ${ev.category}` : 'Not marked'}
                                {viaCode > 0 && <span className="block text-amber-700">+{viaCode} via check-in code</span>}
                            </span>
                        </button>
                    );
                })}
            </div>
            {unpaidNoCode.length > 1 && (
                <button
                    type="button"
                    onClick={() => unpaidNoCode.forEach(s => markAttended(s, true))}
                    className="mt-3 text-sm font-bold text-[#154734] hover:underline"
                >
                    Mark all {unpaidNoCode.length} attended
                </button>
            )}
        </div>
    );
};
