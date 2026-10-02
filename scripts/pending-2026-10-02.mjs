// Staged production writes from Cooper's 2026-10-02 request. Dry run by default:
//   node scripts/pending-2026-10-02.mjs                      -> prints what would be written
//   node scripts/pending-2026-10-02.mjs --apply <password>   -> writes to Supabase
// 1. Jonah Bender (new_1770939315277): attendance credit for UNT volleyball 9/3.
//    He already has UTEP 9/18 (scraped_1787705787004_uv90ymw2g), so that one is skipped.
// 2. "Test Member" general-member account for previewing the member portal.
//    Log in with name "Test Member" + the password passed on the command line.
import fs from 'node:fs';

const env = Object.fromEntries(
    fs.readFileSync(new URL('../.env', import.meta.url), 'utf8')
        .split(/\r?\n/).filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()])
);
const URL_ = env.VITE_SUPABASE_URL, KEY = env.VITE_SUPABASE_ANON_KEY;
const apply = process.argv.includes('--apply');
const password = process.argv[process.argv.indexOf('--apply') + 1];

const attendance = { game_id: 'scraped_1787705787004_2itqy6l8f', member_id: 'new_1770939315277' }; // North Texas, 2026-09-03
const testMember = { id: 'test_member_ui', first_name: 'Test', last_name: 'Member', role: 'Member', years_in_bplt: 1 };

async function post(path, body) {
    const res = await fetch(`${URL_}/rest/v1/${path}`, {
        method: 'POST',
        headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
    const text = await res.text();
    return text ? JSON.parse(text) : null;
}

async function exists(query) {
    const res = await fetch(`${URL_}/rest/v1/${query}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
    return (await res.json()).length > 0;
}

console.log('attendance: Jonah Bender -> UNT volleyball 2026-09-03');
console.log('members:    Test Member (role Member, id test_member_ui)');
if (!apply) { console.log('\nDry run. Re-run with --apply <password> to write.'); process.exit(0); }
if (!password || password.startsWith('--')) { console.error('Pass a password after --apply.'); process.exit(1); }

if (await exists(`attendance?select=member_id&game_id=eq.${attendance.game_id}&member_id=eq.${attendance.member_id}`)) console.log('attendance already present, skipped');
else await post('attendance', attendance);
if (await exists(`members?select=id&id=eq.${testMember.id}`)) console.log('test member already present, skipped');
else await post('members', testMember);
const ok = await post('rpc/rpc_claim_initial_password', { p_member_id: testMember.id, p_new_password: password });
console.log('Done. Password set:', ok);
