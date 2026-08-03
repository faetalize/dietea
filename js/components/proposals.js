/**
 * Proposals: the gate between what the agent wants and what the database gets.
 *
 * A raw tool call becomes a flat list of changes, each carrying what is there
 * now (`before`), what is proposed (`after`), and an editable field list. The
 * user can correct a misread number in place, look at a full preview, then
 * accept — at which point the changes are applied in dependency order through
 * the same storage functions the manual UI uses.
 *
 * Nothing here mutates `dataStore` until accept. Editing a card edits the
 * proposal, not the app.
 */

import { dataStore, getMealById, setIngredients, setMeals, setSchedule } from '../core/dataStore.js';
import { FoodItem, Meal, FoodItemEntry, CookingInstruction } from '../core/models.js';
import { saveIngredients, saveMeals, saveSchedule } from '../services/storage.js';
import { state, updateProfile, flushState } from '../services/state.js';
import { calculateProfileMetrics } from '../services/calories.js';
import { getScheduleDays } from '../services/scheduleInfo.js';
import { applySupplementChanges } from './supplements.js';
import { defaultTimeForSlot } from '../utils/helpers.js';

const SLOTS = ['breakfast', 'lunch', 'snack', 'dinner'];

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/* ------------------------------------------------------------- normalize */

function normalizeIngredient(entry) {
  const existing = dataStore.ingredients.find((i) => i.id === entry.id);

  if (entry.op === 'delete') {
    if (!existing) return null;
    return {
      kind: 'ingredient',
      op: 'delete',
      id: entry.id,
      label: existing.name,
      before: { ...existing },
      after: null,
      fields: [],
      impact: ingredientDeleteImpact(entry.id)
    };
  }

  // An update carrying only some fields keeps the rest of the row as it is.
  const base = existing || {};
  const after = {
    id: entry.id,
    name: entry.name ?? base.name ?? '',
    category: entry.category ?? base.category ?? 'Uncategorized',
    unit: entry.unit ?? base.unit ?? 'g',
    kcal: entry.kcal ?? base.kcal ?? 0,
    protein_per_unit: entry.protein_per_unit ?? base.protein_per_unit ?? 0,
    carb_per_unit: entry.carb_per_unit ?? base.carb_per_unit ?? 0,
    lipid_per_unit: entry.lipid_per_unit ?? base.lipid_per_unit ?? 0
  };

  return {
    kind: 'ingredient',
    op: existing ? 'update' : 'create',
    id: entry.id,
    label: after.name,
    before: existing ? { ...existing } : null,
    after,
    fields: [
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'category', label: 'Category', type: 'text' },
      { key: 'unit', label: 'Unit', type: 'text' },
      { key: 'kcal', label: 'kcal / unit', type: 'number' },
      { key: 'protein_per_unit', label: 'Protein / unit', type: 'number' },
      { key: 'carb_per_unit', label: 'Carbs / unit', type: 'number' },
      { key: 'lipid_per_unit', label: 'Fat / unit', type: 'number' }
    ],
    impact: []
  };
}

/**
 * Which meals silently break if this ingredient disappears.
 *
 * This is the app's documented sharp edge: meals reference ingredients with no
 * foreign key, and hydrateMeal substitutes a zero-macro placeholder when an id
 * stops resolving. The meal keeps rendering and keeps looking correct while
 * weighing nothing — so the only chance to notice is right here, before the
 * delete happens.
 */
function ingredientDeleteImpact(ingredientId) {
  const affected = dataStore.meals.filter((meal) =>
    meal.ingredients.some((entry) => entry.item?.id === ingredientId)
  );

  if (!affected.length) return [];

  return [
    {
      severity: 'warn',
      text: `Used by ${affected.length} meal${affected.length === 1 ? '' : 's'}: ${affected
        .map((m) => m.name)
        .join(', ')}. Those meals will keep their line item but count zero calories for it.`
    }
  ];
}

