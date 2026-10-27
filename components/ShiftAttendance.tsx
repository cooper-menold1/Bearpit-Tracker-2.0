import React, { useState } from 'react';
import { CheckSquare, Square, Loader2, ClipboardCheck } from 'lucide-react';
import { ClubEvent, EventSignup, Member } from '../types';
import { supabase } from '../utils/supabaseClient';
import { todayInChicago, formatGameTime } from '../utils/dateUtils';

interface ShiftAttendanceProps {
    clubEvents: ClubEvent[];
    eventSignups: EventSignup[];
    members: Member[];
}

// Club event shifts pay on attendance, not sign-up. On (or after) the event
// day an officer ticks who actually showed; ticking writes the bonus_points
// row and links it on the signup (event_signups.bonus_point_id), unticking
// removes it. No schema change needed. A signup that already has a
// bonus_point_id is "paid" -- that includes signups from before 2026-10-26,
// which were paid at sign-up and keep their points.
export const ShiftAttendance: React.FC<ShiftAttendanceProps> = ({ clubEvents, eventSignups, members }) => {
    const today = todayInChicago();
    // Today's and past events that have signups, most recent first.
    const markable = clubEvents
        .filter(e => e.date <= today && eventSignups.some(s => s.eventId === e.id))
        .sort((a, b) => b.date.localeCompare(a.date) || (b.time || '').localeCompare(a.time || ''));
    const [eventId, setEventId] = useState('');
    const [busy, setBusy] = useState<Set<string>>(new Set());
    const ev = markable.find(e => e.id === eventId) || markable[0];

    if (!ev) return null;

    const signups = eventSignups.filter(s => s.eventId === ev.id);
    const nameOf = (id: string) => {
        const m = members.find(x => x.id === id);
        return m ? `${m.firstName} ${m.lastName}` : 'Unknown member';
    };
    const setBusyFor = (id: string, on: boolean) => setBusy(prev => {
        const next = new Set(prev);
        if (on) next.add(id); else next.delete(id);
        return next;
    });

    const markAttended = async (s: EventSignup) => {
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
            }
        } catch (e: any) {
            console.error('Marking attended failed', e);
            alert(`Marking attended didn't save: ${e?.message || 'unknown error'}. Please try again.`);
        } finally {
            setBusyFor(s.id, false);
        }
    };

    const unmarkAttended = async (s: EventSignup) => {
        if (!s.bonusPointId) return;
        if (!window.confirm(`Remove ${nameOf(s.memberId)}'s ${ev.pointsValue} pt${ev.pointsValue === 1 ? '' : 's'} for this shift?`)) return;
        setBusyFor(s.id, true);
        try {
            const { error } = await supabase.from('event_signups').update({ bonus_point_id: null }).eq('id', s.id);
            if (error) throw error;
            const { error: bpError } = await supabase.from('bonus_points').delete().eq('id', s.bonusPointId);
            if (bpError) throw bpError;
        } catch (e: any) {
            console.error('Unmarking failed', e);
            alert(`Removing the points didn't save: ${e?.message || 'unknown error'}.`);
        } finally {
            setBusyFor(s.id, false);
        }
    };

    const unpaid = signups.filter(s => !s.bonusPointId);

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
                    const paid = !!s.bonusPointId;
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
                            </span>
                        </button>
                    );
                })}
            </div>
            {unpaid.length > 1 && (
                <button
                    type="button"
                    onClick={() => unpaid.forEach(markAttended)}
                    className="mt-3 text-sm font-bold text-[#154734] hover:underline"
                >
                    Mark all {unpaid.length} attended
                </button>
            )}
        </div>
    );
};
