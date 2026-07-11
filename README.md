# Atlas XI

A scouting platform for the **Morocco national team** — surface players who are _eligible but not yet
cap-tied_ (Moroccan by nationality or descent, with **zero senior "A"-team caps**), and rank them with a
**fair rating** that fixes SofaScore's blind spots: minutes-weighted, sample-size-shrunk, and adjusted for
league strength.

## Features

- **Best XI** — an auto-picked squad of eligible players, filled by position into a formation.
- **Browse & rank** — all eligible players, filterable by league and position.

## How the fair rating works

A flashy 8.0 off the bench over 10 minutes shouldn't outrank a solid 7.0 over 90. We weight each match rating
by minutes played, shrink small samples toward a baseline, then multiply by a league-strength coefficient.
See [PLAN.md](PLAN.md) for the full formula, data sources, league list, and roadmap.

## Data sources

- **Transfermarkt** — discovery & eligibility (nationality, position, caps, market value).
- **SofaScore** (via Playwright, to pass Cloudflare) — per-match ratings & minutes.

## Status

**Phase 0 complete** — SofaScore data access proven end-to-end via Playwright. Next: the database schema.

```bash
npm install
npx playwright install chromium
npm run verify:sofascore   # proves the SofaScore rating pipeline
```