function mealDeleteImpact(mealId) {
  const slots = [];
  const dayNames = getScheduleDays();

  dataStore.schedule.forEach((day, dayIndex) => {
    (day.slots || []).forEach((slot) => {
      if (slot.mealId === mealId) {
        slots.push(`${dayNames[dayIndex] || `Day ${dayIndex + 1}`} ${slot.slot}`);
      }
    });
  });

  if (!slots.length) return [];

  return [
    {
      severity: 'warn',
      text: `Scheduled in ${slots.length} slot${slots.length === 1 ? '' : 's'}: ${slots.join(', ')}. Those will show "Unassigned meal".`
    }
  ];
}

function normalizeMeal(entry) {
  const existing = getMealById(entry.id);

  if (entry.op === 'delete') {
    if (!existing) return null;
    return {
      kind: 'meal',
      op: 'delete',
      id: entry.id,
      label: existing.name,
      before: { name: existing.name, type: existing.type },
      after: null,
      fields: [],
      impact: mealDeleteImpact(entry.id)
    };
  }

  const after = {
    id: entry.id,
    name: entry.name ?? existing?.name ?? '',
    type: entry.type ?? existing?.type ?? 'Lunch',
    ingredients:
      entry.ingredients ??
      existing?.ingredients.map((e) => ({ itemId: e.item?.id, quantity: e.quantity })) ??
      [],
    instructions:
      entry.instructions ?? existing?.instructions.map((i) => ({ name: i.name, steps: [...i.steps] })) ?? []
  };

  return {
    kind: 'meal',
    op: existing ? 'update' : 'create',
    id: entry.id,
    label: after.name,
    before: existing ? { name: existing.name, type: existing.type } : null,
    after,
    fields: [
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'type', label: 'Type', type: 'select', options: ['Breakfast', 'Lunch', 'Snack', 'Dinner'] }
    ],
    impact: []
  };
}

function normalizeScheduleDay(entry, pendingMeals) {
  const dayIndex = num(entry.day);
  const current = dataStore.schedule[dayIndex];
  const dayNames = getScheduleDays();

  const resolveName = (mealId) => {
    if (!mealId) return 'nothing';
    const pending = pendingMeals.find((m) => m.id === mealId);
    if (pending) return pending.after?.name || mealId;
    return getMealById(mealId)?.name || 'unknown meal';
  };

  const slotChanges = (entry.slots || []).map((slot) => ({
    slot: slot.slot,
    mealId: slot.mealId ?? null,
    fromName: resolveName(current?.slots?.find((s) => s.slot === slot.slot)?.mealId),
    toName: resolveName(slot.mealId)
  }));

  return {
    kind: 'schedule',
    op: 'update',
    id: `day-${dayIndex}`,
    label: dayNames[dayIndex] || `Day ${dayIndex + 1}`,
    before: null,
    after: { day: dayIndex, isCheatDay: entry.isCheatDay, slots: slotChanges },
    fields: [],
    impact: []
  };
}

function normalizeSupplements(entry) {
  const parts = [];
  if (Number.isFinite(entry.waterConsumedMl)) parts.push(`water to ${entry.waterConsumedMl} ml`);
  if (Number.isFinite(entry.bottleSizeMl)) parts.push(`bottle size to ${entry.bottleSizeMl} ml`);
  for (const c of entry.completed || []) {
    parts.push(`${c.id} ${c.done ? 'taken' : 'not taken'}`);
  }

  if (!parts.length) return null;

  return {
    kind: 'supplements',
    op: 'update',
    id: 'supplements-today',
    label: "Today's tracking",
    before: null,
    after: entry,
    fields: [
      { key: 'waterConsumedMl', label: 'Water today (ml)', type: 'number' },
      { key: 'bottleSizeMl', label: 'Bottle size (ml)', type: 'number' }
    ],
    summaryText: parts.join(', '),
    impact: []
  };
}

