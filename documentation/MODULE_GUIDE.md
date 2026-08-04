# Module Reference

Every module and its exports. Paths are relative to the repo root; import paths in the
examples are written as a component under `js/components/` would write them.

## Core

### `js/core/models.js`

Four classes. Macros are always computed getters — nothing caches a macro total.

```javascript
import { FoodItem, FoodItemEntry, CookingInstruction, Meal } from '../core/models.js';
```

**`FoodItem`** — `{ id, name, category, unit, kcal, carb_per_unit, protein_per_unit, lipid_per_unit }`.
All macro fields are per single unit.

```javascript
const oats = new FoodItem({ id: 'rolled-oats', name: 'Rolled oats', unit: 'g', kcal: 3.89, carb_per_unit: 0.67, protein_per_unit: 0.17, lipid_per_unit: 0.07 });
oats.macrosFor(60);   // { kcal: 233.4, carbs: 40.2, protein: 10.2, lipids: 4.2 }
```

**`FoodItemEntry`** — `{ item, quantity }`, one line of a recipe.

```javascript
const entry = new FoodItemEntry({ item: oats, quantity: 60 });
entry.label;    // "Rolled oats — 60 g"
entry.macros;   // same as oats.macrosFor(60); zeroed if item is null
```

**`CookingInstruction`** — `{ name, steps }`. One named block of steps, e.g. "Prep" or
"Cook". A meal with more than one block renders as tabs in the detail view.

**`Meal`** — `{ id, name, type, ingredients, instructions }` where `type` is
`Breakfast`, `Lunch`, `Snack`, or `Dinner`.

```javascript
meal.macros;   // { kcal, carbs, protein, lipids }, summed over ingredients
```

### `js/core/dataStore.js`

The single in-memory store. Import `dataStore` to read; use the setters to write, since
they coerce non-arrays to `[]`.

```javascript
import { dataStore, setIngredients, setMeals, setSchedule, getMealById, aggregateShoppingList } from '../core/dataStore.js';

dataStore.ingredients;   // FoodItem[]
dataStore.meals;         // Meal[]
dataStore.schedule;      // day objects, see below

getMealById('overnight-oats-berries');   // Meal | undefined
```

A schedule is an array of day objects:

```javascript
{
  day: 0,
  isCheatDay: false,
  slots: [
    { slot: 'breakfast', mealId: 'overnight-oats-berries', time: '7:00 AM' },
    { slot: 'lunch',     mealId: null,                     time: '1:00 PM' },
    { slot: 'snack',     mealId: null,                     time: '4:00 PM' },
    { slot: 'dinner',    mealId: null,                     time: '7:00 PM' }
  ]
}
```

`aggregateShoppingList()` folds the schedule into per-category ingredient totals:

```javascript
aggregateShoppingList();
// [{ category: 'Dairy', items: [{ id, name, unit, quantity, category }] }, ...]
```

It defaults to the current store but accepts `(schedule, meals)` for testing. Entries
whose meal is not a `Meal` instance are skipped, so pass hydrated meals.

### `js/core/dataLoader.js`

Reads each collection from Supabase, and seeds a brand new account.

```javascript
import { loadIngredients, loadMeals, loadSchedule, isAccountEmpty, seedStarterData } from '../core/dataLoader.js';

const items = await loadIngredients();   // FoodItem[]
const raw   = await loadMeals();         // plain objects, NOT Meal instances
const days  = await loadSchedule();      // [] when the user has no schedule row

if (await isAccountEmpty()) await seedStarterData();
```

All of these throw on failure with a translated message, so one try/catch at the call
site covers them.

`loadMeals()` deliberately returns raw rows — pass them through `hydrateMeal` to get
usable `Meal` objects. The ingredient column list matches the `FoodItem` constructor
exactly, so rows need no mapping.

`seedStarterData()` reads the bundled `ingredients.json` and `menu.json` and upserts them
for the current user. `isAccountEmpty()` guards it: seeding only happens when the account
has neither ingredients nor meals, so it can never overwrite real data. That also means a
user who deliberately deletes everything gets the starter set back, which is what the old
"delete all data" did.

### `js/core/mealSerde.js`

