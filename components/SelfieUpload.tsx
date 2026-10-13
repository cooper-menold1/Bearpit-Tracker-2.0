import React, { useEffect, useId, useRef, useState } from 'react';
import { Camera, CheckCircle2, Loader2 } from 'lucide-react';
import { uploadSelfie } from '../utils/selfieUpload';

interface SelfieUploadProps {
    memberId: string;
    gameId: string;
    sportId: string;
    onUploaded?: () => void;
    onSkip?: () => void;
}

const MAX_BYTES = 15 * 1024 * 1024;

export const SelfieUpload: React.FC<SelfieUploadProps> = ({ memberId, gameId, sportId, onUploaded, onSkip }) => {
    const inputId = useId();
    const inputRef = useRef<HTMLInputElement>(null);
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);

    useEffect(() => {
        if (!file) {
            setPreviewUrl(null);
            return;
        }
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [file]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0] ?? null;
        setError(null);
        if (!f) {
            setFile(null);
            return;
        }
        if (!f.type.startsWith('image/')) {
            setFile(null);
            setError('Please choose an image file.');
            return;
        }
        if (f.size > MAX_BYTES) {
            setFile(null);
            setError('That photo is over 15 MB. Please choose a smaller one.');
            return;
        }
        setFile(f);
    };

    const handleUpload = async () => {
        if (!file || uploading) return;
        setUploading(true);
        setError(null);
        const err = await uploadSelfie({ file, memberId, gameId, sportId });
        setUploading(false);
        if (err) {
            setError(err);
            return;
        }
        setDone(true);
        setFile(null);
        onUploaded?.();
    };

    return (
        <div className="w-full bg-white rounded-xl shadow-md p-5 text-left">
            <h3 className="text-lg font-bold text-[#154734] flex items-center gap-2">
                <Camera size={20} className="text-[#FFB81C]" aria-hidden="true" />
                Add a selfie
            </h3>
            <p className="text-sm text-gray-600 mt-1">Snap a photo from the game for the selfie contest.</p>

            {!done && (
                <>
                    <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mt-4 mb-1">
                        Choose or take a photo
                    </label>
                    <input
                        ref={inputRef}
                        id={inputId}
                        type="file"
                        accept="image/*"
                        capture="user"
                        onChange={handleChange}
                        disabled={uploading}
                        className="block w-full text-sm text-gray-700 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:font-bold file:bg-[#FFB81C] file:text-[#154734] hover:file:brightness-95"
                    />

                    {previewUrl && (
                        <img
                            src={previewUrl}
                            alt="Selfie preview"
                            className="mt-4 w-full max-h-72 object-contain rounded-lg border border-gray-200 bg-gray-50"
                        />
                    )}

                    <button
                        type="button"
                        onClick={handleUpload}
                        disabled={!file || uploading}
                        className="w-full bg-[#154734] text-white py-3 rounded-lg font-bold hover:bg-[#0f3325] disabled:opacity-50 disabled:cursor-not-allowed shadow-md transition-colors mt-4 flex items-center justify-center gap-2"
                    >
                        {uploading ? (
                            <>
                                <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                                Uploading...
                            </>
                        ) : (
                            'Upload selfie'
                        )}
                    </button>

                    {onSkip && (
                        <button
                            type="button"
                            onClick={onSkip}
                            disabled={uploading}
                            className="w-full mt-2 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 disabled:opacity-50"
                        >
                            Skip
                        </button>
                    )}
                </>
            )}

            <div aria-live="polite" role="status" className="mt-3">
                {done && (
                    <p className="flex items-center gap-2 text-[#154734] font-bold">
                        <CheckCircle2 size={20} aria-hidden="true" />
                        Uploaded!
                    </p>
                )}
                {error && (
                    <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">
                        {error}
                    </p>
                )}
            </div>
        </div>
    );
};

export default SelfieUpload;
