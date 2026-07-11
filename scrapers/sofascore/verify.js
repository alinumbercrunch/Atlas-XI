// Phase 0 verify: prove the REAL rating pipeline end-to-end:
//   search player -> player detail -> recent matches -> per-match rating + minutes
const { chromium } = require("playwright");

const API = "https://api.sofascore.com/api/v1";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function apiGet(page, url) {
  const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  const status = resp?.status();
  const body = await page.evaluate(() => document.body.innerText);
  let json = null;
  try { json = JSON.parse(body); } catch {}
  return { status, json };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext({ userAgent: UA, locale: "en-US" })).newPage();
  const step = async (label, url) => {
    const { status, json } = await apiGet(page, url);
    await page.waitForTimeout(700);
    console.log(`  [HTTP ${status}] ${label}`);
    return json;
  };

  // 1) Search for a known Moroccan international.
  const search = await step("search 'Ziyech'", `${API}/search/all?q=Ziyech&page=0`);
  const results = search?.results || [];
  const player = results.find((r) => r.type === "player")?.entity;
  if (!player) { console.log("❌ no player in search results:", JSON.stringify(search).slice(0, 200)); await browser.close(); process.exit(1); }
  console.log(`     → ${player.name} (id ${player.id}), team ${player.team?.name}`);

  // 2) Recent matches for that player.
  const last = await step(`player ${player.id} recent events`, `${API}/player/${player.id}/events/last/0`);
  const events = last?.events || [];
  console.log(`     → ${events.length} recent events`);
  if (!events.length) { console.log("❌ no events"); await browser.close(); process.exit(1); }

  // 3) Per-match rating + minutes for the last few matches — this is the rating fuel.
  console.log("  per-match performance (rating × minutes):");
  let got = 0;
  for (const ev of events.slice(-6)) {
    const s = await step(
      `  event ${ev.id}`,
      `${API}/event/${ev.id}/player/${player.id}/statistics`,
    );
    const st = s?.statistics;
    if (st && st.rating != null) {
      got++;
      const date = new Date(ev.startTimestamp * 1000).toISOString().slice(0, 10);
      console.log(
        `     ${date}  ${ev.homeTeam?.name} v ${ev.awayTeam?.name}  →  rating ${st.rating}, min ${st.minutesPlayed}`,
      );
    }
  }

  await browser.close();
  const ok = got >= 1;
  console.log(ok
    ? `\n[verify] ✅ Full pipeline works — pulled ${got} matches with rating + minutes. Phase 0 DONE.`
    : "\n[verify] ❌ Could not read per-match rating/minutes.");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error("[verify] fatal:", e); process.exit(1); });
