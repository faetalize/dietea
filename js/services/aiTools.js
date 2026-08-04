/**
 * Live Dietea tools exposed to the model.
 *
 * Reads resolve against the current in-memory application state at call time;
 * none of this data is duplicated into the prompt. Writes are proposal tools:
 * they stage typed changes for the existing approval UI and never mutate data
 * directly.
 */

import { aggregateShoppingList, dataStore, getMealById } from '../core/dataStore.js';
import { getSupplementCatalog } from '../core/supplementCatalog.js';
import { DAY_NAMES } from '../utils/helpers.js';
import { calculateMacroTargets, getActivityLevelLabel, MACRO_STRATEGY } from './calories.js';
import { getCurrentDayIndex, getScheduleDays } from './scheduleInfo.js';
import { state } from './state.js';

const EMPTY_OBJECT = {
  type: 'object',
  additionalProperties: false,
  required: [],
  properties: {}
};

const INGREDIENT_ITEM = {
  type: 'object',
  additionalProperties: false,
  required: ['op', 'id', 'name', 'category', 'unit', 'kcal', 'protein_per_unit', 'carb_per_unit', 'lipid_per_unit'],
  properties: {
    op: { type: 'string', enum: ['create', 'update', 'delete'] },
    id: {
      type: 'string',
      description:
        'For update/delete, the exact existing id. For create, a new lowercase-hyphenated id that related meal changes can reference.'
    },
    name: { type: ['string', 'null'] },
    category: { type: ['string', 'null'] },
    unit: { type: ['string', 'null'], description: 'The unit each macro value describes, such as g, ml, or piece.' },
    kcal: { type: ['number', 'null'], description: 'Calories per one unit, retaining useful precision.' },
    protein_per_unit: { type: ['number', 'null'] },
    carb_per_unit: { type: ['number', 'null'] },
    lipid_per_unit: { type: ['number', 'null'] }
  }
};

const MEAL_ITEM = {
  type: 'object',
  additionalProperties: false,
  required: ['op', 'id', 'name', 'type', 'ingredients', 'instructions'],
  properties: {
    op: { type: 'string', enum: ['create', 'update', 'delete'] },
    id: { type: 'string', description: 'Existing id for update/delete; a new lowercase-hyphenated id for create.' },
    name: { type: ['string', 'null'] },
    type: { type: ['string', 'null'], enum: ['Breakfast', 'Lunch', 'Snack', 'Dinner', null] },
    ingredients: {
      type: ['array', 'null'],
      description: 'Complete ingredient list. On update, this replaces the existing list.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['itemId', 'quantity'],
        properties: {
          itemId: { type: 'string', description: 'Existing ingredient id or one created in the same composite proposal.' },
          quantity: { type: 'number' }
        }
      }
    },
    instructions: {
      type: ['array', 'null'],
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'steps'],
        properties: {
          name: { type: 'string' },
          steps: { type: 'array', items: { type: 'string' } }
        }
      }
    }
  }
};

const SCHEDULE_ITEM = {
  type: 'object',
  additionalProperties: false,
  required: ['day', 'isCheatDay', 'slots'],
  properties: {
    day: { type: 'integer', minimum: 0, maximum: 6, description: 'Zero-based day index returned by get_schedule.' },
    isCheatDay: { type: ['boolean', 'null'] },
    slots: {
      type: ['array', 'null'],
      description: 'Only slots being changed; omitted slots remain unchanged.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['slot', 'mealId'],
        properties: {
          slot: { type: 'string', enum: ['breakfast', 'lunch', 'snack', 'dinner'] },
          mealId: { type: ['string', 'null'] }
        }
      }
    }
  }
};

const SUPPLEMENTS_ITEM = {
  type: 'object',
  additionalProperties: false,
  required: ['waterConsumedMl', 'bottleSizeMl', 'completed'],
  properties: {
    waterConsumedMl: { type: ['number', 'null'], description: 'Absolute total for today, not a delta.' },
    bottleSizeMl: { type: ['number', 'null'] },
    completed: {
      type: ['array', 'null'],
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'done'],
        properties: {
          id: { type: 'string', description: 'Exact id returned by get_supplements.' },
          done: { type: 'boolean' }
        }
      }
    }
  }
};