```javascript
import { hydrateMeal, serializeMeal } from '../core/mealSerde.js';

const meal = hydrateMeal(jsonMeal);          // resolves against dataStore.ingredients
const meal = hydrateMeal(jsonMeal, items);   // or against an explicit list
const json = serializeMeal(meal);            // shape written to menu.json
```

`hydrateMeal` resolves each `itemId` against the ingredient list. When an id does not
resolve it does **not** drop the entry — it substitutes a placeholder `FoodItem` built
from the stored `itemName`/`itemUnit` with all macros set to zero. The meal still renders
with the right ingredient names, but under-reports its calories. Load ingredients before
meals to avoid this.

## Services

### `js/services/supabase.js`

Builds the client and translates errors.

```javascript
import { supabase, describeError, assertOk } from '../services/supabase.js';

const { data, error } = await supabase.from('meals').select('*');
assertOk(error, 'Could not load meals');   // throws with a readable message
showToast(describeError(error), 'error');  // or handle it yourself
```

The client is configured with `db: { schema: 'dietea' }`, so `.from('meals')` resolves to
`dietea.meals` — never write the schema into a table name.

`describeError` special-cases the failures that are not the user's fault, most importantly
`PGRST106`, which means the `dietea` schema is not in the project's exposed schemas.
Without that translation the app would report a bare "not found" for a project
misconfiguration.

`supabase-js` is imported from `js/vendor/supabase.js`, a committed esbuild bundle, so
there is no CDN dependency. Regenerate it with `npm run vendor:supabase`.

### `js/services/auth.js`

Email and password auth. Owns the current user.

```javascript
import { initAuth, onAuthChange, signIn, signUp, signOut, getCurrentUser, getCurrentUserId, requireUserId } from '../services/auth.js';

const user = await initAuth();            // read persisted session; null when signed out
const unsubscribe = onAuthChange((u) => { if (!u) showAuthScreen(); });

const { user, error } = await signIn(email, password);
const { user, needsConfirmation, error } = await signUp(email, password);
```

`signUp` returns `needsConfirmation: true` when the project requires email verification —
Supabase returns a user but no session, and the caller has to say "check your inbox"
rather than assume a successful sign-in.

`requireUserId()` throws when signed out and is called by every write path, so an expired
session surfaces as one clear message instead of an opaque RLS rejection. `getCurrentUser`
and `getCurrentUserId` are the non-throwing reads.

### `js/services/state.js`

```javascript
import { state, loadState, saveState, flushState, updateState, updateProfile, resetState } from '../services/state.js';

state.onboarded;        // boolean
state.startDay;         // 0-6, Sunday-indexed; which weekday the plan starts on
state.checkedItems;     // { [shoppingRowId]: boolean }
state.profile;          // see below

await loadState();                          // fetch the user's row, creating it on first run
updateState({ startDay: 2 });               // merges, then queues a save
updateProfile({ weight: 75, height: 180 }); // merges into state.profile, then queues a save
await flushState();                         // write any queued change now and wait
await resetState();                         // back to defaults, written immediately
```

`state.profile` is `{ age, sex, weight, height, activityLevel, goalWeight, goalMonths,
maintenanceCalories, recommendedCalories }`. Weight is kg, height is cm,
`activityLevel` is the TDEE multiplier (1.2–1.9), and the two calorie fields are derived
— `calculateProfileMetrics` recomputes them whenever the profile is edited.

Backed by `dietea.profiles`, one row per user. The module maps between the app's camelCase
shape and the table's snake_case columns; `weight` is `weight_kg`, `goalWeight` is
`goal_weight_kg`, and so on.

`state` stays synchronously readable so components are unchanged, but writes are **queued
on a 400 ms debounce**. That matters for the shopping list, where every checkbox toggle
calls `saveState()` — without debouncing, a shopping trip would be one request per tap.

Use `flushState()` when a write has to land before moving on. Onboarding does this: a
reload before that write completes would drop the user straight back into onboarding.

Because `state` is a rebindable `let`, `loadState()` and `resetState()` replace the whole
object. Read through the live binding rather than destructuring it once at module load.

### `js/services/calories.js`

Mifflin-St Jeor. Weight in kg, height in cm, age in years.

