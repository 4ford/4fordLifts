# 4fordLifts

A personal workout log: record sets, see your PRs, and watch your estimated 1RM
climb. Runs entirely in the browser — no build step, no server, no dependencies.

**Live:** <https://lift-tracker-4ford.vercel.app>

## Colors

Bold athletic: hard black and chalk white, one solid accent, and big condensed
uppercase type ([Barlow Condensed](https://github.com/jpt/barlow), bundled in
`fonts/` under the SIL Open Font License so it works offline). There's no glow
anywhere; emphasis comes from size and solid fills.

Two accents, each with a fixed job. `--accent` is the lifting: primary action,
PR badges, lift charts. `--accent-2` is progression: level, XP, streak,
bodyweight. Everything else derives from those two with `color-mix`, so the
five themes in Settings (Blaze, Red, Cobalt, Gold, Chalk) are just a pair of hex
values each, defined at the top of `styles.css`.

## Features

- **Log** — pick a lift by muscle group or search, then log weight × reps with
  optional RPE and notes. Prefills your last numbers; rest timer starts itself.
  Lifts missing from the library can be added with a muscle group; they appear
  under that group and a **Mine** chip, and are managed in **You → Your lifts**.
  Each session's total is compared to something real ("about 2 pickup trucks").
- **Next-set suggestions** — pick a lift and it shows last session's sets plus
  two targets: beat your reps (a guaranteed rep PR) or add one weight jump
  (10 lbs / 5 kg for legs and deadlifts, 5 lbs / 2.5 kg otherwise). Tap one to
  fill the form. A lift that's stuck and sliding gets a 90% deload instead.
- **On this day** — the Log tab shows what you lifted around today's date in
  each earlier year (within 3 days), and how much each lift has improved since.
- **History** — every session grouped by date, with volume per lift
- **Progress** — per-exercise estimated 1RM chart, best-by-reps table, PR badges,
  and a plateau watch that flags lifts that have stopped setting new bests
- **You** — level and XP, lifetime tonnage compared to real things (golden
  retriever up to the Eiffel Tower) with a bar toward the next one, training
  streak, 16-week grid, and a bodyweight log with its own chart
- Works offline and installs to your phone's home screen (PWA)
- Export/import your data as JSON, export to CSV for spreadsheets

## How XP works

| Source | Rate |
|---|---|
| Volume | 1 XP per 50 lbs moved |
| Showing up | 25 XP per session |
| Beating a lift's previous best | 50 XP per PR |

Each level costs more than the last (`300 × (level − 1)^1.45`), and every level
carries a rank name from Untrained up to Legend.

## How plateaus are called

A session counts as progress if any set in it is one of these:

- **Weight PR**: the heaviest weight you've done on that lift, at any reps
- **Rep PR**: more reps at a weight than you've done at that weight or heavier.
  This only counts at a weight you've lifted before, so a first-time light
  warm-up can't count as a rep PR.
- **New best estimated 1RM**: the same test as the PR badge, so a lift wearing
  a badge is never shown as stuck

| Status | Rule |
|---|---|
| Progressing | A PR within the last 2 sessions, or not enough time has passed |
| Stalling | 3+ sessions **and** 2+ weeks without a PR |
| Plateau | 5+ sessions **and** 4+ weeks without a PR |
| Resting | Not trained in 6+ weeks, so it isn't counted |
| Too early | Fewer than 4 sessions logged |

A lift needs both the session count and the time span, so a few sessions
crammed into one week, or one session a month, can't trigger it alone. The tip
under a stuck lift depends on the numbers. If your recent sessions are more than
5% under your best, it points at fatigue and suggests a deload. Otherwise it
suggests a program change. The thresholds live at the top of the plateau
section in `data.js`.

## Running it locally

Open `index.html` in a browser — that's it.

Service workers need a real server, so to test offline support use any static
server, for example:

```bash
python -m http.server 8000
```

Then visit <http://localhost:8000>.

## Deploying

Push to GitHub, then connect the repo to a static host. All of these are free
for a project this size and redeploy automatically on every push:

- **Vercel** — vercel.com, "Add New Project", pick the repo, deploy
- **Netlify** — netlify.com, "Add new site" → "Import an existing project"
- **GitHub Pages** — repo Settings → Pages → Source: `main` branch, `/root`

No framework is configured, so leave build settings empty and the output
directory as the repository root.

## Using it on your phone

1. Open the deployed URL in Safari (iOS) or Chrome (Android)
2. Share / menu → **Add to Home Screen**
3. It launches full-screen with its own icon

## Where your data lives

In `localStorage`, in the browser you're using — it never leaves your device.
That also means it is **per-browser**: your phone and your laptop keep separate
logs, and clearing site data erases it.

Use **Data → Export backup** regularly. To sync across devices, the usual next
step is a hosted database such as [Supabase](https://supabase.com) — the storage
layer in `app.js` (`load`, `save`) is the only part that would need to change.

## Files

| File | Purpose |
|---|---|
| `index.html` | Markup and view structure |
| `styles.css` | All styling; the palette lives in `:root` |
| `data.js` | Storage, exercise library, and the XP/streak/tonnage math |
| `app.js` | Rendering and interaction for each view |
| `chart.js` | Standalone SVG line chart with hover tooltips |
| `sw.js` | Service worker — offline caching |
| `manifest.webmanifest` | PWA metadata for home-screen install |
| `fonts/` | Barlow Condensed, the display face, plus its license |
| `PYTHON-PROJECTS.md` | Three Python projects to build on this after CS50P |
| `BACKEND.md` | Build plan for the sync backend (the third of those projects) |

## Estimated 1RM

Uses the Epley formula:

```
1RM ≈ weight × (1 + reps / 30)
```

It's an estimate, and it gets less accurate above about 10 reps — useful for
tracking a trend, not for picking your next max attempt.
