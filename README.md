# THE SYSTEM — Workout Tracker

A mobile-first, installable workout tracker built around missions, XP, levels, ranks, stats, streaks, PRs, achievements, and progressive overload.

## Features

- 7-day mission structure
- Exercise set/reps/weight tracking
- XP + leveling
- E → D → C → B → A → S rank progression
- STR / END / AGI / VIT stats
- Personal records
- Workout history
- Streak tracking
- Achievements
- Progressive overload suggestions
- Theme selection
- Local persistence
- Import/export backup
- PWA install support
- Offline shell via service worker

## Run locally

Because the app registers a service worker, run it from a local web server rather than opening `index.html` directly.

### Python

```bash
python -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

### Node

```bash
npx serve .
```

## Deployment

This is a static app and can be deployed to GitHub Pages, Netlify, Vercel, Cloudflare Pages, or any static web host.

## Data

Workout data is stored in the browser with `localStorage`. Use **Export Data** in Settings to create a JSON backup.
