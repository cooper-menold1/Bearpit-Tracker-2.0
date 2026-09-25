// Staged production writes from Cooper's 2026-09-25 notes. Dry run by default:
//   node scripts/pending-2026-09-25.mjs          -> prints what would be written
//   node scripts/pending-2026-09-25.mjs --apply  -> writes to Supabase
// Point values follow the Fall 2026 Point Incentive Framework
// (special gameday role +2, Table for a premium game 3) until the team says otherwise.
import fs from 'node:fs';

const env = Object.fromEntries(
    fs.readFileSync(new URL('../.env', import.meta.url), 'utf8')
        .split(/\r?\n/).filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()])
);
const URL_ = env.VITE_SUPABASE_URL, KEY = env.VITE_SUPABASE_ANON_KEY;
const apply = process.argv.includes('--apply');

const now = new Date().toISOString();
const bonusPoints = [
    { member_id: 'm1', name: 'Ben Jacob' },
    { member_id: 'prospect_1787969848693_gko4k5', name: 'Cadence Martin' },
    { member_id: 'prospect_1787967320100_ze1xnx', name: 'Aaron Willingham' },
].map(m => ({ member_id: m.member_id, _name: m.name, points: 2, category: 'Game Day', reason: 'Special gameday responsibility: passed out burgers at volleyball game', date: now }));

// 12-2pm split into two 1-hour shifts so 2-4 people cover the table the whole time.
const tabling = ['2026-10-01', '2026-10-22'].flatMap(date => [
    ['12:00 PM - 1:00 PM'], ['1:00 PM - 2:00 PM'],
].map(([time]) => ({
    title: 'Volleyball Tabling', category: 'Marketing', date, time, location: null,
    max_signups: 4, points_value: 3,
    description: 'Promote the upcoming volleyball game. We need at least 2 people at the table the whole shift (max 4).',
})));

async function post(table, rows) {
    const res = await fetch(`${URL_}/rest/v1/${table}`, {
        method: 'POST',
        headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify(rows),
    });
    if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
}

console.log('bonus_points:'); bonusPoints.forEach(b => console.log(`  +${b.points} ${b.category}  ${b._name}  "${b.reason}"`));
console.log('club_events:'); tabling.forEach(e => console.log(`  ${e.date} ${e.time}  ${e.title}  max ${e.max_signups}, ${e.points_value} pts`));

if (!apply) { console.log('\nDry run. Re-run with --apply to write.'); process.exit(0); }
await post('bonus_points', bonusPoints.map(({ _name, ...r }) => r));
await post('club_events', tabling);
console.log('\nWritten.');
