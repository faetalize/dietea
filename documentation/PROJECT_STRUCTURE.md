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
│   │   ├── mealSerde.js    # Meal hydrate/serialize
│   │   └── supplementCatalog.js # Fixed supplement definitions shared by UI + AI
│   ├── services/
│   │   ├── supabase.js     # Client construction + error translation
│   │   ├── auth.js         # Sign in/up/out, session, current user
│   │   ├── state.js        # Profile + preferences, debounced to Postgres
│   │   ├── calories.js     # BMR/TDEE/goal math + macro targets
│   │   ├── scheduleInfo.js # Today's index, current meal slot, day names
│   │   ├── storage.js      # Writes for ingredients, meals, schedule
│   │   ├── crypto.js       # PBKDF2 + AES-GCM primitives (WebCrypto)
│   │   ├── credentials.js  # Encrypted credential vault
│   │   ├── openai.js       # Responses API transport, both providers
│   │   ├── codexAuth.js    # Codex OAuth (PKCE)
│   │   ├── aiContext.js    # Small clock/runtime context (live data stays in tools)
│   │   ├── aiTools.js      # Live read tools + approval-gated proposal schemas
│   │   └── agent.js        # Model-driven tool loop + proposal staging
│   ├── utils/
│   │   ├── helpers.js      # Formatting, slugify, day names, slot times
│   │   ├── feedback.js     # Toasts and form validation
│   │   └── markdown.js     # Safe GFM rendering for assistant messages
│   ├── vendor/
│   │   ├── markdown.js     # Vendored Marked bundle (generated, committed)
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
│       ├── settings.js       # Settings panel wiring, incl. AI settings
│       ├── chat.js           # Assistant pill, panel, proposal cards
│       ├── proposals.js      # Proposal normalize + apply
│       ├── proposalPreview.js# Non-destructive preview overlay
│       └── dashboard.js      # Empty placeholder tab
├── scripts/
│   ├── markdown-entry.js   # Bundle entry point for npm run vendor:markdown
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
- `aiContext.js` — contributes only non-data runtime facts such as local time; live app
  objects are fetched through tools instead of copied into every turn.
- `aiTools.js` — exposes typed reads for ingredients, meals, schedule, profile,
  supplements, and shopping data, plus focused and atomic proposal tools for writes.
- `agent.js` — lets the model choose tools with `tool_choice: auto`, executes live reads,
  and stages proposals without mutating data.

### `js/components/`

UI. Each module renders into elements that already exist in `index.html` and attaches its
own listeners. Components read from `dataStore` and `state` directly rather than
receiving props.

## Styling

One stylesheet, `main.css`, dark only. There is no build step, so it is plain CSS with
custom properties as the design system — surfaces, text, accent, spacing, radii and
easing are all declared once in `:root`. Reach for a token rather than a literal.

Depth comes from layered surfaces (`--surface` → `--surface-2` → `--surface-3`) and
hairline borders rather than shadows, which read as muddy on a dark background. Colour is
rationed: one accent (`--primary`) plus four meal hues that double as the macro colours.

Two things to know before editing:

- **Layout is mobile-first at the breakpoints, not the base.** Base rules describe the
  desktop shell; `@media (max-width: 768px)` moves the tab bar to the bottom, turns modals
  into bottom sheets, and collapses grids. `env(safe-area-inset-bottom)` keeps the bar
  clear of the home indicator, which is why `index.html` sets `viewport-fit=cover`.
- **The base input rules use attribute selectors** (`input[type="text"]`), so a bare class
  like `.search-input` loses on specificity. Qualify overrides with the element —
  `input.search-input` — or they silently do nothing.

Numeric readouts set `font-variant-numeric: tabular-nums` so figures do not jitter as they
update.

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

## The assistant

An OpenAI agent that can read everything and write anything — behind one gate.

**Nothing it proposes is applied until the user accepts.** `propose_changes` is the only
write tool, and it stages rather than saves. The staged proposal renders as an editable
card in chat, can be visualized in a full preview overlay, and is applied only on accept.
`js/services/agent.js` is the loop; `js/components/proposals.js` normalizes and applies.

Three things about it are load-bearing:

- **Reasoning items go back into the next request.** The loop pushes every output item —
  including `reasoning` — into history verbatim. Filtering them out breaks continuity
  across tool calls and, with `store: false`, is rejected outright.
- **The preview never mutates `dataStore`.** It is a separate render path over the same
  CSS classes. Reusing the live render functions would paint into the real DOM or require
  swapping the store out and back.
- **What was applied is echoed back to the model**, not what it proposed. The user can
  edit a card before accepting, and without this the model's picture of the database
  drifts from reality.

Deletes are where the preview earns its keep. Because meals reference ingredients with no
foreign key, deleting an ingredient leaves its meals rendering normally while counting
zero calories for it — so a delete proposal names the meals it will affect before you
accept, which is the only place in the app that consequence is visible.

Credentials are encrypted client-side (`js/services/crypto.js`) under a key derived from
the account password, and stored as ciphertext in `dietea.profiles.ai_vault`. See
[README.md](README.md#the-assistant) for setup and the threat model.
