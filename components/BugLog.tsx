import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { Bug, Plus, Check, RotateCcw, Trash2 } from 'lucide-react';

interface BugReport {
    id: string;
    description: string;
    page: string | null;
    reportedBy: string | null;
    priority: string;
    status: string;
    createdAt: string;
    fixedAt: string | null;
}

const PAGES = ['Check-in', 'Member Portal', 'Leaderboard', 'Game Calendar', 'Management', 'Login', 'Interest Form', 'Other'];
const PRIORITIES = ['Low', 'Normal', 'High'];
const PRIORITY_STYLES: Record<string, string> = {
    High: 'bg-red-100 text-red-700',
    Normal: 'bg-yellow-100 text-yellow-800',
    Low: 'bg-gray-100 text-gray-600',
};

const fromRow = (r: any): BugReport => ({
    id: r.id,
    description: r.description,
    page: r.page,
    reportedBy: r.reported_by,
    priority: r.priority,
    status: r.status,
    createdAt: r.created_at,
    fixedAt: r.fixed_at,
});

// Self-contained (talks to Supabase directly) so the bug log doesn't need to
// be threaded through App's data loading like the other Management tabs.
export const BugLog: React.FC = () => {
    const [bugs, setBugs] = useState<BugReport[]>([]);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [showFixed, setShowFixed] = useState(false);
    const [form, setForm] = useState({ description: '', page: '', reportedBy: '', priority: 'Normal' });
    const [saving, setSaving] = useState(false);

    const load = async () => {
        const { data, error } = await supabase.from('bug_reports').select('*').order('created_at', { ascending: false });
        if (error) { setLoadError(error.message); return; }
        setLoadError(null);
        setBugs((data || []).map(fromRow));
    };

    useEffect(() => { load(); }, []);

    const handleAdd = async () => {
        if (!form.description.trim()) return;
        setSaving(true);
        const { error } = await supabase.from('bug_reports').insert({
            description: form.description.trim(),
            page: form.page || null,
            reported_by: form.reportedBy.trim() || null,
            priority: form.priority,
        });
        setSaving(false);
        if (error) { alert(`Couldn't save bug: ${error.message}`); return; }
        setForm({ description: '', page: '', reportedBy: '', priority: 'Normal' });
        load();
    };

    const setStatus = async (bug: BugReport, status: 'Open' | 'Fixed') => {
        const { error } = await supabase.from('bug_reports')
            .update({ status, fixed_at: status === 'Fixed' ? new Date().toISOString() : null })
            .eq('id', bug.id);
        if (error) { alert(`Couldn't update bug: ${error.message}`); return; }
        load();
    };

    const handleDelete = async (bug: BugReport) => {
        if (!confirm('Delete this bug report?')) return;
        const { error } = await supabase.from('bug_reports').delete().eq('id', bug.id);
        if (error) { alert(`Couldn't delete bug: ${error.message}`); return; }
        load();
    };

    const open = bugs.filter(b => b.status !== 'Fixed');
    const fixed = bugs.filter(b => b.status === 'Fixed');
    const shown = showFixed ? fixed : open;

    return (
        <div className="flex flex-col h-full gap-4 overflow-y-auto">
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm shrink-0">
                <h3 className="font-bold text-[#154734] mb-1 flex items-center gap-2">
                    <Bug className="w-5 h-5" /> Log a Bug
                </h3>
                <p className="text-xs text-gray-500 mb-4">
                    Jot down anything broken you hear about or run into. Only the description is required.
                </p>
                <textarea
                    className="w-full border p-2 rounded mb-3"
                    rows={3}
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="What's wrong? e.g. Check-in says 'too far away' at Ferrell Center"
                />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="text-xs font-bold text-gray-500">Where on the site</label>
                        <select className="w-full border p-2 rounded" value={form.page} onChange={e => setForm(f => ({ ...f, page: e.target.value }))}>
                            <option value="">Not sure</option>
                            {PAGES.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500">Reported by</label>
                        <input type="text" className="w-full border p-2 rounded" value={form.reportedBy} onChange={e => setForm(f => ({ ...f, reportedBy: e.target.value }))} placeholder="Optional" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500">Priority</label>
                        <select className="w-full border p-2 rounded" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>
                </div>
                <button
                    onClick={handleAdd}
                    disabled={saving || !form.description.trim()}
                    className="mt-4 bg-[#FFB81C] text-[#154734] font-bold py-2 px-4 rounded hover:bg-yellow-400 flex items-center gap-2 disabled:opacity-50"
                >
                    <Plus className="w-4 h-4" /> {saving ? 'Saving...' : 'Log Bug'}
                </button>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex-1 overflow-auto">
                <div className="p-4 border-b bg-gray-50 flex items-center gap-4">
                    <button onClick={() => setShowFixed(false)} className={`font-bold ${!showFixed ? 'text-[#154734]' : 'text-gray-400'}`}>
                        Open ({open.length})
                    </button>
                    <button onClick={() => setShowFixed(true)} className={`font-bold ${showFixed ? 'text-[#154734]' : 'text-gray-400'}`}>
                        Fixed ({fixed.length})
                    </button>
                </div>
                {loadError ? (
                    <div className="p-8 text-center text-red-500 text-sm">
                        Couldn't load the bug log: {loadError}
                    </div>
                ) : shown.length === 0 ? (
                    <div className="p-8 text-center text-gray-400 italic">{showFixed ? 'Nothing fixed yet.' : 'No open bugs.'}</div>
                ) : (
                    <ul className="divide-y divide-gray-100">
                        {shown.map(bug => (
                            <li key={bug.id} className="p-4 flex gap-4 items-start hover:bg-gray-50">
                                <div className="flex-1 min-w-0">
                                    <div className={`whitespace-pre-wrap ${bug.status === 'Fixed' ? 'line-through text-gray-400' : 'text-gray-900'}`}>{bug.description}</div>
                                    <div className="flex flex-wrap gap-2 mt-2 text-xs text-gray-500 items-center">
                                        <span className={`font-bold px-2 py-0.5 rounded-full ${PRIORITY_STYLES[bug.priority] || PRIORITY_STYLES.Normal}`}>{bug.priority}</span>
                                        {bug.page && <span className="bg-[#154734]/10 text-[#154734] font-bold px-2 py-0.5 rounded-full">{bug.page}</span>}
                                        <span>{new Date(bug.createdAt).toLocaleDateString()}</span>
                                        {bug.reportedBy && <span>from {bug.reportedBy}</span>}
                                        {bug.fixedAt && <span className="text-green-600">fixed {new Date(bug.fixedAt).toLocaleDateString()}</span>}
                                    </div>
                                </div>
                                {bug.status === 'Fixed' ? (
                                    <button onClick={() => setStatus(bug, 'Open')} title="Reopen" className="text-gray-400 hover:text-[#154734]">
                                        <RotateCcw className="w-4 h-4" />
                                    </button>
                                ) : (
                                    <button onClick={() => setStatus(bug, 'Fixed')} title="Mark fixed" className="text-gray-400 hover:text-green-600">
                                        <Check className="w-5 h-5" />
                                    </button>
                                )}
                                <button onClick={() => handleDelete(bug)} title="Delete" className="text-gray-400 hover:text-red-500">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};
