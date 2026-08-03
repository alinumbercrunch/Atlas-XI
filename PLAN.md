# Morocco Player Stats — Project Plan

_Last updated: 2026-07-11_

## 1. What we're building

A **scouting platform for the Morocco national team**: track players who are **eligible to be
called up but not yet cap-tied**, and help decide who deserves a call-up based on a _fair_ rating.

### Eligibility rule (the defining filter)

A player is **in scope** if:

- He is **Moroccan by nationality or descent** (binationals included — citizenship OR birthplace signals), **AND**
- He has **never played a senior "A"-team match for any country**.
  - Youth caps (U17 / U20 / U21 / U23) do **not** cap-tie a player → those players are still eligible.

**Data source for eligibility:** Transfermarkt player profiles list international appearances split into
A-team vs youth, plus citizenship and place of birth.

**Three-state eligibility status** (not a hard binary — friendlies don't cap-tie under FIFA rules):

- `eligible` — Moroccan-eligible AND **0 senior A caps**. Auto-included.
- `review` — Moroccan-eligible BUT has **≥1 senior A cap** for another country. **Not excluded** — flagged for
  manual check (a friendly-only capper can still switch to Morocco; a competitive capper cannot).
- `excluded` — not Moroccan-eligible, or confirmed cap-tied.

**Discovery strategy (targeted + overrides):**

- Use Transfermarkt's **players-by-nationality = Morocco** lists (captures dual-nationals with Moroccan citizenship tagged).
- Enrich each candidate's profile for caps / citizenship / position / market value.
- **Manual `overrides` table** for descent-only players (no Moroccan passport in the data — undetectable
  automatically by anyone) and for resolving `review`-bucket cases. Overrides win over auto-detection.
- Broad full-roster crawl of all leagues is a later option if we find we're missing people.

### Leagues in scope

| #   | Country        | Tier 1               | Tier 2              |
| --- | -------------- | -------------------- | ------------------- |
| 1   | 🇲🇦 Morocco     | Botola Pro 1         | —                   |
| 2   | 🇫🇷 France      | Ligue 1              | Ligue 2             |
| 3   | 🇪🇸 Spain       | La Liga              | Segunda (La Liga 2) |
| 4   | 🇮🇹 Italy       | Serie A              | Serie B             |
| 5   | 🇵🇹 Portugal    | Primeira Liga        | —                   |
| 6   | 🇳🇱 Netherlands | Eredivisie           | Eerste Divisie      |
| 7   | 🇩🇪 Germany     | Bundesliga           | 2. Bundesliga       |
| 8   | 🇧🇪 Belgium     | Pro League           | —                   |
| 9   | 🏴 England     | Premier League       | Championship        |
| 10  | 🏴 Scotland    | Scottish Premiership | —                   |

16 divisions total. Because discovery is nationality-driven (not per-league crawling), adding divisions is cheap —
we just filter the Moroccan-player set to those whose current club sits in one of these divisions.

## 2. Features (kept deliberately simple)

1. **Best XI** — one auto-selected squad, arranged into a formation (default **4-3-3**, configurable).
   Solved as an **optimal assignment** (maximize total squad score, each player used once) — _not_ naïve
   top-per-slot, because a versatile player can be #1 at two positions but fill only one.
2. **Browse & rank** — filter by **league** and **position**; see all eligible players ranked by fair score.

_No sprawling option menus. These two views are the product for v1._

**Position taxonomy** (for filtering and squad slots): `GK, CB, FB, DM, CM, AM, W, ST`.
Each raw Transfermarkt/SofaScore position maps into one of these; a player may qualify for several.

## 3. The fair rating system

SofaScore's per-match rating has two flaws we fix rather than discard:
it ignores **how many minutes** you played and **how strong your league is**.

### Per-player season score

```
wAvg   = Σ(rating_i × minutes_i) / Σ(minutes_i)     // minutes-weighted average rating
M      = Σ(minutes_i)                                // total minutes this season
shrunk = (wAvg × M + baseline × K) / (M + K)         // Bayesian shrinkage toward baseline
Score  = shrunk × leagueCoefficient(player.league)   // weight by league strength
```

- `baseline` = **6.2** (≈ the eligible pool's average rating; tuned down from 6.7 so small samples don't float up).
- `K` = "prior minutes" constant (500). Larger K = more skeptical of small samples.
- Result: a small sample is pulled toward the baseline until minutes accumulate — this **solves the
  cameo problem** (an 8.0 over 10 minutes contributes almost nothing until the player earns real minutes).

**Worked example (the exact cameo scenario):** with baseline 6.2, K 500 —
a sub rated 8.0 over 50 min → **6.36**; a starter rated 7.0 over 2700 min → **6.88**.
The solid starter correctly ranks higher. ✅

### League strength coefficient (starter values — tunable)

| League                 | Coeff |     | League                       | Coeff |
| ---------------------- | ----- | --- | ---------------------------- | ----- |
| Premier League (ENG 1) | 1.00  |     | Championship (ENG 2)         | 0.66  |
| La Liga (ESP 1)        | 0.95  |     | 2. Bundesliga (GER 2)        | 0.62  |
| Bundesliga (GER 1)     | 0.92  |     | Serie B (ITA 2)              | 0.60  |
| Serie A (ITA 1)        | 0.92  |     | Segunda (ESP 2)              | 0.60  |
| Ligue 1 (FRA 1)        | 0.85  |     | Ligue 2 (FRA 2)              | 0.58  |
| Primeira Liga (POR 1)  | 0.78  |     | Scottish Premiership (SCO 1) | 0.55  |
| Eredivisie (NED 1)     | 0.75  |     | Botola Pro 1 (MAR 1)         | 0.50  |
| Pro League (BEL 1)     | 0.72  |     | Eerste Divisie (NED 2)       | 0.48  |

These are hand-set starters (v1). Better long-term: derive them from UEFA club coefficients and/or average
squad market value so they're defensible rather than arbitrary. Stored in the `leagues` table so they're editable.

### Timeframe & mid-season transfers

Default to the **current season (2025/26)** club stats. For players who **transfer between leagues mid-season**,
apply the league coefficient **per match** (based on that match's competition) before aggregating — so a January
move or a cup game is weighted correctly, rather than tagging the whole season with one league's coefficient.

### Minimum-minutes gate

**Ranking floor: ≥ 300 league minutes** to appear in Browse (Best XI: ≥ 450) — a tiny-sample fluke can't take a
squad slot. The Browse view shows everyone (with minutes displayed so users can judge sample size).

### Future (not v1)

Custom composite from raw per-match stats (goals, xG, tackles, pass %, position-weighted). Documented, deferred.

## 4. Data sources & the scraping decision

Tested 2026-07-11:

| Source                                     | Plain fetch (axios) | Role                                                                         |
| ------------------------------------------ | ------------------- | ---------------------------------------------------------------------------- |
| SofaScore JSON API                         | ❌ 403 (Cloudflare) | **Performance stats** via Playwright                                         |
| SofaScore HTML                             | ❌ 403 (Cloudflare) | —                                                                            |
| Transfermarkt                              | ✅ works            | **Discovery + eligibility** (bio, position, caps, citizenship, market value) |
| Botola official site (botola.ma / lnfp.ma) | to verify           | **Botola fallback** for Moroccan-league coverage                             |

**Division of labor:**

- **Transfermarkt** (plain HTTP + cheerio): discover players per league/club; extract nationality, position,
  A-team vs youth caps, market value → drives eligibility filtering.
- **SofaScore** (Playwright): per-match ratings & minutes → feed the fair rating.
- **Botola official site** (to be checked in Phase 1): SofaScore/Transfermarkt coverage of the Moroccan league
  can be thin. If so, use the official Botola/LNFP site as a supplementary source for Botola fixtures/lineups/minutes.

**SofaScore-via-Playwright pattern (VERIFIED 2026-07-11 — Phase 0):** the simplest strategy that works is to
**navigate headless Chromium straight at the API URL** and read `document.body.innerText` → `JSON.parse`.
Cloudflare is passed automatically (we get real HTTP 200/404 JSON, never 403). Throttle ~700 ms between calls,
reuse one browser context. Code: `scrapers/sofascore/spike.js` (bypass proof) and `verify.js` (full pipeline).

**Verified endpoints (base `https://api.sofascore.com/api/v1`):**

| Purpose                        | Endpoint                                        | Returns                                               |
| ------------------------------ | ----------------------------------------------- | ----------------------------------------------------- |
| Name → SofaScore id            | `/search/all?q={name}&page=0`                   | `results[].entity {id, name, team}`                   |
| Player detail                  | `/player/{id}`                                  | name, team, position                                  |
| Recent matches                 | `/player/{id}/events/last/{page}`               | `events[]` (id, teams, timestamp, tournament, season) |
| **Per-match rating + minutes** | `/event/{eventId}/player/{playerId}/statistics` | `statistics {rating, minutesPlayed, goals, ...}`      |

`/search/all` means we can map players to SofaScore by **name search** rather than needing pre-known IDs — big
simplification for Phase 3. **Botola is covered by SofaScore** (Ziyech @ Wydad returned per-match ratings), so
the official-Botola-site fallback is likely unnecessary — keep it only as a contingency.

## 5. Architecture

```
lib/
  fetchWithHeaders.js   plain browser-UA HTTP GET (salvaged) — used by Transfermarkt
  parseHtml.js          cheerio wrapper (salvaged)
scrapers/
  transfermarkt/   axios/fetch + cheerio → discovery, positions, caps, citizenship, market value
  sofascore/       Playwright           → per-match ratings & minutes
                   verify.js            Phase 0 proof (bypass + full pipeline)
db/
  schema.sql       SQLite (better-sqlite3)
  index.js         connection, migrations, upsert helpers
rating/
  score.js         minutes-weight + shrinkage + league coeff; Best XI selection
etl/
  run.js           scrape → normalize → upsert (idempotent, re-runnable)
api/
  server.js        HTTP API over SQLite
web/
  astro            Astro frontend — "Best XI" + "Browse & rank" views
```

**Frontend: Astro.** Content-driven, mostly static views over the SQLite data — a good fit. Astro can read the
DB / API at build time (fast static pages) with islands for the interactive filters (league/position) in Browse.

### Draft schema

- `leagues` (id, name, country, tier, coefficient)
- `clubs` (id, name, league_id)
- `players` (id, name, birthplace, citizenships, positions, club_id, tm_id, sofascore_id, market_value,
  senior_A_caps, moroccan_eligible, eligibility_status[eligible|review|excluded])
- `overrides` (player_id, action[include|exclude], reason)
- `seasons` (id, label)
- `matches` (id, season_id, home_club_id, away_club_id, date, competition)
- `player_match_stats` (player_id, match_id, rating, minutes, goals, assists, ...)
- Derived (view or table): `player_scores` (player_id, season_id, wavg, minutes, shrunk, score)

## 6. Phased roadmap

- [x] **Phase 0 — Playwright spike. ✅ DONE (2026-07-11).** Proved Cloudflare bypass + full rating pipeline
      (search → player → matches → per-match rating/minutes), all HTTP 200. Endpoints documented in §4.
- [x] **Phase 1 — Schema + leagues seed. ✅ DONE.** `db/schema.sql` (leagues, clubs, players w/ eligibility_status,
      overrides, seasons, matches, player_match_stats, player_scores), `db/index.js` (connection + PRAGMAs + schema init),
      `db/leagues.js` + `db/seed.js` (16 divisions + coefficients + current season, idempotent). 15 passing tests.
      _Remaining for later: resolve SofaScore/Transfermarkt source IDs per league (deferred to when scrapers need them)._
- [ ] **Phase 2 — Transfermarkt discovery + eligibility.** Targeted Morocco-nationality lists → enrich profiles
      (caps split A vs youth, citizenship, position, market value); set `eligibility_status`
      (eligible / review / excluded); apply `overrides`.
- [x] **Phase 2 — Transfermarkt discovery + eligibility. ✅ DONE.** `parse.js` (profile/search parsers),
      `eligibility.js` (pure 3-state classifier), `client.js` (throttled `TransfermarktClient`),
      `discover.js` (paginate the Morocco most-valuable list, land_id=107, ~500 players incl. dual-nationals),
      `ingest.js` (upsert players + find-or-create clubs), `run.js` (`npm run tm:discover`, honors overrides).
      Verified live end-to-end into SQLite. 33 new tests (48 total).
- [x] **Phase 3 — SofaScore stats (Playwright). ✅ DONE.** `client.js` (Playwright `SofascoreClient`, reused context,
      throttled), `parse.js` (search/events/match-stats parsers), `match.js` (accent-aware name+club matcher),
      `ingest.js` (upsert matches + player_match_stats), `run.js` (`npm run sofa:stats`). Verified live: Bilal Nadir →
      24 stat rows (rating+minutes) into SQLite. 23 new tests (61 total). Matches store `sofascore_unique_tournament_id`;
      `league_id` mapping deferred (see Phase 4).
- [x] **Phase 4 — Rating engine. ✅ DONE.** All 16 SofaScore tournament ids verified + seeded into
      `leagues.sofascore_tournament_id`. `rating/score.js` (pure: minutes-weighted rating → Bayesian shrinkage →
      minutes-weighted league coefficient; Best XI via optimal max-weight assignment). `rating/run.js`
      (`npm run rate`): maps matches→leagues, computes `player_scores`, builds Best XI. **Cups excluded (league only).**
      Min-minutes gate 450. Verified live (Bilal Nadir 5.683). 19 new tests (72 total).
- [x] **Phase 5 — ETL orchestration. ✅ DONE.** `etl/run.js` (`npm run etl`): chains discover → stats → rate on one
      DB connection, idempotent, per-stage timing + summary, `STAGES`/`MAXPAGES`/`*_LIMIT` env bounds, injectable
      stages for tests. Verified live full-chain. 3 new tests (75 total).
- [x] **Phase 6 — Astro frontend. ✅ DONE.** `web/` Astro static site reading the SQLite DB at build time:
      `src/lib/queries.js` (injectable-db query layer, reuses `selectBestXI`), Best XI pitch (`index.astro`) +
      Browse & rank with client-side league/position filters (`browse.astro`), Morocco-themed light/dark layout.
      `npm run web:build` / `web:dev`. eslint-plugin-astro + prettier-plugin-astro wired in. 5 query tests (80 total).
      Verified: builds + renders real data. (SSR API endpoints can be added later if live data is needed.)

## 7. Immediate next step

Run **Phase 0**: add Playwright, write the SofaScore spike, confirm we can pull JSON. Everything depends on it.

## 8. Open decisions

- Best XI formation (default 4-3-3) and minimum-minutes gate (default 450) — confirm later, sensible defaults for now.
- Botola data source — confirm whether SofaScore covers it or we need the official site (Phase 1).
- Nothing committed to git yet; first commit after Phase 0 succeeds.

_Settled: league list (16 divisions), hand-set coefficients, Astro frontend, three-state eligibility,
targeted+overrides discovery, per-match league weighting._
