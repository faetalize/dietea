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

Reads the bundled JSON over HTTP. Called once from `main.js` on startup, and again by
Settings when a connected file is disconnected and the app reverts to the bundled copy.

```javascript
import { loadIngredients, loadMeals } from '../core/dataLoader.js';

const items = await loadIngredients();   // FoodItem[]; throws if the fetch fails
const raw   = await loadMeals();         // plain objects, NOT Meal instances; [] on failure
```

`loadMeals()` deliberately returns raw JSON — pass it through `hydrateMeal` to get usable
`Meal` objects. Note the asymmetry: `loadIngredients` throws on failure, `loadMeals`
returns `[]`.

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

### `js/services/state.js`

```javascript
import { state, loadState, saveState, updateState, updateProfile, resetState } from '../services/state.js';

state.onboarded;        // boolean
state.startDay;         // 0-6, Sunday-indexed; which weekday the plan starts on
state.checkedItems;     // { [shoppingRowId]: boolean }
state.profile;          // see below

updateState({ startDay: 2 });               // merges, then saves
updateProfile({ weight: 75, height: 180 }); // merges into state.profile, then saves
resetState();                               // back to defaults, then saves
```

`state.profile` is `{ age, sex, weight, height, activityLevel, goalWeight, goalMonths,
maintenanceCalories, recommendedCalories }`. Weight is kg, height is cm,
`activityLevel` is the TDEE multiplier (1.2–1.9), and the two calorie fields are derived
— `calculateProfileMetrics` recomputes them whenever the profile is edited.

`updateState` and `updateProfile` both persist, so an explicit `saveState()` is only
needed after mutating `state` in place (as the shopping list does with `checkedItems`).

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

### `js/services/fileSystem.js`

Wraps the File System Access API and owns both file handles. The handles are plain
module-level variables, so they are lost on reload.

```javascript
import { isFileSystemSupported, selectIngredientsFile, selectMealsFile, loadIngredientsFromFile, loadMealsFromFile, saveIngredientsToFile, saveMealsToFile, getIngredientsFileHandle, getMealsFileHandle, clearIngredientsFileHandle, clearMealsFileHandle, clearFileHandle } from '../services/fileSystem.js';

if (!isFileSystemSupported()) { /* Firefox, Safari — read-only mode */ }

const handle = await selectIngredientsFile();   // opens the picker; null if cancelled
const data   = await loadIngredientsFromFile(handle);
const ok     = await saveIngredientsToFile(items);   // false if no handle or permission denied
```

Getters return the handle or `null`, which is how the rest of the app tests whether a file
is connected. `clearFileHandle()` clears both; the two specific clears drop one each.

Writes request `readwrite` permission on every save and resolve to `false` rather than
throwing if it is denied.

Handles are deliberately not persisted. An earlier design kept them in IndexedDB; the
stubs left over from it were removed, so reconnecting once per session is the intended
behavior rather than a gap waiting to be filled. Restoring persistence means bringing
IndexedDB back.

### `js/services/storage.js`

Routes each dataset to its destination.

```javascript
import { saveIngredients, saveMeals, saveSchedule } from '../services/storage.js';

const ok = await saveIngredients();   // → ingredients.json
const ok = await saveMeals();         // → menu.json, via serializeMeal
saveSchedule();                       // → localStorage 'mealPrepSchedule'
```

`saveIngredients` and `saveMeals` are async and return a boolean. They return `false`
immediately — writing nothing — when the API is unsupported or the file is not connected.
**Always check the result**; the established pattern is to snapshot, mutate optimistically,
and restore on failure:

```javascript
const previous = [...dataStore.ingredients];
setIngredients(next);
if (!await saveIngredients()) {
  setIngredients(previous);
  showToast('Connect ingredients.json in Settings before saving changes', 'error');
  return;
}
```

`saveSchedule` is synchronous and always succeeds — it only touches `localStorage`.

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
calorie totals, and surfaces the leftover weekly calories as its budget.

**Auto-generate** fills the week from the meals available. Per day it draws up to 500
random candidate sets, discards any over the daily calorie budget, and keeps the best by
this ordering: fewest missed protein/fat minimums, then closest macro ratio, then smallest
calorie gap. If every draw is over budget it falls back to greedily fitting the
lowest-calorie meals. Lunch and dinner share one pool; a slot with no matching meal type
falls back to the full meal list. Targets are 1.6 g/kg protein and 0.8 g/kg fat (floored
at 0.6 g/kg when calories are tight), with carbs filling the remainder.

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
import { renderSupplements, setupSupplementsListeners, clearSupplementsData } from './supplements.js';

clearSupplementsData();   // drops the stored tracking; silent, caller re-renders
```

A fixed list of 13 supplements plus water tracking, persisted to
`localStorage` under `mealPrepSupplementsState` and reset automatically when the date
changes. The storage key is private to this module — reach it through
`clearSupplementsData()` rather than naming the key elsewhere. Goals scale off `state.profile.weight` — 35 ml/kg water, 1.6 g/kg protein —
defaulting to 75 kg when no profile is set. The list itself is a hardcoded `SUPPLEMENTS`
constant in the module, not user data.

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

setupSettingsListeners({ onScheduleChanged, onIngredientsChanged, onMealsChanged, onSupplementsChanged, onShowOnboarding });
```

Wires the start-day selector, the file connect/disconnect controls, and the destructive
actions. Every callback is optional; `main.js` supplies all five so that a change in
Settings re-renders whatever it affects.

Destructive buttons use a two-step confirm driven by a `.confirming` class on a
`.setting-action-wrapper` — see `setupDestructiveAction`.

Disconnecting a file reverts that dataset to the bundled JSON rather than leaving it
empty. *Delete all data* clears all three `localStorage` keys — state, schedule, and
supplement tracking — drops both handles, restores the bundled data, and reopens
onboarding.

## Adding a module

1. Put it in the folder matching its layer — `core` for data, `services` for
   cross-cutting behavior, `utils` for pure helpers, `components` for UI.
2. Export only what callers need; keep helpers module-private.
3. Import with an explicit relative path ending in `.js`. There is no bundler or import
   map, so the browser resolves paths literally.
4. If it renders, add its markup to `index.html`, expose a `render*` and a
   `setup*Listeners`, and call them from `main.js`.
5. If it mutates ingredients or meals, follow the snapshot-and-roll-back save pattern.
6. Verify in the browser — there is no test suite.
