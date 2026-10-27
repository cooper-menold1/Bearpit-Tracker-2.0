import React, { useEffect, useRef, useState } from 'react';
import { X, ArrowLeft, Search, CheckCircle2, AlertTriangle, RefreshCw, ScanLine, Zap } from 'lucide-react';
import { Member, BonusPoint, Role } from '../types';
import { HIDDEN_MEMBER_IDS, PointMenuItem } from '../constants';
import { presetsByCategory, presetPointsLabel, capPeriodLabel, capUsage } from '../utils/pointMenu';
import { parseMemberQr } from '../utils/memberQr';
import { isInAppBrowser } from '../utils/location';

// Officer Quick Award: pick a POINT_MENU preset, then scan members' "My QR"
// codes one after another (or search by name) and each one gets the preset
// awarded through the normal bonus-points handler. Built for an officer
// standing at a hospitality table / tabling shift with a phone.

type AwardFn = (memberIds: string[], points: number, reason: string, category: string) => Promise<boolean | void> | boolean | void;

interface QuickAwardProps {
    members: Member[];
    bonusPoints: BonusPoint[];
    onAward: AwardFn;
    onClose: () => void;
}

// Same member + same preset within this window is ignored, so a QR held
// in front of the camera for a few seconds only awards once.
const SCAN_DEBOUNCE_MS = 10_000;
const SCAN_INTERVAL_MS = 200;
// jsQR fallback decodes a downscaled frame; plenty for a phone-screen QR.
const FALLBACK_MAX_WIDTH = 640;

type CamState = 'starting' | 'live' | 'denied' | 'unsupported' | 'nocamera' | 'error';
type Toast = { kind: 'ok' | 'warn' | 'error' | 'info'; text: string };
type LogEntry = { id: number; name: string; points: number; ok: boolean; at: Date };
// Waiting on the officer: auto-award is off, or this award would go over the cap.
type Pending = { member: Member; overCapUsed?: number };

interface BarcodeDetectorLike { detect(src: CanvasImageSource): Promise<{ rawValue: string }[]> }
type JsQR = (data: Uint8ClampedArray, width: number, height: number, opts?: { inversionAttempts?: 'dontInvert' | 'onlyInvert' | 'attemptBoth' | 'invertFirst' }) => { data: string } | null;

// Native BarcodeDetector (Chrome on Android, some Safari builds) when it
// supports QR; otherwise null and we decode frames with jsQR.
const getBarcodeDetector = async (): Promise<BarcodeDetectorLike | null> => {
    const BD = (window as unknown as { BarcodeDetector?: any }).BarcodeDetector;
    if (!BD) return null;
    try {
        const formats: string[] | undefined = await BD.getSupportedFormats?.();
        if (formats && !formats.includes('qr_code')) return null;
        return new BD({ formats: ['qr_code'] });
    } catch {
        return null;
    }
};

const fullName = (m: Member) => `${m.firstName} ${m.lastName}`;

