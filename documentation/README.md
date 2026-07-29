# Meal Prep Planner Documentation

- Architecture and file layout: [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)
- Module-by-module reference: [MODULE_GUIDE.md](MODULE_GUIDE.md)
- How the current structure came about: [REFACTORING.md](REFACTORING.md)

## App overview

A single-page vanilla JavaScript webapp for meal prep planning. No build step, no
framework, no runtime dependencies — `index.html` loads `main.js` as an ES module and
everything else is imported from `js/`.

The app has five tabs plus a settings panel:

| Tab | What it does |
| --- | --- |
| Shopping | Ingredient totals aggregated from the current schedule, with checkable rows |
| Schedule | The planned week as a list or a calendar, plus the schedule editor and weekly calorie/macro overview |
| Menu | Meal cards; create, edit, delete, import, and drill into a meal's recipe |
| Ingredients | The ingredient database; create, edit, delete, import |
| Supplements | Daily supplement adherence and water tracking, reset each day |
| Settings (gear) | Start day, file connections, and destructive data actions |

## Getting started

1. Start a local server — the app cannot run from `file://`:

   ```bash
   npm run dev
   ```

2. Open <http://localhost:3000> in Chrome or Edge.
3. Complete onboarding (age, sex, weight, height, activity level, goal weight, goal
   timeframe). This produces your maintenance and target calories.
4. Open Settings and connect `ingredients.json` and `menu.json`. **Do this before
   editing anything** — see below.

### Why you have to connect the files

On load, the app reads `./ingredients.json` and `./menu.json` over HTTP. That is enough
to browse, schedule, and shop, but a `fetch()` cannot write back.

Saving goes through the File System Access API instead, which needs an explicit file
handle that only the user can grant. Until you connect a file in Settings, every write to
that dataset is refused: the app rolls the change back in memory and shows a toast such
as *"Connect menu.json in Settings before saving meals."*

Settings has a **Quick Setup** button that walks you through connecting both files in one
go, or you can connect each individually.

Two consequences worth knowing:

- **Handles are not persisted.** They live in module-level variables in
  `js/services/fileSystem.js` and are gone on reload, so you reconnect once per session.
- **Chrome or Edge only.** Firefox and Safari do not implement the File System Access
  API. There the app is read-only for ingredients and meals; Settings detects this and
  disables the connect buttons. Scheduling, shopping, profile, and supplements still work,
  because those persist to `localStorage`.

## Where data lives

| Data | Stored in | Written by |
| --- | --- | --- |
| Ingredients | `ingredients.json`, via File System Access API | `saveIngredients()` |
| Meals | `menu.json`, via File System Access API | `saveMeals()` |
| Schedule | `localStorage` key `mealPrepSchedule` | `saveSchedule()` |
| Profile, start day, shopping checkmarks | `localStorage` key `mealPrepState` | `saveState()` |
| Today's supplement and water tracking | `localStorage` key `mealPrepSupplementsState` | `js/components/supplements.js` |

Settings → *Delete all data* clears `mealPrepState` and `mealPrepSchedule`, drops the
file handles, and reloads the bundled JSON. It does not clear the supplements key.

## Data formats

`ingredients.json` is a flat array. All macro values are **per unit**, so a `kcal` of
`0.59` with a unit of `g` means 0.59 kcal per gram:

```json
{
  "id": "greek-yogurt",
  "name": "Plain Greek yogurt (low-lactose)",
  "category": "Dairy",
  "unit": "g",
  "kcal": 0.59,
  "carb_per_unit": 0.04,
  "protein_per_unit": 0.1,
  "lipid_per_unit": 0.007
}
```

`menu.json` is a flat array of meals. Ingredients are referenced by `itemId`, with
`itemName` and `itemUnit` denormalized as a fallback for when the id no longer resolves:

```json
{
  "id": "overnight-oats-berries",
  "name": "Overnight Oats & Berries",
  "type": "Breakfast",
  "ingredients": [
    { "itemId": "rolled-oats", "itemName": "Rolled oats", "itemUnit": "g", "quantity": 60 }
  ],
  "instructions": [
    { "name": "Prep", "steps": ["Mix oats, yogurt, chia, and honey in a container."] }
  ]
}
```

`type` is one of `Breakfast`, `Lunch`, `Snack`, or `Dinner`. A meal whose `itemId` is
missing from `ingredients.json` still renders, but with zeroed macros — see `hydrateMeal`
in [MODULE_GUIDE.md](MODULE_GUIDE.md).

## Development

```bash
npm run dev
```

Serves the repo root on port 3000 with live reload. The script tries to exclude
`ingredients.json` and `menu.json` from the reload watcher, so that the app writing to
them does not reload the page out from under you.

Note that the exclusion does not currently take effect on Windows: `npm` runs scripts
through `cmd.exe`, which does not strip the single quotes around `--ignorePattern`, so
live-server receives the quotes as part of the regex and the pattern never matches. Until
that is fixed, expect a reload after each save on Windows.
