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
    // AI preferences are deliberately NOT secret and live as plain columns, so
    // the settings panel can render before the credential vault is unlocked.
    // `vault` is ciphertext — see js/services/credentials.js.
    ai: {
      vault: null,
      model: 'gpt-5.6-terra',
      provider: 'apikey',
      reasoningEffort: 'medium'
    },
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
    ai: {
      vault: row.ai_vault && typeof row.ai_vault === 'object' ? row.ai_vault : null,
      model: row.ai_model || base.ai.model,
      provider: row.ai_provider || base.ai.provider,
      reasoningEffort: row.ai_reasoning_effort || base.ai.reasoningEffort
    },
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
    ai_vault: state.ai.vault,
    ai_model: state.ai.model,
    ai_provider: state.ai.provider,
    ai_reasoning_effort: state.ai.reasoningEffort,
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
 * Merge into the AI preference block. Kept separate from updateState() because
 * that one replaces top-level keys wholesale, which would silently drop the
 * vault whenever a caller only meant to change the model.
 */
export function updateAiSettings(updates) {
  state.ai = { ...state.ai, ...updates };
  saveState();
}

/**
 * Reset to defaults and persist immediately.
 *
 * Credentials survive. "Delete all data" means the meal plan, not the account —
 * the user stays signed into Supabase, so logging them out of OpenAI as a side
 * effect would be surprising, and re-linking Codex is not a trivial step.
 */
export async function resetState() {
  requireUserId();
  const credentials = state.ai;
  state = defaultState();
  state.ai = credentials;
  return flushState();
}