function normalizeProfile(entry) {
  const before = state.profile || {};
  const keys = ['age', 'sex', 'weight', 'height', 'activityLevel', 'goalWeight', 'goalMonths'];
  const after = {};
  let changed = false;

  for (const key of keys) {
    const value = entry[key];
    after[key] = value === null || value === undefined ? before[key] : value;
    if (value !== null && value !== undefined && value !== before[key]) changed = true;
  }

  if (!changed) return null;

  return {
    kind: 'profile',
    op: 'update',
    id: 'profile',
    label: 'Body profile',
    before: { ...before },
    after,
    fields: [
      { key: 'weight', label: 'Weight (kg)', type: 'number' },
      { key: 'height', label: 'Height (cm)', type: 'number' },
      { key: 'age', label: 'Age', type: 'number' },
      { key: 'goalWeight', label: 'Goal weight (kg)', type: 'number' },
      { key: 'goalMonths', label: 'Timeframe (months)', type: 'number' }
    ],
    impact: [
      {
        severity: 'info',
        text: 'Changing this recalculates your maintenance and target calories, which shifts every macro target in the app.'
      }
    ]
  };
}

/**
 * Turn raw tool arguments into the flat change list the UI renders.
 */
export function normalizeProposal(proposal) {
  const raw = proposal.raw || {};
  const changes = [];

  for (const entry of raw.ingredients || []) {
    const change = normalizeIngredient(entry);
    if (change) changes.push(change);
  }

  const mealChanges = (raw.meals || []).map(normalizeMeal).filter(Boolean);
  changes.push(...mealChanges);

  for (const entry of raw.schedule || []) {
    changes.push(normalizeScheduleDay(entry, mealChanges));
  }

  if (raw.supplements) {
    const change = normalizeSupplements(raw.supplements);
    if (change) changes.push(change);
  }

  if (raw.profile) {
    const change = normalizeProfile(raw.profile);
    if (change) changes.push(change);
  }

  return { ...proposal, changes };
}

/* ----------------------------------------------------------------- apply */

/**
 * Apply an accepted proposal.
 *
 * Order is not cosmetic: a meal that references a newly created ingredient only
 * resolves once that ingredient is in the store, and a schedule slot pointing at
 * a new meal only resolves once the meal exists. Ingredients, then meals, then
 * everything else.
 *
 * Each collection follows the app's existing optimistic pattern — snapshot,
 * swap, save, restore on failure — so a partial failure leaves the store as it
 * was rather than half-applied.
 */
export async function applyProposal(normalized) {
  const changes = normalized.changes || [];
  const applied = [];

  const ingredientChanges = changes.filter((c) => c.kind === 'ingredient');
  const mealChanges = changes.filter((c) => c.kind === 'meal');
  const scheduleChanges = changes.filter((c) => c.kind === 'schedule');
  const supplementChange = changes.find((c) => c.kind === 'supplements');
  const profileChange = changes.find((c) => c.kind === 'profile');

  if (ingredientChanges.length) {
    const previous = [...dataStore.ingredients];
    let next = [...dataStore.ingredients];

    for (const change of ingredientChanges) {
      if (change.op === 'delete') {
        next = next.filter((i) => i.id !== change.id);
      } else {
        const item = new FoodItem({
          id: change.after.id,
          name: change.after.name,
          category: change.after.category,
          unit: change.after.unit,
          kcal: num(change.after.kcal),
          protein_per_unit: num(change.after.protein_per_unit),
          carb_per_unit: num(change.after.carb_per_unit),
          lipid_per_unit: num(change.after.lipid_per_unit)
        });
        const at = next.findIndex((i) => i.id === item.id);
        if (at >= 0) next[at] = item;
        else next.push(item);
      }
      applied.push(change);
    }

    setIngredients(next);
    if (!(await saveIngredients())) {
      setIngredients(previous);
      return { ok: false, applied: [] };
    }
  }

  if (mealChanges.length) {
    const previous = [...dataStore.meals];
    let next = [...dataStore.meals];

    for (const change of mealChanges) {
      if (change.op === 'delete') {
        next = next.filter((m) => m.id !== change.id);
      } else {
        const meal = buildMeal(change.after);
        const at = next.findIndex((m) => m.id === meal.id);
        if (at >= 0) next[at] = meal;
        else next.push(meal);
      }
      applied.push(change);
    }

    setMeals(next);
    if (!(await saveMeals())) {
      setMeals(previous);
      return { ok: false, applied: [] };
    }
  }

  if (scheduleChanges.length) {
    const previous = dataStore.schedule;
    const next = withScheduleChanges(scheduleChanges);

    setSchedule(next);
    if (!(await saveSchedule())) {
      setSchedule(previous);
      return { ok: false, applied: [] };
    }
    applied.push(...scheduleChanges);
  }

  if (supplementChange) {
    await applySupplementChanges({
      waterConsumedMl: Number(supplementChange.after.waterConsumedMl),
      bottleSizeMl: Number(supplementChange.after.bottleSizeMl),
      completed: supplementChange.after.completed
    });
    applied.push(supplementChange);
  }

  if (profileChange) {
    updateProfile(profileChange.after);
    const metrics = calculateProfileMetrics(state.profile);
    if (metrics) {
      updateProfile({
        maintenanceCalories: metrics.maintenanceCalories,
        recommendedCalories: metrics.recommendedCalories
      });
    }
    await flushState();
    applied.push(profileChange);
  }

  return { ok: true, applied };
}

