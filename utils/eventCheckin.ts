import { supabase } from './supabaseClient';

// Rotating-code check-ins for event check-ins (tabling_, hosp_, ... games).
// Server side: supabase/migrations/20261026_event_checkin_codes.sql. Every
// call here degrades gracefully when that migration hasn't been run yet.

// The officer's id + password from this login, in memory only (same idea as
// App.tsx currentPasswordRef). rpc_event_checkin_code needs the password to
// prove the caller is an officer. Lost on refresh; the code screen then asks.
export const officerSession: { memberId: string | null; password: string | null } = { memberId: null, password: null };

export const currentOfficerId = (): string | null => {
    if (officerSession.memberId) return officerSession.memberId;
    try { return JSON.parse(sessionStorage.getItem('bp_member') || 'null')?.id ?? null; } catch { return null; }
};

// PostgREST answers PGRST202 when the function isn't there (migration not run).
const isMissingRpc = (error: { code?: string; message?: string } | null) =>
    !!error && (error.code === 'PGRST202' || /could not find the function/i.test(error.message || ''));

// Probed once per page load: is rpc_event_checkin installed? The probe uses a
// game id that can't exist, so it writes nothing.
let availability: Promise<boolean> | null = null;
export const eventCodesAvailable = (): Promise<boolean> => {
    if (!availability) {
        availability = Promise.resolve(supabase.rpc('rpc_event_checkin', { p_game_id: '__probe__', p_member_id: '', p_code: '' }))
            .then(({ error }) => !isMissingRpc(error))
            .catch(() => false);
    }
    return availability;
};

// ok: code + secondsLeft are set. Not ok: error + reason are set.
export interface CodeResult {
    ok: boolean;
    code?: string;
    secondsLeft?: number;
    error?: string;
    reason?: 'missing' | 'auth' | 'network' | 'other';
}

export const fetchCheckinCode = async (gameId: string, officerId: string, password: string): Promise<CodeResult> => {
    const { data, error } = await supabase.rpc('rpc_event_checkin_code', {
        p_game_id: gameId, p_officer_id: officerId, p_officer_password: password,
    });
    if (isMissingRpc(error)) return { ok: false, reason: 'missing', error: 'Check-in codes need the 20261026_event_checkin_codes.sql migration. Ask an admin to run it.' };
    if (error) return { ok: false, reason: 'network', error: error.message };
    if (!data?.ok) {
        if (data?.error === 'not_officer') return { ok: false, reason: 'auth', error: 'Wrong password, or your account is not an Officer/Admin.' };
        const msg: Record<string, string> = {
            no_game: "That check-in doesn't exist anymore.",
            not_event: "That isn't an event check-in.",
        };
        return { ok: false, reason: 'other', error: msg[data?.error] || 'Could not get a code.' };
    }
    return { ok: true, code: data.code, secondsLeft: data.seconds_left };
};

const CHECKIN_MESSAGES: Record<string, string> = {
    already: "You're already checked in for this event.",
    bad_code: "That code didn't work. Codes change every minute, so enter the one on the officer's screen right now.",
    not_open: "Check-in for this event isn't open yet.",
    closed: 'Check-in for this event has closed. Talk to an officer if you were there.',
    not_event: "This event doesn't use check-in codes.",
    no_game: "That event couldn't be found.",
    no_member: "We couldn't find your member record. Talk to an officer.",
};

// Returns an error message, or null when the member is checked in.
export const submitEventCheckin = async (gameId: string, memberId: string, code: string): Promise<string | null> => {
    const { data, error } = await supabase.rpc('rpc_event_checkin', { p_game_id: gameId, p_member_id: memberId, p_code: code });
    if (error) return "Check-in didn't save: " + error.message + '. Please try again or tell an officer.';
    if (data === 'ok') return null;
    return CHECKIN_MESSAGES[data] || "Check-in didn't save. Please try again or tell an officer.";
};

// What the officer's QR encodes.
export const checkinUrl = (gameId: string, code: string) =>
    `${window.location.origin}${window.location.pathname}?checkin=${encodeURIComponent(gameId)}&code=${encodeURIComponent(code)}`;

// Reads ?checkin=&code= once on load and strips them from the address bar,
// so a refresh (or "Submit another response") doesn't replay a stale code.
// Cached, so calling it again (e.g. StrictMode double init) returns the same.
let takenParams: { gameId: string; code: string } | null | undefined;
export const takeCheckinParams = (): { gameId: string; code: string } | null => {
    if (takenParams === undefined) takenParams = readCheckinParams();
    return takenParams;
};

const readCheckinParams = (): { gameId: string; code: string } | null => {
    try {
        const params = new URLSearchParams(window.location.search);
        const gameId = params.get('checkin');
        if (!gameId) return null;
        const code = (params.get('code') || '').replace(/\D/g, '').slice(0, 6);
        params.delete('checkin');
        params.delete('code');
        const rest = params.toString();
        window.history.replaceState({}, '', window.location.pathname + (rest ? `?${rest}` : '') + window.location.hash);
        return { gameId, code };
    } catch { return null; }
};
