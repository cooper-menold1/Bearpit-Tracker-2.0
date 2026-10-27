import { AppState, AttendanceRecord, BonusPoint, Game, GameRole, Member, Role, Sport } from '../types';
import { POINT_CATEGORIES, FAN_TIERS } from '../constants';
import { isMeetingSport } from './applicationArchive';

export const GAME_ATTENDANCE_CATEGORY = 'Attendance';

// Attendance points, from the Official BPLT Incentive Framework (Fall 2026).
// Meetings are not on the framework's menu, so they keep their old value.
export const ATTENDANCE_POINTS = {
    home: 2,        // regular Waco home game
    premium: 4,     // premium home game (Game.isBonus)
    away: 3,        // away or neutral-site game
    newSport: 1,    // extra, first game ever attended in a sport
    meeting: 1,     // meetings (2 if marked bonus)
};

// Event check-ins: a "game" whose id starts with one of these prefixes is
// really a club event check-in (e.g. tabling). It awards its own pointsValue
// in its own category instead of 1 point of Game Attendance. Add prefixes here.
const EVENT_CHECKIN_PREFIXES: Record<string, string> = {
    tabling_: 'Marketing',
};

const eventPrefixOf = (game: Pick<Game, 'id'>) =>
    Object.keys(EVENT_CHECKIN_PREFIXES).find(p => String(game.id).startsWith(p));

export const isEventCheckin = (game: Pick<Game, 'id'>) => eventPrefixOf(game) !== undefined;

// Category a check-in's points are filed under.
export const checkinCategory = (game: Pick<Game, 'id'>) => {
    const p = eventPrefixOf(game);
    return p ? EVENT_CHECKIN_PREFIXES[p] : GAME_ATTENDANCE_CATEGORY;
};

// Meetings live under the Meetings sport; generated ones also have a meeting_ id.
export const isMeetingGame = (game: Partial<Pick<Game, 'id' | 'sportId'>>, sports?: Sport[]) =>
    String(game.id ?? '').startsWith('meeting_')
    || (!!game.sportId && !!sports?.some(s => s.id === game.sportId && isMeetingSport(s)));

// The one rule for check-in points, used everywhere. Event check-ins use their
// own pointsValue (fallback 1). Games: home 2, premium 4, away/neutral 3.
// Pass sports so meetings are recognized by sport, not only by id.
export const gamePointValue = (
    game: Pick<Game, 'isBonus'> & Partial<Pick<Game, 'id' | 'pointsValue' | 'location' | 'sportId'>>,
    sports?: Sport[],
) => {
    if (game.id !== undefined && isEventCheckin({ id: game.id })) return game.pointsValue || 1;
    if (isMeetingGame(game, sports)) return ATTENDANCE_POINTS.meeting * (game.isBonus ? 2 : 1);
    if (game.isBonus) return ATTENDANCE_POINTS.premium;
    return game.location === 'Away' || game.location === 'Neutral' ? ATTENDANCE_POINTS.away : ATTENDANCE_POINTS.home;
};

// "Attend a game for a sport you have not previously attended": the member's
// first-ever checked-in game in each sport earns +1. Meetings and event
// check-ins don't count. Returns those game ids.
export const firstSportGameIds = (memberId: string, data: Pick<AppState, 'games' | 'attendance' | 'sports'>) => {
    const firstBySport = new Map<string, Game>();
    data.games.forEach(g => {
        if (!data.attendance[g.id]?.[memberId] || isEventCheckin(g) || isMeetingGame(g, data.sports)) return;
        const cur = firstBySport.get(g.sportId);
        if (!cur || g.date < cur.date || (g.date === cur.date && g.id < cur.id)) firstBySport.set(g.sportId, g);
    });
    return new Set([...firstBySport.values()].map(g => g.id));
};

// Points one member got for one check-in, including the new-sport bonus.
export const checkinPointsFor = (game: Game, firstIds: Set<string>, sports?: Sport[]) =>
    gamePointValue(game, sports) + (firstIds.has(game.id) ? ATTENDANCE_POINTS.newSport : 0);

// --- Game-day roster (game_roles) ---
// Officers assign members a job at a game (chant leader, setup crew,
// hospitality team...). Like attendance, these points are DERIVED, never
// stored: a role only counts once that member also checked in to that game,
// so the check-in is the proof they showed. Until then it's "pending".

// Presets from the Official BPLT Incentive Framework (Fall 2026). Officers
// can also type a custom role with its own category and points.
export const GAME_ROLE_PRESETS = [
    { role: 'Chant leader', category: 'Game Day', points: 2 },              // Lead/support chants
    { role: 'Setup / tear-down crew', category: 'Game Day', points: 2 },    // Assist with game-day setup/tear-down
    { role: 'Special game-day role', category: 'Game Day', points: 2 },     // Serve in a special game-day role (2-3)
    { role: 'Hospitality Team', category: 'Hospitality', points: 2 },       // Serve on Hospitality Team at a game
    { role: 'Hospitality responsibility', category: 'Hospitality', points: 1 }, // Assist with a designated hospitality responsibility
    { role: 'Event photographer', category: 'Media', points: 2 },           // Take approved photography at an event
];

