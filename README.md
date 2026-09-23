# 4fordLifts

A personal workout log: record sets, see your PRs, and watch your estimated 1RM
climb. Runs entirely in the browser — no build step, no server, no dependencies.

**Live:** <https://lift-tracker-4ford.vercel.app>

## Colors

Two accents, each with a fixed job — `--accent` is the lifting (primary action,
PR badges, lift charts), `--accent-2` is progression (level, XP, streak,
bodyweight). Everything else derives from those two with `color-mix`, so the
five themes in Settings are just a pair of hex values each, defined at the top
of `styles.css`.

## Features

- **Log** — pick a lift by muscle group or search, then log weight × reps with
  optional RPE and notes. Prefills your last numbers; rest timer starts itself.
- **History** — every session grouped by date, with volume per lift
- **Progress** — per-exercise estimated 1RM chart, best-by-reps table, PR badges
- **You** — level and XP, lifetime tonnage, training streak, 16-week grid,
  and a bodyweight log with its own chart
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

## Estimated 1RM

Uses the Epley formula:

```
1RM ≈ weight × (1 + reps / 30)
```

It's an estimate, and it gets less accurate above about 10 reps — useful for
tracking a trend, not for picking your next max attempt.
