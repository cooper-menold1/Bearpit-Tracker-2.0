
import React, { useState } from 'react';
import { Member, Game, Sport } from '../types';
import { PrivacyLink } from './PrivacyPolicy';
import { CheckCircle2, User, Calendar, Trophy, AlertTriangle, ArrowLeft, MapPin, Loader2 } from 'lucide-react';
import { VENUES } from '../constants';
import { todayInChicago } from '../utils/dateUtils';
import { getDistance, getCurrentPosition } from '../utils/location';

export interface AttendanceLocation {
    latitude: number;
    longitude: number;
    accuracyMeters: number;
    distanceMeters: number | null; // null when there's no venue to compare against
    withinGeofence: boolean | null; // null when there's no venue to compare against
}

interface AttendanceFormProps {
    members: Member[];
    games: Game[];
    sports: Sport[];
    onSubmit: (gameId: string, memberId: string, location: AttendanceLocation | null, newMemberDetails?: Member) => void;
    onBack: () => void;
}

export const AttendanceForm: React.FC<AttendanceFormProps> = ({ members, games, sports, onSubmit, onBack }) => {
    const [step, setStep] = useState(1);
    const [name, setName] = useState('');
    const [matchedMember, setMatchedMember] = useState<Member | null>(null);
    const [notFound, setNotFound] = useState(false);
    const [selectedGameId, setSelectedGameId] = useState('');

    const selectedGame = games.find(g => g.id === selectedGameId);
    const isAwayGame = selectedGame?.location === 'Away';
    const selectedSport = selectedGame ? sports.find(s => s.id === selectedGame.sportId) : null;
    const hasVenues = (selectedSport?.venueIds?.length || 0) > 0 && !isAwayGame;

    const [submitted, setSubmitted] = useState(false);

    // Location Sharing States
    const [isVerifyingLocation, setIsVerifyingLocation] = useState(false);
    const [locationError, setLocationError] = useState<string | null>(null);
    const [location, setLocation] = useState<AttendanceLocation | null>(null);

    // Date filtering: Only show games for TODAY
    const todayStr = todayInChicago(); // YYYY-MM-DD, Central time
    const todaysGames = games
        .filter(g => g.date === todayStr)
        .sort((a, b) => (a.time || '23:59').localeCompare(b.time || '23:59'));

    const shareLocation = async (gameId: string) => {
        if (!gameId) {
            setLocation(null);
            return;
        }

        setIsVerifyingLocation(true);
        setLocationError(null);
        setLocation(null);

        try {
            const game = games.find(g => g.id === gameId);
            if (!game) throw new Error("Game not found");

            const sport = sports.find(s => s.id === game.sportId);
            const validVenues = (game.location !== 'Away' && sport?.venueIds)
                ? VENUES.filter(v => sport.venueIds?.includes(v.id))
                : [];

            const position = await getCurrentPosition();
            const { latitude, longitude, accuracy } = position.coords;

            let distanceMeters: number | null = null;
            let withinGeofence: boolean | null = null;

            if (validVenues.length > 0) {
                distanceMeters = Math.min(...validVenues.map(v => getDistance(latitude, longitude, v.latitude, v.longitude)));
                withinGeofence = validVenues.some(v => getDistance(latitude, longitude, v.latitude, v.longitude) <= v.radiusMeters);
            }

            setLocation({ latitude, longitude, accuracyMeters: accuracy, distanceMeters, withinGeofence });
        } catch (err: any) {
            console.error("Location sharing failed", err);
            if (err.code === 1) {
                setLocationError("Location access is required to log attendance. Please allow location sharing and try again.");
            } else if (err.code === 3) {
                setLocationError("Location request timed out. Please try again.");
            } else {
                setLocationError(err.message || "Could not get your location.");
            }
        } finally {
            setIsVerifyingLocation(false);
        }
    };

    const handleGameChange = (gameId: string) => {
        setSelectedGameId(gameId);
        if (gameId) {
            shareLocation(gameId);
        } else {
            setLocation(null);
            setLocationError(null);
        }
    };

    const handleNameNext = (e: React.FormEvent) => {
        e.preventDefault();
        setNotFound(false);
        // Normalize both sides: stray/double spaces in a stored name (e.g. "Ornelas ")
        // used to make exact-match fail and lock members out of check-in.
        const norm = (s: string) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
        const found = members.find(m =>
            norm(`${m.firstName} ${m.lastName}`) === norm(name)
        );

        if (found) {
            setMatchedMember(found);
            setStep(2);
        } else {
            // No self-service capture here anymore -- new people go through
            // the dedicated "Interested in Joining?" form instead.
            setNotFound(true);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedGameId || !matchedMember) return;

        onSubmit(selectedGameId, matchedMember.id, location);
        setSubmitted(true);
    };

    if (submitted) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-xl shadow-sm text-center max-w-md w-full border-t-4 border-[#154734]">
                    <div className="w-16 h-16 bg-green-100 text-[#154734] rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Sic 'Em!</h2>
                    <p className="text-gray-600 mb-6">Your attendance has been recorded.</p>
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
                    <h1 className="text-xl font-bold text-[#154734]">Attendance Check-in</h1>
                    <p className="text-[#154734] text-sm font-semibold opacity-90">BearPit</p>
                </div>

                <form className="p-6 space-y-6">
                    <div className="flex gap-2 mb-6">
                        <div className={`h-1.5 flex-1 rounded-full ${step >= 1 ? 'bg-[#154734]' : 'bg-gray-200'}`}></div>
                        <div className={`h-1.5 flex-1 rounded-full ${step >= 2 ? 'bg-[#154734]' : 'bg-gray-200'}`}></div>
                    </div>

                    {step === 1 && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Your Name</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                                    <input aria-label="Your name"
                                        type="text"
                                        required
                                        value={name}
                                        onChange={e => { setName(e.target.value); setNotFound(false); }}
                                        className="pl-10 w-full bg-white text-black border border-gray-300 rounded-lg p-2.5 focus:ring-[#FFB81C] focus:border-[#FFB81C]"
                                        placeholder="First Last"
                                    />
                                </div>
                                <p className="text-xs text-gray-500 mt-2">Please use the name you registered with.</p>
                            </div>

                            {notFound && (
                                <div className="bg-amber-50 p-3 rounded-lg text-sm text-amber-800 border border-amber-100">
                                    We couldn't find <strong>{name}</strong> in our records. This form is for
                                    existing members only -- if you're new, use the <strong>"Interested in
                                    Joining?"</strong> option on the login page instead.
                                </div>
                            )}

                            <button
                                onClick={handleNameNext}
                                disabled={!name.trim()}
                                className="w-full bg-[#154734] text-white py-3 rounded-lg font-bold hover:bg-[#0f3325] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Next
                            </button>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Current Date</label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                                    <input aria-label="Current date"
                                        type="text"
                                        disabled
                                        value={todayStr}
                                        className="pl-10 w-full bg-gray-100 border border-gray-300 rounded-lg p-2.5 text-gray-500 cursor-not-allowed"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Event Attended</label>
                                <div className="relative">
                                    <Trophy className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                                    {todaysGames.length > 0 ? (
                                        <select aria-label="Game"
                                            value={selectedGameId}
                                            onChange={e => handleGameChange(e.target.value)}
                                            className="pl-10 w-full bg-white text-black border border-gray-300 rounded-lg p-2.5 focus:ring-[#FFB81C] focus:border-[#FFB81C]"
                                        >
                                            <option value="">-- Select an Event --</option>
                                            {todaysGames.map(g => (
                                                <option key={g.id} value={g.id}>
                                                    {g.opponent} ({g.location}) - {g.time || 'TBA'}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <div className="pl-10 w-full bg-red-50 border border-red-200 rounded-lg p-2.5 text-red-600 flex items-center text-sm">
                                            <AlertTriangle className="w-4 h-4 mr-2" /> No games scheduled for today ({todayStr}).
                                        </div>
                                    )}
                                </div>
                            </div>

                            <p className="text-xs text-gray-500 mb-2">
                                Your location is shared when you check in so officers can confirm you were at the venue. See our <PrivacyLink className="text-[#154734]" />.
                            </p>
                            {/* Verification Hint */}
                            <div className="bg-blue-50 border-blue-100 p-3 rounded-lg border flex items-start gap-2 mb-2">
                                <div className="text-[#154734] mt-0.5"><MapPin className="w-4 h-4" /></div>
                                <div className="text-xs text-gray-700 leading-relaxed">
                                    <strong>Location Required:</strong> To log attendance you must share your location.
                                    It's recorded with your check-in so officers can double-check it{hasVenues ? " against the venue" : ""}.
                                </div>
                            </div>

                            {/* Location Sharing Status */}
                            {selectedGameId && (
                                <div className="animate-in fade-in duration-300">
                                    {isVerifyingLocation ? (
                                        <div className="flex items-center gap-2 text-sm text-[#154734] bg-green-50 p-3 rounded-lg border border-green-100">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Getting your location...
                                        </div>
                                    ) : locationError ? (
                                        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100">
                                            <AlertTriangle className="w-4 h-4 shrink-0" />
                                            <div className="flex-1">
                                                <span>{locationError}</span>
                                                <p className="text-[10px] opacity-80 mt-0.5">You can still submit -- it'll be flagged for an officer to double-check.</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => shareLocation(selectedGameId)}
                                                className="ml-auto text-xs font-bold underline whitespace-nowrap"
                                            >
                                                Retry
                                            </button>
                                        </div>
                                    ) : location ? (
                                        location.withinGeofence === true ? (
                                            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 p-3 rounded-lg border border-green-100">
                                                <CheckCircle2 className="w-4 h-4" />
                                                Location shared -- you're at the venue. Sic 'Em!
                                            </div>
                                        ) : location.withinGeofence === false ? (
                                            <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-100">
                                                <MapPin className="w-4 h-4 shrink-0" />
                                                <span>Location shared, but you look ~{Math.round(location.distanceMeters!)}m from the venue. This will be flagged for an officer to double-check.</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 p-3 rounded-lg border border-green-100">
                                                <CheckCircle2 className="w-4 h-4" />
                                                Location shared with your check-in.
                                            </div>
                                        )
                                    ) : null}
                                </div>
                            )}

                            <button
                                onClick={handleSubmit}
                                disabled={!selectedGameId || isVerifyingLocation}
                                className="w-full bg-[#154734] text-white py-3 rounded-lg font-bold hover:bg-[#0f3325] disabled:opacity-50 disabled:cursor-not-allowed shadow-md transition-colors mt-4 flex items-center justify-center gap-2"
                            >
                                <CheckCircle2 className="w-5 h-5" />
                                Submit Attendance
                            </button>
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
};
