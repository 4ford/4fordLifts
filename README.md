# Lift Tracker

A personal workout log: record sets, see your PRs, and watch your estimated 1RM
climb. Runs entirely in the browser — no build step, no server, no dependencies.

## Features

- Log sets (exercise, weight, reps, optional RPE and notes) with a rest timer
- History grouped by session, with per-session volume
- Per-exercise progress: estimated 1RM chart, best-by-reps table, PR badges
- Works offline and installs to your phone's home screen (PWA)
- Export/import your data as JSON, export to CSV for spreadsheets

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
| `app.js` | State, storage, and rendering for each view |
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
