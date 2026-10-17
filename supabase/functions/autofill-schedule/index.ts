// Scheduled version of AutoFillModal's "Baylor Schedule" mode.
// Runs weekly via pg_cron (see supabase/migrations/..._schedule_autofill_cron.sql),
// fetches baylorbears.com directly (no CORS proxy needed server-side, unlike
// utils/scraper.ts's browser-side version), inserts new games, and updates
// existing ones whose opponent/time/location changed.
//
// - Only fills games for sports that already exist in the `sports` table
//   (matched by exact or partial name, same as resolveSportMappings). A
//   scraped sport with no match — including anything with "club" in the
//   name — is skipped rather than auto-created; unattended runs shouldn't be
//   inventing new Sport rows.
// - A game matched to an existing row (same sport + date) gets UPDATED in
//   place when the scraped opponent/time/location differs, so the tracker
//   stays current with baylorbears.com without needing a manual re-run of
//   AutoFillModal.
// - Premium games (Fall 2026 point framework) are marked is_bonus = true on insert, and
//   upgraded false -> true on existing rows. It never sets an existing true back to false.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const PRUNE_STALE = Deno.env.get("AUTOFILL_PRUNE_STALE") !== "false";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Premium games (is_bonus = true, worth 2 points). Source: Fall 2026 BearPit Point
// Incentive Framework; update each semester.
// KEEP IN SYNC with utils/premium.ts (this file cannot import from the app).
// Keyed by the scraped baylorbears.com sport title, not sport_id.
const PREMIUM_GAMES: Record<string, string[]> = {
  "Volleyball": ["2026-09-05", "2026-10-02", "2026-10-04", "2026-10-25", "2026-10-30", "2026-11-20", "2026-11-28"],
  "Soccer": ["2026-10-02", "2026-10-16"],
  "Women's Basketball": ["2026-11-02"],
};
const normSport = (s: string) => s.trim().toLowerCase().replace(/’/g, "'");
const PREMIUM_BY_SPORT: Record<string, string[]> = Object.fromEntries(
  Object.entries(PREMIUM_GAMES).map(([k, v]) => [normSport(k), v]),
);
function isPremiumGame(sportName: string, date: string): boolean {
  return (PREMIUM_BY_SPORT[normSport(sportName)] ?? []).includes(date);
}

interface ScrapedGame {
  date: string;
  time: string;
  opponent: string;
  location: "Home" | "Away" | "Neutral";
  sportName: string;
  description: string;
}

