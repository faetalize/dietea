import test from 'node:test';
import assert from 'node:assert/strict';

import { FoodItem, FoodItemEntry, Meal } from '../js/core/models.js';
import { dataStore, setIngredients, setMeals, setSchedule } from '../js/core/dataStore.js';
import { state } from '../js/services/state.js';
import { buildRuntimeContext } from '../js/services/aiContext.js';
import {
  AI_TOOLS,
  executeAiTool,
  mergeProposalPayloads,
  proposalFromToolCall
} from '../js/services/aiTools.js';

const expectedTools = [
  'list_ingredients',
  'get_ingredient',
  'list_meals',
  'get_meal',
  'get_schedule',
  'get_profile',
  'get_supplements',
  'get_shopping_list',
  'propose_ingredient_changes',
  'propose_meal_changes',
  'propose_schedule_changes',
  'propose_supplement_changes',
  'propose_profile_changes',
  'propose_shopping_changes',
  'propose_changes'
];

function call(name, args = {}, supplements) {
  return executeAiTool(
    { name, arguments: JSON.stringify(args) },
    { supplements }
  );
}

function seedStore() {
  const broccoli = new FoodItem({
    id: 'broccoli',
    name: 'Broccoli',
    category: 'Vegetables',
    unit: 'g',
    kcal: 0.34,
    protein_per_unit: 0.028,
    carb_per_unit: 0.066,
    lipid_per_unit: 0.004
  });
  const meal = new Meal({
    id: 'broccoli-bowl',
    name: 'Broccoli bowl',
    type: 'Lunch',
    ingredients: [new FoodItemEntry({ item: broccoli, quantity: 100 })],
    instructions: []
  });

  setIngredients([broccoli]);
  setMeals([meal]);
  setSchedule([
    {
      day: 0,
      isCheatDay: false,
      slots: [{ slot: 'lunch', mealId: meal.id, time: '12:30' }]
    }
  ]);
}

function restoreStore(snapshot) {
  setIngredients(snapshot.ingredients);
  setMeals(snapshot.meals);
  setSchedule(snapshot.schedule);
}

test('exposes live reads plus focused and atomic approval-gated writes', () => {
  assert.deepEqual(AI_TOOLS.map((tool) => tool.name), expectedTools);
  assert.ok(AI_TOOLS.every((tool) => tool.strict === true));
});

test('strict tool schemas require every declared object property', () => {
  function inspect(schema, path) {
    if (!schema || typeof schema !== 'object') return;
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (types.includes('object')) {
      const properties = Object.keys(schema.properties || {}).sort();
      const required = [...(schema.required || [])].sort();
      assert.deepEqual(required, properties, `${path} must require all properties`);
      assert.equal(schema.additionalProperties, false, `${path} must reject extra properties`);
    }
    for (const [key, child] of Object.entries(schema.properties || {})) inspect(child, `${path}.${key}`);
    if (schema.items) inspect(schema.items, `${path}[]`);
    (schema.anyOf || []).forEach((child, index) => inspect(child, `${path}.anyOf[${index}]`));
  }

  for (const tool of AI_TOOLS) inspect(tool.parameters, tool.name);
});

test('read tools resolve current app objects at execution time', () => {
  const snapshot = {
    ingredients: dataStore.ingredients,
    meals: dataStore.meals,
    schedule: dataStore.schedule
  };

  try {
    seedStore();

    const ingredients = call('list_ingredients', {
      query: 'broc',
      category: null,
      offset: 0,
      limit: 25
    });
    assert.equal(ingredients.total, 1);
    assert.equal(ingredients.results[0].id, 'broccoli');

    const meal = call('get_meal', { mealId: 'broccoli-bowl' });
    assert.equal(meal.ingredients[0].itemId, 'broccoli');
    assert.equal(meal.macros.kcal, 34);

    const schedule = call('get_schedule', { day: null });
    assert.equal(schedule.days[0].slots[0].mealName, 'Broccoli bowl');
    assert.equal(schedule.days[0].totals.kcal, 34);

    const shopping = call('get_shopping_list');
    assert.equal(shopping.categories[0].items[0].quantity, 100);
    assert.equal(shopping.categories[0].items[0].trackingId, 'vegetables-broccoli');
    assert.equal(shopping.categories[0].items[0].checked, false);
  } finally {
    restoreStore(snapshot);
  }
});

test('supplement reads use the current tracker snapshot supplied by the UI', () => {
  const result = call(
    'get_supplements',
    {},
    {
      day: '2026-08-04',
      completed: { creatine: true },
      waterConsumed: 1500,
      bottleSize: 750,
      goals: { waterGoalMl: 2200 }
    }
  );

  assert.equal(result.day, '2026-08-04');
  assert.equal(result.hydration.waterGoalMl, 2200);
  assert.equal(result.supplements.find((item) => item.id === 'creatine').done, true);
});

test('profile reads explicitly expose the macro strategy behind the targets', () => {
  const oldProfile = { ...state.profile };
  try {
    Object.assign(state.profile, {
      age: 30,
      weight: 110,
      height: 180,
      maintenanceCalories: 2600,
      recommendedCalories: 2292
    });

    const result = call('get_profile');
    assert.equal(result.macroStrategy.protein.gramsPerKg, 1.6);
    assert.equal(result.macroStrategy.fats.targetGramsPerKg, 0.8);
    assert.equal(result.macroStrategy.fats.floorGramsPerKg, 0.6);
    assert.equal(result.macroStrategy.carbs.policy, 'fill_remaining_calories_after_protein_and_fats');
    assert.equal(result.macroTargets.proteinG, 176);
  } finally {
    state.profile = oldProfile;
  }
});

test('focused proposal calls merge into one atomic review payload without writing', () => {
  const before = dataStore.schedule;
  const ingredientCall = {
    name: 'propose_ingredient_changes',
    arguments: JSON.stringify({
      summary: 'Add spinach.',
      ingredients: [
        {
          op: 'create',
          id: 'spinach',
          name: 'Spinach',
          category: 'Vegetables',
          unit: 'g',
          kcal: 0.23,
          protein_per_unit: 0.029,
          carb_per_unit: 0.036,
          lipid_per_unit: 0.004
        }
      ]
    })
  };
  const scheduleCall = {
    name: 'propose_schedule_changes',
    arguments: JSON.stringify({
      summary: 'Plan Monday lunch.',
      schedule: [{ day: 0, isCheatDay: null, slots: [{ slot: 'lunch', mealId: 'broccoli-bowl' }] }]
    })
  };

  const first = proposalFromToolCall(ingredientCall).proposal;
  const second = proposalFromToolCall(scheduleCall).proposal;
  const merged = mergeProposalPayloads([first, second]);

  assert.equal(merged.ingredients[0].id, 'spinach');
  assert.equal(merged.schedule[0].day, 0);
  assert.match(merged.summary, /Add spinach/);
  assert.match(merged.summary, /Plan Monday lunch/);
  assert.equal(dataStore.schedule, before);
});

test('runtime context does not dump live app data into every prompt', () => {
  const snapshot = {
    ingredients: dataStore.ingredients,
    meals: dataStore.meals,
    schedule: dataStore.schedule
  };
  const oldWeight = state.profile.weight;

  try {
    seedStore();
    state.profile.weight = 123.456;
    const context = buildRuntimeContext();

    assert.doesNotMatch(context, /Broccoli/i);
    assert.doesNotMatch(context, /123\.456/);
    assert.match(context, /Live application data is available through the provided tools/);
  } finally {
    state.profile.weight = oldWeight;
    restoreStore(snapshot);
  }
});
