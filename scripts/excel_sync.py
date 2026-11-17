"""BPLT Excel point tracker -> website sync. See docs/excel-sync-plan.md.

The exec team's Box sheet ("BPLT Point Tracking System.xlsx", tab "Activity Log")
is the source of truth for the non-attendance points it lists. This script makes
the site's Excel-sourced bonus_points rows mirror that sheet:
  * a row in the sheet  -> a bonus_points row on the site (added or updated)
  * a row removed from the sheet -> its bonus_points row is deleted
Attendance rows: only "Away game" rows count, and only if the member has no
check-in at a game on that date. Home/premium games come from site check-ins.
Points from the site itself (check-ins, event codes, Quick Award, referrals,
roster roles, hand-entered awards) are never touched.

Usage (dry run by default, nothing is written):
  python -I scripts/excel_sync.py              # dry run + report
  python -I scripts/excel_sync.py --apply      # write to the live site
  python -I scripts/excel_sync.py --apply --force   # skip the mass-delete guard
  --sheet PATH   use a specific .xlsx (default: BPLT_SHEET_PATH in .env, else search ~/Box)
"""
import argparse, datetime as dt, json, os, re, sys, urllib.parse, urllib.request, uuid
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
STATE_DIR = ROOT / 'sync-state'
REPORT_DIR = ROOT / 'sync-reports'
BACKUP_DIR = ROOT / 'sync-backups'
STATE_FILE = STATE_DIR / 'excel-sync-state.json'
SHEET_NAME = 'BPLT Point Tracking System.xlsx'
NAMESPACE = uuid.UUID('6f1c2a9e-5b7d-4e1a-9c3b-2d8e7f4a1b60')  # fixed: makes row ids deterministic

# Must match constants.ts POINT_CATEGORIES, plus the check-in category.
SITE_CATEGORIES = {'Hospitality', 'Game Day', 'Recruitment', 'Marketing', 'Media', 'Community',
                   'Leadership / Special Projects', 'Other', 'Attendance'}
CATEGORY_ALIASES = {'gameday': 'Game Day', 'game day': 'Game Day', 'leadership': 'Leadership / Special Projects',
                    'special projects': 'Leadership / Special Projects'}
MAX_DELETES = 10          # more than this in one run -> stop
MAX_DELETE_SHARE = 0.5    # or more than half of the Excel-sourced rows -> stop


def norm(s):
    return re.sub(r'\s+', ' ', str(s or '')).strip().lower()


def load_env():
    env = {}
    for line in (ROOT / '.env').read_text(encoding='utf-8').splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def find_sheet(env, cli_path):
    if cli_path:
        return Path(cli_path)
    if env.get('BPLT_SHEET_PATH'):
        return Path(env['BPLT_SHEET_PATH'])
    cfg = STATE_DIR / 'sheet-path.txt'  # local, gitignored (.env is tracked in git)
    if cfg.exists() and cfg.read_text(encoding='utf-8').strip():
        return Path(cfg.read_text(encoding='utf-8').strip())
    box = Path.home() / 'Box'
    hits = sorted(box.rglob(SHEET_NAME)) if box.exists() else []
    if len(hits) == 1:
        return hits[0]
    if len(hits) > 1:
        raise SystemExit(f'Found {len(hits)} copies of {SHEET_NAME} under {box}. Set BPLT_SHEET_PATH in .env.')
    raise SystemExit(f'Could not find {SHEET_NAME} under {box}. Is Box Drive signed in? Or set BPLT_SHEET_PATH in .env.')


class Api:
    def __init__(self, env):
        self.url = env['VITE_SUPABASE_URL'].rstrip('/') + '/rest/v1/'
        key = env.get('SUPABASE_SERVICE_ROLE_KEY') or env['VITE_SUPABASE_ANON_KEY']
        self.key_kind = 'service role' if env.get('SUPABASE_SERVICE_ROLE_KEY') else 'anon'
        self.h = {'apikey': key, 'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'}

    def call(self, method, path, body=None, prefer=None):
        h = dict(self.h)
        if prefer:
            h['Prefer'] = prefer
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(self.url + path, data=data, headers=h, method=method)
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                txt = r.read().decode()
                return json.loads(txt) if txt else None
        except urllib.error.HTTPError as e:
            raise RuntimeError(f'{method} {path[:80]}: {e.code} {e.read().decode()[:300]}')

    def get_all(self, path):
        out, start = [], 0
        while True:
            sep = '&' if '?' in path else '?'
            page = self.call('GET', f'{path}{sep}limit=1000&offset={start}')
            out += page
            if len(page) < 1000:
                return out
            start += 1000


