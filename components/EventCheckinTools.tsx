import React, { useState } from 'react';
import { Plus, QrCode, Clock } from 'lucide-react';
import { Game, Sport } from '../types';
import { POINT_CATEGORIES } from '../constants';
import { supabase } from '../utils/supabaseClient';
import { isEventCheckin, checkinCategory, eventCheckinPrefixFor } from '../utils/fanTier';
import { isMeetingSport } from '../utils/applicationArchive';
import { todayInChicago, formatGameTime, timeSortKey } from '../utils/dateUtils';
import { EventCheckinCode } from './EventCheckinCode';

interface EventCheckinToolsProps {
    games: Game[];
    sports: Sport[];
}

// Categories that have an event check-in prefix (everything but 'Other').
const CHECKIN_CATEGORIES = POINT_CATEGORIES.filter(c => eventCheckinPrefixFor(c));

// Officer tools for event check-ins: create one (a games row with a category
// prefix, location 'Away' so the geofence is off), and open the rotating
// check-in code for today's. Writes go straight to Supabase; the realtime
// subscription in App.tsx refreshes the list.
export const EventCheckinTools: React.FC<EventCheckinToolsProps> = ({ games, sports }) => {
    // Games need a sport_id. Default to Meetings: it's a club thing, not a team.
    const defaultSportId = (sports.find(isMeetingSport) || sports[0])?.id || '';
    const blankForm = (category = 'Marketing') => ({
        title: '', category, date: todayInChicago(), startTime: '', endTime: '', points: 1, sportId: '', location: '',
    });
    const [form, setForm] = useState(blankForm());
    const [saving, setSaving] = useState(false);
    const [showCodeFor, setShowCodeFor] = useState<Game | null>(null);

    const today = todayInChicago();
    const checkins = games
        .filter(g => isEventCheckin(g) && g.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date) || timeSortKey(a.time).localeCompare(timeSortKey(b.time)));

    const handleCreate = async () => {
        const prefix = eventCheckinPrefixFor(form.category);
        const sportId = form.sportId || defaultSportId;
        if (!form.title.trim() || !form.date || !prefix || !sportId) {
            alert('Please fill in at least a title, category and date.');
            return;
        }
        // id: <prefix><sport>_<date>[_<HHMM>], e.g. tabling_vb_2026-10-22_1200
        const id = `${prefix}${sportId}_${form.date}${form.startTime ? '_' + form.startTime.replace(':', '') : ''}`;
        const timeRange = form.startTime
            ? `${formatGameTime(form.startTime)}${form.endTime ? `-${formatGameTime(form.endTime)}` : ''}`
            : '';
        const row: Record<string, unknown> = {
            id,
            sport_id: sportId,
            date: form.date,
            time: form.startTime || null,
            end_time: form.endTime || null,
            opponent: form.title.trim(),
            location: 'Away', // no geofence for event check-ins
            is_bonus: false,
            points_value: Math.max(0, Number(form.points) || 0),
            description: [form.location.trim(), timeRange, `${form.category} event check-in. Location check off.`].filter(Boolean).join(' · '),
        };
        setSaving(true);
        let { error } = await supabase.from('games').insert(row);
        // games.end_time comes from the 20261026 migration; without it, save the rest.
        if (error && /end_time/.test(error.message || '')) {
            delete row.end_time;
            ({ error } = await supabase.from('games').insert(row));
        }
        setSaving(false);
        if (error) {
            alert(error.code === '23505'
                ? 'A check-in with the same category, sport, date and start time already exists.'
                : `Creating the check-in didn't save: ${error.message}`);
            return;
        }
        setForm(blankForm(form.category));
    };

    return (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm shrink-0">
            <h3 className="font-bold text-[#154734] mb-1 flex items-center gap-2">
                <QrCode className="w-5 h-5" /> New Event Check-in
            </h3>
            <p className="text-xs text-gray-500 mb-4">
                For club events where members earn points by showing up (tabling, hospitality, service...). Members check in with the rotating code you show on your phone. No location check.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label className="text-xs font-bold text-gray-500">Title</label>
                    <input type="text" className="w-full border p-2 rounded" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Volleyball Tabling" />
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-500">Category</label>
                    <select className="w-full border p-2 rounded" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                        {CHECKIN_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-500">Location</label>
                    <input type="text" className="w-full border p-2 rounded" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Optional, e.g. Fountain Mall" />
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-500">Date</label>
                    <input type="date" className="w-full border p-2 rounded" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="text-xs font-bold text-gray-500">Start</label>
                        <input type="time" className="w-full border p-2 rounded" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500">End</label>
                        <input type="time" className="w-full border p-2 rounded" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="text-xs font-bold text-gray-500">Points</label>
                        <input type="number" min={0} className="w-full border p-2 rounded" value={form.points} onChange={e => setForm(f => ({ ...f, points: Number(e.target.value) }))} />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500">Linked Sport</label>
                        <select className="w-full border p-2 rounded" value={form.sportId || defaultSportId} onChange={e => setForm(f => ({ ...f, sportId: e.target.value }))}>
                            {sports.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                </div>
            </div>
            <p className="text-[11px] text-gray-400 mt-2">Members can check in from 1 hour before the start until 1 hour after the end (4 hours after the start if there's no end). No start time = all day.</p>
            <button onClick={handleCreate} disabled={saving} className="mt-4 bg-[#FFB81C] text-[#154734] font-bold py-2 px-4 rounded hover:bg-yellow-400 flex items-center gap-2 disabled:opacity-50">
                <Plus className="w-4 h-4" /> {saving ? 'Creating...' : 'Create Check-in'}
            </button>

            {checkins.length > 0 && (
                <div className="mt-6 border-t pt-4">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Current &amp; Upcoming Check-ins</h4>
                    <div className="divide-y divide-gray-100">
                        {checkins.map(g => (
                            <div key={g.id} className="py-3 flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="font-bold text-gray-900 truncate">{g.opponent}</p>
                                    <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{g.date} · {formatGameTime(g.time)}</span>
                                        <span className="bg-[#154734]/10 text-[#154734] font-bold px-2 py-0.5 rounded-full">{checkinCategory(g)} · +{g.pointsValue}</span>
                                        {g.description && <span className="truncate">{g.description}</span>}
                                    </div>
                                </div>
                                {g.date === today ? (
                                    <button onClick={() => setShowCodeFor(g)} className="shrink-0 flex items-center gap-1 text-sm font-bold text-white bg-[#154734] hover:bg-[#0f3325] px-3 py-1.5 rounded-lg">
                                        <QrCode className="w-4 h-4" /> Show Code
                                    </button>
                                ) : (
                                    <span className="shrink-0 text-xs text-gray-400">Not today</span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {showCodeFor && <EventCheckinCode game={showCodeFor} onClose={() => setShowCodeFor(null)} />}
        </div>
    );
};
