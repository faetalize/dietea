/**
 * Loads ingredients and meals from Supabase.
 *
 * ingredients.json and menu.json are no longer the database — they survive only
 * as the starter dataset seeded into a brand new account, so a fresh sign-up
 * lands in a usable app instead of an empty one.
 */

import { FoodItem } from './models.js';
import { supabase, assertOk } from '../services/supabase.js';
import { requireUserId } from '../services/auth.js';

/**
 * Column list matches the FoodItem constructor exactly, so rows need no mapping.
 */
const INGREDIENT_COLUMNS = 'id, name, category, unit, kcal, carb_per_unit, protein_per_unit, lipid_per_unit';
const MEAL_COLUMNS = 'id, name, type, ingredients, instructions';

export async function loadIngredients() {
  const { data, error } = await supabase
    .from('ingredients')
    .select(INGREDIENT_COLUMNS)
    .order('name');

  assertOk(error, 'Could not load ingredients');
  return (data || []).map((row) => new FoodItem(row));
}

/**
 * Returns plain objects, not Meal instances — pass them through hydrateMeal so
 * each itemId resolves against the already-loaded ingredients.
 */
export async function loadMeals() {
  const { data, error } = await supabase
    .from('meals')
    .select(MEAL_COLUMNS)
    .order('name');

  assertOk(error, 'Could not load meals');
  return data || [];
}

export async function loadSchedule() {
  const { data, error } = await supabase
    .from('schedules')
    .select('days')
    .maybeSingle();

  assertOk(error, 'Could not load schedule');
  return Array.isArray(data?.days) ? data.days : [];
}

/**
 * Seed a new account from the bundled JSON.
 *
 * Only runs when the account has no ingredients and no meals at all, so it can
 * never overwrite real data — a user who deliberately deleted everything gets
 * the starter set back, which matches what the old "delete all data" did.
 */
export async function seedStarterData() {
  const userId = requireUserId();

  const [bundledIngredients, bundledMeals] = await Promise.all([
    fetchJson('./ingredients.json'),
    fetchJson('./menu.json')
  ]);

  if (bundledIngredients.length) {
    const rows = bundledIngredients.map((item) => ({
      user_id: userId,
      id: item.id,
      name: item.name,
      category: item.category || 'Uncategorized',
      unit: item.unit,
      kcal: item.kcal ?? 0,
      carb_per_unit: item.carb_per_unit ?? 0,
      protein_per_unit: item.protein_per_unit ?? 0,
      lipid_per_unit: item.lipid_per_unit ?? 0
    }));

    const { error } = await supabase.from('ingredients').upsert(rows, { onConflict: 'user_id,id' });
    assertOk(error, 'Could not seed ingredients');
  }

  if (bundledMeals.length) {
    const rows = bundledMeals.map((meal) => ({
      user_id: userId,
      id: meal.id,
      name: meal.name,
      type: meal.type,
      ingredients: meal.ingredients || [],
      instructions: meal.instructions || []
    }));

    const { error } = await supabase.from('meals').upsert(rows, { onConflict: 'user_id,id' });
    assertOk(error, 'Could not seed meals');
  }

  return {
    ingredients: bundledIngredients.length,
    meals: bundledMeals.length
  };
}

/**
 * True when the account has never been populated.
 *
 * Deliberately a plain `select ... limit 1` rather than a `head: true` count.
 * A HEAD response carries no body, so a failed HEAD gives supabase-js an error
 * with no code and no message — which stripped the actionable text off the very
 * first request the app makes. Fetching one row is also cheaper than an exact
 * count, which has to scan.
 */
export async function isAccountEmpty() {
  const [ingredients, meals] = await Promise.all([
    supabase.from('ingredients').select('id').limit(1),
    supabase.from('meals').select('id').limit(1)
  ]);

  assertOk(ingredients.error, 'Could not check ingredients');
  assertOk(meals.error, 'Could not check meals');

  return !ingredients.data?.length && !meals.data?.length;
}

async function fetchJson(url) {
  try {
    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) return [];
    const parsed = await response.json();
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn(`Could not read starter data from ${url}`, err);
    return [];
  }
}
