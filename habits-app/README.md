# Arrow Habits — Daily System Tracker

A standalone, points-based daily habit tracker. Separate app from BidLens; it only shares this
repository. Deployed as its own Netlify site from the `habits-app/` base directory.

Check off the daily system — 30 pushups, 45-min zone 2 walk, shoulder / mobility / core work,
Turkish get-ups, fast until 1pm, no sugar, creatine + vitamin stack, meditation / box breathing —
earn points toward an editable daily goal (default 18 of 24), and keep the streak.

## Screens

- **Today:** tappable checklist with per-habit points, score vs. goal, current/best streak, and a
  yesterday recap.
- **Trends:** streak stat tiles, a 14-day consistency bar chart with the goal line, a 12-week
  heatmap, and per-habit completion rates over 30 days.
- **Manage:** rename habits, retune point values (history rescoring is automatic), reorder,
  archive/restore, add habits, set the daily goal, and export/import a JSON backup.

## Design

- **Deterministic math:** all scoring, streak, and trend calculations are pure, unit-tested
  TypeScript (`src/lib/habits/scoring.ts`). Points are always recomputed from current habit values,
  so retuning a habit rescores history.
- **Local-first:** data lives in IndexedDB (Dexie) in your browser; the daily goal in localStorage.
  No accounts, no backend — the static export works offline once the service worker caches it.
- **Deliberately manual check-off:** nothing auto-completes; logging the win is part of the loop.

## Commands

```bash
npm install
npm run dev          # http://localhost:3000
npm run test         # Vitest unit tests (scoring, streaks, trends)
npm run build        # static export to out/
npm run typecheck    # tsc --noEmit
npm run generate-assets  # regenerate PWA icons (uses root repo's Playwright)
```
