/**
 * Session snapshot handed to the model each turn.
 *
 * Written as compact text rather than JSON: the model reads it about as well
 * either way, and a hundred ingredients as one line each is far cheaper than
 * the same data wrapped in braces and quotes.
 *
 * What is deliberately left out: cooking instructions. A full recipe is the
 * single biggest thing in this dataset and is almost never relevant to the turn
 * at hand, so it is fetched on demand through the `get_meal` tool instead.
 */

import { dataStore } from '../core/dataStore.js';
import { state } from './state.js';
import { calculateMacroTargets, getActivityLevelLabel } from './calories.js';
import { DAY_NAMES } from '../utils/helpers.js';
import { getCurrentMealSlot, getCurrentDayIndex, getScheduleDays } from './scheduleInfo.js';

function formatProfile() {
  const p = state.profile || {};
  if (!p.age || !p.weight || !p.height) {
    return 'Profile: not set up yet. The user has not completed onboarding.';
  }

  const target = p.recommendedCalories || p.maintenanceCalories;
  const macros = target ? calculateMacroTargets(target, p.weight) : null;

  const lines = [
    `Profile: ${p.age}y ${p.sex}, ${p.weight} kg, ${p.height} cm, ${getActivityLevelLabel(p.activityLevel)}`,
    `Maintenance: ${p.maintenanceCalories ?? '?'} kcal/day. Daily target: ${p.recommendedCalories ?? '?'} kcal/day.`
  ];

  if (p.goalWeight && p.goalMonths) {
    lines.push(`Goal: ${p.weight} kg to ${p.goalWeight} kg over ${p.goalMonths} month(s).`);
  }

  if (macros) {
    lines.push(
      `Daily macro targets: ${macros.proteinG} g protein, ${macros.carbsG} g carbs, ${macros.fatsG} g fat` +
        (macros.isFatLimited ? ' (fat reduced to its floor to fit the calorie target).' : '.')
    );
  }

  return lines.join('\n');
}

function formatIngredients() {
  const items = dataStore.ingredients;
  if (!items.length) return 'Ingredients: none.';

  const lines = items.map(
    (i) =>
      `- ${i.id} | ${i.name} | ${i.category || 'Uncategorized'} | per 1 ${i.unit}: ` +
      `${i.kcal} kcal, ${i.protein_per_unit} p, ${i.carb_per_unit} c, ${i.lipid_per_unit} f`
  );

  return `Ingredients (${items.length}), as "id | name | category | per-unit macros":\n${lines.join('\n')}`;
}

function formatMeals() {
  const meals = dataStore.meals;
  if (!meals.length) return 'Meals: none.';

  const lines = meals.map((m) => {
    const macros = m.macros;
    return (
      `- ${m.id} | ${m.name} | ${m.type} | ${Math.round(macros.kcal)} kcal, ` +
      `${Math.round(macros.protein)} g protein | ${m.ingredients.length} ingredient(s)`
    );
  });

  return `Meals (${meals.length}), as "id | name | type | totals | count":\n${lines.join('\n')}`;
}

function formatSchedule() {
  const schedule = dataStore.schedule;
  if (!schedule.length) return 'Schedule: empty. No meals are planned this week.';

  const names = getScheduleDays();
  const todayIndex = getCurrentDayIndex();

  const lines = schedule.map((day, i) => {
    const marker = i === todayIndex ? ' (today)' : '';
    if (day.isCheatDay) return `- Day ${i + 1} ${names[i]}${marker}: cheat day, nothing scheduled`;

    const slots = (day.slots || [])
      .map((slot) => {
        const meal = dataStore.meals.find((m) => m.id === slot.mealId);
        return `${slot.slot}=${meal ? meal.name : 'none'}`;
      })
      .join(', ');

    return `- Day ${i + 1} ${names[i]}${marker}: ${slots}`;
  });

  return `Schedule (week starts ${DAY_NAMES[state.startDay]}):\n${lines.join('\n')}`;
}

function formatToday(supplements) {
  const now = new Date();
  const date = now.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const time = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const slot = getCurrentMealSlot();

  const lines = [`Now: ${date}, ${time}.${slot ? ` It is around ${slot} time.` : ''}`];

  if (supplements) {
    const taken = Object.values(supplements.completed || {}).filter(Boolean).length;
    lines.push(
      `Today so far: ${supplements.waterConsumed} ml water logged, ${taken} supplement(s) ticked off. ` +
        `Bottle size ${supplements.bottleSize} ml.`
    );
  }

  return lines.join('\n');
}

/**
 * Build the snapshot. `supplements` is passed in rather than imported to keep
 * this in the services layer — components import services, not the reverse.
 */
export function buildSessionContext(supplements) {
  return [
    formatToday(supplements),
    '',
    formatProfile(),
    '',
    formatSchedule(),
    '',
    formatMeals(),
    '',
    formatIngredients()
  ].join('\n');
}
