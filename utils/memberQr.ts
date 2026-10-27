// Member QR codes for officer Quick Award scanning. The code is just a
// short tag + the member id; the officer's phone looks the id up in the
// loaded member list, so no names or other personal info are in the QR.
export const MEMBER_QR_PREFIX = 'bearpit-member:';

export const memberQrValue = (memberId: string) => `${MEMBER_QR_PREFIX}${memberId}`;

// Returns the member id, or null if this isn't a BearPit member QR.
export const parseMemberQr = (text: string): string | null => {
    const t = (text || '').trim();
    if (!t.toLowerCase().startsWith(MEMBER_QR_PREFIX)) return null;
    const id = t.slice(MEMBER_QR_PREFIX.length).trim();
    return id || null;
};
