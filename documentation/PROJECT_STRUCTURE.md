# Project Structure

```
dietea/
├── index.html              # All markup: tabs, panels, and every modal
├── main.css                # All styles
├── main.js                 # Entry point: bootstrap, wiring, onboarding
├── ingredients.json        # Ingredient database (source of truth)
├── menu.json               # Meal database (source of truth)
├── package.json            # Dev server script only; no runtime dependencies
├── js/
│   ├── core/
│   │   ├── dataStore.js    # In-memory store + shopping list aggregation
│   │   ├── models.js       # FoodItem, FoodItemEntry, CookingInstruction, Meal
│   │   ├── dataLoader.js   # Fetches the bundled ingredients.json / menu.json
│   │   └── mealSerde.js    # Meal hydrate/serialize
│   ├── services/
│   │   ├── fileSystem.js   # File System Access API handles and read/write
│   │   ├── state.js        # App state + localStorage persistence
│   │   ├── calories.js     # BMR/TDEE/goal math
│   │   └── storage.js      # Save routing for ingredients, meals, schedule
│   ├── utils/
│   │   ├── helpers.js      # Formatting, slugify, day names, slot times
│   │   └── feedback.js     # Toasts and form validation
│   └── components/
│       ├── navigation.js     # Tab switching, meal detail show/hide
│       ├── shopping.js       # Shopping list
│       ├── schedule.js       # Schedule list + calendar views
│       ├── scheduleEditor.js # Schedule editor modal, auto-generator, overview
│       ├── menu.js           # Meal cards, search, import
│       ├── mealDetail.js     # Single meal recipe view
│       ├── mealCreation.js   # Create/edit meal modals
│       ├── ingredients.js    # Ingredient list and CRUD
│       ├── supplements.js    # Supplement + water tracker
│       ├── profile.js        # Profile card, macro wheel, edit modal
│       └── settings.js       # Settings panel wiring
└── documentation/
    ├── README.md
    ├── PROJECT_STRUCTURE.md
    ├── MODULE_GUIDE.md
    └── REFACTORING.md
```

## Layering

Imports run in one direction — `components` → `services`/`utils` → `core`. Nothing in
`core` imports a component, and no module touches `window.*` to reach another.

### `js/core/`

Data and data shapes, with no DOM access.

- `dataStore.js` — the single in-memory store (`ingredients`, `meals`, `schedule`) plus
  its setters and `aggregateShoppingList()`, which folds the schedule into per-category
  ingredient totals.
- `models.js` — the four classes. Macro totals are computed getters, never stored fields.
- `dataLoader.js` — `fetch()`es the bundled JSON on startup.
- `mealSerde.js` — converts between plain JSON meals and `Meal` instances.

### `js/services/`

Cross-cutting behavior, mostly without DOM access.

- `fileSystem.js` — owns the two file handles and wraps the File System Access API.
- `state.js` — the `state` object (onboarding flag, start day, shopping checkmarks,
  profile) and its `localStorage` round-trip.
- `calories.js` — Mifflin-St Jeor BMR, TDEE, and goal-adjusted target calories.
- `storage.js` — decides where each dataset is written: ingredients and meals to their
  JSON files, schedule to `localStorage`.

### `js/utils/`

- `helpers.js` — `titleCase`, `fmt`, `slugify`, `defaultTimeForSlot`, `DAY_NAMES`.
- `feedback.js` — `showToast`, `showFieldError`, `clearValidationErrors`.

### `js/components/`

UI. Each module renders into elements that already exist in `index.html` and attaches its
own listeners; there is no templating layer and no virtual DOM. Components read from
`dataStore` and `state` directly rather than receiving props.

## Startup sequence

`main.js` runs on `DOMContentLoaded`:

1. `bootstrapData()` — fetch `ingredients.json`, fetch and hydrate `menu.json`, read the
   schedule from `localStorage`. Each step falls back to an empty array on failure.
2. `loadState()` — restore state from `localStorage`, merged over defaults.
3. `showApp()` or `showOnboarding()`, depending on `state.onboarded`.
4. `setupEventListeners()` — wire every component once.

Ingredients are loaded before meals on purpose: `hydrateMeal` resolves each `itemId`
against the already-loaded ingredient list.

## How a change propagates

There is no reactivity. A mutation updates `dataStore`, persists, then calls the render
functions affected. `main.js` owns those fan-out callbacks — `onIngredientsChanged`,
`onMealsChanged`, `onScheduleChanged` — and passes them into the components that can
trigger each kind of change.

Writes to ingredients and meals are optimistic and reversible: the component swaps in the
new array, awaits the save, and restores the previous array if the save returns `false`
(which is what happens when the file is not connected).