// Public CORS-proxy fallback, same set utils/scraper.ts uses client-side.
// baylorbears.com (Cloudflare) 403s Supabase Edge Functions' own egress IPs
// even with browser-like headers — confirmed 2026-08-26, direct fetch works
// fine from other networks but not from here — so a direct attempt is tried
// first (fast, no third-party dependency when it works), and these proxies
// are the fallback since they're already proven to get through from the
// client's AutoFillModal.
// corsproxy.io removed: as of 2026-08, its anonymous endpoint 403s with
// "keyless_legacy_url" and requires a paid API key — it can no longer serve
// as a free fallback here.
const PROXIES = [
  (url: string) => `https://cors-get-proxy.sirjosh.workers.dev/?url=${encodeURIComponent(url)}`,
  (url: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
];

function parseCalendarPayload(contents: any): ScrapedGame[] {
  if (!Array.isArray(contents)) throw new Error("Unexpected response shape from baylorbears.com");

  const games: ScrapedGame[] = [];
  for (const dayData of contents) {
    if (!dayData?.events || !Array.isArray(dayData.events)) continue;
    const dateStr = dayData.date ? dayData.date.split("T")[0] : "";
    if (!dateStr) continue;

    for (const event of dayData.events) {
      const sportName = event.sport?.title || "Unknown";
      const opponent = (event.opponent?.title || event.title || "Unknown Opponent").trim();

      let location: "Home" | "Away" | "Neutral" = "Home";
      if (event.locationIndicator === "A" || event.atVs === "at") location = "Away";
      else if (event.locationIndicator === "N") location = "Neutral";

      games.push({
        date: dateStr,
        time: event.time?.trim() || "TBA",
        opponent,
        location,
        sportName,
        description: (event.gamePromotionText || "").trim(),
      });
    }
  }
  return games.filter((g) => g.opponent && g.opponent.toLowerCase() !== "baylor");
}

const normTime = (t?: string | null): string => {
  const v = (t || "").trim().toLowerCase().replace(/\s+/g, "").replace(/\./g, "");
  return v === "tba" || v === "tbd" ? "" : v;
};

// Match scraped games to existing by sport + date + start time (keeps doubleheaders separate).
// Passes (each existing game claimed once): same time; same opponent; lone leftover on that sport/day;
// pass 4 = "moved": same sport + opponent within +-21 days, where that (sport, opponent, date) is no longer scraped.
// Keep in sync with matchGamesToExisting in utils/scraper.ts.
function matchGames(queries: { sportKey?: string; date: string; time?: string; opponent: string }[], existing: any[]): (string | null)[] {
  const result: (string | null)[] = queries.map(() => null);
  const claimed = new Set<string>();
  const cands = (q: any) => existing.filter((e) => !claimed.has(e.id) && e.date === q.date && e.sport_id === q.sportKey);
  const run = (pick: (q: any, c: any[]) => any) => {
    queries.forEach((q, i) => {
      if (result[i] || !q.sportKey) return;
      const m = pick(q, cands(q));
      if (m) { result[i] = m.id; claimed.add(m.id); }
    });
  };
  run((q, c) => { const t = normTime(q.time); return t ? c.find((e) => normTime(e.time) === t) : undefined; });
  run((q, c) => c.find((e) => String(e.opponent).toLowerCase() === q.opponent.toLowerCase()));
  run((q, c) => {
    const n = queries.filter((o, j) => !result[j] && o.sportKey === q.sportKey && o.date === q.date).length;
    return c.length === 1 && n === 1 ? c[0] : undefined;
  });
  // Pass 4: moved games (date changed on the site).
  const dayNum = (d: string) => Date.parse(d + "T00:00:00Z") / 86400000;
  const oppKey = (o: any) => String(o ?? "").trim().toLowerCase();
  const scrapedKeys = new Set(queries.map((q) => `${q.sportKey}|${oppKey(q.opponent)}|${q.date}`));
  queries.forEach((q, i) => {
    if (result[i] || !q.sportKey) return;
    let best: any = null;
    let bestDiff = Infinity;
    for (const e of existing) {
      if (claimed.has(e.id) || e.sport_id !== q.sportKey || oppKey(e.opponent) !== oppKey(q.opponent)) continue;
      const diff = Math.abs(dayNum(e.date) - dayNum(q.date));
      if (!(diff <= 21) || scrapedKeys.has(`${e.sport_id}|${oppKey(e.opponent)}|${e.date}`)) continue;
      if (diff < bestDiff) { best = e; bestDiff = diff; }
    }
    if (best) { result[i] = best.id; claimed.add(best.id); }
  });
  return result;
}

async function fetchMonth(year: number, month: number, log: string[]): Promise<ScrapedGame[]> {
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const baseUrl = `https://baylorbears.com/api/v2/Calendar/from/${startDate}/to/${endDate}`;

  // 1. Direct attempt.
  try {
    const res = await fetch(baseUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Referer": "https://baylorbears.com/",
        "Accept": "application/json",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return parseCalendarPayload(await res.json());
  } catch (directErr) {
    log.push(`Direct fetch for ${year}-${month} failed (${directErr}), falling back to proxies`);
  }

  // 2. Proxy fallback chain.
  let lastError: unknown = null;
  for (const proxyFn of PROXIES) {
    const proxyUrl = proxyFn(baseUrl);
    try {
      const res = await fetch(proxyUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      let contents = data.contents;
      if (typeof contents === "string") {
        try { contents = JSON.parse(contents); } catch { /* ignore */ }
      }
      if (!contents) contents = data;
      if (contents?.Error) { lastError = new Error(contents.Error); continue; }
      if (!Array.isArray(contents)) { lastError = new Error("Unexpected proxy payload shape"); continue; }

      return parseCalendarPayload(contents);
    } catch (err) {
      lastError = err;
      continue;
    }
  }

  throw lastError || new Error(`All fetch attempts failed for ${year}-${month}`);
}

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const log: string[] = [];

  try {
    const { data: existingSports, error: sportsErr } = await supabase.from("sports").select("*");
    if (sportsErr) throw sportsErr;
    const { data: existingGames, error: gamesErr } = await supabase.from("games").select("*");
    if (gamesErr) throw gamesErr;

    // Current month + next 2 months, so a weekly run never misses a
    // newly-posted game regardless of when in the month it lands.
    const now = new Date();
    const scraped: ScrapedGame[] = [];
    const monthKeys: string[] = [];
    const monthCounts = new Map<string, number>(); // YYYY-MM -> events fetched for that month
    for (let i = 0; i < 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const got = await fetchMonth(d.getFullYear(), d.getMonth() + 1, log);
      monthKeys.push(mk);
      monthCounts.set(mk, got.length);
      scraped.push(...got);
    }

    const sports = existingSports ?? [];
    let added = 0;
    let updated = 0;
    let premiumMarked = 0;
    let skippedUnknownSport = 0;

    const sportFor = (g: ScrapedGame) =>
      sports.find((s: any) => s.name.toLowerCase() === g.sportName.toLowerCase())
        ?? sports.find((s: any) => g.sportName.toLowerCase().includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(g.sportName.toLowerCase()));
    const snapshot = [...(existingGames ?? [])];
    const matchedIds = matchGames(
      scraped.map((g) => ({ sportKey: sportFor(g)?.id, date: g.date, time: g.time, opponent: g.opponent })),
      existingGames ?? [],
    );

    for (const [gi, g] of scraped.entries()) {
      const sport = sportFor(g);

      if (!sport) {
        skippedUnknownSport++;
        continue;
      }

      const existing = matchedIds[gi] ? (existingGames ?? []).find((ex: any) => ex.id === matchedIds[gi]) : undefined;

      if (existing) {
        const same = existing.opponent.toLowerCase() === g.opponent.toLowerCase()
          && existing.date === g.date
          && ((existing.time || "").trim() === g.time.trim() || (!existing.time && !g.time))
          && existing.location === g.location;
        const premiumUpgrade = isPremiumGame(g.sportName, g.date) && !existing.is_bonus;
        if (same && !premiumUpgrade) continue;

        const { error: updErr } = await supabase.from("games").update({
          opponent: g.opponent,
          date: g.date,
          time: g.time.trim(),
          location: g.location,
          description: g.description,
          ...(premiumUpgrade ? { is_bonus: true } : {}),
        }).eq("id", existing.id);
        if (updErr) { log.push(`Failed to update game ${g.sportName} ${g.date}: ${updErr.message}`); continue; }
        if (premiumUpgrade) { premiumMarked++; log.push(`Marked premium ${g.sportName} ${g.date} (${existing.id})`); }
        if (same) continue;
        updated++;
        log.push(`Updated ${g.sportName} ${g.date}: was ${existing.date} "${existing.opponent}"/${existing.time}/${existing.location} -> "${g.opponent}"/${g.time}/${g.location}`);
        continue;
      }

      let id = "autofill_" + sport.id + "_" + g.date;
      if ((existingGames ?? []).some((ex: any) => ex.id === id)) {
        // Second game of a doubleheader: disambiguate the id so it does not overwrite the first.
        id += "_" + (normTime(g.time) || g.opponent.toLowerCase()).replace(/[^a-z0-9]+/g, "");
      }
      const { error: gameErr } = await supabase.from("games").insert({
        id,
        sport_id: sport.id,
        date: g.date,
        time: g.time,
        opponent: g.opponent,
        location: g.location,
        is_bonus: isPremiumGame(g.sportName, g.date),
        points_value: 1,
        description: g.description,
      });
      if (gameErr) { log.push(`Failed to insert game ${g.sportName} ${g.date}: ${gameErr.message}`); continue; }
      added++;
      existingGames!.push({ id, sport_id: sport.id, date: g.date, opponent: g.opponent, time: g.time, location: g.location });
    }

    // Stale rows: auto-imported, future, inside the fetched window, in a covered sport, and no longer listed.
    let pruned = 0;
    let staleKept = 0;
    const matchedSet = new Set(matchedIds.filter(Boolean));
    // Coverage is per sport AND month: a partial or empty month (e.g. a proxy returning "[]")
    // must never be read as "those games were removed", or real games would be deleted.
    const coveredSportMonths = new Set(
      scraped.map((g) => { const sp = sportFor(g)?.id; return sp ? `${sp}|${String(g.date).slice(0, 7)}` : null; }).filter(Boolean) as string[],
    );
    for (const mk of monthKeys) {
      if ((monthCounts.get(mk) ?? 0) === 0) log.push(`Prune skipped for ${mk}: fetch returned 0 events.`);
    }
    const todayChicago = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());
    const winEndD = new Date(now.getFullYear(), now.getMonth() + 3, 0);
    const winEnd = `${winEndD.getFullYear()}-${String(winEndD.getMonth() + 1).padStart(2, "0")}-${String(winEndD.getDate()).padStart(2, "0")}`;
    const stale = snapshot.filter((e: any) =>
      (String(e.id).startsWith("scraped_") || String(e.id).startsWith("autofill_"))
      && e.date >= todayChicago && e.date <= winEnd
      && (monthCounts.get(String(e.date).slice(0, 7)) ?? 0) > 0
      && coveredSportMonths.has(`${e.sport_id}|${String(e.date).slice(0, 7)}`)
      && !matchedSet.has(e.id));
    if (stale.length > 0) {
      const withAttendance = new Set<string>();
      let attendanceOk = true;
      for (let i = 0; i < stale.length; i += 100) {
        const { data: att, error: attErr } = await supabase.from("attendance").select("game_id").in("game_id", stale.slice(i, i + 100).map((e: any) => e.id));
        if (attErr) { attendanceOk = false; log.push(`Attendance check failed, not pruning: ${attErr.message}`); break; }
        (att ?? []).forEach((a: any) => withAttendance.add(a.game_id));
      }
      for (const e of stale as any[]) {
        const label = `${e.sport_id} ${e.date} ${e.opponent} (${e.id})`;
        if (!attendanceOk || withAttendance.has(e.id) || !PRUNE_STALE) {
          staleKept++;
          log.push(`Stale (kept${withAttendance.has(e.id) ? ", has attendance" : ""}): ${label}`);
          continue;
        }
        const { error: delErr } = await supabase.from("games").delete().eq("id", e.id);
        if (delErr) { staleKept++; log.push(`Failed to prune ${label}: ${delErr.message}`); continue; }
        pruned++;
        log.push(`Pruned stale game: ${label}`);
      }
    }

    const summary = `Autofill run ${new Date().toISOString()}: +${added} new games, ${updated} games updated, ${premiumMarked} marked premium, ${pruned} stale pruned (${staleKept} stale kept), ${skippedUnknownSport} events skipped (no matching known sport).`;
    console.log(summary, log.join(" | "));

    return new Response(JSON.stringify({ ok: true, added, updated, premiumMarked, pruned, staleKept, skippedUnknownSport, log }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Autofill run failed:", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
