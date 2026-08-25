
import React, { useState } from 'react';
import { Member, Role } from '../types';
import { CheckCircle2, ArrowLeft, UserPlus } from 'lucide-react';

interface InterestFormProps {
    onSubmit: (member: Member) => void;
    onBack: () => void;
}

const YEAR_OPTIONS = ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Grad Student'];

// Public "I'm interested" form -- separate from AttendanceForm (which is
// now for existing members checking in at a game only). This is the
// intake point for Late Night / tabling / anyone new: name + Baylor email
// is all that's required, phone and year are optional so it stays quick.
export const InterestForm: React.FC<InterestFormProps> = ({ onSubmit, onBack }) => {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [year, setYear] = useState('');
    const [submitted, setSubmitted] = useState(false);

    const emailValid = email.toLowerCase().endsWith('@baylor.edu');
    const canSubmit = firstName.trim() && lastName.trim() && emailValid;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit) return;

        onSubmit({
            id: `prospect_${Date.now()}`,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.trim(),
            phone: phone.trim() || undefined,
            year: year || undefined,
            role: Role.PROSPECTIVE,
            yearsInBPLT: 0,
        });
        setSubmitted(true);
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
                        Thanks for your interest in Bear Pit. Keep an eye on your Baylor email -- we'll follow up
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
                        <h1 className="text-xl font-bold text-[#154734]">Interested in Joining Bear Pit?</h1>
                    </div>
                    <p className="text-[#154734] text-sm font-semibold opacity-90">Takes less than a minute</p>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">First Name</label>
                            <input
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
                            <input
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
                        <input
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
                        <input
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
                        <select
                            value={year}
                            onChange={e => setYear(e.target.value)}
                            className="w-full bg-white text-black border border-gray-300 rounded-lg p-2.5 focus:ring-[#FFB81C] focus:border-[#FFB81C]"
                        >
                            <option value="">-- Select --</option>
                            {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>

                    <button
                        type="submit"
                        disabled={!canSubmit}
                        className="w-full bg-[#154734] text-white py-3 rounded-lg font-bold hover:bg-[#0f3325] disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-2"
                    >
                        Submit
                    </button>
                </form>
            </div>
        </div>
    );
};
