# Dietea — Meal Prep Planner

A single-page vanilla-JS webapp for planning a week of meals: keep a menu of recipes,
schedule them across the week against a calorie and macro target, and generate the
shopping list that falls out of that schedule.

Data lives in Supabase, scoped per user, so your plan and profile follow you to any
device. The frontend is static — no build step, no server — and deploys as-is to
Cloudflare Pages or any static host.

## Run it

```bash
npm run dev
```

Then open <http://localhost:3000>.

The app has to be served over HTTP. Opening `index.html` straight from disk (`file://`)
does not work: `main.js` is loaded as an ES module, which browsers block on a `file://`
origin.

## Setup

The Supabase project is already configured in [js/config.js](js/config.js), and the
schema is applied. One project setting is required before the app can read anything:

> **Supabase dashboard → Project Settings → API → Exposed schemas → add `dietea`.**

Without it every request fails with `PGRST106`, and the app will say so. See
[documentation/README.md](documentation/README.md) for the details.

## Docs

- [Overview and getting started](documentation/README.md)
- [Project structure](documentation/PROJECT_STRUCTURE.md)
- [Module reference](documentation/MODULE_GUIDE.md)
- [Architecture history](documentation/REFACTORING.md)
