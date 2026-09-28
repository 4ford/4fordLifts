# 4fordLifts

Matt's personal workout tracker. Vanilla HTML/CSS/JS PWA — no build step, no
framework, no dependencies. Keep it that way; don't introduce npm, bundlers, or
libraries without asking.

- Repo: github.com/4ford/4fordLifts (**public** — never commit secrets)
- Live: https://lift-tracker-4ford.vercel.app — **pushing to `main` deploys**,
  so confirm before pushing
- The folder is still named `lift-tracker` from before the rename to 4fordLifts

## Code layout

`README.md` has the file table and feature list. The split that matters:

- `data.js` — `window.LiftData`: storage, exercise library, and all derived
  math (e1RM, streaks, XP, plateaus). Pure functions over `state.sets`.
- `app.js` — rendering and interaction only. Reads numbers from `LiftData`.
- `load`/`save` in `data.js` are the only code touching storage — the seam for
  the future sync backend.

Style: ES5 in an IIFE with `'use strict'` (`var`, `function`, no arrow
functions or modules). Section banners like `/* ── Name ──── */`. Comments
explain *why*, sparingly.

## Rules that aren't obvious from the code

- **Dates** are local `YYYY-MM-DD` strings. Parse with `LiftData.isoToMs`,
  never `new Date('2026-09-23')` — that's UTC and lands a day early.
- **Storage schema** is versioned (`v: 3`, key `lift-tracker/v1`). Any new
  field needs a default in `load()` *and* in the import and clear-all paths in
  `app.js`, so older saved data and backups still load.
- **PRs** everywhere (badge, XP, toast) mean a new best Epley e1RM. The plateau
  tracker is broader: a weight PR, a rep PR (only at a weight lifted before, so
  warm-ups don't count), or an e1RM PR all reset it. Thresholds are constants
  at the top of the plateau section in `data.js`; the README table documents
  them — keep the two in sync.
- **Service worker** (`sw.js`) is network-first. Bump `CACHE` only when the
  file list in `SHELL` changes.

## Design constraints (from Matt)

Neon, but **not** the "classic vibecoded look": no purple gradient washes, no
glassmorphism cards. Flat surfaces, 1px borders, heavy numerals.

- Two accents with fixed jobs: `--accent` = lifting (primary action, PRs, lift
  charts); `--accent-2` = progression (level, XP, streak, bodyweight). Don't use
  them decoratively.
- **Glow is reserved for PRs and the XP bar.** Warnings (e.g. plateau) get no
  glow.
- Derive new colors from the tokens with `color-mix` so all five themes work.

## Backend

A sync backend (FastAPI + PostgreSQL, raw SQL, no ORM) is planned in
`BACKEND.md`, deferred until after CS50P. **Matt is writing it himself to
learn Python** — explain and guide, don't write it for him unless asked. He
turned down managed options like Supabase for that reason.

## Testing on this machine

Node is not installed. To check behavior:

1. Serve the folder: `python -m http.server 5173`
2. Drive it with headless Edge (`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`):
   `--headless=new --dump-dom <url>` for text, `--screenshot=<file> --window-size=420,760`
   for a phone-width view. Use a throwaway `--user-data-dir`.

To test with sample data, put a test page on the same origin that seeds
`localStorage` and loads `index.html` in an iframe. Keep test pages outside the
repo, e.g. in a copied folder.
