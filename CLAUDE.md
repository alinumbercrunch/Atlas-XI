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
- `scrapers/transfermarkt/` — axios/fetch + cheerio (discovery, eligibility) _(Phase 2)_
- `scrapers/sofascore/` — **Playwright** (per-match ratings & minutes); `verify.js` is the working proof
- `db/` — SQLite via `better-sqlite3` _(Phase 1)_ · `rating/` _(Phase 4)_ · `etl/` _(Phase 5)_ · `web/` Astro _(Phase 6)_
- SQLite data is regenerable by the scrapers → **git-ignored** (`*.sqlite`, `data/`).

## Commands

```bash
npm install && npx playwright install chromium   # first-time setup
npm run verify:sofascore                          # proves the SofaScore pipeline
npm run lint        # ESLint      (npm run lint:fix to autofix)
npm run format      # Prettier    (npm run format:check to verify)
```

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

## Status

Phase 0 (SofaScore access) ✅ done. **Next: Phase 1** — write `db/schema.sql` + seed the `leagues` table
(17 divisions + coefficients from PLAN.md §3).
