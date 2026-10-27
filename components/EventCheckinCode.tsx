import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { X, Loader2, AlertTriangle, Lock } from 'lucide-react';
import { Game } from '../types';
import { checkinCategory } from '../utils/fanTier';
import { formatGameTime } from '../utils/dateUtils';
import { fetchCheckinCode, checkinUrl, currentOfficerId, officerSession } from '../utils/eventCheckin';

interface EventCheckinCodeProps {
    game: Game;
    onClose: () => void;
}

// Full-screen officer display for one event check-in: a QR + 6-digit code
// that rotate every 60 seconds. The code comes from the server
// (rpc_event_checkin_code), which wants the officer's password as proof --
// login is custom, so the DB has no other way to know who's asking. The
// password from this login is reused; after a refresh we ask for it once.
export const EventCheckinCode: React.FC<EventCheckinCodeProps> = ({ game, onClose }) => {
    const officerId = currentOfficerId();
    const [password, setPassword] = useState(officerSession.password || '');
    const [passwordInput, setPasswordInput] = useState('');
    const [code, setCode] = useState<string | null>(null);
    const [qr, setQr] = useState<string | null>(null);
    const [deadline, setDeadline] = useState(0);
    const [now, setNow] = useState(Date.now());
    const [error, setError] = useState<string | null>(null);
    const [blocked, setBlocked] = useState(false); // migration missing / not an event: stop polling

    // Fetch a code, then again right after it rotates.
    useEffect(() => {
        if (!password || !officerId || blocked) return;
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const load = async () => {
            const r = await fetchCheckinCode(game.id, officerId, password);
            if (cancelled) return;
            if (r.ok) {
                officerSession.password = password; // proven good: don't ask again this session
                const ms = (r.secondsLeft || 60) * 1000;
                setCode(r.code || null);
                setError(null);
                setDeadline(Date.now() + ms);
                timer = setTimeout(load, ms + 300);
            } else if (r.reason === 'auth') {
                if (officerSession.password === password) officerSession.password = null;
                setPassword('');
                setError(r.error || null);
            } else if (r.reason === 'network') {
                setError("Couldn't reach the server. Retrying...");
                timer = setTimeout(load, 5000);
            } else {
                setBlocked(true);
                setError(r.error || null);
            }
        };
        load();
        return () => { cancelled = true; clearTimeout(timer); };
    }, [game.id, officerId, password, blocked]);

    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        if (!code) { setQr(null); return; }
        let cancelled = false;
        QRCode.toDataURL(checkinUrl(game.id, code), { width: 512, margin: 1, color: { dark: '#154734', light: '#ffffff' } })
            .then(url => { if (!cancelled) setQr(url); })
            .catch(err => console.error('QR render failed', err));
        return () => { cancelled = true; };
    }, [code, game.id]);

    const secondsLeft = Math.max(0, Math.ceil((deadline - now) / 1000));

    return (
        <div className="fixed inset-0 bg-[#154734] z-50 flex flex-col items-center justify-center p-4 overflow-y-auto">
            <button type="button" onClick={onClose} aria-label="Close" className="absolute top-4 right-4 text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10">
                <X className="w-7 h-7" />
            </button>

            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border-4 border-[#FFB81C] text-center">
                <div className="bg-[#FFB81C] p-4">
                    <h2 className="text-xl font-bold text-[#154734] leading-tight">{game.opponent}</h2>
                    <p className="text-[#154734] text-sm font-semibold opacity-90">
                        {checkinCategory(game)} · +{game.pointsValue || 1} pt{(game.pointsValue || 1) === 1 ? '' : 's'} · {formatGameTime(game.time)}
                    </p>
                </div>

                <div className="p-6 flex flex-col items-center gap-4">
                    {!officerId ? (
                        <p className="text-sm text-red-600">Please log out and back in to show a check-in code.</p>
                    ) : !password ? (
                        <form
                            className="w-full space-y-3"
                            onSubmit={e => { e.preventDefault(); if (passwordInput) { setError(null); setPassword(passwordInput); setPasswordInput(''); } }}
                        >
                            <div className="flex items-center justify-center gap-2 text-[#154734] font-bold"><Lock className="w-4 h-4" /> Confirm it's you</div>
                            <p className="text-xs text-gray-500">Enter your password to show the check-in code.</p>
                            <input
                                type="password"
                                aria-label="Your password"
                                autoFocus
                                value={passwordInput}
                                onChange={e => setPasswordInput(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-[#FFB81C] focus:border-[#FFB81C]"
                            />
                            {error && <p className="text-sm text-red-600">{error}</p>}
                            <button type="submit" disabled={!passwordInput} className="w-full bg-[#154734] text-white py-2.5 rounded-lg font-bold hover:bg-[#0f3325] disabled:opacity-50">
                                Show Code
                            </button>
                        </form>
                    ) : blocked ? (
                        <div className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 p-3 rounded-lg border border-amber-200 text-left">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> <span>{error}</span>
                        </div>
                    ) : !code ? (
                        <div className="flex items-center gap-2 text-[#154734] py-16"><Loader2 className="w-6 h-6 animate-spin" /> Getting code...</div>
                    ) : (
                        <>
                            <div className="bg-white p-2 rounded-xl border-2 border-gray-100">
                                {qr ? <img src={qr} alt="Check-in QR code" className="w-64 h-64 sm:w-72 sm:h-72" /> : <div className="w-64 h-64 sm:w-72 sm:h-72" />}
                            </div>
                            <div>
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Or enter code</p>
                                <p className="text-5xl sm:text-6xl font-mono font-bold text-[#154734] tracking-[0.2em]">{code}</p>
                            </div>
                            <div className="w-full">
                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-[#FFB81C] transition-all duration-1000 ease-linear" style={{ width: `${(secondsLeft / 60) * 100}%` }} />
                                </div>
                                <p className="text-xs text-gray-500 mt-1">New code in {secondsLeft}s</p>
                            </div>
                            {error && <p className="text-xs text-amber-700">{error}</p>}
                            <p className="text-xs text-gray-400">Members: scan with your camera, or open the site, tap Check In, pick this event and type the code.</p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
