# CLAUDE.md — Atlas XI

Operating notes for Claude Code in this repo. **Full product design & roadmap lives in [PLAN.md](PLAN.md)** —
read it for the _what/why_; this file is the _how_. Keep the two non-overlapping.

## One-liner

Scouting platform for the Morocco national team: surface players **eligible but not yet cap-tied**
(Moroccan by nationality/descent, **0 senior "A"-team caps**) and rank them with a fair,
minutes-weighted, league-adjusted rating. Two views: **Best XI** and **Browse & rank**.

## Stack & layout

- **Node.js, CommonJS** (`require` / `module.exports`) — not ESM yet. Config files are `.mjs`.
- `lib/` — shared HTTP + HTML helpers (`fetchWithHeaders.js`, `parseHtml.js`)
- `scrapers/transfermarkt/` — fetch + cheerio. `parse.js` (profile/search parsers), `eligibility.js` (pure 3-state
  classifier), `client.js` (throttled `TransfermarktClient`, injectable `fetchImpl`), `discover.js` (paginate Morocco
  most-valuable list, land_id=107), `ingest.js` (upsert players + clubs), `run.js` (orchestrator, `npm run tm:discover`),
  `__fixtures__/` (real saved TM pages).
- `scrapers/sofascore/` — **Playwright**. `client.js` (`SofascoreClient`), `parse.js` (search/events/stats),
  `match.js` (accent-aware name+club matcher), `ingest.js` (matches + player_match_stats), `run.js`
  (`npm run sofa:stats`), `verify.js` (Phase 0 proof), `__fixtures__/` (saved JSON)
- `db/` — SQLite via `better-sqlite3`: `schema.sql`, `index.js` (`getDb`/`initSchema`, in-memory via `:memory:`),
  `leagues.js` (16-division data), `seed.js` (idempotent). `rating/` _(Phase 4)_ · `etl/` _(Phase 5)_ · `web/` Astro _(Phase 6)_
- SQLite data is regenerable by the scrapers → **git-ignored** (`*.sqlite`, `data/`).

## Commands

```bash
npm install && npx playwright install chromium   # first-time setup
npm run verify:sofascore                          # proves the SofaScore pipeline
npm run db:seed                                   # create+seed SQLite (leagues + current season)
npm test            # Vitest      (test:watch, test:coverage)
npm run lint        # ESLint      (npm run lint:fix to autofix)
npm run format      # Prettier    (npm run format:check to verify)
```

## Engineering standards (apply to EVERY feature)

1. **Clean, efficient syntax** — readable, idiomatic, no cleverness for its own sake. Match the surrounding style.
2. **No redundancy / duplication** — reuse `lib/` helpers and existing code; extract shared logic instead of copy-pasting.
3. **Safeguards & edge cases** — scrapers hit messy/inconsistent HTML & JSON. Validate inputs; handle missing/malformed
   fields, empty results, network failures, timeouts, and rate limits. Fail loudly with useful messages, never silently.
4. **Iterate to confirm** — actually run the code/tests and observe real behavior before calling it done. Don't assume.
5. **Test every feature** — **Vitest**. Unit-test pure logic (e.g. the rating engine) with real numbers; test parsers
   against **saved fixtures** (`__fixtures__/`), not live network. Keep unit tests fast and deterministic.

## Critical gotchas

- **SofaScore is Cloudflare-protected** — plain `fetch`/axios returns **403**. The only working access is
  **Playwright**: navigate headless Chromium _straight at the API URL_ and `JSON.parse(document.body.innerText)`.
  Verified endpoints + the pattern are in `scrapers/sofascore/verify.js` and PLAN.md §4.
  Map players by **name** via `/search/all?q=` (no pre-known IDs needed).
- **Transfermarkt works with plain fetch** — use `lib/fetchWithHeaders.js` + `lib/parseHtml.js`, not Playwright.
- Be polite to SofaScore: **throttle ~700 ms** between calls, **reuse one browser context**.
- SofaScore covers the Botola, so the official-Botola-site fallback is likely unnecessary (contingency only).

## Conventions

- Code must pass **ESLint + Prettier** (double quotes, semicolons, trailing commas, 100-col). A **Husky
  pre-commit** runs lint-staged, so keep committed code clean or the hook will reformat/block it.
- **Never commit** `node_modules/` or `*.sqlite` (already git-ignored — keep it that way).
- Commit trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **Astro tooling** (`eslint-plugin-astro`, `prettier-plugin-astro`) is intentionally deferred to Phase 6 —
  don't add it before the frontend exists (marker in `eslint.config.mjs`).

## Maintenance

**After each feature, update this file if anything changed** — new commands, conventions, gotchas, or the
Status line below. Keep it current so it stays trustworthy; don't let it drift from reality.

## Status

Phases 0–3 ✅: SofaScore access · schema + 16-league seed · TM discovery+eligibility · SofaScore stats (all live
end-to-end into SQLite). 61 tests. Tooling: ESLint, Prettier, Husky, Vitest.
**Populate order:** `npm run tm:discover` (players) → `npm run sofa:stats` (per-match rating+minutes).
**Next: Phase 4 — rating engine.** First map `matches.sofascore_unique_tournament_id` → `league_id` (fill
`leagues.sofascore_tournament_id`; Botola uniqueTournament=937; decide cup handling). Then the fair score
(minutes-weight → shrinkage → per-match coefficient, skip null ratings) + Best XI → `player_scores`.
Facts: TM Morocco list = land_id=107; SofaScore stats fields = rating/minutesPlayed/goals/goalAssist; season "25/26".
