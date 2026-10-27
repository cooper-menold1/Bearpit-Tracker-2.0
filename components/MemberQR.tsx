import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { X, RefreshCw } from 'lucide-react';
import { Member } from '../types';
import { memberQrValue } from '../utils/memberQr';

// Full-screen "My QR" for a member to hold up to an officer's phone at a
// game/event. Officers scan it with Quick Award to log points. Pure black
// on white, big quiet zone, so it scans in bright sun and dim arenas.
export const MemberQR: React.FC<{ member: Member; onClose: () => void }> = ({ member, onClose }) => {
    const [dataUrl, setDataUrl] = useState<string | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        QRCode.toDataURL(memberQrValue(member.id), {
            errorCorrectionLevel: 'M',
            margin: 4,
            width: 720,
            color: { dark: '#000000', light: '#ffffff' },
        }).then(setDataUrl).catch(err => {
            console.error('QR generation failed', err);
            setError(true);
        });
    }, [member.id]);

    // Keep the screen awake while the code is up so it doesn't dim mid-scan.
    useEffect(() => {
        let lock: { release: () => Promise<void> } | null = null;
        const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
        nav.wakeLock?.request('screen').then(l => { lock = l; }).catch(() => { });
        return () => { lock?.release().catch(() => { }); };
    }, []);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <div role="dialog" aria-modal="true" aria-label="My QR code" className="fixed inset-0 z-[60] bg-white flex flex-col">
            <div className="bg-[#154734] text-white px-4 py-3 flex items-center justify-between shrink-0">
                <div>
                    <p className="font-bold leading-tight">{member.firstName} {member.lastName}</p>
                    <p className="text-xs text-[#FFB81C] font-medium">BearPit member QR</p>
                </div>
                <button type="button" aria-label="Close" onClick={onClose} className="p-2 -mr-2 text-white/80 hover:text-white">
                    <X className="w-6 h-6" />
                </button>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center p-4 gap-4">
                {dataUrl ? (
                    <img
                        src={dataUrl}
                        alt={`QR code for ${member.firstName} ${member.lastName}`}
                        className="w-full max-w-[min(90vw,70vh)] aspect-square"
                        style={{ imageRendering: 'pixelated' }}
                    />
                ) : error ? (
                    <p className="text-red-600 font-bold text-center">Couldn't make your QR code. Close and try again.</p>
                ) : (
                    <RefreshCw className="w-10 h-10 animate-spin text-[#154734]" />
                )}
                <p className="text-center text-gray-700 font-medium max-w-xs">
                    Show this to an officer to get credit for hospitality, tabling, media and other points.
                </p>
                <p className="text-center text-xs text-gray-400">Turn your screen brightness up if it won't scan.</p>
            </div>
        </div>
    );
};
