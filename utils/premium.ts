// Premium games (Game.isBonus = true, worth 2 via gamePointValue in utils/fanTier.ts).
// Source: Fall 2026 BearPit Point Incentive Framework. Update each semester.
// KEEP IN SYNC with the copy in supabase/functions/autofill-schedule/index.ts
// (the edge function is a single pasted file and cannot import from the app).
//
// Keyed by the SCRAPED baylorbears.com sport title (ScrapedGame.sportName), not sport_id:
// the site's single "Basketball" sport receives both Men's and Women's events.

export const PREMIUM_GAMES: Readonly<Record<string, readonly string[]>> = {
    'Volleyball': ['2026-09-05', '2026-10-02', '2026-10-04', '2026-10-25', '2026-10-30', '2026-11-20', '2026-11-28'],
    'Soccer': ['2026-10-02', '2026-10-16'],
    "Women's Basketball": ['2026-11-02'],
};

const normSport = (s: string) => s.trim().toLowerCase().replace(/’/g, "'");

const PREMIUM_BY_SPORT: Record<string, readonly string[]> = Object.fromEntries(
    Object.entries(PREMIUM_GAMES).map(([k, v]) => [normSport(k), v]),
);

export function isPremiumGame(sportName: string, date: string): boolean {
    return (PREMIUM_BY_SPORT[normSport(sportName)] ?? []).includes(date);
}
