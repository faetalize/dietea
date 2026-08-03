# Architecture History

Historical note, newest first. Records why the app is shaped the way it is, so old
decisions are not mistaken for current ones.

## The assistant

An OpenAI agent with write access to every domain, gated by a proposal the user approves.

- **Plain `fetch`, no SDK.** Both endpoints accept the SDK's headers, so this was not a
  compatibility workaround — vendoring another esbuild bundle would have cost the app its
  no-build-step character for a few dozen lines of saved code.
- **One write tool, not five.** The docs advise combining functions that are always called
  sequentially, and importing a recipe is always ingredients-then-meal-then-schedule. Split
  across tools it becomes three approvals where each only makes sense if the last was
  accepted; combined it is one decision applied in dependency order.
- **`store: false` with encrypted reasoning items**, rather than `previous_response_id`.
  The convenient option would have OpenAI retain a thread containing body weight,
  composition and eating habits.
- **The prompt is short on purpose.** GPT-5.6's guidance inverted the GPT-5 advice:
  scripted preambles, process checklists and worked examples measurably hurt. What remains
  is goal, boundaries and a completion check. The visible narration moved into the UI's
  step list instead.
- **Credentials encrypted client-side** under the account password. This protects the
  database at rest, not the running page — an honest but real distinction, and the reason
  the vault unlocks per browser session rather than being cached indefinitely.
- **Codex turned out to be development-only.** Its backend allowlists three exact origins
  for CORS — `localhost:3000`, `localhost:5173`, `chatgpt.com` — so a deployed build
  cannot use it, and neither can `127.0.0.1:3000`. This was only discovered by testing the
  live endpoint; nothing documents it. It is why the provider layer treats an API key as
  the default rather than a fallback, and why the origin is checked before a request is
  built instead of letting CORS produce an unreadable failure.
- **The Codex wire format came from opencode's plugin, not from guesswork.** Two things
  were wrong on the first pass: the model was assumed to need a `-codex` suffix (it does
  not — the canonical `gpt-5.6-*` ids pass through unchanged), and the required
  `OpenAI-Beta: responses=experimental` header was missing. Both are only discoverable by
  reading a working implementation.

`getDailyMacroTargets` was extracted into `calories.js` as a prerequisite. It had existed
as two copies, in `profile.js` and `scheduleEditor.js`; a third for the agent would have
let it quote targets that disagreed with the wheel on screen. `getCurrentMealSlot` and its
neighbours moved to `services/scheduleInfo.js` for the same reason — services cannot
import components.

### What was deliberately not done

- **No preview via the live renderers.** Reusing them would have meant swapping `dataStore`
  out and back around a render, which risks a half-applied store if anything throws. A
  separate render path over the same CSS classes costs some duplication and cannot corrupt
  anything.
- **Proposals are not persisted.** Reload and a pending one is gone. Staging them in
  Postgres would survive that, but a proposal is only meaningful against the database state
  that produced it, and re-asking is cheap.

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