const PROFILE_ITEM = {
  type: 'object',
  additionalProperties: false,
  required: ['age', 'sex', 'weight', 'height', 'activityLevel', 'goalWeight', 'goalMonths'],
  properties: {
    age: { type: ['integer', 'null'] },
    sex: { type: ['string', 'null'], enum: ['male', 'female', null] },
    weight: { type: ['number', 'null'], description: 'Kilograms.' },
    height: { type: ['number', 'null'], description: 'Centimetres.' },
    activityLevel: { type: ['number', 'null'], enum: [1.2, 1.375, 1.55, 1.725, 1.9, null] },
    goalWeight: { type: ['number', 'null'], description: 'Kilograms.' },
    goalMonths: { type: ['integer', 'null'] }
  }
};

const SHOPPING_ITEM = {
  type: 'object',
  additionalProperties: false,
  required: ['trackingId', 'checked'],
  properties: {
    trackingId: { type: 'string', description: 'Exact trackingId returned by get_shopping_list.' },
    checked: { type: 'boolean', description: 'Whether the item is marked as acquired.' }
  }
};

const SUMMARY = {
  type: 'string',
  description: 'One plain sentence describing the proposed change, shown to the user.'
};

function proposalParameters(domain, schema) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['summary', domain],
    properties: {
      summary: SUMMARY,
      [domain]: schema
    }
  };
}

export const AI_TOOLS = [
  {
    type: 'function',
    name: 'list_ingredients',
    description: 'List or search the live ingredient database. Use null filters to list everything, with pagination.',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['query', 'category', 'offset', 'limit'],
      properties: {
        query: { type: ['string', 'null'], description: 'Case-insensitive name/id search, or null.' },
        category: { type: ['string', 'null'], description: 'Exact category filter, or null.' },
        offset: { type: 'integer', minimum: 0 },
        limit: { type: 'integer', minimum: 1, maximum: 100 }
      }
    }
  },
  {
    type: 'function',
    name: 'get_ingredient',
    description: 'Read one live ingredient by exact id, including precise per-unit macros.',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['ingredientId'],
      properties: { ingredientId: { type: 'string' } }
    }
  },
  {
    type: 'function',
    name: 'list_meals',
    description: 'List or search live meals with macro totals. Use get_meal for full ingredients and instructions.',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['query', 'type', 'offset', 'limit'],
      properties: {
        query: { type: ['string', 'null'], description: 'Case-insensitive name/id search, or null.' },
        type: { type: ['string', 'null'], enum: ['Breakfast', 'Lunch', 'Snack', 'Dinner', null] },
        offset: { type: 'integer', minimum: 0 },
        limit: { type: 'integer', minimum: 1, maximum: 100 }
      }
    }
  },
  {
    type: 'function',
    name: 'get_meal',
    description: 'Read one live meal by exact id, including ingredient quantities, macro totals, and instructions.',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['mealId'],
      properties: { mealId: { type: 'string' } }
    }
  },
  {
    type: 'function',
    name: 'get_schedule',
    description: 'Read the live weekly schedule. Pass null for the entire week or a zero-based day index for one day.',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['day'],
      properties: { day: { type: ['integer', 'null'], minimum: 0, maximum: 6 } }
    }
  },
  {
    type: 'function',
    name: 'get_profile',
    description: 'Read the live body profile, calorie calculations, activity label, goals, macro targets, and the strategy used to derive those targets.',
    strict: true,
    parameters: EMPTY_OBJECT
  },
  {
    type: 'function',
    name: 'get_supplements',
    description: "Read today's live hydration and supplement tracker plus the complete supplement catalog.",
    strict: true,
    parameters: EMPTY_OBJECT
  },
  {
    type: 'function',
    name: 'get_shopping_list',
    description: 'Read the live shopping list derived from the current schedule and meals.',
    strict: true,
    parameters: EMPTY_OBJECT
  },
  {
    type: 'function',
    name: 'propose_ingredient_changes',
    description: 'Stage ingredient creates, updates, or deletes for user review. Does not write data.',
    strict: true,
    parameters: proposalParameters('ingredients', { type: 'array', items: INGREDIENT_ITEM })
  },
  {
    type: 'function',
    name: 'propose_meal_changes',
    description: 'Stage meal creates, updates, or deletes for user review. Does not write data.',
    strict: true,
    parameters: proposalParameters('meals', { type: 'array', items: MEAL_ITEM })
  },
  {
    type: 'function',
    name: 'propose_schedule_changes',
    description: 'Stage weekly schedule edits for user review. Does not write data.',
    strict: true,
    parameters: proposalParameters('schedule', { type: 'array', items: SCHEDULE_ITEM })
  },
  {
    type: 'function',
    name: 'propose_supplement_changes',
    description: "Stage changes to today's hydration or supplement tracking for user review. Does not write data.",
    strict: true,
    parameters: proposalParameters('supplements', SUPPLEMENTS_ITEM)
  },
  {
    type: 'function',
    name: 'propose_profile_changes',
    description: 'Stage body profile or goal changes for user review. Does not write data.',
    strict: true,
    parameters: proposalParameters('profile', PROFILE_ITEM)
  },
  {
    type: 'function',
    name: 'propose_shopping_changes',
    description: 'Stage shopping-list checkoff changes for user review. Does not write data.',
    strict: true,
    parameters: proposalParameters('shopping', { type: 'array', items: SHOPPING_ITEM })
  },
  {
    type: 'function',
    name: 'propose_changes',
    description:
      'Stage one atomic, cross-domain proposal for user review. Use when related ingredient, meal, schedule, supplement, or profile changes belong together. Does not write data.',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['summary', 'ingredients', 'meals', 'schedule', 'supplements', 'profile', 'shopping'],
      properties: {
        summary: SUMMARY,
        ingredients: { type: ['array', 'null'], items: INGREDIENT_ITEM },
        meals: { type: ['array', 'null'], items: MEAL_ITEM },
        schedule: { type: ['array', 'null'], items: SCHEDULE_ITEM },
        supplements: { anyOf: [SUPPLEMENTS_ITEM, { type: 'null' }] },
        profile: { anyOf: [PROFILE_ITEM, { type: 'null' }] },
        shopping: { type: ['array', 'null'], items: SHOPPING_ITEM }
      }
    }
  }
];

