
import React, { useState } from 'react';
import { X, Lock, Check } from 'lucide-react';
import { Member, Sport } from '../types';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    member: Member;
    sports: Sport[];
    onUpdateProfile: (updates: Partial<Member>, memberId?: string) => void;
    adminMode?: boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, member, sports, onUpdateProfile, adminMode = false }) => {
    const [newPassword, setNewPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [email, setEmail] = useState(member.email || '');
    const [fallSportId, setFallSportId] = useState(member.fallSportId || '');
    const [springSportId, setSpringSportId] = useState(member.springSportId || '');
    const [isChair, setIsChair] = useState(member.isChair || false);
    const [localError, setLocalError] = useState('');
    const [localSuccess, setLocalSuccess] = useState(false);

    React.useEffect(() => {
        setEmail(member.email || '');
        setFallSportId(member.fallSportId || '');
        setSpringSportId(member.springSportId || '');
        setIsChair(member.isChair || false);
        setNewPassword('');
        setConfirm('');
    }, [member.id, isOpen]);

    if (!isOpen) return null;

    const eligibleSports = sports.filter(s => !s.name.toLowerCase().includes('basketball') && !s.name.toLowerCase().includes('bball'));

    const handleSave = () => {
        setLocalError('');
        const updates: Partial<Member> = {};

        if (newPassword) {
            if (newPassword.length < 4) {
                setLocalError('Password must be at least 4 characters.');
                return;
            }
            if (newPassword !== confirm) {
                setLocalError("Passwords do not match");
                return;
            }
            updates.password = newPassword;
        }

        if (email !== member.email) updates.email = email;
        if (fallSportId !== member.fallSportId) updates.fallSportId = fallSportId;
        if (springSportId !== member.springSportId) updates.springSportId = springSportId;
        if (isChair !== member.isChair) updates.isChair = isChair;

        onUpdateProfile(updates, member.id);

        setLocalSuccess(true);
        setTimeout(() => {
            setLocalSuccess(false);
            setNewPassword('');
            setConfirm('');
            onClose();
        }, 1500);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden">
                <div className="bg-[#154734] p-4 flex justify-between items-center text-white">
                    <h3 className="font-bold flex items-center gap-2">
                        <Lock className="w-4 h-4" />
                        {adminMode ? `Edit Profile: ${member.firstName}` : 'Profile & Settings'}
                    </h3>
                    <button onClick={onClose} className="hover:bg-white/10 rounded-full p-1 transition-colors"><X className="w-5 h-5" /></button>
                </div>

                {localSuccess ? (
                    <div className="flex flex-col items-center justify-center py-10 text-green-600">
                        <Check className="w-12 h-12 mb-2 animate-bounce" />
                        <p className="font-bold text-lg">Profile Updated!</p>
                    </div>
                ) : (
                    <div className="p-6 space-y-6">
                        {/* Hidden input to confuse simple autofill bots if necessary, but autoComplete="off" is cleaner */}
                        <form className="space-y-6" onSubmit={(e) => e.preventDefault()} autoComplete="off">
                            <div className="space-y-4">
                                <h3 className="font-bold text-gray-900 border-b pb-2 flex items-center justify-between">
                                    <span>Profile Details</span>
                                    <span className="text-[10px] uppercase text-gray-400 font-normal">ID: {member.id}</span>
                                </h3>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Baylor Email</label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-[#FFB81C] outline-none"
                                        placeholder="first_last@baylor.edu"
                                        autoComplete="off"
                                        name="member_email_field"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Fall Sport</label>
                                        <select value={fallSportId} onChange={e => setFallSportId(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2.5 text-sm outline-none bg-white">
                                            <option value="">-- None --</option>
                                            {eligibleSports.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Spring Sport</label>
                                        <select value={springSportId} onChange={e => setSpringSportId(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2.5 text-sm outline-none bg-white">
                                            <option value="">-- None --</option>
                                            {eligibleSports.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                                {(member.role === 'Officer' || member.role === 'Admin') && (
                                    <div className="flex items-center gap-2 bg-gray-50 p-3 rounded-lg border border-gray-200">
                                        <input type="checkbox" id="chairCheck" checked={isChair} onChange={e => setIsChair(e.target.checked)} className="w-4 h-4 text-[#154734] rounded" />
                                        <label htmlFor="chairCheck" className="text-sm font-bold text-gray-700">{adminMode ? 'User is a Sport Chair' : 'I am a Sport Chair'}</label>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4 pt-4 border-t border-gray-100">
                                <h3 className="font-bold text-gray-900">Change Password (Optional)</h3>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">New Password</label>
                                    <input
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-[#FFB81C]"
                                        placeholder="Leave blank to keep current"
                                        autoComplete="new-password"
                                        name="member_new_password_field"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Confirm Password</label>
                                    <input
                                        type="password"
                                        value={confirm}
                                        onChange={(e) => setConfirm(e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-[#FFB81C]"
                                        placeholder="Repeat new password"
                                        autoComplete="new-password"
                                        name="member_confirm_password_field"
                                    />
                                </div>
                            </div>

                            {localError && <div className="text-red-500 text-sm bg-red-50 p-2 rounded border border-red-100">{localError}</div>}

                            <button
                                type="button"
                                onClick={handleSave}
                                className="w-full bg-[#154734] text-white py-3.5 rounded-lg font-bold hover:bg-[#0f3325] transition-all shadow-md active:scale-[0.98]"
                            >
                                Save Changes
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
};
