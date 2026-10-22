import { AppState, BonusPoint, Game, Member, Role } from '../types';
import { POINT_CATEGORIES, FAN_TIERS } from '../constants';

export const GAME_ATTENDANCE_CATEGORY = 'Game Attendance';

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

// The one rule for check-in points, used everywhere: normal games are 1 for
// attending, +1 if bonus. Event check-ins use their own pointsValue (fallback 1).
export const gamePointValue = (game: Pick<Game, 'isBonus'> & Partial<Pick<Game, 'id' | 'pointsValue'>>) =>
    game.id !== undefined && isEventCheckin({ id: game.id })
        ? (game.pointsValue || 1)
        : (game.isBonus ? 2 : 1);

// Check-in points for one member, split by category.
const checkinPointsByCategory = (memberId: string, data: AppState) => {
    const out: Record<string, number> = {};
    data.games.forEach(g => {
        if (data.attendance[g.id]?.[memberId]) {
            const c = checkinCategory(g);
            out[c] = (out[c] || 0) + gamePointValue(g);
        }
    });
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