function serializeIngredient(item) {
  return {
    id: item.id,
    name: item.name,
    category: item.category || 'Uncategorized',
    unit: item.unit,
    kcal: item.kcal,
    protein_per_unit: item.protein_per_unit,
    carb_per_unit: item.carb_per_unit,
    lipid_per_unit: item.lipid_per_unit
  };
}

function serializeMeal(meal, full = false) {
  const result = {
    id: meal.id,
    name: meal.name,
    type: meal.type,
    macros: meal.macros,
    ingredientCount: meal.ingredients.length
  };

  if (!full) return result;

  return {
    ...result,
    ingredients: meal.ingredients.map((entry) => ({
      itemId: entry.item?.id,
      name: entry.item?.name,
      quantity: entry.quantity,
      unit: entry.item?.unit,
      macros: entry.macros
    })),
    instructions: meal.instructions.map((instruction) => ({
      name: instruction.name,
      steps: [...instruction.steps]
    }))
  };
}

function page(items, offset, limit) {
  const safeOffset = Math.max(0, Number(offset) || 0);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 50));
  const results = items.slice(safeOffset, safeOffset + safeLimit);
  const nextOffset = safeOffset + results.length;

  return {
    total: items.length,
    offset: safeOffset,
    limit: safeLimit,
    nextOffset: nextOffset < items.length ? nextOffset : null,
    results
  };
}

function listIngredients({ query, category, offset, limit }) {
  const needle = String(query || '').trim().toLowerCase();
  const categoryName = String(category || '').trim().toLowerCase();
  const matches = dataStore.ingredients
    .filter((item) => !needle || `${item.id} ${item.name}`.toLowerCase().includes(needle))
    .filter((item) => !categoryName || String(item.category || '').toLowerCase() === categoryName)
    .map(serializeIngredient);

  return page(matches, offset, limit);
}