/**
 * Build a Meal from proposal data, resolving each itemId against the store.
 *
 * Ingredients are applied first, so anything created in this same proposal is
 * already present by the time this runs. A still-unresolved id keeps the app's
 * existing placeholder behaviour rather than dropping the line.
 */
function buildMeal(after) {
  const entries = (after.ingredients || []).map((entry) => {
    const item =
      dataStore.ingredients.find((i) => i.id === entry.itemId) ||
      new FoodItem({
        id: entry.itemId,
        name: entry.itemName || 'Unknown',
        unit: entry.itemUnit || '',
        kcal: 0,
        protein_per_unit: 0,
        carb_per_unit: 0,
        lipid_per_unit: 0
      });

    return new FoodItemEntry({ item, quantity: num(entry.quantity) });
  });

  return new Meal({
    id: after.id,
    name: after.name,
    type: after.type,
    ingredients: entries,
    instructions: (after.instructions || []).map(
      (i) => new CookingInstruction({ name: i.name, steps: i.steps })
    )
  });
}

/**
 * Merge day-level schedule edits into a full week.
 *
 * The schedule may be empty (the user never built one), so this materializes a
 * blank week first — otherwise scheduling a single meal into day 3 would
 * produce a one-element array and the week views would render one day.
 */
export function withScheduleChanges(scheduleChanges, base = dataStore.schedule) {
  const week = [];

  for (let i = 0; i < 7; i++) {
    const existing = base[i];
    week.push({
      day: i,
      isCheatDay: existing?.isCheatDay || false,
      slots: SLOTS.map((slot) => {
        const found = existing?.slots?.find((s) => s.slot === slot);
        return {
          slot,
          mealId: found?.mealId ?? null,
          time: found?.time || defaultTimeForSlot(slot)
        };
      })
    });
  }

  for (const change of scheduleChanges) {
    const day = week[change.after.day];
    if (!day) continue;

    if (change.after.isCheatDay === true) {
      week.forEach((d, i) => {
        d.isCheatDay = i === change.after.day;
      });
      day.slots.forEach((s) => {
        s.mealId = null;
      });
      continue;
    }

    if (change.after.isCheatDay === false) day.isCheatDay = false;

    for (const slotChange of change.after.slots || []) {
      const slot = day.slots.find((s) => s.slot === slotChange.slot);
      if (slot) {
        slot.mealId = slotChange.mealId;
        day.isCheatDay = false;
      }
    }
  }

  return week;
}

/**
 * What actually landed, echoed back to the model so its picture of the database
 * matches reality even when the user edited the card before accepting.
 */
export function describeApplied(applied) {
  return applied.map((change) => ({
    kind: change.kind,
    op: change.op,
    id: change.id,
    values: change.after
  }));
}

export { SLOTS };
