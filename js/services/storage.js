/**
 * Storage Service
 *
 * Persists ingredients, meals, and the schedule to Supabase.
 *
 * The save functions keep their original whole-collection contract — callers
 * still hand over the full array and get a boolean back — so the existing
 * snapshot / mutate / roll-back-on-false pattern in the components is unchanged.
 * Each sync upserts what is present and deletes what is gone. That is a few
 * round trips rather than one, which is fine at this scale (tens of rows) but
 * is not atomic: a failure between the upsert and the delete can leave a
 * removed row behind. Worth revisiting as a single RPC if the data grows.
 */

import { dataStore } from '../core/dataStore.js';
import { serializeMeal } from '../core/mealSerde.js';
import { supabase, describeError } from './supabase.js';
import { requireUserId } from './auth.js';
import { showToast } from '../utils/feedback.js';

/**
 * Upsert every row and delete the ones that are no longer in the collection.
 */
async function syncTable(table, rows, userId) {
  if (rows.length) {
    const { error } = await supabase.from(table).upsert(rows, { onConflict: 'user_id,id' });
    if (error) throw error;
  }

  const { data: existing, error: readError } = await supabase.from(table).select('id');
  if (readError) throw readError;

  const keep = new Set(rows.map((row) => row.id));
  const removed = (existing || []).map((row) => row.id).filter((id) => !keep.has(id));

  if (removed.length) {
    const { error } = await supabase.from(table).delete().eq('user_id', userId).in('id', removed);
    if (error) throw error;
  }
}

/**
 * Persist the ingredient collection. Returns false and toasts on failure so the
 * caller can restore its snapshot.
 */
export async function saveIngredients() {
  try {
    const userId = requireUserId();
    const rows = dataStore.ingredients.map((item) => ({
      user_id: userId,
      id: item.id,
      name: item.name,
      category: item.category || 'Uncategorized',
      unit: item.unit,
      kcal: Number(item.kcal) || 0,
      carb_per_unit: Number(item.carb_per_unit) || 0,
      protein_per_unit: Number(item.protein_per_unit) || 0,
      lipid_per_unit: Number(item.lipid_per_unit) || 0
    }));

    await syncTable('ingredients', rows, userId);
    return true;
  } catch (err) {
    console.error('Failed to save ingredients', err);
    showToast(describeError(err), 'error');
    return false;
  }
}

export async function saveMeals() {
  try {
    const userId = requireUserId();
    const rows = dataStore.meals.map((meal) => {
      const serialized = serializeMeal(meal);
      return {
        user_id: userId,
        id: serialized.id,
        name: serialized.name,
        type: serialized.type,
        ingredients: serialized.ingredients,
        instructions: serialized.instructions
      };
    });

    await syncTable('meals', rows, userId);
    return true;
  } catch (err) {
    console.error('Failed to save meals', err);
    showToast(describeError(err), 'error');
    return false;
  }
}

/**
 * The schedule is a single row per user, so this is a plain upsert.
 * Now async — callers that care about failure should await it.
 */
export async function saveSchedule() {
  try {
    const userId = requireUserId();
    const { error } = await supabase
      .from('schedules')
      .upsert({ user_id: userId, days: dataStore.schedule }, { onConflict: 'user_id' });

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Failed to save schedule', err);
    showToast(describeError(err), 'error');
    return false;
  }
}
