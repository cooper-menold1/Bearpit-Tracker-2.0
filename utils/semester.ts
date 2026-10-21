// Semesters for splitting leaderboard points. Start dates are Baylor's
// first day of classes (registrar academic calendar). A semester runs from
// its start date until the next one starts, so winter-break games count
// toward the fall and summer activity toward the spring.
// Add the next year's start dates here once Baylor publishes them; dates
// outside this table fall back to a month rule (Aug-Dec = Fall).
const SEMESTER_STARTS: { label: string; start: string }[] = [
    { label: 'Spring 2026', start: '2026-01-20' },
    { label: 'Fall 2026', start: '2026-08-24' },
    { label: 'Spring 2027', start: '2027-01-19' },
    { label: 'Fall 2027', start: '2027-08-23' },
];

const SEMESTER_STARTS_DESC = [...SEMESTER_STARTS].reverse();

export interface Semester {
    key: string; // sorts chronologically, e.g. "2026-2-Fall"
    label: string; // e.g. "Fall 2026"
}

const toSemester = (label: string): Semester => {
    const [term, year] = label.split(' ');
    return { key: `${year}-${term === 'Fall' ? 2 : 1}-${term}`, label };
};

export const semesterOf = (dateStr: string): Semester => {
    const d = dateStr.slice(0, 10);
    const first = SEMESTER_STARTS[0].start;
    const last = SEMESTER_STARTS[SEMESTER_STARTS.length - 1].start;
    if (d >= first && d < last) {
        const match = SEMESTER_STARTS_DESC.find(s => d >= s.start)!;
        return toSemester(match.label);
    }
    const year = Number(d.slice(0, 4));
    const month = Number(d.slice(5, 7));
    return toSemester(month >= 8 ? `Fall ${year}` : `Spring ${year}`);
};

const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const currentSemester = (): Semester => semesterOf(todayStr());

// Every semester that has any dated activity, newest first, always
// including the current one so the default selection exists.
export const listSemesters = (dates: string[]): Semester[] => {
    const byKey = new Map<string, Semester>();
    [...dates, todayStr()].forEach(d => {
        if (!d) return;
        const s = semesterOf(d);
        byKey.set(s.key, s);
    });
    return [...byKey.values()].sort((a, b) => b.key.localeCompare(a.key));
};
