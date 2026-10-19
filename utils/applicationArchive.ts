import { AppState, Member, Sport } from '../types';
import { parseLocalDate } from './dateUtils';

// A membership application is archived once it has sat this long with no
// interaction at a general meeting or interest meeting.
export const ARCHIVE_AFTER_DAYS = 28;

export interface ApplicationStatus {
    appliedDate: Date | null;      // from id timestamp, null if unparseable
    lastMeetingDate: Date | null;  // latest meeting/interest game the member is checked in to, dated <= now
    lastActivity: Date | null;     // later of appliedDate and lastMeetingDate
    daysIdle: number | null;       // whole days from lastActivity to now
    archived: boolean;
}

type ArchiveData = Pick<AppState, 'games' | 'sports' | 'attendance'>;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
// Apply timestamps outside this window are treated as garbage ids.
const MIN_VALID_APPLY_MS = new Date(2020, 0, 1).getTime();

// Prospect ids are `prospect_${Date.now()}_${rand}` (older rows may be just
// `prospect_${Date.now()}` or another shape), so take the first 13-digit run.
export function getApplicationDate(member: Member): Date | null {
    const match = /(?<!\d)(\d{13})(?!\d)/.exec(member?.id || '');
    if (!match) return null;
    const ms = Number(match[1]);
    if (!Number.isFinite(ms) || ms < MIN_VALID_APPLY_MS || ms > Date.now()) return null;
    return new Date(ms);
}

// General meetings and interest meetings both live under the Meetings sport
// (id 'meetings'), so a loose match on id or name covers them.
export function isMeetingSport(sport: Sport): boolean {
    return /meeting|interest/i.test(`${sport?.id || ''} ${sport?.name || ''}`);
}

export function getApplicationStatus(member: Member, data: ArchiveData, now: Date = new Date()): ApplicationStatus {
    const appliedRaw = getApplicationDate(member);
    // An apply date in the future relative to `now` can't be trusted.
    const appliedDate = appliedRaw && appliedRaw.getTime() <= now.getTime() ? appliedRaw : null;

    const meetingSportIds = new Set((data?.sports || []).filter(isMeetingSport).map(s => s.id));
    let lastMeetingDate: Date | null = null;
    for (const game of data?.games || []) {
        if (!meetingSportIds.has(game.sportId)) continue;
        if (!data.attendance?.[game.id]?.[member.id]) continue;
        if (!game.date || !/^\d{4}-\d{2}-\d{2}/.test(game.date)) continue;
        const d = parseLocalDate(game.date.slice(0, 10));
        if (isNaN(d.getTime()) || d.getTime() > now.getTime()) continue;
        if (!lastMeetingDate || d.getTime() > lastMeetingDate.getTime()) lastMeetingDate = d;
    }

    let lastActivity: Date | null = appliedDate;
    if (lastMeetingDate && (!lastActivity || lastMeetingDate.getTime() > lastActivity.getTime())) {
        lastActivity = lastMeetingDate;
    }

    const daysIdle = lastActivity
        ? Math.max(0, Math.floor((now.getTime() - lastActivity.getTime()) / MS_PER_DAY))
        : null;
    // Legacy rows with no usable date at all are archived too.
    const archived = daysIdle === null || daysIdle >= ARCHIVE_AFTER_DAYS;

    return { appliedDate, lastMeetingDate, lastActivity, daysIdle, archived };
}

// Splits applications into active and archived, each newest activity first
// (rows with no activity date sort last).
export function splitApplications(
    prospects: Member[],
    data: ArchiveData,
    now: Date = new Date()
): { active: Member[]; archived: Member[]; statusById: Map<string, ApplicationStatus> } {
    const statusById = new Map<string, ApplicationStatus>();
    const active: Member[] = [];
    const archived: Member[] = [];

    for (const p of prospects || []) {
        const status = getApplicationStatus(p, data, now);
        statusById.set(p.id, status);
        (status.archived ? archived : active).push(p);
    }

    const time = (m: Member) => statusById.get(m.id)?.lastActivity?.getTime() ?? null;
    const byRecent = (a: Member, b: Member) => {
        const ta = time(a);
        const tb = time(b);
        if (ta === null && tb === null) return 0;
        if (ta === null) return 1;
        if (tb === null) return -1;
        return tb - ta;
    };
    active.sort(byRecent);
    archived.sort(byRecent);

    return { active, archived, statusById };
}
