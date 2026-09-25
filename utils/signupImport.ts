import { Member } from '../types';

// Parses a sign-up sheet exported from Box/Excel as CSV and matches each row
// to a member, so officers can award points to everyone who signed up without
// ticking boxes by hand. Handles quoted fields and either a single "Name"
// column or separate "First"/"Last" columns; an email column wins when present.

export interface SignupMatchResult {
    matched: Member[];
    unmatched: string[]; // raw names/emails from the sheet with no member match
}

export function parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (inQuotes) {
            if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
            else if (c === '"') inQuotes = false;
            else field += c;
        } else if (c === '"') inQuotes = true;
        else if (c === ',') { row.push(field); field = ''; }
        else if (c === '\n' || c === '\r') {
            if (c === '\r' && text[i + 1] === '\n') i++;
            row.push(field); field = '';
            if (row.some(f => f.trim())) rows.push(row);
            row = [];
        } else field += c;
    }
    row.push(field);
    if (row.some(f => f.trim())) rows.push(row);
    return rows;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

export function matchSignups(csvText: string, members: Member[]): SignupMatchResult {
    const rows = parseCsv(csvText);
    if (rows.length < 2) return { matched: [], unmatched: [] };

    const header = rows[0].map(h => h.trim().toLowerCase());
    const col = (...names: string[]) => header.findIndex(h => names.some(n => h.includes(n)));
    const emailCol = col('email');
    const firstCol = col('first');
    const lastCol = col('last');
    const nameCol = firstCol === -1 ? col('name') : -1;

    const byEmail = new Map(members.filter(m => m.email).map(m => [m.email!.trim().toLowerCase(), m]));
    const byName = new Map(members.map(m => [norm(m.firstName + m.lastName), m]));

    const matched = new Map<string, Member>();
    const unmatched: string[] = [];

    rows.slice(1).forEach(r => {
        const email = emailCol >= 0 ? (r[emailCol] || '').trim().toLowerCase() : '';
        const name = firstCol >= 0
            ? `${(r[firstCol] || '').trim()} ${lastCol >= 0 ? (r[lastCol] || '').trim() : ''}`.trim()
            : nameCol >= 0 ? (r[nameCol] || '').trim() : '';
        if (!email && !name) return;

        // "Martin, Cadence" -> "Cadence Martin"
        const flipped = name.includes(',') ? name.split(',').reverse().join(' ') : name;
        const m = (email && byEmail.get(email)) || (name && byName.get(norm(flipped)));
        if (m) matched.set(m.id, m);
        else unmatched.push(name || email);
    });

    return { matched: Array.from(matched.values()), unmatched };
}