```javascript
import { calculateBMR, calculateTDEE, calculateRecommendedCalories, isGoalRealistic, getActivityLevelLabel, calculateProfileMetrics } from '../services/calories.js';

const bmr  = calculateBMR(75, 180, 30, 'male');   // 1730
const tdee = calculateTDEE(bmr, 1.55);            // rounded

calculateRecommendedCalories(tdee, 75, 70, 6);    // target for losing 5kg in 6 months
getActivityLevelLabel(1.55);                      // 'Moderately active'
```

`calculateRecommendedCalories` assumes 7700 kcal per kg and a 30-day month, then clamps:
at most a 1000 kcal deficit, at most a 500 kcal surplus, and never below 1200 kcal.

```javascript
const check = isGoalRealistic(75, 70, 6);
check.isRealistic;         // false if faster than 1 kg/week losing, 0.5 kg/week gaining
check.weeklyChange;        // kg per week the goal implies
check.recommendedMonths;   // a timeframe that would be realistic
```

`calculateProfileMetrics(profile)` returns `{ bmr, maintenanceCalories,
recommendedCalories }`, or `null` if any required profile field is missing — always
null-check it.

`calculateMacroTargets(targetCalories, weightKg)` splits a daily calorie target into
macros: protein fixed at 1.6 g/kg, fat aiming for 0.8 g/kg with a 0.6 g/kg floor, carbs
absorbing the remainder. When protein plus the fat target exceed the day's calories, fat
falls toward its floor rather than letting carbs go negative.

```javascript
const t = calculateMacroTargets(2180, 82);
t.proteinG; t.carbsG; t.fatsG;          // grams
t.proteinKcal; t.proteinPct; t.proteinRatio;
t.fatsMinG;                             // the floor actually reachable
t.isFatLimited;                         // true when fat was pushed to the floor
```

Percentages are computed so the three always sum to exactly 100. Pure and
weight-passed rather than reading `state`, so it stays usable from any layer.

> Three callers depend on identical numbers here — the profile card, the schedule
> generator, and the AI profile tool. This used to exist as two copies, which meant the
> assistant could quote targets that disagreed with the wheel on screen.

### `js/services/scheduleInfo.js`

Where the user is in their week. Pure derivation over `state` and `dataStore`, no DOM.

```javascript
import { getScheduleDays, getCurrentDayIndex, getCurrentMealSlot } from '../services/scheduleInfo.js';

getScheduleDays();      // ['Monday', 'Tuesday', ...] rotated to state.startDay
getCurrentDayIndex();   // index of today in the schedule, or -1
getCurrentMealSlot();   // 'breakfast' | 'lunch' | 'snack' | 'dinner' | null
```

Lives in services rather than beside the schedule views because the AI runtime context and
schedule tool need the same answers, and services cannot import components.

### `js/services/storage.js`

Persists each collection to Supabase.

```javascript
import { saveIngredients, saveMeals, saveSchedule } from '../services/storage.js';

const ok = await saveIngredients();   // → dietea.ingredients
const ok = await saveMeals();         // → dietea.meals, via serializeMeal
const ok = await saveSchedule();      // → dietea.schedules
```

All three are async and return a boolean, and they **toast the reason themselves** on
failure — callers only have to roll back. **Always check the result**; the established
pattern is to snapshot, mutate optimistically, and restore on failure:

```javascript
const previous = [...dataStore.ingredients];
setIngredients(next);
if (!await saveIngredients()) {
  setIngredients(previous);
  return;
}
```

`saveIngredients` and `saveMeals` keep their original whole-collection contract: hand over
the full array, and the module works out the difference. Each sync upserts every current
row and then deletes the rows that are gone.

Two consequences of that design:

- It is **several round trips**, not one. Fine at this scale — tens of rows — but worth
  revisiting as a single RPC if the data grows.
- It is **not atomic**. A failure between the upsert and the delete can leave a removed
  row behind. The in-memory rollback will not undo a partial write.

`saveSchedule` is a plain upsert of one row, since the whole plan is a single JSONB
column. It used to be synchronous; it is now async, so callers that care about failure
should await it.

## Assistant services

### `js/services/crypto.js`

WebCrypto primitives for the credential vault. PBKDF2-SHA256 at 600k iterations, AES-GCM
256. Nothing else in the app does cryptography.

```javascript
const vault = await encryptVault(password, { apiKey: 'sk-…', codex: null });
// { v: 1, salt, iv, ciphertext } — all base64

const key = await deriveKeyForVault(password, vault);
await decryptVaultWithKey(vault, key);
```

