
import React, { useMemo, useState } from 'react';
import { Member, Role } from '../types';
import { CheckCircle2, ArrowLeft, UserPlus, AlertTriangle, X } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import { PrivacyLink } from './PrivacyPolicy';
import { canBeReferrer } from '../utils/fanTier';

interface InterestFormProps {
    members: Member[];
    onSubmit: (member: Member) => void;
    onBack: () => void;
}

const YEAR_OPTIONS = ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Grad Student'];
const HEARD_OPTIONS = ['A game', 'Late Night', 'A friend / word of mouth', 'Instagram', 'Other'];

// Public "I'm interested" form -- separate from AttendanceForm (which is
// now for existing members checking in at a game only). This is the
// intake point for Late Night / tabling / anyone new: name + Baylor email
// is all that's required, phone and year are optional so it stays quick.
export const InterestForm: React.FC<InterestFormProps> = ({ members, onSubmit, onBack }) => {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [year, setYear] = useState('');
    const [heardAbout, setHeardAbout] = useState('');
    // Referrer: pick a current member (earns them Recruitment points
    // automatically, see utils/fanTier.ts), or "someone else" for free text.
    const [referrerId, setReferrerId] = useState('');
    const [referrerQuery, setReferrerQuery] = useState('');
    const [referrerOther, setReferrerOther] = useState(false);
    const [referredBy, setReferredBy] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');

    const emailValid = email.toLowerCase().endsWith('@baylor.edu');

    const referrerOptions = useMemo(
        () => members.filter(canBeReferrer).sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)),
        [members]
    );
    const referrer = referrerOptions.find(m => m.id === referrerId);
    // Every word typed must start a word of the name ("jo sm" finds John Smith).
    const referrerMatches = useMemo(() => {
        const words = referrerQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
        if (words.length === 0) return [];
        return referrerOptions.filter(m => {
            const parts = `${m.firstName} ${m.lastName}`.toLowerCase().split(/\s+/);
            return words.every(w => parts.some(p => p.startsWith(w)));
        }).slice(0, 6);
    }, [referrerQuery, referrerOptions]);

    // Someone already on the roster (Member/Officer/Admin, not a still-pending
    // Prospective) doesn't need to fill this out -- catches the case where an
    // existing member finds this form instead of the Member Portal.
    const existingMember = members.find(m => {
        if (m.role === Role.PROSPECTIVE) return false;
        const emailMatch = !!email.trim() && !!m.email && m.email.toLowerCase() === email.trim().toLowerCase();
        const nameMatch = !!firstName.trim() && !!lastName.trim() &&
            `${m.firstName} ${m.lastName}`.toLowerCase() === `${firstName.trim()} ${lastName.trim()}`.toLowerCase();
        return emailMatch || nameMatch;
    });

    const canSubmit = firstName.trim() && lastName.trim() && emailValid && !existingMember;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit || submitting) return;

        setSubmitting(true);
        setSubmitError('');

        const member: Member = {
            id: `prospect_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.trim(),
            phone: phone.trim() || undefined,
            year: year || undefined,
            heardAbout: heardAbout || undefined,
            // Keep the free-text name filled for a picked member too (older views read it).
            referredBy: referrer ? `${referrer.firstName} ${referrer.lastName}` : (referrerOther ? referredBy.trim() || undefined : undefined),
            referredById: referrer?.id,
            role: Role.PROSPECTIVE,
            yearsInBPLT: 0,
        };

        try {
            // Written directly here (rather than only via the onSubmit prop)
            // and awaited, so a real write failure is caught and shown to the
            // person submitting instead of silently swallowed -- this is the
            // public "I'm interested" form, unattended, often on someone's
            // phone on weak signal at a table/game, so a lost signup with no
            // error shown is the failure mode that actually matters here.
            const row: Record<string, unknown> = {
                id: member.id,
                first_name: member.firstName,
                last_name: member.lastName,
                role: member.role,
                years_in_bplt: member.yearsInBPLT,
                email: member.email,
                phone: member.phone,
                year: member.year,
                heard_about: member.heardAbout,
                referred_by: member.referredBy,
            };
            if (member.referredById) row.referred_by_id = member.referredById;
            let { error } = await supabase.from('members').insert(row);
            // referred_by_id needs 20261026_referral_points.sql. If it's missing (or
            // not granted yet), save without it -- the referrer's name is still in referred_by.
            if (error && 'referred_by_id' in row && /referred_by_id|permission denied|PGRST204|42703|42501/i.test(`${error.code} ${error.message}`)) {
                delete row.referred_by_id;
                ({ error } = await supabase.from('members').insert(row));
            }
            if (error) throw error;

            setSubmitted(true);
            // Best-effort refresh of the parent's cached member list -- the
            // real save already succeeded above, so a failure here (e.g. the
            // redundant upsert inside handleAddMember) isn't user-facing.
            try { onSubmit(member); } catch { /* non-fatal, see above */ }
        } catch (err) {
            console.error('Interest form submit failed:', err);
            setSubmitError("Something went wrong submitting your info. Please try again -- if it keeps happening, find a BearPit officer and let them know.");
        } finally {
            setSubmitting(false);
        }
    };

    if (submitted) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-xl shadow-sm text-center max-w-md w-full border-t-4 border-[#154734]">
                    <div className="w-16 h-16 bg-green-100 text-[#154734] rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">You're on the list!</h2>
                    <p className="text-gray-600 mb-6">
                        Thanks for your interest in BearPit. Keep an eye on your Baylor email -- we'll follow up
                        with the next meeting or intersession time.
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="text-[#154734] hover:text-[#FFB81C] font-bold transition-colors"
                    >
                        Submit another response
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#154734] flex flex-col items-center pt-12 p-4 relative">
            <button
                onClick={onBack}
                className="absolute top-4 left-4 flex items-center gap-1 text-white/80 hover:text-white text-sm font-medium transition-colors z-10"
            >
                <ArrowLeft className="w-4 h-4" /> Back to Login
            </button>

            <div className="w-full max-w-lg bg-white rounded-xl shadow-lg overflow-hidden border-2 border-[#FFB81C]">
                <div className="bg-[#FFB81C] p-4 text-center">
                    <div className="flex items-center justify-center gap-2 mb-1">
                        <UserPlus className="w-5 h-5 text-[#154734]" />
                        <h1 className="text-xl font-bold text-[#154734]">Interested in Joining BearPit?</h1>
                    </div>
                    <p className="text-[#154734] text-sm font-semibold opacity-90">Takes less than a minute</p>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">First Name</label>
                            <input aria-label="First name"
                                type="text"
                                required
                                value={firstName}
                                onChange={e => setFirstName(e.target.value)}
                                className="w-full bg-white text-black border border-gray-300 rounded-lg p-2.5 focus:ring-[#FFB81C] focus:border-[#FFB81C]"
                                placeholder="First"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Last Name</label>
                            <input aria-label="Last name"
                                type="text"
                                required
                                value={lastName}
                                onChange={e => setLastName(e.target.value)}
                                className="w-full bg-white text-black border border-gray-300 rounded-lg p-2.5 focus:ring-[#FFB81C] focus:border-[#FFB81C]"
                                placeholder="Last"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Baylor Email</label>
                        <input aria-label="Baylor email"
                            type="email"
                            required
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className="w-full bg-white text-black border border-gray-300 rounded-lg p-2.5 focus:ring-[#FFB81C] focus:border-[#FFB81C]"
                            placeholder="first_last1@baylor.edu"
                        />
                        {email.length > 0 && !emailValid && (
                            <p className="text-xs text-red-600 mt-1">Please use your @baylor.edu email.</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">
                            Phone Number <span className="text-gray-400 font-normal">(optional)</span>
                        </label>
                        <input aria-label="Phone number"
                            type="tel"
                            value={phone}
                            onChange={e => setPhone(e.target.value)}
                            className="w-full bg-white text-black border border-gray-300 rounded-lg p-2.5 focus:ring-[#FFB81C] focus:border-[#FFB81C]"
                            placeholder="(254) 555-0100"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">
                            Class Year <span className="text-gray-400 font-normal">(optional)</span>
                        </label>
                        <select aria-label="Class year"
                            value={year}
                            onChange={e => setYear(e.target.value)}
                            className="w-full bg-white text-black border border-gray-300 rounded-lg p-2.5 focus:ring-[#FFB81C] focus:border-[#FFB81C]"
                        >
                            <option value="">-- Select --</option>
                            {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">
                            How did you hear about us? <span className="text-gray-400 font-normal">(optional)</span>
                        </label>
                        <select aria-label="How did you hear about us"
                            value={heardAbout}
                            onChange={e => setHeardAbout(e.target.value)}
                            className="w-full bg-white text-black border border-gray-300 rounded-lg p-2.5 focus:ring-[#FFB81C] focus:border-[#FFB81C]"
                        >
                            <option value="">-- Select --</option>
                            {HEARD_OPTIONS.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">
                            Who recommended you? <span className="text-gray-400 font-normal">(optional)</span>
                        </label>
                        {referrer ? (
                            <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-2.5">
                                <span className="font-bold text-[#154734]">{referrer.firstName} {referrer.lastName}</span>
                                <button type="button" aria-label="Clear who recommended you"
                                    onClick={() => { setReferrerId(''); setReferrerQuery(''); }}
                                    className="text-gray-400 hover:text-gray-700">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ) : referrerOther ? (
                            <>
                                <input aria-label="Who recommended you"
                                    type="text"
                                    value={referredBy}
                                    onChange={e => setReferredBy(e.target.value)}
                                    className="w-full bg-white text-black border border-gray-300 rounded-lg p-2.5 focus:ring-[#FFB81C] focus:border-[#FFB81C]"
                                    placeholder="Their name, if you know it"
                                />
                                <button type="button" onClick={() => { setReferrerOther(false); setReferredBy(''); }}
                                    className="text-xs font-bold text-[#154734] hover:underline mt-1">
                                    Search the member list instead
                                </button>
                            </>
                        ) : (
                            <>
                                <input aria-label="Search for the member who recommended you"
                                    type="text"
                                    value={referrerQuery}
                                    onChange={e => setReferrerQuery(e.target.value)}
                                    className="w-full bg-white text-black border border-gray-300 rounded-lg p-2.5 focus:ring-[#FFB81C] focus:border-[#FFB81C]"
                                    placeholder="Start typing a BearPit member's name"
                                />
                                {referrerQuery.trim() && (
                                    <div className="mt-1 border border-gray-200 rounded-lg divide-y divide-gray-100 overflow-hidden">
                                        {referrerMatches.map(m => (
                                            <button type="button" key={m.id}
                                                onClick={() => setReferrerId(m.id)}
                                                className="w-full text-left px-3 py-2 text-sm text-gray-800 hover:bg-[#FFB81C]/20">
                                                {m.firstName} {m.lastName}
                                            </button>
                                        ))}
                                        {referrerMatches.length === 0 && (
                                            <p className="px-3 py-2 text-sm text-gray-500">No member found by that name.</p>
                                        )}
                                    </div>
                                )}
                                <button type="button" onClick={() => { setReferrerOther(true); setReferredBy(referrerQuery.trim()); }}
                                    className="text-xs font-bold text-[#154734] hover:underline mt-1">
                                    Someone else / not sure
                                </button>
                            </>
                        )}
                    </div>

                    {existingMember && (
                        <div className="bg-amber-50 p-3 rounded-lg text-sm text-amber-800 border border-amber-100">
                            Looks like you're already a BearPit member! No need to fill this out -- use the{' '}
                            <strong>Member Portal</strong> (top right of the login page) to sign in instead.
                        </div>
                    )}

                    {submitError && (
                        <div className="bg-red-50 p-3 rounded-lg text-sm text-red-800 border border-red-100 flex gap-2 items-start">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>{submitError}</span>
                        </div>
                    )}

                    <p className="text-xs text-gray-500">
                        We collect your name and contact info to add you to the BearPit member list and track points. See our <PrivacyLink className="text-[#154734]" />.
                    </p>

                    <button
                        type="submit"
                        disabled={!canSubmit || submitting}
                        className="w-full bg-[#154734] text-white py-3 rounded-lg font-bold hover:bg-[#0f3325] disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-2"
                    >
                        {submitting ? 'Submitting...' : 'Submit'}
                    </button>
                </form>
            </div>
        </div>
    );
};
