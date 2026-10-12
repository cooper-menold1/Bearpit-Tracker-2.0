import React, { useState } from 'react';
import { X } from 'lucide-react';

// Contact address for privacy requests (confirmed by Cooper 2026-10-12).
const CONTACT_EMAIL = 'cooper_menold1@baylor.edu';

export const PrivacyPolicyModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={onClose}>
        <div
            className="bg-white rounded-2xl shadow-2xl border-2 border-[#FFB81C] max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
        >
            <div className="bg-[#154734] p-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-[#FFB81C]">Privacy Policy</h2>
                <button onClick={onClose} aria-label="Close" className="text-white/70 hover:text-white transition-colors">
                    <X className="w-6 h-6" />
                </button>
            </div>
            <div className="p-6 overflow-y-auto text-sm text-gray-700 leading-relaxed space-y-4">
                <p className="text-xs text-gray-500">Effective date: October 12, 2026</p>

                <section>
                    <h3 className="font-bold text-gray-900 mb-1">Who runs this site</h3>
                    <p>
                        This site is run by the BearPit student section leadership team, a student-run organization.
                        It is not an official Baylor University website. {/* TODO (owner): confirm this wording. */}
                    </p>
                </section>

                <section>
                    <h3 className="font-bold text-gray-900 mb-1">What we collect</h3>
                    <ul className="list-disc pl-5 space-y-1">
                        <li><strong>Interest form:</strong> first and last name, Baylor email, and optionally phone number, class year, and how you heard about us.</li>
                        <li><strong>Member accounts:</strong> name, Baylor email, role, years in BearPit, sport assignments, and a password (checked by our database at sign-in).</li>
                        <li><strong>Attendance:</strong> which games you checked in to and when.</li>
                        <li><strong>Check-in location:</strong> when you check in, your browser asks for your location. We save your latitude, longitude, location accuracy, your distance from the venue, and whether you were within the venue area, so officers can double-check attendance. Away games and sports without a venue have no distance comparison, but location may still be saved.</li>
                        <li><strong>Club events:</strong> which events (such as tabling shifts) you signed up for and when.</li>
                        <li><strong>Selfie contest:</strong> photos in the contest, the game they relate to, and your votes.</li>
                        <li><strong>Points:</strong> attendance points and any bonus points officers award, with the reason and category.</li>
                        <li><strong>Bug reports:</strong> if you tell an officer about a problem, they may log your name and what you reported.</li>
                    </ul>
                </section>

                <section>
                    <h3 className="font-bold text-gray-900 mb-1">Why we collect it</h3>
                    <p>
                        To keep the member list, contact you about meetings and events, track attendance and points,
                        and run contests such as the selfie contest.
                    </p>
                </section>

                <section>
                    <h3 className="font-bold text-gray-900 mb-1">Photos</h3>
                    <p>
                        Selfie contest photos are shown to members for viewing and voting, and may appear in the
                        photo wall on the public login page. Only upload photos you are comfortable sharing.
                    </p>
                </section>

                <section>
                    <h3 className="font-bold text-gray-900 mb-1">Who can see it</h3>
                    <p>
                        BearPit officers and admins can see member information, including check-in locations.
                        Signed-in members can see the leaderboards, which show member names, points, fan levels,
                        and attendance, as well as the contest photos. The public login page does not show names.
                        {/* TODO (owner): confirm leaderboard visibility and that member search is limited to signed-in users. */}
                        We do not sell your data.
                    </p>
                </section>

                <section>
                    <h3 className="font-bold text-gray-900 mb-1">Services we use</h3>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Supabase stores the database.</li>
                        <li>Firebase / Google hosts the website.</li>
                    </ul>
                </section>

                <section>
                    <h3 className="font-bold text-gray-900 mb-1">How long we keep it</h3>
                    <p>
                        We keep your information while you are a BearPit member. Officers delete it on request.
                    </p>
                </section>

                <section>
                    <h3 className="font-bold text-gray-900 mb-1">Correction or deletion</h3>
                    <p>
                        To correct or delete your information, email <strong>{CONTACT_EMAIL}</strong>.
                    </p>
                </section>

                <section>
                    <h3 className="font-bold text-gray-900 mb-1">Who this site is for</h3>
                    <p>This site is intended for Baylor students. Please do not submit information if you are not a Baylor student.</p>
                </section>
            </div>
        </div>
    </div>
);

// Inline link that opens the policy modal. Self-contained so any form can drop it in.
export const PrivacyLink: React.FC<{ className?: string }> = ({ className = '' }) => {
    const [open, setOpen] = useState(false);
    return (
        <>
            <button type="button" onClick={() => setOpen(true)} className={`underline font-semibold hover:text-[#FFB81C] transition-colors ${className}`}>
                Privacy Policy
            </button>
            {open && <PrivacyPolicyModal onClose={() => setOpen(false)} />}
        </>
    );
};