AES-GCM authenticates, so a wrong password throws `OperationError` rather than returning
garbage. Callers use that to tell "wrong password" from "no vault yet".

`encryptVaultWithKey` re-seals under an already-derived key, keeping the salt — that is
how saving a second credential avoids asking for the password again. Every write gets a
fresh IV, which GCM requires.

`exportDerivedKey` / `importDerivedKey` serialize the key so it survives a reload inside
the tab. This is the one place raw key material is exposed; the alternative was caching
the password, which would also unlock the Supabase account.

### `js/services/credentials.js`

The vault: the OpenAI API key and the Codex tokens, in one encrypted blob.

```javascript
rememberPassword(password);   // from the sign-in form, before the session loads
await initVault();            // after loadState(); consumes it. Never throws.

isUnlocked(); needsUnlock(); hasVault();
getApiKey(); getCodexTokens(); hasCredentialFor('codex');

await setApiKey('sk-…');      // encrypts and flushes
await changePassword(current, next, updateAuthPassword);
lock();                       // on sign-out
```

`needsUnlock()` is the state that matters for UI: credentials exist but this session
cannot read them, so prompt rather than offering setup.

### `js/services/openai.js`

The only module that talks to a model. One call, two providers.

```javascript
const response = await streamResponse({
  input, tools, instructions, effort, signal, onEvent,
  toolChoice: 'auto', parallelToolCalls: true
});
response.output;   // authoritative items — append verbatim to history
response.streamedText; // exact concatenated text deltas, used only as a consistency fallback
```

`store: false` always, with `include: ['reasoning.encrypted_content']` so reasoning
survives tool calls without OpenAI retaining the thread. Plain `fetch`, not the SDK —
both endpoints accept the SDK's headers, but vendoring another bundle would cost this app
its no-build-step character.

**The Codex request shape is not obvious and is not documented.** It was derived from
opencode's plugin (`numman-ali/opencode-openai-codex-auth`), which is the reference
implementation everyone else follows:

