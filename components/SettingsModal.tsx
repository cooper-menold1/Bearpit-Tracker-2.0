import React, { useState } from 'react';
import { X, Lock, Check } from 'lucide-react';
import { Member, Sport } from '../types';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    member: Member;
    sports: Sport[];
    onUpdateProfile: (updates: Partial<Member>) => void;
    adminMode?: boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, member, sports, onUpdateProfile, adminMode = false }) => {
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [email, setEmail] = useState(member.email || '');
    const [fallSportId, setFallSportId] = useState(member.fallSportId || '');
    const [springSportId, setSpringSportId] = useState(member.springSportId || '');
    const [isChair, setIsChair] = useState(member.isChair || false);
    const [localError, setLocalError] = useState('');
    const [localSuccess, setLocalSuccess] = useState(false);

    // Sync state when member changes (important for Admin View)
    React.useEffect(() => {
        setEmail(member.email || '');
        setFallSportId(member.fallSportId || '');
        setSpringSportId(member.springSportId || '');
        setIsChair(member.isChair || false);
        setPassword('');
        setConfirm('');
    }, [member.id, isOpen]);

    if (!isOpen) return null;

    const eligibleSports = sports.filter(s => !s.name.toLowerCase().includes('basketball') && !s.name.toLowerCase().includes('bball'));

    const handleSave = () => {
        setLocalError('');
        const updates: Partial<Member> = {};

        // Password Update
        if (password) {
            if (password.length < 4) {
                setLocalError('Password must be at least 4 characters.');
                return;
            }
            if (password !== confirm) {
                setLocalError("Passwords do not match");
                return;
            }
            updates.password = password;
        }

        // Profile Updates
        if (email !== member.email) updates.email = email;
        if (fallSportId !== member.fallSportId) updates.fallSportId = fallSportId;
        if (springSportId !== member.springSportId) updates.springSportId = springSportId;
        if (isChair !== member.isChair) updates.isChair = isChair;

        onUpdateProfile(updates);
        setLocalSuccess(true);
        setTimeout(() => {
            setLocalSuccess(false);
            setPassword('');
            setConfirm('');
            onClose();
        }, 1500);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden">
                <div className="bg-[#154734] p-4 flex justify-between items-center">
                    <h3 className="font-bold text-white flex items-center gap-2">
                        <Lock className="w-4 h-4" />
                        {adminMode ? `Edit Profile: ${member.firstName}` : 'Profile & Settings'}
                    </h3>
                    <button onClick={onClose} className="text-white/70 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {localSuccess ? (
                    <div className="flex flex-col items-center justify-center py-6 text-green-600">
                        <Check className="w-12 h-12 mb-2" />
                        <p className="font-bold">Profile Updated!</p>
                    </div>
                ) : (
                    <div className="p-6 space-y-6">
                        {/* Profile Section */}
                        <div className="space-y-4">
                            <h3 className="font-bold text-gray-900 border-b pb-2">Profile Details</h3>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Baylor Email</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-[#FFB81C] outline-none"
                                    placeholder="first_last@baylor.edu"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Fall Sport</label>
                                    <select
                                        value={fallSportId}
                                        onChange={e => setFallSportId(e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-[#FFB81C] outline-none"
                                    >
                                        <option value="">-- None --</option>
                                        {eligibleSports.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Spring Sport</label>
                                    <select
                                        value={springSportId}
                                        onChange={e => setSpringSportId(e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-[#FFB81C] outline-none"
                                    >
                                        <option value="">-- None --</option>
                                        {eligibleSports.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {(member.role === 'Officer' || member.role === 'Admin') && (
                                <div className="flex items-center gap-2 bg-gray-50 p-3 rounded-lg border border-gray-200">
                                    <input
                                        type="checkbox"
                                        id="chairCheck"
                                        checked={isChair}
                                        onChange={e => setIsChair(e.target.checked)}
                                        className="w-4 h-4 text-[#154734] rounded focus:ring-[#154734]"
                                    />
                                    <label htmlFor="chairCheck" className="text-sm font-bold text-gray-700">
                                        {adminMode ? 'User is a Sport Chair' : 'I am a Sport Chair'}
                                    </label>
                                </div>
                            )}
                        </div>

                        {/* Password Section */}
                        <div className="space-y-4 pt-4 border-t border-gray-100">
                            <h3 className="font-bold text-gray-900">Change Password (Optional)</h3>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">New Password</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-[#FFB81C] outline-none"
                                    placeholder="Enter new password"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Confirm Password</label>
                                <input
                                    type="password"
                                    value={confirm}
                                    onChange={(e) => setConfirm(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-[#FFB81C] outline-none"
                                    placeholder="Confirm new password"
                                />
                            </div>
                        </div>

                        {localError && (
                            <div className="text-red-500 text-sm bg-red-50 p-2 rounded">
                                {localError}
                            </div>
                        )}

                        <div className="pt-2">
                            <button
                                onClick={handleSave}
                                className="w-full bg-[#154734] text-white py-3 rounded-lg font-bold hover:bg-[#0f3325] shadow-md transition-all transform hover:-translate-y-0.5"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
