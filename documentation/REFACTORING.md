# Architecture History

Historical note, newest first. Records why the app is shaped the way it is, so old
decisions are not mistaken for current ones.

## Supabase

Data moved from the browser to Postgres so a plan made on a laptop is visible on a phone.

- All tables live in a dedicated `dietea` schema, not `public`, and every one is scoped
  per user by row level security.
- Auth is Supabase email/password. `main.js` gates the whole app behind a session.
- `js/services/fileSystem.js` was **deleted**. The File System Access API existed because
  there was no server; once there was one it was pure cost — a Chrome-only dependency and
  a whole "connect your files in Settings before you can save" flow that could be removed
  outright rather than carried alongside the new backend.
- `localStorage` is no longer used for app data at all. Only the Supabase session remains
  there, managed by `supabase-js`.
- `ingredients.json` and `menu.json` survive as **starter data**, seeded into a new
  account on first sign-in. They are no longer the database.
- `supabase-js` is vendored into `js/vendor/` by esbuild rather than loaded from a CDN, so
  the app keeps its no-build-step, no-runtime-dependency character and deploys to any
  static host as-is.

The port was cheap because `js/services/storage.js` already isolated persistence — every
component called `saveIngredients()` / `saveMeals()` / `saveSchedule()` and knew nothing
about where the data went. Those signatures are unchanged; only their bodies are new.

### What was deliberately not done

- **Meal ingredients stayed JSONB** rather than becoming a junction table. A foreign key
  to `ingredients` would forbid a meal that references a deleted ingredient, but that
  case is load-bearing: entries keep a denormalized `itemName`/`itemUnit` precisely so a
  meal still renders when its `itemId` no longer resolves.
- **No offline cache.** The old localStorage layer would have made a reasonable
  write-through cache for using the shopping list in a shop with bad signal. Out of scope
  for the port; the seam for it is `storage.js`.
- **Whole-collection saves.** `saveIngredients()` still takes the entire array and diffs
  it, rather than becoming granular per-row operations. That kept every call site and the
  rollback pattern unchanged, at the cost of a few extra round trips.

## Modular refactor

Before Supabase, the app was pulled apart from a single large script into ES modules.

- `main.js` became a thin entry point; rendering moved to `js/components/`, data to
  `js/core/`, cross-cutting behavior to `js/services/`.
- `main.legacy.js`, the temporary bridge that re-exported functions onto `window`, was
  deleted. No `window.*` delegation remains.

### Rules that came out of it, still in force

- Imports flow one way: `components` → `services`/`utils` → `core`. `core/dataLoader.js`
  is the one exception, since reading data now needs the client and the current user.
- Components read `dataStore` and `state` directly rather than receiving props.
- Cross-feature updates go through the `on*Changed` callbacks that `main.js` passes into
  each component, not through direct calls between components.
- Native ES modules throughout, so relative import paths must include the `.js` extension.

For the current structure, see [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) and
[MODULE_GUIDE.md](MODULE_GUIDE.md).
