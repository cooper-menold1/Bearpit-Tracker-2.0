import { supabase } from './supabaseClient';

const MAX_SIDE = 1280;
const BUCKET = 'photos';

/** Resize so the longest side is <= 1280 px and encode as JPEG q0.8. */
export const compressImage = (file: File): Promise<Blob> =>
    new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(img.width * scale));
            canvas.height = Math.max(1, Math.round(img.height * scale));
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Could not process image.'));
                return;
            }
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(
                blob => (blob ? resolve(blob) : reject(new Error('Could not compress image.'))),
                'image/jpeg',
                0.8
            );
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('That file could not be read as an image.'));
        };
        img.src = url;
    });

/**
 * Best-effort orphan cleanup. The storage policy is INSERT-only (deliberately, so nobody can
 * delete photos), so this will usually fail. Orphans may remain and can be cleaned from the
 * Supabase dashboard. Never throws, never masks the original error.
 */
const removeBestEffort = async (path: string): Promise<void> => {
    try {
        await supabase.storage.from(BUCKET).remove([path]);
    } catch {
        // ignore
    }
};

/** Returns an error message, or null on success. */
export const uploadSelfie = async ({
    file,
    memberId,
    gameId,
    sportId,
}: {
    file: File;
    memberId: string;
    gameId: string;
    sportId: string;
}): Promise<string | null> => {
    let blob: Blob;
    try {
        blob = await compressImage(file);
    } catch (e) {
        return e instanceof Error ? e.message : 'Could not process image.';
    }

    const random6 = Math.random().toString(36).slice(2, 8).padEnd(6, '0');
    const path = `${sportId}/${gameId}/${Date.now()}_${random6}.jpg`;

    const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
    if (upErr) return `Upload failed: ${upErr.message}`;

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const publicUrl = pub?.publicUrl;
    if (!publicUrl) {
        await removeBestEffort(path);
        return 'Upload failed: could not get photo URL.';
    }

    const { error: insErr } = await supabase.from('selfies').insert({
        id: 'selfie_' + Date.now() + '_' + random6,
        member_id: memberId,
        game_id: gameId,
        image_data: publicUrl,
        timestamp: new Date().toISOString(),
    });
    if (insErr) {
        await removeBestEffort(path);
        return `Could not save selfie: ${insErr.message}`;
    }
    return null;
};