| | |
| --- | --- |
| URL | `chatgpt.com/backend-api/codex/responses` (the API's `/responses` with `/codex` spliced in) |
| `OpenAI-Beta` | `responses=experimental` — **required**; omitting it fails the request |
| `chatgpt-account-id` | from the `https://api.openai.com/auth` JWT claim |
| `originator` | `codex_cli_rs` |
| `session_id` / `conversation_id` | same value, stable per conversation, drives prompt caching |
| `Accept` | `text/event-stream` |

Model ids are the **same canonical ids as the Platform API** — `gpt-5.6-sol` and friends
pass straight through. There is no separate "codex" model to substitute; inventing one
gets `The 'gpt-5.6-codex' model is not supported when using Codex with a ChatGPT account`.

The difference is the context window, and it belongs to the **endpoint, not the model**:
Codex caps every model at 272k where the API allows 1.05M. Sol, Terra and Luna have
identical windows as each other on both.

The parser rebuilds `response.output` from `response.output_item.done` events because the
Codex endpoint can stream a complete answer while leaving the final
`response.completed.response.output` incomplete. `streamedText` is a second fallback, so
text already rendered by the UI can never be reclassified as an empty response afterward.
Both LF and CRLF SSE delimiters are accepted.

Requests ask for `reasoning.summary: 'auto'`. `onEvent` receives text deltas, tool start
and completed-argument events, actual reasoning-item state, and
`reasoning-summary`/`reasoning-summary-done` events for the live UI. Only the model's
purpose-built reasoning summary is displayable; raw or encrypted reasoning stays in
history and is never rendered.

`toolChoice` stays `auto`: the model decides whether to read data, stage a proposal, or
answer. Independent calls may be returned together with `parallelToolCalls: true`; the
host sends their outputs back in the original call order.
`describeAiError(err)` translates failures; it returns `''` for an abort, since a user
cancelling is not an error to report.

### `js/services/codexAuth.js`

Codex OAuth, PKCE S256 against `auth.openai.com` with the Codex CLI's public client.

```javascript
const url = await beginAuthorization();      // open in a new tab
const tokens = await completeAuthorization(pastedCallbackUrl);
if (isExpired(tokens)) tokens = await refreshTokens(tokens);
```

`completeAuthorization` verifies `state` before exchanging, which is what makes the
paste step safe. `refreshTokens` carries the old refresh token forward when the response
omits a new one — otherwise a connection dies after its first refresh.

```javascript
isCodexOriginSupported();        // false anywhere but localhost:3000 / localhost:5173
describeCodexOriginProblem();    // '' when fine, otherwise what to do about it
```

The Codex backend sends CORS headers for exactly `http://localhost:3000`,
`http://localhost:5173` and `https://chatgpt.com` — measured, not documented. Note that
`http://127.0.0.1:3000` is *not* on it despite being the same server, and neither is any
deployed domain, so **Codex is a local-development path only**.

`openai.js` calls this before building a request. Letting it through instead produces a
bare CORS rejection, which arrives as a `TypeError: Failed to fetch` and gets translated
into "could not reach the server" — true, useless, and pointing at the wrong problem.

### `js/services/aiContext.js`

`buildRuntimeContext()` supplies only local date/time, timezone, and the current meal
window. Live profile, schedule, meal, ingredient, supplement, and shopping-list data are
not duplicated into the prompt; the model reads them on demand through tools.

### `js/services/aiTools.js`

The model's typed live-data surface. Read tools execute against the in-memory store at
call time:

- `list_ingredients`, `get_ingredient`
- `list_meals`, `get_meal`
- `get_schedule`, `get_profile`, `get_supplements`, `get_shopping_list`

`get_profile` returns both the calculated targets and a structured `macroStrategy`:
protein fixed per kilogram, a per-kilogram fat target with a floor under calorie
pressure, and carbohydrates filling the remaining calories. The strategy ratios come
from the same constants used by the calculator and profile card.

Writes are deliberately phrased as proposals because they stop at the approval boundary:
`propose_ingredient_changes`, `propose_meal_changes`, `propose_schedule_changes`,
`propose_supplement_changes`, `propose_profile_changes`, and
`propose_shopping_changes`. `propose_changes` is the atomic cross-domain option for
dependent changes such as creating an ingredient, using it in a meal, and scheduling that
meal together.

### `js/services/agent.js`

Tool definitions and the loop.

```javascript
await runTurn({ text, attachments, getSupplements, signal, onEvent, onProposal });
recordProposalOutcome(proposalId, 'accepted', appliedValues);
clearConversation();
```

There is no lexical intent classifier and the host never forces tool use from words in the
user's message. Every model call uses automatic tool choice. Read calls are executed and
returned until the model answers; a proposal call stages a review card and ends the turn.
Multiple focused proposal calls returned together are merged into one approval card so
the user reviews and accepts the whole batch once.

The loop has no arbitrary tool-round ceiling. The user-facing Stop button aborts the
active request, which is the explicit yield/cancellation path for long-running work.

Two invariants:

- Every output item goes back into history **verbatim, including reasoning items**.
  Filtering them breaks the model's continuity across tool calls and is rejected outright
  when `store: false`.
- `recordProposalOutcome` echoes the **applied** values, not the proposed ones. The user
  can edit a card before accepting; without this the model's picture of the database
  drifts.
- Proposal tools never mutate application data. Only the card's Accept action calls the
  existing persistence functions, in dependency order.

## Utils

### `js/utils/helpers.js`

```javascript
import { titleCase, fmt, slugify, defaultTimeForSlot, DAY_NAMES } from '../utils/helpers.js';

titleCase('hello world');        // 'Hello World'
fmt(123.456);                    // '123.46'; '0.00' for non-finite input
slugify('My Meal Name!');        // 'my-meal-name'
defaultTimeForSlot('breakfast'); // '7:00 AM'; '—' for an unknown slot
DAY_NAMES[0];                    // 'Sunday'
```

`slugify` falls back to `item-<timestamp>` when the input has no alphanumerics, so it
never returns an empty string. Ids for new records are minted as
`slugify(\`${name}-${Date.now()}\`)`.

Note that `dataStore.js` and `shopping.js` each carry a private `slugify` that lacks that
fallback. Use the `helpers.js` one in new code.

### `js/utils/feedback.js`

```javascript
import { showToast, showFieldError, clearValidationErrors } from '../utils/feedback.js';

showToast('Meal saved!', 'success');   // 'success' | 'error' | 'default'
showFieldError(document.getElementById('meal-name'), 'Meal name is required');
clearValidationErrors(document.getElementById('create-meal-modal'));
```

Toasts append to `#toast-container` and remove themselves after ~3s. `showFieldError`
needs the input to sit inside a `.form-field` wrapper; it marks the wrapper and clears the
mark on the next input event. Call `clearValidationErrors` on the container before
re-validating.

## Components

Every component renders into markup that already exists in `index.html`. Render functions
are safe to call repeatedly — they rebuild their subtree and rebind listeners. The
`setup*Listeners` functions are wired exactly once, from `main.js`.

### `js/components/navigation.js`

```javascript
import { switchTab, showMealDetail, hideMealDetail, setupMealDetailNavigation, savePreviousTab, getPreviousTab } from './navigation.js';

switchTab('menu');                        // 'shopping' | 'schedule' | 'menu' | 'ingredients' | 'supplements'
showMealDetail('overnight-oats-berries'); // swaps the menu panel for the detail view
```

`savePreviousTab`/`getPreviousTab` let Settings return to wherever the user came from.
Settings is not a tab id — `main.js` toggles `#settings-tab` directly.

### `js/components/shopping.js`

```javascript
import { renderShoppingList, resetShoppingList } from './shopping.js';
```

Renders `aggregateShoppingList()` grouped by category. Checkbox state is keyed by
`<category-slug>-<item-id>` in `state.checkedItems`, so renaming a category or an
ingredient id drops its checkmarks. `resetShoppingList()` clears them and re-renders.

### `js/components/schedule.js`

```javascript
import { renderSchedule, renderScheduleList, renderScheduleCalendar, getScheduleDays, getCurrentDayIndex, getCurrentMealSlot, scrollToCurrentDay } from './schedule.js';

renderSchedule();   // renders both views; the hidden one is rendered too
```

Read-only views of `dataStore.schedule` — editing lives in `scheduleEditor.js`.

`getScheduleDays()` maps schedule positions to weekday names starting at `state.startDay`.
`getCurrentDayIndex()` returns the position matching today, or `-1`.
`getCurrentMealSlot()` buckets the current time into a slot (breakfast 05:00–10:30, lunch
10:30–15:00, snack 15:00–18:00, dinner 18:00–22:00) and returns `null` outside those.
Together they drive the `current-day`/`current-meal` highlighting.

### `js/components/scheduleEditor.js`

```javascript
import { renderScheduleOverview, setupScheduleListeners } from './scheduleEditor.js';
```

The editor modal, the auto-generator, and the weekly overview above the schedule.

The modal works on a deep-copied `tempSchedule` and only commits to `dataStore` when the
user saves, so cancelling discards cleanly. Saving a week with no meals stores an empty
schedule rather than a week of empty days.

One day can be marked a **cheat day**: marking it clears its meals, excludes it from
calorie totals, and surfaces the leftover weekly calories as its budget. In practice that
lands around 15% above an average day.

**Auto-generate** fills the week from the meals available. Per day it draws up to 500
random candidate sets, discards any over the daily calorie budget, and keeps the best by
this ordering: fewest missed protein/fat minimums, then closest macro ratio, then smallest
calorie gap. If every draw is over budget it falls back to greedily fitting the
lowest-calorie meals. Lunch and dinner share one pool; a slot with no matching meal type
falls back to the full meal list. Targets are 1.6 g/kg protein and 0.8 g/kg fat (floored
at 0.6 g/kg when calories are tight), with carbs filling the remainder.

The daily calorie budget is always `weeklyTarget / 7`, **never divided by the number of
days actually being scheduled**. Dividing by 6 when a cheat day exists would hand each
remaining day ~17% more calories and leave the cheat day with almost nothing, contradicting
the overview — and it made the outcome depend on the order of operations, since generating
first and marking a cheat day afterwards budgeted per calendar day while doing it the other
way round did not. Per-calendar-day budgeting makes both orders agree.

Macro targets are per-day and have no weekly component: `proteinMinG` is derived from body
weight alone, so a cheat day never inflates the protein target on the days around it, and a
shortfall on one day is never made up on another.

### `js/components/menu.js`

```javascript
import { renderMenuCards, filterMenuCards, setupMenuListeners } from './menu.js';

filterMenuCards('oats');   // matches name and type; '' shows everything
```

Cards carry inline edit and delete-with-confirm actions. Import accepts a single meal
object or an array; meals missing `name` or `type` are skipped, and a colliding id is
reassigned rather than overwriting the existing meal.

### `js/components/mealDetail.js`

```javascript
import { renderMealDetail } from './mealDetail.js';

renderMealDetail(mealId, containerEl);   // container defaults to #meal-detail-content
```

Renders nutrition, ingredients, and instructions for one meal. A single instruction block
renders inline; several render as tabs. Reached through `showMealDetail`.

### `js/components/mealCreation.js`

```javascript
import { openCreateMealModal, openEditMealModal, closeCreateMealModal, deleteMeal, setupMealCreationListeners } from './mealCreation.js';

await deleteMeal(mealId, () => renderMenuCards());
setupMealCreationListeners({ onMealsChanged });
```

One modal serves both create and edit, switching on module-level `editingMealId`; the
title and save button relabel themselves. Edits are staged in module state and only
applied on save. A meal needs a name and at least one ingredient.

All three mutations save through `saveMeals()` and roll back if it fails, so they no-op
with an error toast when `menu.json` is not connected.

### `js/components/ingredients.js`

```javascript
import { renderIngredients, filterIngredients, setupIngredientsListeners } from './ingredients.js';
```

Ingredients grouped by category, each card with edit and delete-with-confirm. Create,
edit, delete, and import all go through `saveIngredients()` with the same rollback
pattern. Category inputs are backed by a datalist rebuilt from existing categories;
a blank category becomes `Uncategorized`. Import skips ids that already exist.

Remember that the numeric fields are **per unit**, not per 100 g.

### `js/components/supplements.js`

```javascript
import { renderSupplements, setupSupplementsListeners, loadSupplementsState, clearSupplementsData } from './supplements.js';

await loadSupplementsState();   // called once during bootstrap
await clearSupplementsData();   // deletes every day's row; silent, caller re-renders
```

A fixed list of 13 supplements plus water tracking, backed by `dietea.supplement_days`.

The table is keyed `(user_id, day)`, so the tracker **keeps history** rather than
overwriting yesterday. `loadSupplementsState()` reads the most recent row; if it is not
today's, the module starts a fresh day and carries the bottle-size preference forward.

Today's tracker is held in a module-level variable so `renderSupplements()` stays
synchronous. Mutations update that variable immediately and persist in the background, so
the UI never waits on the network.

Goals scale off `state.profile`, defaulting to 75 kg when nothing is set: protein at
1.6 g/kg of actual weight, and water at 75% of the ~35 ml/kg total-fluid estimate applied
to *adjusted* weight, rounded to the nearest 50 ml.

Two corrections are baked into that water figure, and both matter:

- **The 75% share.** 35 ml/kg is a *total* fluid figure covering water from food as well
  as drink, but only bottles are logged here. Tracking the full amount in bottles would
  overstate the drinking target by roughly a third.
- **Adjusted body weight.** Fluid needs do not scale linearly with mass — fat-free mass is
  ~70-75% water against ~10-40% for adipose tissue — so a straight ml/kg figure
  overestimates for heavier bodies. `getAdjustedWeightKg()` takes Devine ideal weight for
  height and sex, then adds 40% of any excess. Below ideal weight the actual weight is
  used unchanged, so this only ever tapers the goal. At 180 cm it changes nothing up to
  75 kg, and pulls a 110 kg goal from 2,900 ml down to 2,350 ml.

Both are conventions, not precision. If `height` is missing the adjustment is skipped and
actual weight is used.

The supplement list itself comes from the fixed catalog in
`js/core/supplementCatalog.js`, not user data. The tracker UI reads it directly and
`get_supplements` exposes the same catalog to the model, so names and ids cannot drift.
Its ids are the keys inside the `completed` JSONB column, so renaming an id orphans that
supplement's history; renaming a label is free.

### `js/components/profile.js`

```javascript
import { renderProfileCard, setupProfileListeners } from './profile.js';
```

The profile card in Settings: stats, activity label, maintenance/target/difference
calories, goal text with a warning when the goal is aggressive, protein range, and a macro
wheel. Clicking the macro card cycles it through percent, kcal, and grams.

Saving the edit modal clears the derived calorie fields, recomputes them with
`calculateProfileMetrics`, and re-renders.

### `js/components/settings.js`

```javascript
import { setupSettingsListeners } from './settings.js';

setupSettingsListeners({ onScheduleChanged, onIngredientsChanged, onMealsChanged, onSupplementsChanged, onShowOnboarding, onSignedOut });
```

Wires the profile card, the start-day selector, the account section, and the destructive
actions. Every callback is optional; `main.js` supplies all six so that a change in
Settings re-renders whatever it affects.

Destructive buttons use a two-step confirm driven by a `.confirming` class on a
`.setting-action-wrapper` — see `setupDestructiveAction`.

*Delete all data* removes every row the user owns across all five tables, resets the
profile, then re-seeds the starter ingredients and menu so the account lands in the same
state as a fresh sign-up, and reopens onboarding.

### `js/components/chat.js`

The pill, the panel, messages, attachments, and the proposal card.

```javascript
setupChat({ onApplied });   // once, from main.js
openChat(); closeChat();
renderGate();               // re-evaluate after credentials or provider change
renderProposal(proposal);   // also usable outside a live turn
```

Agent work renders as a live step list. A generic “Waiting for response” status appears
immediately and disappears as soon as text starts streaming. “Thinking” is reserved for
an actual reasoning output item; it becomes a completed “Reasoned” row when text begins,
or a model-authored reasoning-summary row with expandable detail when a summary is
available. Tool calls show their start, safe argument summary, and completion result. Raw
chain-of-thought is never shown.

Model output is escaped before its minimal markdown is applied, so text quoted off a
photographed label cannot inject markup.

Attachments: images become `input_image`, PDFs `input_file`, and text-ish files are inlined
as text — sending a `.txt` as a document costs far more than its contents.

### `js/components/proposals.js`

Normalization and application. Import `normalizeProposal` to turn raw tool arguments into
a flat change list, `applyProposal` to commit one.

```javascript
{ kind, op: 'create'|'update'|'delete', id, label, before, after, fields, impact }
```

`applyProposal` runs ingredients → meals → schedule → supplements → profile → shopping. That order is
not cosmetic: a meal referencing a newly created ingredient only resolves once that
ingredient is in the store. Each collection uses the app's snapshot / swap / roll-back-on-
false pattern, so a failure leaves the store as it was.

`impact` is the blast radius. Deleting an ingredient lists the meals that would keep
their line item and count zero calories for it; deleting a meal lists the schedule slots
that would fall back to "Unassigned meal".

`withScheduleChanges(changes, base)` merges day-level edits into a full seven-day week,
materializing a blank one first — otherwise scheduling into day 3 of an empty schedule
would produce a one-element array.

`describeApplied(applied)` is what gets echoed back to the model.

### `js/components/proposalPreview.js`

`openPreview(normalized)` / `closePreview()`. Renders the proposal through the app's own
CSS classes with `New` / `Updates` / `Removes` badges, showing only fields that actually
moved.

It never touches `dataStore`. Reusing the live render functions was the obvious
alternative and is wrong: they write to fixed element ids and read the store directly, so
driving them would paint into the real DOM or need the store swapped out and back.

Meal totals are computed from the proposal, resolving ingredients created in that same
proposal — for a new meal there is nothing to look up, and for an edited one the stored
totals are stale.

### `js/components/dashboard.js`

`renderDashboard()`. A placeholder.

## Adding a module

1. Put it in the folder matching its layer — `core` for data, `services` for
   cross-cutting behavior, `utils` for pure helpers, `components` for UI.
2. Export only what callers need; keep helpers module-private.
3. Import with an explicit relative path ending in `.js`. There is no bundler or import
   map, so the browser resolves paths literally.
4. If it renders, add its markup to `index.html`, expose a `render*` and a
   `setup*Listeners`, and call them from `main.js`.
5. If it mutates ingredients or meals, follow the snapshot-and-roll-back save pattern.
6. If it writes to Supabase, call `requireUserId()` first and set `user_id` on every row —
   RLS will reject the write otherwise.
7. If it needs a new table, add a migration under `supabase/migrations/`, put it in the
   `dietea` schema, enable RLS, and add a `auth.uid() = user_id` policy. A table without
   a policy is invisible rather than public, which is a confusing way to find the mistake.
8. Verify in the browser — there is no test suite.
