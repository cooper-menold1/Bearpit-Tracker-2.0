import { BonusPoint } from '../types';
import { POINT_MENU, PointMenuItem } from '../constants';
import { semesterOf } from './semester';
import { todayInChicago } from './dateUtils';

// Helpers for the POINT_MENU presets (constants.ts): finding which preset a
// reason belongs to and checking the per-member caps ("Repeated activities
// may have semester or monthly caps to prevent point farming").

// bonus_points.date is a full ISO timestamp (UTC); bucket it by the Chicago
// calendar day so an 11pm game-night award lands in the right month.
export const chicagoDay =(date: string): string =>
    /^\d{4}-\d{2}-\d{2}$/.test(date)
        ? date
        : new Date(date).toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });

// A reason matches a preset when it is the preset's label, optionally with
// details appended (e.g. "Serve on Hospitality Team at a game - BSB vs TCU").
const reasonMatches = (reason: string, preset: PointMenuItem) =>
    (reason || '').trim().toLowerCase().startsWith(preset.label.toLowerCase());

export const findPreset = (reason: string, category?: string): PointMenuItem | undefined =>
    POINT_MENU.find(p => p.category === (category || 'Other') && reasonMatches(reason, p));

export const presetsByCategory = (): { category: string; items: PointMenuItem[] }[] => {
    const groups: { category: string; items: PointMenuItem[] }[] = [];
    POINT_MENU.forEach(p => {
        const g = groups.find(x => x.category === p.category);
        if (g) g.items.push(p); else groups.push({ category: p.category, items: [p] });
    });
    return groups;
};

export const presetPointsLabel = (p: PointMenuItem) =>
    p.minPoints !== undefined && p.maxPoints !== undefined ? `${p.minPoints}-${p.maxPoints}` : `${p.points}`;

export const capPeriodLabel = (p: PointMenuItem) =>
    p.cap ? `${p.cap.max} per ${p.cap.per}` : '';

const samePeriod = (date: string, per: 'month' | 'semester', today: string) => {
    const d = chicagoDay(date);
    return per === 'month' ? d.slice(0, 7) === today.slice(0, 7) : semesterOf(d).key === semesterOf(today).key;
};

// How many times this member already got this capped preset in the current
// month/semester. Only positive awards count (a -1 correction isn't a use).
export const capUsage = (memberId: string, preset: PointMenuItem, bonusPoints: BonusPoint[]): number => {
    if (!preset.cap) return 0;
    const today = todayInChicago();
    return bonusPoints.filter(b =>
        b.memberId === memberId
        && b.points > 0
        && (b.category || 'Other') === preset.category
        && reasonMatches(b.reason, preset)
        && samePeriod(b.date, preset.cap!.per, today)
    ).length;
};

export interface CapHit { memberId: string; used: number; max: number }

// Members (of memberIds) for whom one more award of this reason/category
// would go over the preset's cap. Empty when the reason isn't a capped preset.
export const capHits = (memberIds: string[], reason: string, category: string, bonusPoints: BonusPoint[]): CapHit[] => {
    const preset = findPreset(reason, category);
    if (!preset?.cap) return [];
    return memberIds
        .map(id => ({ memberId: id, used: capUsage(id, preset, bonusPoints), max: preset.cap!.max }))
        .filter(h => h.used + 1 > h.max);
};