function getIngredient({ ingredientId }) {
  const item = dataStore.ingredients.find((ingredient) => ingredient.id === ingredientId);
  return item ? serializeIngredient(item) : { error: `No ingredient with id "${ingredientId}".` };
}

function listMeals({ query, type, offset, limit }) {
  const needle = String(query || '').trim().toLowerCase();
  const matches = dataStore.meals
    .filter((meal) => !needle || `${meal.id} ${meal.name}`.toLowerCase().includes(needle))
    .filter((meal) => !type || meal.type === type)
    .map((meal) => serializeMeal(meal));

  return page(matches, offset, limit);
}

function getMeal({ mealId }) {
  const meal = getMealById(mealId);
  return meal ? serializeMeal(meal, true) : { error: `No meal with id "${mealId}".` };
}

function serializeScheduleDay(scheduleDay, index, names) {
  const slots = (scheduleDay?.slots || []).map((slot) => {
    const meal = slot.mealId ? getMealById(slot.mealId) : null;
    return {
      slot: slot.slot,
      time: slot.time,
      mealId: slot.mealId ?? null,
      mealName: meal?.name ?? null,
      macros: meal?.macros ?? null
    };
  });
  const totals = slots.reduce(
    (sum, slot) => ({
      kcal: sum.kcal + Number(slot.macros?.kcal || 0),
      protein: sum.protein + Number(slot.macros?.protein || 0),
      carbs: sum.carbs + Number(slot.macros?.carbs || 0),
      lipids: sum.lipids + Number(slot.macros?.lipids || 0)
    }),
    { kcal: 0, protein: 0, carbs: 0, lipids: 0 }
  );

  return {
    day: index,
    name: names[index] || `Day ${index + 1}`,
    isToday: index === getCurrentDayIndex(),
    isCheatDay: !!scheduleDay?.isCheatDay,
    slots,
    totals
  };
}

function getSchedule({ day }) {
  const names = getScheduleDays();
  const days = dataStore.schedule.map((entry, index) => serializeScheduleDay(entry, index, names));
  const selected = day === null || day === undefined ? days : days.filter((entry) => entry.day === day);

  return {
    empty: dataStore.schedule.length === 0,
    weekStartsOn: DAY_NAMES[state.startDay],
    todayIndex: getCurrentDayIndex(),
    days: selected
  };
}

function getProfile() {
  const profile = { ...(state.profile || {}) };
  const targetCalories = profile.recommendedCalories || profile.maintenanceCalories;
  const macroTargets = targetCalories ? calculateMacroTargets(targetCalories, profile.weight) : null;

  return {
    isComplete: !!(profile.age && profile.weight && profile.height),
    profile,
    activityLabel: getActivityLevelLabel(profile.activityLevel),
    macroTargets,
    macroStrategy: {
      protein: {
        policy: 'fixed_per_body_weight',
        gramsPerKg: MACRO_STRATEGY.proteinGramsPerKg
      },
      fats: {
        policy: 'target_per_body_weight_with_calorie_limited_floor',
        targetGramsPerKg: MACRO_STRATEGY.fatTargetGramsPerKg,
        floorGramsPerKg: MACRO_STRATEGY.fatFloorGramsPerKg
      },
      carbs: {
        policy: 'fill_remaining_calories_after_protein_and_fats'
      },
      calorieConstraint:
        'If protein plus target fat exceeds the calorie budget, reduce fat toward its floor before allowing carbohydrates to reach zero.'
    }
  };
}

function getSupplements(tracker) {
  const weight = Number(state.profile?.weight);
  const proteinGoalG = Math.round((Number.isFinite(weight) && weight > 0 ? weight : 75) * 1.6);
  const completed = tracker?.completed || {};
  const supplements = getSupplementCatalog(proteinGoalG).map((item) => ({
    ...item,
    done: !!completed[item.id]
  }));

  return {
    day: tracker?.day || null,
    hydration: {
      waterConsumedMl: Number(tracker?.waterConsumed) || 0,
      bottleSizeMl: Number(tracker?.bottleSize) || 0,
      waterGoalMl: Number(tracker?.goals?.waterGoalMl) || null
    },
    completedCount: supplements.filter((item) => item.done).length,
    supplements
  };
}

