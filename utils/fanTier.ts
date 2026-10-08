import { AppState, Game, Member, Role } from '../types';
import { POINT_CATEGORIES, FAN_TIERS } from '../constants';

// The one rule for game points, used everywhere: 1 for attending, +1 if
// it's a bonus game. Games no longer carry a custom point value
// (Game.pointsValue / games.points_value is ignored).
export const gamePointValue = (game: Pick<Game, 'isBonus'>) => (game.isBonus ? 2 : 1);

// Lifetime points decide a member's fan level (rank); the leaderboard
// separately ranks by the current semester's points.
export const computeLifetimeStats = (member: Member, data: AppState) => {
    // "Game Attendance" is its own category, earned automatically from check-ins.
    let gameAttendancePoints = 0;
    data.games.forEach(g => {
        if (data.attendance[g.id]?.[member.id]) gameAttendancePoints += gamePointValue(g);
    });

    const myBonusPoints = data.bonusPoints.filter(b => b.memberId === member.id);

    const categories = [
        { name: 'Game Attendance', points: gameAttendancePoints, icon: 'game' as const },
        ...POINT_CATEGORIES.map(name => ({
            name,
            points: myBonusPoints.filter(b => (b.category || 'Other') === name).reduce((sum, b) => sum + b.points, 0),
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
