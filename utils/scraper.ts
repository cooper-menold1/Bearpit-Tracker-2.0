import { Game, Sport } from '../types';

export interface ScrapedGame {
    date: string;
    time: string;
    opponent: string;
    location: 'Home' | 'Away' | 'Neutral';
    sportName: string;
    description: string;
}

const PROXIES = [
    (url: string) => `https://cors-get-proxy.sirjosh.workers.dev/?url=${encodeURIComponent(url)}`,
    (url: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
    (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}` // Fourth fallback
];

export const fetchSchedule = async (year: number, month: number): Promise<ScrapedGame[]> => {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const baseUrl = `https://baylorbears.com/api/v2/Calendar/from/${startDate}/to/${endDate}`;

    let lastError: any = null;

    for (const proxyFn of PROXIES) {
        const proxyUrl = proxyFn(baseUrl);
        try {
            console.log(`Fetching from proxy: ${proxyUrl}`);
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();

            // AllOrigins wraps in { contents: "..." }
            // CodeTabs returns raw array or error object { Error: "..." }
            let contents = data.contents;
            if (typeof contents === 'string') {
                try {
                    contents = JSON.parse(contents);
                } catch (e) { /* ignore */ }
            }

            // If contents is still undefined, maybe it's not AllOrigins
            if (!contents) {
                contents = data;
            }

            // Safety check: skip if we got an error object from a proxy
            if (contents && contents.Error) {
                console.warn(`Proxy returned error message: ${contents.Error}`);
                continue;
            }

            if (!contents || !Array.isArray(contents)) {
                console.warn(`Unexpected data format from proxy:`, contents);
                continue;
            }

            const games: ScrapedGame[] = [];
            contents.forEach((dayData: any) => {
                if (!dayData || !dayData.events || !Array.isArray(dayData.events)) return;

                const dateStr = dayData.date ? dayData.date.split('T')[0] : '';
                if (!dateStr) return;

                dayData.events.forEach((event: any) => {
                    const sportName = event.sport?.title || 'Unknown';
                    const opponent = event.opponent?.title || event.title || 'Unknown Opponent';

                    let location: 'Home' | 'Away' | 'Neutral' = 'Home';
                    if (event.locationIndicator === 'A' || event.atVs === 'at') {
                        location = 'Away';
                    } else if (event.locationIndicator === 'N') {
                        location = 'Neutral';
                    }

                    const time = event.time || 'TBA';
                    const description = event.gamePromotionText || '';

                    games.push({
                        date: dateStr,
                        time,
                        opponent: opponent.trim(),
                        location,
                        sportName,
                        description: description.trim()
                    });
                });
            });

            // If we successfully parsed an array (even if empty), return it
            return games.filter(g => g.opponent && g.opponent.toLowerCase() !== 'baylor');

        } catch (error) {
            console.warn(`Proxy failed: ${proxyUrl}`, error);
            lastError = error;
            continue;
        }
    }

    throw lastError || new Error("Failed to fetch schedule. Both proxies are currently unavailable.");
};

export const resolveSportMappings = (scrapedGames: ScrapedGame[], existingSports: Sport[]) => {
    const uniqueSportNames = Array.from(new Set(scrapedGames.map(g => g.sportName)));
    const mappings: Record<string, { sportId?: string, status: 'mapped' | 'new' | 'ignore' }> = {};

    uniqueSportNames.forEach(name => {
        if (name.toLowerCase().includes('club')) {
            mappings[name] = { status: 'ignore' };
            return;
        }

        const exactMatch = existingSports.find(s => s.name.toLowerCase() === name.toLowerCase());
        if (exactMatch) {
            mappings[name] = { sportId: exactMatch.id, status: 'mapped' };
            return;
        }

        const partialMatch = existingSports.find(s =>
            name.toLowerCase().includes(s.name.toLowerCase()) ||
            s.name.toLowerCase().includes(name.toLowerCase())
        );
        if (partialMatch) {
            mappings[name] = { sportId: partialMatch.id, status: 'mapped' };
            return;
        }

        mappings[name] = { status: 'new' };
    });

    return mappings;
};

const normTime = (t?: string | null): string => {
    const v = (t || '').trim().toLowerCase().replace(/\s+/g, '').replace(/\./g, '');
    return v === 'tba' || v === 'tbd' ? '' : v;
};

export interface SlotCandidate { id: string; sportKey: string; date: string; time?: string | null; opponent: string; }
export interface SlotQuery { sportKey: string | undefined; date: string; time?: string | null; opponent: string; }

/**
 * Match scraped games to existing games by sport + date + start time, so doubleheaders
 * stay separate. Passes (each existing game is claimed at most once):
 *  1. same start time; 2. same opponent (covers TBA/missing or changed times);
 *  3. the lone leftover game on that sport/day (opponent/time changed).
 * Returns the matched existing id (or null) for each query, in order.
 * Keep in sync with matchGames in supabase/functions/autofill-schedule/index.ts.
 */
export const matchGamesToExisting = (queries: SlotQuery[], existing: SlotCandidate[]): (string | null)[] => {
    const result: (string | null)[] = queries.map(() => null);
    const claimed = new Set<string>();
    const cands = (q: SlotQuery) => existing.filter(e => !claimed.has(e.id) && e.date === q.date && e.sportKey === q.sportKey);
    const run = (pick: (q: SlotQuery, c: SlotCandidate[]) => SlotCandidate | undefined) => {
        queries.forEach((q, i) => {
            if (result[i] || !q.sportKey) return;
            const m = pick(q, cands(q));
            if (m) { result[i] = m.id; claimed.add(m.id); }
        });
    };
    run((q, c) => { const t = normTime(q.time); return t ? c.find(e => normTime(e.time) === t) : undefined; });
    run((q, c) => c.find(e => e.opponent.toLowerCase() === q.opponent.toLowerCase()));
    run((q, c) => {
        const n = queries.filter((o, j) => !result[j] && o.sportKey === q.sportKey && o.date === q.date).length;
        return c.length === 1 && n === 1 ? c[0] : undefined;
    });
    return result;
};
