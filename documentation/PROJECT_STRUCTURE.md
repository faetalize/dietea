# Project Structure

```
dietea/
├── index.html              # All markup: auth screen, tabs, panels, every modal
├── main.css                # All styles
├── main.js                 # Entry point: auth gate, bootstrap, wiring, onboarding
├── ingredients.json        # Starter ingredients, seeded into new accounts only
├── menu.json               # Starter meals, seeded into new accounts only
├── package.json            # Dev server + vendoring scripts
├── js/
│   ├── config.js           # Supabase URL, publishable key, schema name
│   ├── core/
│   │   ├── dataStore.js    # In-memory store + shopping list aggregation
│   │   ├── models.js       # FoodItem, FoodItemEntry, CookingInstruction, Meal
│   │   ├── dataLoader.js   # Reads from Supabase; seeds new accounts
│   │   └── mealSerde.js    # Meal hydrate/serialize
│   ├── services/
│   │   ├── supabase.js     # Client construction + error translation
│   │   ├── auth.js         # Sign in/up/out, session, current user
│   │   ├── state.js        # Profile + preferences, debounced to Postgres
│   │   ├── calories.js     # BMR/TDEE/goal math
│   │   └── storage.js      # Writes for ingredients, meals, schedule
│   ├── utils/
│   │   ├── helpers.js      # Formatting, slugify, day names, slot times
│   │   └── feedback.js     # Toasts and form validation
│   ├── vendor/
│   │   └── supabase.js     # Vendored supabase-js bundle (generated, committed)
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
├── scripts/
│   └── supabase-entry.js   # Bundle entry point for npm run vendor:supabase
├── supabase/
│   └── migrations/         # Schema history, mirrors the remote migration table
└── documentation/
    ├── README.md
    ├── PROJECT_STRUCTURE.md
    ├── MODULE_GUIDE.md
    └── REFACTORING.md
```

## Layering

Imports run in one direction — `components` → `services`/`utils` → `core`. Nothing in
`core` imports a component, and no module touches `window.*` to reach another.

`core/dataLoader.js` is the one deliberate exception: it imports from `services/` because
reading data now requires the Supabase client and the current user id.

### `js/core/`

Data and data shapes, with no DOM access.

- `dataStore.js` — the single in-memory store (`ingredients`, `meals`, `schedule`) plus
  its setters and `aggregateShoppingList()`.
- `models.js` — the four classes. Macro totals are computed getters, never stored fields.
- `dataLoader.js` — reads each collection from Supabase, and seeds a brand new account
  from the bundled starter JSON.
- `mealSerde.js` — converts between stored JSON meals and `Meal` instances.

### `js/services/`

- `supabase.js` — builds the client against the `dietea` schema and translates PostgREST
  errors into messages worth showing a human.
- `auth.js` — owns the current user. Everything that writes calls `requireUserId()`.
- `state.js` — the `state` object and its debounced round-trip to `dietea.profiles`.
- `calories.js` — Mifflin-St Jeor BMR, TDEE, and goal-adjusted target calories.
- `storage.js` — persists ingredients, meals, and the schedule.

### `js/components/`

UI. Each module renders into elements that already exist in `index.html` and attaches its
own listeners. Components read from `dataStore` and `state` directly rather than
receiving props.

## Startup sequence

`main.js` runs on `DOMContentLoaded`:

1. `setupAuthScreenListeners()` — wire the sign-in form.
2. `initAuth()` — read any persisted session.
3. If signed out, show the auth screen and stop. If signed in, `startSession()`.
4. `startSession()` → `bootstrapData()` → `loadState()` → wire app listeners **once** →
   `showApp()` or `showOnboarding()`.

`bootstrapData()` seeds the account if it is empty, then loads ingredients, meals, the
schedule, and today's supplement row. Ingredients are loaded before meals on purpose:
`hydrateMeal` resolves each `itemId` against the already-loaded ingredient list.

App listeners are guarded by an `appListenersReady` flag so that signing out and back in
does not stack duplicate handlers.

## How a change propagates

There is no reactivity. A mutation updates `dataStore`, persists to Supabase, then calls
the render functions affected. `main.js` owns those fan-out callbacks —
`onIngredientsChanged`, `onMealsChanged`, `onScheduleChanged`, `onSupplementsChanged` —
and passes them into the components that can trigger each kind of change.

Writes to ingredients and meals are optimistic and reversible: the component swaps in the
new array, awaits the save, and restores the previous array if the save returns `false`.
The save functions toast the reason themselves, so callers only have to roll back.
