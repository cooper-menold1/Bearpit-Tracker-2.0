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

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface ScrapedGame {
  date: string;
  time: string;
  opponent: string;
  location: "Home" | "Away" | "Neutral";
  sportName: string;
  description: string;
}

async function fetchMonth(year: number, month: number): Promise<ScrapedGame[]> {
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const url = `https://baylorbears.com/api/v2/Calendar/from/${startDate}/to/${endDate}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; BearPitTracker/1.0; +https://baylor-bearpit.web.app/)",
      "Referer": "https://baylorbears.com/",
      "Accept": "application/json",
    },
  });
  if (!res.ok) throw new Error(`baylorbears.com fetch failed: HTTP ${res.status}`);
  const contents = await res.json();
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
        time: event.time || "TBA",
        opponent,
        location,
        sportName,
        description: (event.gamePromotionText || "").trim(),
      });
    }
  }
  return games.filter((g) => g.opponent && g.opponent.toLowerCase() !== "baylor");
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
    for (let i = 0; i < 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      scraped.push(...(await fetchMonth(d.getFullYear(), d.getMonth() + 1)));
    }

    const sports = existingSports ?? [];
    let added = 0;
    let updated = 0;
    let skippedUnknownSport = 0;

    for (const g of scraped) {
      const sport = sports.find((s: any) => s.name.toLowerCase() === g.sportName.toLowerCase())
        ?? sports.find((s: any) => g.sportName.toLowerCase().includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(g.sportName.toLowerCase()));

      if (!sport) {
        skippedUnknownSport++;
        continue;
      }

      const existing = (existingGames ?? []).find((ex: any) => ex.date === g.date && ex.sport_id === sport.id);

      if (existing) {
        const same = existing.opponent.toLowerCase() === g.opponent.toLowerCase()
          && (existing.time === g.time || (!existing.time && !g.time))
          && existing.location === g.location;
        if (same) continue;

        const { error: updErr } = await supabase.from("games").update({
          opponent: g.opponent,
          time: g.time,
          location: g.location,
          description: g.description,
        }).eq("id", existing.id);
        if (updErr) { log.push(`Failed to update game ${g.sportName} ${g.date}: ${updErr.message}`); continue; }
        updated++;
        log.push(`Updated ${g.sportName} ${g.date}: was "${existing.opponent}"/${existing.time}/${existing.location} -> "${g.opponent}"/${g.time}/${g.location}`);
        continue;
      }

      const id = "autofill_" + sport.id + "_" + g.date;
      const { error: gameErr } = await supabase.from("games").insert({
        id,
        sport_id: sport.id,
        date: g.date,
        time: g.time,
        opponent: g.opponent,
        location: g.location,
        is_bonus: false,
        points_value: 1,
        description: g.description,
      });
      if (gameErr) { log.push(`Failed to insert game ${g.sportName} ${g.date}: ${gameErr.message}`); continue; }
      added++;
      existingGames!.push({ id, sport_id: sport.id, date: g.date, opponent: g.opponent, time: g.time, location: g.location });
    }

    const summary = `Autofill run ${new Date().toISOString()}: +${added} new games, ${updated} games updated, ${skippedUnknownSport} events skipped (no matching known sport).`;
    console.log(summary, log.join(" | "));

    return new Response(JSON.stringify({ ok: true, added, updated, skippedUnknownSport, log }), {
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
