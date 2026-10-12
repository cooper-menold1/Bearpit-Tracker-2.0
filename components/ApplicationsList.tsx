import React, { useState, useEffect } from 'react';
import { AppState, Role, EmailTemplate } from '../types';
import { Users, Mail, Settings2, Save, Eye, EyeOff, Copy, Check, FileSpreadsheet } from 'lucide-react';
import { renderEmailTemplate, buildMailto, buildBulkMailto, downloadMailMergeCSV } from '../utils/emailTemplate';

interface ApplicationsListProps {
    data: AppState;
    onApprove: (memberId: string) => void;
    onReject: (memberId: string) => void;
    onSaveTemplate: (template: EmailTemplate) => void;
}

const EMPTY_TEMPLATE: EmailTemplate = {
    id: 'prospective_welcome',
    subject: '',
    body: '',
    meetingType: 'interest session',
    meetingDate: '',
    meetingTime: '',
    meetingLocation: '',
};

export const ApplicationsList: React.FC<ApplicationsListProps> = ({ data, onApprove, onReject, onSaveTemplate }) => {
    const prospective = data.members.filter(m => m.role === Role.PROSPECTIVE);
    const [form, setForm] = useState<EmailTemplate>(data.emailTemplate || EMPTY_TEMPLATE);
    const [showConfig, setShowConfig] = useState(!data.emailTemplate);
    const [showPreview, setShowPreview] = useState(false);
    const [saved, setSaved] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [emailsCopied, setEmailsCopied] = useState(false);

    const toggleSelected = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };
    const allSelected = prospective.length > 0 && prospective.every(m => selectedIds.has(m.id));
    const toggleSelectAll = () => {
        setSelectedIds(allSelected ? new Set() : new Set(prospective.map(m => m.id)));
    };

    const selectedWithEmail = prospective.filter(m => selectedIds.has(m.id) && m.email);
    const selectedMissingEmail = prospective.filter(m => selectedIds.has(m.id) && !m.email).length;
    // Bulk send can't merge a different {{first_name}} per recipient the way
    // the one-at-a-time mailto does, so it renders once with a generic
    // greeting shared by everyone in the bcc.
    const bulkMailtoHref = data.emailTemplate && selectedWithEmail.length > 0
        ? (() => {
            const { subject, body } = renderEmailTemplate(data.emailTemplate, { id: '', firstName: '', lastName: '', role: Role.PROSPECTIVE, yearsInBPLT: 0 });
            return buildBulkMailto(subject, body, selectedWithEmail.map(m => m.email!));
        })()
        : undefined;

    // Copies every applicant's email regardless of checkbox selection --
    // paste straight into Outlook's To/Bcc field alongside a template
    // pasted in manually, as a fallback that doesn't depend on mailto:
    // links or a particular default mail app being set up correctly.
    const copyAllEmails = () => {
        const emails = prospective.filter(m => m.email).map(m => m.email!);
        navigator.clipboard.writeText(emails.join('; ')).then(() => {
            setEmailsCopied(true);
            setTimeout(() => setEmailsCopied(false), 2000);
        });
    };

    useEffect(() => {
        if (data.emailTemplate) setForm(data.emailTemplate);
    }, [data.emailTemplate]);

    const handleSave = () => {
        onSaveTemplate(form);
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
    };

    const previewMember = { id: 'preview', firstName: 'Riley', lastName: 'Sample', role: Role.PROSPECTIVE, yearsInBPLT: 0, email: 'riley.sample1@baylor.edu' };
    const preview = form.subject && form.body ? renderEmailTemplate(form, previewMember) : null;

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <button
                    onClick={() => setShowConfig(v => !v)}
                    className="w-full p-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="bg-amber-100 p-2 rounded-lg text-amber-700">
                            <Settings2 className="w-6 h-6" />
                        </div>
                        <div className="text-left">
                            <h2 className="text-xl font-bold text-[#154734]">Automation Configuration</h2>
                            <p className="text-gray-500 text-sm">Manage the welcome email sent to new prospective members.</p>
                        </div>
                    </div>
                    <span className="text-gray-400 text-sm font-medium">{showConfig ? 'Hide' : 'Edit'}</span>
                </button>

                {showConfig && (
                    <div className="p-6 border-t border-gray-100 space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Subject</label>
                            <input aria-label="Email subject"
                                type="text"
                                value={form.subject}
                                onChange={e => setForm({ ...form, subject: e.target.value })}
                                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-[#154734] outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Body</label>
                            <textarea aria-label="Email body"
                                value={form.body}
                                onChange={e => setForm({ ...form, body: e.target.value })}
                                rows={12}
                                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm font-mono focus:ring-2 focus:ring-[#154734] outline-none"
                            />
                            <p className="text-xs text-gray-400 mt-1">
                                Placeholders: <code className="bg-gray-100 px-1 rounded">{'{{first_name}}'}</code>{' '}
                                <code className="bg-gray-100 px-1 rounded">{'{{meeting_type}}'}</code>{' '}
                                <code className="bg-gray-100 px-1 rounded">{'{{date}}'}</code>{' '}
                                <code className="bg-gray-100 px-1 rounded">{'{{time}}'}</code>{' '}
                                <code className="bg-gray-100 px-1 rounded">{'{{location}}'}</code>
                            </p>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Meeting Type</label>
                                <select aria-label="Meeting type"
                                    value={form.meetingType || 'interest session'}
                                    onChange={e => setForm({ ...form, meetingType: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-white outline-none"
                                >
                                    <option value="interest session">Interest Session</option>
                                    <option value="General Meeting">General Meeting</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Date</label>
                                <input aria-label="Meeting date"
                                    type="date"
                                    value={form.meetingDate || ''}
                                    onChange={e => setForm({ ...form, meetingDate: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Time</label>
                                <input aria-label="Meeting time"
                                    type="text"
                                    placeholder="6:30 PM"
                                    value={form.meetingTime || ''}
                                    onChange={e => setForm({ ...form, meetingTime: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Location</label>
                                <input aria-label="Meeting location"
                                    type="text"
                                    placeholder="Foster 240"
                                    value={form.meetingLocation || ''}
                                    onChange={e => setForm({ ...form, meetingLocation: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm outline-none"
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-3 pt-2">
                            <button
                                onClick={handleSave}
                                className="bg-[#154734] text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-[#0e3022] flex items-center gap-2"
                            >
                                <Save className="w-4 h-4" /> {saved ? 'Saved!' : 'Save Template'}
                            </button>
                            <button
                                onClick={() => setShowPreview(v => !v)}
                                className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm font-medium flex items-center gap-2"
                            >
                                {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />} {showPreview ? 'Hide' : 'Show'} Preview
                            </button>
                        </div>

                        {showPreview && preview && (
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-2">
                                <p className="text-xs font-bold text-gray-400 uppercase mb-1">Subject</p>
                                <p className="font-bold text-gray-800 mb-3">{preview.subject}</p>
                                <p className="text-xs font-bold text-gray-400 uppercase mb-1">Body</p>
                                <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700">{preview.body}</pre>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-100 p-2 rounded-lg text-blue-700">
                            <Users className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-[#154734]">Membership Applications</h2>
                            <p className="text-gray-500 text-sm">People who filled out "Interested in Joining?"</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        {prospective.some(m => m.email) && (
                            <button
                                onClick={copyAllEmails}
                                title="Copies every applicant's email, semicolon-separated -- paste into Outlook's To/Bcc field"
                                className="inline-flex items-center gap-2 bg-gray-100 text-gray-700 px-3 py-2 rounded-lg text-sm font-bold hover:bg-gray-200"
                            >
                                {emailsCopied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                                {emailsCopied ? 'Copied!' : 'Copy All Emails'}
                            </button>
                        )}
                    </div>
                    {selectedIds.size > 0 && (
                        <div className="flex items-center gap-2">
                            {selectedMissingEmail > 0 && (
                                <span className="text-xs text-amber-600">{selectedMissingEmail} selected with no email will be skipped</span>
                            )}
                            {selectedWithEmail.length > 0 && (
                                <button
                                    onClick={() => downloadMailMergeCSV(selectedWithEmail.map(m => ({ firstName: m.firstName, lastName: m.lastName, email: m.email! })), 'bearpit-applicants-mail-merge.csv')}
                                    title="Download a CSV to use with Outlook/Word Mail Merge -- sends a real individual 'Dear [First Name]' email to each person"
                                    className="inline-flex items-center gap-2 bg-blue-100 text-blue-800 px-3 py-2 rounded-lg text-sm font-bold hover:bg-blue-200"
                                >
                                    <FileSpreadsheet className="w-4 h-4" /> Export for Mail Merge ({selectedWithEmail.length})
                                </button>
                            )}
                            {bulkMailtoHref ? (
                                <a
                                    href={bulkMailtoHref}
                                    title="Opens one email addressed (bcc) to everyone selected"
                                    className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 px-3 py-2 rounded-lg text-sm font-bold hover:bg-amber-200"
                                >
                                    <Mail className="w-4 h-4" /> Email Selected ({selectedWithEmail.length})
                                </a>
                            ) : (
                                <span className="text-xs text-gray-400" title="Save a welcome-email template above first">
                                    Save a template above to email selected applicants
                                </span>
                            )}
                        </div>
                    )}
                </div>
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-700 uppercase text-xs">
                        <tr>
                            <th className="px-4 py-3 w-8">
                                <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} aria-label="Select all applicants" />
                            </th>
                            <th className="px-6 py-3">Name</th>
                            <th className="px-6 py-3">Email</th>
                            <th className="px-6 py-3">Phone</th>
                            <th className="px-6 py-3">Year</th>
                            <th className="px-6 py-3">Heard About</th>
                            <th className="px-6 py-3">Referred By</th>
                            <th className="px-6 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {prospective.map(m => {
                            const mailtoHref = data.emailTemplate && m.email ? buildMailto(data.emailTemplate, m) : undefined;
                            return (
                                <tr key={m.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-4">
                                        <input type="checkbox" checked={selectedIds.has(m.id)} onChange={() => toggleSelected(m.id)} aria-label={`Select ${m.firstName} ${m.lastName}`} />
                                    </td>
                                    <td className="px-6 py-4 font-bold text-gray-900">{m.firstName} {m.lastName}</td>
                                    <td className="px-6 py-4 text-blue-600">{m.email || 'No Email'}</td>
                                    <td className="px-6 py-4 text-gray-500">{m.phone || '—'}</td>
                                    <td className="px-6 py-4 text-gray-500">{m.year || '—'}</td>
                                    <td className="px-6 py-4 text-gray-500">{m.heardAbout || '—'}</td>
                                    <td className="px-6 py-4 text-gray-500">{m.referredBy || '—'}</td>
                                    <td className="px-6 py-4 text-right whitespace-nowrap">
                                        {mailtoHref ? (
                                            <a
                                                href={mailtoHref}
                                                title="Open a pre-filled welcome email to this person"
                                                className="inline-flex items-center gap-1 text-amber-600 hover:text-amber-800 font-bold mr-3"
                                            >
                                                <Mail className="w-4 h-4" /> Email
                                            </a>
                                        ) : (
                                            <span className="text-gray-300 mr-3" title={m.email ? 'Save a template above first' : 'No email on file'}>
                                                <Mail className="w-4 h-4 inline" /> Email
                                            </span>
                                        )}
                                        <button onClick={() => onApprove(m.id)} className="text-green-600 hover:text-green-800 font-bold mr-3">Approve</button>
                                        <button onClick={() => onReject(m.id)} className="text-red-500 hover:text-red-700">Reject</button>
                                    </td>
                                </tr>
                            );
                        })}
                        {prospective.length === 0 && (
                            <tr><td colSpan={8} className="px-6 py-10 text-center text-gray-400 italic">No pending applications.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