def read_sheet(path):
    wb = openpyxl.load_workbook(path, data_only=True)
    guide = {}
    for row in wb['Activity Guide'].iter_rows(min_row=2, max_col=3, values_only=True):
        cat, act, pts = row
        if not act or pts is None:
            continue
        full = str(act).strip()
        short = full.split(':', 1)[1].strip() if ':' in full else full
        entry = {'category': str(cat).strip() if cat else None, 'points': float(pts), 'activity': short}
        guide[norm(full)] = entry
        guide[norm(short)] = entry
    log = wb['Activity Log']
    header = [norm(c.value) for c in next(log.iter_rows(min_row=1, max_row=1))]
    rows = []
    for i, r in enumerate(log.iter_rows(min_row=2, values_only=True), start=2):
        if all(v is None or str(v).strip() == '' for v in r[:6]):
            continue
        rows.append({'row': i, 'name': r[0], 'date': r[1], 'category': r[2], 'activity': r[3],
                     'points_cell': r[4], 'notes': r[5]})
    return guide, rows, header


def to_date(v):
    if isinstance(v, dt.datetime):
        return v.date()
    if isinstance(v, dt.date):
        return v
    if isinstance(v, str):
        for fmt in ('%m/%d/%Y', '%Y-%m-%d', '%m/%d/%y'):
            try:
                return dt.datetime.strptime(v.strip(), fmt).date()
            except ValueError:
                pass
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--apply', action='store_true')
    ap.add_argument('--force', action='store_true')
    ap.add_argument('--sheet')
    args = ap.parse_args()

    env = load_env()
    sheet = find_sheet(env, args.sheet)
    api = Api(env)
    now = dt.datetime.now()
    rep = [f'# Excel sync {now:%Y-%m-%d %H:%M} ({"APPLY" if args.apply else "DRY RUN"})',
           f'Sheet: `{sheet}` (modified {dt.datetime.fromtimestamp(sheet.stat().st_mtime):%Y-%m-%d %H:%M})',
           f'Key: {api.key_kind}', '']

    guide, rows, _ = read_sheet(sheet)
    members = api.get_all('members?select=id,first_name,last_name')
    by_name = {}
    for m in members:
        by_name.setdefault(norm(f"{m['first_name']} {m['last_name']}"), []).append(m['id'])
    aliases = {}
    alias_file = STATE_DIR / 'name-aliases.json'
    if alias_file.exists():
        aliases = {norm(k): v for k, v in json.loads(alias_file.read_text(encoding='utf-8')).items()}
    name_of = {m['id']: f"{m['first_name']} {m['last_name']}" for m in members}

    games = {g['id']: g for g in api.get_all('games?select=id,date,location')}
    attendance = api.get_all('attendance?select=game_id,member_id')
    checkin_dates = {}
    for a in attendance:
        g = games.get(a['game_id'])
        if g and g.get('date'):
            checkin_dates.setdefault(a['member_id'], set()).add(str(g['date'])[:10])
    bonus = api.get_all('bonus_points?select=id,member_id,points,reason,date,category,source')
    bonus_by_id = {b['id']: b for b in bonus}

    state = json.loads(STATE_FILE.read_text(encoding='utf-8')) if STATE_FILE.exists() else {'managed': {}}
    managed = state['managed']  # bonus_points id -> sheet key

    skipped, desired, seen = [], {}, {}
    for r in rows:
        where = f"row {r['row']}"
        name = str(r['name'] or '').strip()
        if not name:
            skipped.append((where, 'no member name')); continue
        where += f' ({name})'
        if not r['activity']:
            skipped.append((where, 'no activity')); continue
        d = to_date(r['date'])
        if not d:
            skipped.append((where, 'no or unreadable date')); continue
        ids = [aliases[norm(name)]] if norm(name) in aliases else by_name.get(norm(name), [])
        if len(ids) != 1:
            skipped.append((where, 'name not found on the site' if not ids else 'name matches more than one member')); continue
        mid = ids[0]
        g = guide.get(norm(r['activity']))
        if g:
            pts, cat, act = g['points'], g['category'], g['activity']
        else:
            act = str(r['activity']).strip()
            pc = r['points_cell']
            if not isinstance(pc, (int, float)):
                skipped.append((where, f'activity "{act}" is not in the Activity Guide and has no typed points')); continue
            pts, cat = float(pc), str(r['category'] or '').strip()
        cat = CATEGORY_ALIASES.get(norm(cat), cat)
        if cat not in SITE_CATEGORIES:
            skipped.append((where, f'category "{cat}" is not a site category')); continue
        if cat == 'Attendance':
            if 'away' not in norm(act):
                skipped.append((where, f'{act}: home/premium attendance comes from site check-ins')); continue
            if d.isoformat() in checkin_dates.get(mid, set()):
                skipped.append((where, f'away game {d}: already checked in on the site')); continue
        notes = str(r['notes']).strip() if r['notes'] else ''
        base = '|'.join([mid, d.isoformat(), norm(act), norm(notes)])
        seen[base] = seen.get(base, 0) + 1
        key = f'{base}|{seen[base]}'
        rid = str(uuid.uuid5(NAMESPACE, key))
        pts = int(pts) if float(pts).is_integer() else pts
        desired[rid] = {'key': key, 'sheet_row': r['row'], 'row': {
            'id': rid, 'member_id': mid, 'points': pts, 'category': cat,
            'reason': f'{act} ({notes})' if notes else act, 'date': f'{d.isoformat()}T12:00:00-06:00',
            'source': 'excel'}}

    # Rows we created earlier: anything in the state file, plus any deterministic id already live.
    ours_live = {i for i in managed if i in bonus_by_id} | {i for i in desired if i in bonus_by_id}

    def differs(live, want):
        return (live['member_id'] != want['member_id'] or float(live['points']) != float(want['points'])
                or (live.get('category') or '') != want['category'] or live['reason'] != want['reason']
                or str(live['date'])[:10] != want['date'][:10] or live.get('source') != 'excel')

    to_add = [v['row'] for i, v in desired.items() if i not in bonus_by_id]
    to_update = [v['row'] for i, v in desired.items() if i in bonus_by_id and differs(bonus_by_id[i], v['row'])]
    to_delete = sorted(i for i in ours_live if i not in desired)

    # Possible double counts: hand-entered site points that look like a sheet row.
    dupes = []
    for v in desired.values():
        w = v['row']
        for b in bonus:
            if b['id'] in ours_live or b['id'] in desired:
                continue
            if b['member_id'] == w['member_id'] and (b.get('category') or 'Other') == w['category'] and float(b['points']) == float(w['points']):
                dupes.append((name_of.get(w['member_id'], w['member_id']), w['reason'], w['date'][:10], b['reason'], str(b['date'])[:10]))

    fmt = lambda w: f"{name_of.get(w['member_id'], w['member_id'])}: +{w['points']} {w['category']}, {w['reason']} ({w['date'][:10]})"
    rep.append(f'Sheet rows read: {len(rows)}. Valid: {len(desired)}. Skipped: {len(skipped)}.')
    rep.append(f'Changes: {len(to_add)} add, {len(to_update)} update, {len(to_delete)} remove.\n')
    for title, items in (('Add', [fmt(w) for w in to_add]), ('Update', [fmt(w) for w in to_update]),
                         ('Remove (no longer in the sheet)', [fmt(bonus_by_id[i]) for i in to_delete]),
                         ('Skipped', [f'{w}: {why}' for w, why in skipped]),
                         ('Possible double counts (already entered on the site by hand)',
                          [f'{n}: sheet "{s}" {sd}  vs  site "{b}" {bd}' for n, s, sd, b, bd in dupes])):
        rep.append(f'## {title} ({len(items)})')
        rep += [f'- {x}' for x in items] or ['- none']
        rep.append('')

    totals = {}
    for v in desired.values():
        w = v['row']; totals[w['member_id']] = totals.get(w['member_id'], 0) + w['points']
    rep.append('## Sheet points per member (after this sync)')
    rep += [f'- {name_of.get(m, m)}: {p}' for m, p in sorted(totals.items(), key=lambda x: -x[1])] or ['- none']

    blocked = None
    if not desired and ours_live:
        blocked = 'the sheet has no valid rows but the site has Excel points. Not wiping them.'
    elif len(to_delete) > MAX_DELETES or (len(ours_live) >= 4 and len(to_delete) > MAX_DELETE_SHARE * len(ours_live)):
        blocked = f'{len(to_delete)} removals in one run is more than the safety limit.'
    if blocked and not args.force:
        rep.insert(4, f'**STOPPED: {blocked} Nothing was changed. Check the sheet, then re-run with --force if this is intended.**\n')

    REPORT_DIR.mkdir(exist_ok=True)
    report_path = REPORT_DIR / f'{now:%Y-%m-%d_%H%M}{"" if args.apply else "_dryrun"}.md'

    if args.apply and not (blocked and not args.force):
        BACKUP_DIR.mkdir(exist_ok=True)
        (BACKUP_DIR / f'{now:%Y-%m-%d_%H%M}.json').write_text(
            json.dumps([bonus_by_id[i] for i in ours_live], indent=1, default=str), encoding='utf-8')
        if to_add or to_update:
            api.call('POST', 'bonus_points?on_conflict=id', to_add + to_update, prefer='resolution=merge-duplicates,return=minimal')
        for i in range(0, len(to_delete), 50):
            ids = ','.join(to_delete[i:i + 50])
            api.call('DELETE', f'bonus_points?id=in.({ids})', prefer='return=minimal')
        STATE_DIR.mkdir(exist_ok=True)
        state['managed'] = {i: v['key'] for i, v in desired.items()}
        state['last_apply'] = now.isoformat(timespec='seconds')
        STATE_FILE.write_text(json.dumps(state, indent=1), encoding='utf-8')
        # Verify: every desired id is now live, every removed id is gone.
        live_ids = {b['id'] for b in api.get_all('bonus_points?select=id')}
        missing = [i for i in desired if i not in live_ids]
        lingering = [i for i in to_delete if i in live_ids]
        rep.append(f'\nVerify: {len(desired) - len(missing)}/{len(desired)} sheet rows live, {len(lingering)} removals still present.')
        if missing or lingering:
            rep.append('**VERIFY FAILED**')

    report_path.write_text('\n'.join(rep) + '\n', encoding='utf-8')
    print('\n'.join(rep))
    print(f'\nReport: {report_path}')
    if blocked and not args.force:
        sys.exit(2)
    if not args.apply:
        print('Dry run. Nothing was written. Re-run with --apply to update the site.')


if __name__ == '__main__':
    main()
