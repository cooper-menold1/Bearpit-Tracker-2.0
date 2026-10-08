// Cooper's 2026-10-05 request: Ryan Watford (new_1768957453756) present at volleyball vs UCF 10/2 and vs Colorado 10/4.
// Game points come from attendance automatically (1 per game, 2 if bonus). Skips rows that already exist.
import fs from 'node:fs';
const env = Object.fromEntries(fs.readFileSync(new URL('../.env', import.meta.url), 'utf8').split(/\r?\n/).filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const U = env.VITE_SUPABASE_URL, K = env.VITE_SUPABASE_ANON_KEY, H = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' };
const member = 'new_1768957453756';
for (const game of ['autofill_vb_2026-10-02', 'autofill_vb_2026-10-04']) {
    const have = await (await fetch(`${U}/rest/v1/attendance?select=game_id&game_id=eq.${game}&member_id=eq.${member}`, { headers: H })).json();
    if (have.length) { console.log(game, 'already present'); continue; }
    const res = await fetch(`${U}/rest/v1/attendance`, { method: 'POST', headers: H, body: JSON.stringify({ game_id: game, member_id: member }) });
    console.log(game, res.ok ? 'added' : `FAILED ${res.status} ${await res.text()}`);
}
const rows = await (await fetch(`${U}/rest/v1/attendance?select=game_id&member_id=eq.${member}&game_id=in.(autofill_vb_2026-10-02,autofill_vb_2026-10-04)`, { headers: H })).json();
console.log('verified rows:', JSON.stringify(rows));