export const isGameRoleConfirmed = (role: Pick<GameRole, 'gameId' | 'memberId'>, attendance: AttendanceRecord) =>
    !!attendance[role.gameId]?.[role.memberId];

// The roles that earn points (member checked in), each with its game for
// dating and labels. Pass memberId for one member. Roles whose game was
// deleted are dropped. Empty when the game_roles migration hasn't been run.
export const confirmedGameRoles = (data: Pick<AppState, 'games' | 'attendance' | 'gameRoles'>, memberId?: string) => {
    const roles = (data.gameRoles || []).filter(r => (!memberId || r.memberId === memberId) && isGameRoleConfirmed(r, data.attendance));
    if (roles.length === 0) return [];
    const gamesById = new Map(data.games.map(g => [g.id, g]));
    return roles.flatMap(role => {
        const game = gamesById.get(role.gameId);
        return game ? [{ role, game }] : [];
    });
};

// Check-in points for one member, split by category. Confirmed game-day
// roles ride along here since they also need the check-in.
const checkinPointsByCategory = (memberId: string, data: AppState) => {
    const out: Record<string, number> = {};
    const firstIds = firstSportGameIds(memberId, data);
    data.games.forEach(g => {
        if (data.attendance[g.id]?.[memberId]) {
            const c = checkinCategory(g);
            out[c] = (out[c] || 0) + checkinPointsFor(g, firstIds, data.sports);
        }
    });
    confirmedGameRoles(data, memberId).forEach(({ role }) => { out[role.category] = (out[role.category] || 0) + role.points; });
    return out;
};

// Lifetime points decide a member's fan level (rank); the leaderboard
// separately ranks by the current semester's points.
export const computeLifetimeStats = (member: Member, data: AppState) => {
    // "Game Attendance" is its own category, earned automatically from check-ins.
    const checkins = checkinPointsByCategory(member.id, data);
    const myBonusPoints = data.bonusPoints.filter(b => b.memberId === member.id);
    return buildLifetimeStats(member, checkins, myBonusPoints);
};

// Batch version for lists: groups bonus points once instead of filtering per
// member. Returns the same tier computeLifetimeStats(member, data).tier would.
export const computeLifetimeTiers = (data: AppState) => {
    const bonusByMember = new Map<string, BonusPoint[]>();
    data.bonusPoints.forEach(b => {
        const list = bonusByMember.get(b.memberId);
        if (list) list.push(b);
        else bonusByMember.set(b.memberId, [b]);
    });
    const tiers = new Map<string, ReturnType<typeof computeLifetimeStats>['tier']>();
    data.members.forEach(member => {
        tiers.set(member.id, buildLifetimeStats(member, checkinPointsByCategory(member.id, data), bonusByMember.get(member.id) || []).tier);
    });
    return tiers;
};

const buildLifetimeStats = (member: Member, checkins: Record<string, number>, myBonusPoints: BonusPoint[]) => {
    const categories = [
        { name: GAME_ATTENDANCE_CATEGORY, points: checkins[GAME_ATTENDANCE_CATEGORY] || 0, icon: 'game' as const },
        ...POINT_CATEGORIES.map(name => ({
            name,
            points: myBonusPoints.filter(b => (b.category || 'Other') === name).reduce((sum, b) => sum + b.points, 0)
                + (checkins[name] || 0),
            icon: 'category' as const,
        })),
    ];
    const totalPoints = categories.reduce((sum, c) => sum + c.points, 0)
        + (member.role === Role.ADMIN || member.role === Role.OFFICER ? 5 : 0);

    // Fan tier: highest tier where the member meets BOTH the points and
    // the breadth (distinct categories) requirement. 'Other' is excluded
    // from breadth so misc adjustments can't unlock a tier.
    const categoriesEarned = categories.filter(c => c.name !== 'Other' && c.points > 0).length;
    let tierIndex = 0;
    FAN_TIERS.forEach((t, i) => {
        if (totalPoints >= t.minPoints && categoriesEarned >= t.minCategories) tierIndex = i;
    });
    const nextTier = FAN_TIERS[tierIndex + 1];
    const tier = {
        name: FAN_TIERS[tierIndex].name,
        index: tierIndex,
        next: nextTier ? {
            name: nextTier.name,
            pointsNeeded: Math.max(0, nextTier.minPoints - totalPoints),
            categoriesNeeded: Math.max(0, nextTier.minCategories - categoriesEarned),
            progressPct: Math.min(100, Math.round((Math.max(0, totalPoints) / nextTier.minPoints) * 100)),
        } : null,
    };

    return { totalPoints, categories, categoriesEarned, tier, myBonusPoints };
};

// --- Media approval (photo gallery) ---
// Approving a member's gallery photo awards a 'Media' bonus_points row whose
// reason names the photo, so the same photo can't be credited twice and
// "Remove approval" can find the row again.
export const MEDIA_APPROVAL_POINTS = {
    content: 1,     // Submit approved unofficial content
    photography: 2, // Take approved photography at an event
};

export const mediaApprovalReason = (selfieId: string) => `Approved photo #${selfieId}`;