function slugify(value = '') {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function getShoppingList() {
  return {
    categories: aggregateShoppingList().map((category) => ({
      ...category,
      items: category.items.map((item, index) => {
        const trackingId = `${slugify(category.category)}-${item.id || index}`;
        return {
          ...item,
          trackingId,
          checked: !!state.checkedItems[trackingId]
        };
      })
    }))
  };
}

function proposalPayload(name, args) {
  const base = {
    summary: args.summary || 'Proposed changes',
    ingredients: null,
    meals: null,
    schedule: null,
    supplements: null,
    profile: null,
    shopping: null
  };

  switch (name) {
    case 'propose_ingredient_changes':
      return { ...base, ingredients: args.ingredients };
    case 'propose_meal_changes':
      return { ...base, meals: args.meals };
    case 'propose_schedule_changes':
      return { ...base, schedule: args.schedule };
    case 'propose_supplement_changes':
      return { ...base, supplements: args.supplements };
    case 'propose_profile_changes':
      return { ...base, profile: args.profile };
    case 'propose_shopping_changes':
      return { ...base, shopping: args.shopping };
    case 'propose_changes':
      return args;
    default:
      return null;
  }
}

const PROPOSAL_TOOL_NAMES = new Set([
  'propose_ingredient_changes',
  'propose_meal_changes',
  'propose_schedule_changes',
  'propose_supplement_changes',
  'propose_profile_changes',
  'propose_shopping_changes',
  'propose_changes'
]);

export function isProposalTool(name) {
  return PROPOSAL_TOOL_NAMES.has(name);
}

export function proposalFromToolCall(call) {
  let args = {};
  try {
    args = call.arguments ? JSON.parse(call.arguments) : {};
  } catch {
    return { error: 'Arguments were not valid JSON.' };
  }

  const proposal = proposalPayload(call.name, args);
  return proposal ? { proposal } : { error: `Unknown proposal tool "${call.name}".` };
}

/** Merge focused proposal calls from one model response into one review card. */
export function mergeProposalPayloads(payloads) {
  const merged = {
    summary: '',
    ingredients: [],
    meals: [],
    schedule: [],
    supplements: null,
    profile: null,
    shopping: []
  };
  const summaries = [];

  for (const payload of payloads) {
    if (!payload) continue;
    if (payload.summary && !summaries.includes(payload.summary)) summaries.push(payload.summary);
    merged.ingredients.push(...(payload.ingredients || []));
    merged.meals.push(...(payload.meals || []));
    merged.schedule.push(...(payload.schedule || []));
    if (payload.supplements) merged.supplements = payload.supplements;
    if (payload.profile) merged.profile = payload.profile;
    merged.shopping.push(...(payload.shopping || []));
  }

  merged.summary = summaries.join(' ') || 'Proposed changes';
  if (!merged.ingredients.length) merged.ingredients = null;
  if (!merged.meals.length) merged.meals = null;
  if (!merged.schedule.length) merged.schedule = null;
  if (!merged.shopping.length) merged.shopping = null;
  return merged;
}

/** Execute a model function call against current app state. */
export function executeAiTool(call, { supplements, stageProposal } = {}) {
  let args = {};
  try {
    args = call.arguments ? JSON.parse(call.arguments) : {};
  } catch {
    return { error: 'Arguments were not valid JSON.' };
  }

  switch (call.name) {
    case 'list_ingredients':
      return listIngredients(args);
    case 'get_ingredient':
      return getIngredient(args);
    case 'list_meals':
      return listMeals(args);
    case 'get_meal':
      return getMeal(args);
    case 'get_schedule':
      return getSchedule(args);
    case 'get_profile':
      return getProfile();
    case 'get_supplements':
      return getSupplements(supplements);
    case 'get_shopping_list':
      return getShoppingList();
    default: {
      const proposal = proposalPayload(call.name, args);
      return proposal && stageProposal ? stageProposal(proposal) : { error: `Unknown tool "${call.name}".` };
    }
  }
}