export const QuickAward: React.FC<QuickAwardProps> = ({ members, bonusPoints, onAward, onClose }) => {
    const [preset, setPreset] = useState<PointMenuItem | null>(null);
    const [expandedKey, setExpandedKey] = useState<string | null>(null); // ranged preset showing its value chips
    const [points, setPoints] = useState(0);
    const [autoAward, setAutoAward] = useState(true);
    const [cam, setCam] = useState<CamState>('starting');
    const [retryNonce, setRetryNonce] = useState(0);
    const [toast, setToast] = useState<Toast | null>(null);
    const [pending, setPending] = useState<Pending | null>(null);
    const [log, setLog] = useState<LogEntry[]>([]);
    const [query, setQuery] = useState('');
    const inApp = isInAppBrowser();

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const recentScans = useRef(new Map<string, number>()); // `${memberId}|${presetKey}` -> last scan time
    const lastBadScan = useRef<{ text: string; at: number } | null>(null);
    // Cap counting has to include awards made this session even before the
    // refetch brings them back in bonusPoints.
    const initialBonusPoints = useRef(bonusPoints);
    const sessionCounts = useRef(new Map<string, number>());
    const logId = useRef(0);

    const scanning = preset !== null;

    const startPreset = (p: PointMenuItem, value: number) => {
        setPreset(p);
        setPoints(value);
        setPending(null);
        setToast(null);
        recentScans.current.clear();
    };

    const capUsedFor = (memberId: string) => {
        if (!preset?.cap) return 0;
        const session = sessionCounts.current.get(`${memberId}|${preset.key}`) || 0;
        return Math.max(
            capUsage(memberId, preset, bonusPoints),
            capUsage(memberId, preset, initialBonusPoints.current) + session,
        );
    };

    const doAward = async (member: Member) => {
        if (!preset) return;
        const p = preset, pts = points, key = `${member.id}|${p.key}`;
        setPending(null);
        setToast({ kind: 'info', text: `Awarding ${fullName(member)}...` });
        let ok = true;
        try {
            ok = (await onAward([member.id], pts, p.label, p.category)) !== false;
        } catch (err) {
            console.error('Quick award failed', err);
            ok = false;
        }
        if (ok) {
            sessionCounts.current.set(key, (sessionCounts.current.get(key) || 0) + 1);
            navigator.vibrate?.(60);
        } else {
            recentScans.current.delete(key); // let them rescan right away
        }
        setLog(prev => [{ id: ++logId.current, name: fullName(member), points: pts, ok, at: new Date() }, ...prev]);
        setToast(ok
            ? { kind: 'ok', text: `+${pts} ${fullName(member)}` }
            : { kind: 'error', text: `Didn't save for ${fullName(member)}. Try again.` });
    };

    // confirmed = the officer already picked this person by hand, so only
    // the cap check can stop it.
    const considerAward = (member: Member, confirmed: boolean) => {
        if (!preset) return;
        const used = capUsedFor(member.id);
        const overCap = !!preset.cap && used + 1 > preset.cap.max;
        if (overCap) { setPending({ member, overCapUsed: used }); return; }
        if (!confirmed && !autoAward) { setPending({ member }); return; }
        doAward(member);
    };

    const handleScan = (text: string) => {
        if (!preset || pending) return;
        const now = Date.now();
        const memberId = parseMemberQr(text);
        if (!memberId) {
            const last = lastBadScan.current;
            if (!last || last.text !== text || now - last.at > 4000) {
                setToast({ kind: 'warn', text: "That's not a BearPit member QR. Have them open My QR in their portal." });
            }
            lastBadScan.current = { text, at: now };
            return;
        }
        const key = `${memberId}|${preset.key}`;
        const last = recentScans.current.get(key);
        if (last && now - last < SCAN_DEBOUNCE_MS) return;
        recentScans.current.set(key, now);
        const member = members.find(m => m.id === memberId);
        if (!member) {
            setToast({ kind: 'error', text: "QR scanned, but that member isn't in the list (approved yet?)." });
            return;
        }
        considerAward(member, false);
    };
    // The scan loop lives in an effect; read the latest handler through a ref.
    const handleScanRef = useRef(handleScan);
    handleScanRef.current = handleScan;

    // Camera + decode loop, running only while a preset is picked.
    useEffect(() => {
        if (!scanning) return;
        let cancelled = false;
        let stream: MediaStream | null = null;
        let timer: number | undefined;

        const start = async () => {
            if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) { setCam('unsupported'); return; }
            setCam('starting');
            try {
                stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
            } catch (err) {
                if (cancelled) return;
                const name = (err as { name?: string })?.name;
                console.error('Camera failed', err);
                setCam(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied'
                    : name === 'NotFoundError' || name === 'OverconstrainedError' ? 'nocamera' : 'error');
                return;
            }
            const video = videoRef.current;
            if (cancelled || !video) { stream.getTracks().forEach(t => t.stop()); return; }
            video.srcObject = stream;
            await video.play().catch(() => { });
            if (cancelled) return;
            setCam('live');

            let detector = await getBarcodeDetector();
            let jsQR: JsQR | null = null;
            const loadJsQR = async () => { jsQR = (await import('jsqr')).default as unknown as JsQR; };
            if (!detector) await loadJsQR();

            const tick = async () => {
                if (cancelled) return;
                try {
                    if (video.readyState >= 2 && video.videoWidth) {
                        let text: string | null = null;
                        if (detector) {
                            try {
                                const codes = await detector.detect(video);
                                text = codes[0]?.rawValue ?? null;
                            } catch {
                                // Some builds expose BarcodeDetector but can't run it; fall back.
                                detector = null;
                                await loadJsQR();
                            }
                        } else if (jsQR && canvasRef.current) {
                            const scale = Math.min(1, FALLBACK_MAX_WIDTH / video.videoWidth);
                            const w = Math.round(video.videoWidth * scale), h = Math.round(video.videoHeight * scale);
                            const canvas = canvasRef.current;
                            canvas.width = w; canvas.height = h;
                            const ctx = canvas.getContext('2d', { willReadFrequently: true });
                            if (ctx) {
                                ctx.drawImage(video, 0, 0, w, h);
                                const img = ctx.getImageData(0, 0, w, h);
                                text = (jsQR as JsQR)(img.data, w, h, { inversionAttempts: 'dontInvert' })?.data ?? null;
                            }
                        }
                        if (text && !cancelled) handleScanRef.current(text);
                    }
                } catch (err) {
                    console.error('QR decode failed', err);
                }
                if (!cancelled) timer = window.setTimeout(tick, SCAN_INTERVAL_MS);
            };
            tick();
        };
        start();

        // Always release the camera: closing, changing preset, or unmount.
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
            stream?.getTracks().forEach(t => t.stop());
            if (videoRef.current) videoRef.current.srcObject = null;
        };
    }, [scanning, retryNonce]);

    // Success/warning toasts fade on their own; "Awarding..." waits for the result.
    useEffect(() => {
        if (!toast || toast.kind === 'info') return;
        const t = window.setTimeout(() => setToast(null), toast.kind === 'ok' ? 2500 : 4000);
        return () => window.clearTimeout(t);
    }, [toast]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const q = query.trim().toLowerCase();
    const matches = q
        ? members
            .filter(m => !HIDDEN_MEMBER_IDS.includes(m.id) && m.role !== Role.PROSPECTIVE)
            .filter(m => fullName(m).toLowerCase().includes(q) || (m.email || '').toLowerCase().includes(q))
            .sort((a, b) => fullName(a).localeCompare(fullName(b)))
            .slice(0, 6)
        : [];

    const camMessage: Record<Exclude<CamState, 'starting' | 'live'>, string> = {
        denied: 'Camera access is blocked. Allow the camera for this site in your browser settings, then tap Retry. You can still search by name below.',
        unsupported: "This browser can't use the camera here. Open the site in Safari or Chrome, or search by name below.",
        nocamera: "No rear camera found. Search by name below instead.",
        error: "Couldn't start the camera. Tap Retry, or search by name below.",
    };

    return (
        <div role="dialog" aria-modal="true" aria-label="Quick Award" className="fixed inset-0 z-[60] bg-gray-100 flex flex-col">
            <div className="bg-[#154734] text-white px-4 py-3 flex items-center gap-3 shrink-0">
                {scanning && (
                    <button type="button" aria-label="Change preset" onClick={() => { setPreset(null); setPending(null); }} className="p-1 -ml-1 text-white/80 hover:text-white">
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                )}
                <div className="flex-1 min-w-0">
                    <p className="font-bold leading-tight flex items-center gap-2"><Zap className="w-4 h-4 text-[#FFB81C]" /> Quick Award</p>
                    <p className="text-xs text-[#FFB81C] font-medium truncate">
                        {preset ? `${preset.label} · +${points} ${preset.category}` : 'Pick what you are awarding'}
                    </p>
                </div>
                <button type="button" aria-label="Close" onClick={onClose} className="p-2 -mr-2 text-white/80 hover:text-white">
                    <X className="w-6 h-6" />
                </button>
            </div>

            {!scanning ? (
                // --- Step 1: preset picker ---
                <div className="flex-1 overflow-y-auto p-4 space-y-5">
                    {presetsByCategory().map(g => (
                        <div key={g.category}>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{g.category}</p>
                            <div className="space-y-2">
                                {g.items.map(p => {
                                    const ranged = p.minPoints !== undefined && p.maxPoints !== undefined;
                                    return (
                                        <div key={p.key} className="bg-white rounded-xl border border-gray-200 shadow-sm">
                                            <button
                                                type="button"
                                                onClick={() => ranged ? setExpandedKey(k => k === p.key ? null : p.key) : startPreset(p, p.points)}
                                                className="w-full text-left px-4 py-3 flex items-center justify-between gap-3"
                                            >
                                                <span className="font-medium text-gray-900">{p.label}</span>
                                                <span className="shrink-0 text-right">
                                                    <span className="block text-sm font-bold text-[#154734]">{presetPointsLabel(p)} pts</span>
                                                    {p.cap && <span className="block text-[10px] text-gray-400">max {capPeriodLabel(p)}</span>}
                                                </span>
                                            </button>
                                            {ranged && expandedKey === p.key && (
                                                <div className="px-4 pb-3 flex items-center gap-2 flex-wrap">
                                                    <span className="text-xs text-gray-500">How many points?</span>
                                                    {Array.from({ length: p.maxPoints! - p.minPoints! + 1 }, (_, i) => p.minPoints! + i).map(v => (
                                                        <button
                                                            key={v}
                                                            type="button"
                                                            onClick={() => startPreset(p, v)}
                                                            className="min-w-12 bg-[#FFB81C] text-[#154734] font-bold px-4 py-2 rounded-lg hover:bg-yellow-400"
                                                        >
                                                            {v}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                    <p className="text-xs text-gray-400 text-center pb-4">Need something not on the menu? Use the Points Manager form instead.</p>
                </div>
            ) : (
                // --- Step 2: scan / search ---
                <div className="flex-1 overflow-y-auto">
                    <div className="relative bg-black">
                        <video ref={videoRef} playsInline muted autoPlay className={`w-full max-h-[55vh] aspect-square object-cover ${cam === 'live' ? '' : 'invisible'}`} />
                        <canvas ref={canvasRef} className="hidden" />
                        {cam === 'live' && (
                            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                                <div className="w-3/5 aspect-square border-4 border-[#FFB81C] rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
                            </div>
                        )}
                        {cam === 'starting' && (
                            <div className="absolute inset-0 flex items-center justify-center text-white gap-2">
                                <RefreshCw className="w-6 h-6 animate-spin" /> Starting camera...
                            </div>
                        )}
                        {cam !== 'starting' && cam !== 'live' && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-white p-6 gap-3">
                                <AlertTriangle className="w-8 h-8 text-[#FFB81C]" />
                                <p className="text-sm">{camMessage[cam]}</p>
                                {(cam === 'denied' || cam === 'error') && (
                                    <button type="button" onClick={() => setRetryNonce(n => n + 1)} className="bg-[#FFB81C] text-[#154734] font-bold px-4 py-2 rounded-lg">Retry</button>
                                )}
                            </div>
                        )}

                        {toast && (
                            <div className={`absolute top-3 left-3 right-3 rounded-xl px-4 py-3 shadow-lg font-bold flex items-center gap-2 ${toast.kind === 'ok' ? 'bg-green-600 text-white text-lg' : toast.kind === 'error' ? 'bg-red-600 text-white' : toast.kind === 'warn' ? 'bg-amber-100 text-amber-900' : 'bg-white text-gray-800'}`}>
                                {toast.kind === 'ok' ? <CheckCircle2 className="w-6 h-6 shrink-0" /> : toast.kind === 'info' ? <RefreshCw className="w-5 h-5 shrink-0 animate-spin" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
                                <span className="text-sm leading-snug">{toast.text}</span>
                            </div>
                        )}

                        {pending && (
                            <div className="absolute inset-x-3 bottom-3 bg-white rounded-xl shadow-2xl p-4">
                                <p className="text-lg font-bold text-gray-900">{fullName(pending.member)}</p>
                                {pending.overCapUsed !== undefined && preset?.cap ? (
                                    <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-1 flex items-start gap-2">
                                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                        <span>Already has {pending.overCapUsed} of {preset.cap.max} this {preset.cap.per} for "{preset.label}". Awarding goes over the cap.</span>
                                    </p>
                                ) : (
                                    <p className="text-sm text-gray-500">Award +{points} {preset?.category}?</p>
                                )}
                                <div className="mt-3 grid grid-cols-2 gap-2">
                                    <button type="button" onClick={() => setPending(null)} className="py-3 rounded-lg border border-gray-300 font-bold text-gray-700">Skip</button>
                                    <button type="button" onClick={() => doAward(pending.member)} className={`py-3 rounded-lg font-bold ${pending.overCapUsed !== undefined ? 'bg-amber-500 text-white' : 'bg-[#FFB81C] text-[#154734]'}`}>
                                        {pending.overCapUsed !== undefined ? 'Award anyway' : `Award +${points}`}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-4 space-y-4">
                        {inApp && (
                            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3 rounded-lg flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                <span>You're in an in-app browser. The camera may not work here. Open this page in Safari/Chrome (tap ••• &gt; Open in browser).</span>
                            </div>
                        )}

                        <label className="flex items-center justify-between gap-3 bg-white rounded-xl border border-gray-200 px-4 py-3">
                            <span>
                                <span className="block font-bold text-gray-800 text-sm flex items-center gap-1"><ScanLine className="w-4 h-4" /> Award on scan</span>
                                <span className="block text-xs text-gray-500">{autoAward ? 'Points go in as soon as a code scans.' : 'You tap Award after each scan.'}</span>
                            </span>
                            <input type="checkbox" className="w-5 h-5 accent-[#154734]" checked={autoAward} onChange={e => setAutoAward(e.target.checked)} />
                        </label>

                        <div className="bg-white rounded-xl border border-gray-200 p-4">
                            <label className="text-xs font-bold text-gray-500 flex items-center gap-1"><Search className="w-3 h-3" /> No QR? Search by name</label>
                            <input
                                type="search"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder="Start typing a name..."
                                className="w-full border p-3 rounded-lg mt-1 text-base"
                                autoComplete="off"
                            />
                            {matches.length > 0 && (
                                <div className="mt-2 divide-y divide-gray-100 border rounded-lg">
                                    {matches.map(m => (
                                        <button
                                            key={m.id}
                                            type="button"
                                            disabled={!!pending}
                                            onClick={() => { setQuery(''); considerAward(m, true); }}
                                            className="w-full text-left px-3 py-3 flex items-center justify-between hover:bg-gray-50 disabled:opacity-50"
                                        >
                                            <span className="font-medium text-gray-900">{fullName(m)}</span>
                                            <span className="text-xs font-bold text-[#154734] bg-[#FFB81C]/30 px-2 py-1 rounded-full">+{points}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                            {q && matches.length === 0 && <p className="text-xs text-gray-400 mt-2">No member matches "{query}".</p>}
                        </div>

                        {log.length > 0 && (
                            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                <p className="px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wide bg-gray-50 border-b">
                                    This session · {log.filter(l => l.ok).length} awarded
                                </p>
                                <div className="divide-y divide-gray-100 max-h-60 overflow-y-auto">
                                    {log.map(l => (
                                        <div key={l.id} className="px-4 py-2 flex items-center justify-between text-sm">
                                            <span className="text-gray-800">{l.name}</span>
                                            <span className={`font-bold ${l.ok ? 'text-green-600' : 'text-red-500'}`}>
                                                {l.ok ? `+${l.points}` : 'failed'} <span className="text-xs text-gray-400 font-normal">{l.at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        <p className="text-xs text-gray-400 text-center pb-4">Awarded the wrong person? An admin can delete it under Points Manager &gt; Recent Point Adjustments.</p>
                    </div>
                </div>
            )}
        </div>
    );
};
