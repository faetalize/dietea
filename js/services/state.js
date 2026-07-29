/**
 * State Management
 *
 * Profile and app preferences live in dietea.profiles, one row per user.
 *
 * `state` stays a synchronously readable object so components are unchanged;
 * writes are pushed to Supabase on a short debounce. That matters for the
 * shopping list, where every checkbox toggle calls saveState() — without it
 * a shopping trip would be one request per tap. Call flushState() when a write
 * must land before moving on, such as finishing onboarding.
 */

import { supabase, describeError } from './supabase.js';
import { requireUserId, getCurrentUserId } from './auth.js';

const SAVE_DEBOUNCE_MS = 400;

function defaultState() {
  return {
    onboarded: false,
    startDay: 1,
    checkedItems: {},
    profile: {
      age: null,
      sex: 'male',
      weight: null,       // in kg
      height: null,       // in cm
      activityLevel: 1.55, // moderate
      goalWeight: null,   // in kg
      goalMonths: null,   // timeframe in months
      maintenanceCalories: null,
      recommendedCalories: null
    }
  };
}

export let state = defaultState();

let saveTimer = null;
let pendingSave = null;

function num(value) {
  return value === null || value === undefined ? null : Number(value);
}

function rowToState(row) {
  const base = defaultState();
  if (!row) return base;

  return {
    onboarded: !!row.onboarded,
    startDay: row.start_day ?? base.startDay,
    checkedItems: row.checked_items && typeof row.checked_items === 'object' ? row.checked_items : {},
    profile: {
      age: row.age ?? null,
      sex: row.sex || 'male',
      weight: num(row.weight_kg),
      height: num(row.height_cm),
      activityLevel: num(row.activity_level) ?? 1.55,
      goalWeight: num(row.goal_weight_kg),
      goalMonths: row.goal_months ?? null,
      maintenanceCalories: row.maintenance_calories ?? null,
      recommendedCalories: row.recommended_calories ?? null
    }
  };
}

function stateToRow(userId) {
  return {
    user_id: userId,
    onboarded: state.onboarded,
    start_day: state.startDay,
    checked_items: state.checkedItems,
    age: state.profile.age,
    sex: state.profile.sex,
    weight_kg: state.profile.weight,
    height_cm: state.profile.height,
    activity_level: state.profile.activityLevel,
    goal_weight_kg: state.profile.goalWeight,
    goal_months: state.profile.goalMonths,
    maintenance_calories: state.profile.maintenanceCalories,
    recommended_calories: state.profile.recommendedCalories
  };
}

/**
 * Load the signed-in user's row, creating it on first run.
 */
export async function loadState() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('Could not load profile', error);
    throw new Error(describeError(error));
  }

  state = rowToState(data);

  if (!data) {
    // First sign-in: materialize the row so later saves are plain updates.
    await writeState();
  }

  return state;
}

async function writeState() {
  const userId = getCurrentUserId();
  if (!userId) return false;

  const { error } = await supabase
    .from('profiles')
    .upsert(stateToRow(userId), { onConflict: 'user_id' });

  if (error) {
    console.error('Could not save profile', error);
    return false;
  }
  return true;
}

/**
 * Queue a debounced save. Fire-and-forget by design: the UI has already been
 * updated optimistically, and flushState() exists for the cases that must wait.
 */
export function saveState() {
  if (saveTimer) clearTimeout(saveTimer);

  pendingSave = new Promise((resolve) => {
    saveTimer = setTimeout(async () => {
      saveTimer = null;
      const ok = await writeState();
      pendingSave = null;
      resolve(ok);
    }, SAVE_DEBOUNCE_MS);
  });

  return pendingSave;
}

/**
 * Write any queued change immediately and wait for it.
 */
export async function flushState() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
    pendingSave = null;
    return writeState();
  }

  if (pendingSave) return pendingSave;
  return writeState();
}

export function updateState(updates) {
  Object.assign(state, updates);
  saveState();
}

export function updateProfile(profileUpdates) {
  state.profile = {
    ...state.profile,
    ...profileUpdates
  };
  saveState();
}

/**
 * Reset to defaults and persist immediately.
 */
export async function resetState() {
  requireUserId();
  state = defaultState();
  return flushState();
}
