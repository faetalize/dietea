/**
 * Supplements Tracker UI Component
 * Daily supplement adherence + hydration tracking
 */

import { state } from '../services/state.js';
import { supabase, describeError } from '../services/supabase.js';
import { requireUserId } from '../services/auth.js';
import { showToast } from '../utils/feedback.js';

const SUPPLEMENTS = [
  { id: 'd3', name: 'Vitamin D3', timing: 'Morning (with fat)', dosage: '2,000 - 5,000 IU', note: 'Bone health, mood, immunity.' },
  { id: 'k2', name: 'Vitamin K2', timing: 'Morning (with D3)', dosage: '100 mcg', note: 'Helps direct calcium to bones.' },
  { id: 'b12', name: 'Vitamin B12', timing: 'Morning', dosage: 'Daily value+', note: 'Energy and nervous system support.' },
  { id: 'vitc', name: 'Vitamin C', timing: 'Morning', dosage: '500 - 1000 mg', note: 'Immunity and collagen support.' },
  { id: 'ltheanine', name: 'L-Theanine', timing: 'Morning (with coffee)', dosage: '100 - 200 mg', note: 'Calm focus with caffeine.' },
  { id: 'omega3', name: 'Omega-3', timing: 'With meals', dosage: '1,000 mg EPA/DHA', note: 'Heart and brain support.' },
  { id: 'fiber', name: 'Fiber', timing: 'With meals', dosage: '30g+ daily', note: 'Gut health support.' },
  { id: 'creatine', name: 'Creatine', timing: 'Anytime', dosage: '5 g', note: 'Muscle and performance support.' },
  { id: 'collagen', name: 'Collagen Powder', timing: 'Anytime', dosage: '10 - 20 g', note: 'Joint and skin support.' },
  { id: 'taurine', name: 'Taurine', timing: 'Evening / pre-workout', dosage: '1 - 2 g', note: 'Calmness and heart support.' },
  { id: 'magnesium', name: 'Magnesium', timing: 'Evening', dosage: '200 - 400 mg', note: 'Recovery and sleep support.' },
  { id: 'glycine', name: 'Glycine', timing: 'Bedtime', dosage: '3 - 5 g', note: 'Sleep quality support.' },
  { id: 'protein', name: 'Protein Intake', timing: 'Across meals', dosage: '', note: 'Daily target based on body weight.' }
];

function todayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getWeightKg() {
  const weight = Number(state?.profile?.weight);
  if (Number.isFinite(weight) && weight > 0) return weight;
  return 75;
}

/**
 * Total daily fluid need is commonly estimated at ~35 ml per kg of body weight,
 * but that covers ALL water including what comes from food, which is typically
 * 20-30% of the total. This tracker only counts water you actually drink, so
 * the goal is the drinking share of that total — food is assumed to cover the
 * rest rather than being logged.
 */
const TOTAL_FLUID_ML_PER_KG = 35;
const DRINKING_SHARE = 0.75; // assumes ~25% of total water comes from food

/**
 * Fluid needs do not scale linearly with body mass. Fat-free mass is roughly
 * 70-75% water while adipose tissue is only 10-40%, so a straight ml/kg figure
 * overestimates for heavier bodies — at 110 kg the raw number asks for nearly
 * 3 L of drinking water, well past what the estimate actually supports.
 *
 * Clinical practice handles this with adjusted body weight: ideal weight for
 * height, plus a fraction of the excess. Below ideal weight the actual weight
 * is used unchanged, so this only ever tapers the goal and never inflates it.
 *
 * Devine ideal weight and the 0.4 factor are both conventions rather than
 * precision. This is a ballpark by design; thirst remains the better signal,
 * and activity, heat, and sweat move it far more than body weight does.
 */
function getAdjustedWeightKg() {
  const weight = getWeightKg();
  const heightCm = Number(state?.profile?.height);

  // No height on file — fall back to actual weight.
  if (!Number.isFinite(heightCm) || heightCm <= 0) return weight;

  const inchesOverFiveFeet = Math.max(0, heightCm / 2.54 - 60);
  const base = state?.profile?.sex === 'female' ? 45.5 : 50;
  const idealWeight = base + 2.3 * inchesOverFiveFeet;

  if (weight <= idealWeight) return weight;
  return idealWeight + 0.4 * (weight - idealWeight);
}

function getGoals() {
  // Rounded to the nearest 50 ml — this is a ballpark, and a goal of
  // "1,969 ml" would imply precision the estimate does not have.
  const rawGoal = getAdjustedWeightKg() * TOTAL_FLUID_ML_PER_KG * DRINKING_SHARE;
  const waterGoalMl = Math.round(rawGoal / 50) * 50;

  const proteinGoalG = Math.round(getWeightKg() * 1.6);
  return { waterGoalMl, proteinGoalG };
}

function getDefaultTrackerState() {
  return {
    day: todayKey(),
    completed: {},
    waterConsumed: 0,
    bottleSize: 750
  };
}

/**
 * Today's tracker, held in memory so render stays synchronous.
 * Populated by loadSupplementsState() during startup.
 */
let trackerState = getDefaultTrackerState();

function loadTrackerState() {
  return trackerState;
}

function rowToTracker(row) {
  const fallback = getDefaultTrackerState();
  if (!row) return fallback;

  return {
    day: row.day || fallback.day,
    completed: row.completed && typeof row.completed === 'object' ? row.completed : {},
    waterConsumed: Number(row.water_consumed) || 0,
    bottleSize: Number(row.bottle_size) || fallback.bottleSize
  };
}

/**
 * Fetch today's row. A new day simply has no row yet, which is why the table is
 * keyed by (user_id, day) — yesterday's tracking is kept rather than reset over.
 * Carries yesterday's bottle size forward so the preference is not lost.
 */
export async function loadSupplementsState() {
  const today = todayKey();

  const { data, error } = await supabase
    .from('supplement_days')
    .select('day, completed, water_consumed, bottle_size')
    .order('day', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Could not load supplement tracking', error);
    trackerState = getDefaultTrackerState();
    return trackerState;
  }

  const latest = rowToTracker(data);

  trackerState = latest.day === today
    ? latest
    : { ...getDefaultTrackerState(), bottleSize: latest.bottleSize };

  return trackerState;
}

async function saveTrackerState(nextState) {
  trackerState = nextState;

  try {
    const userId = requireUserId();
    const { error } = await supabase.from('supplement_days').upsert({
      user_id: userId,
      day: nextState.day,
      completed: nextState.completed,
      water_consumed: nextState.waterConsumed,
      bottle_size: nextState.bottleSize
    }, { onConflict: 'user_id,day' });

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Could not save supplement tracking', err);
    showToast(describeError(err), 'error');
    return false;
  }
}

/**
 * Drop all persisted supplement tracking for the signed-in user.
 * Used by Settings → Delete all data. The caller re-renders; this stays silent
 * so it can be folded into a larger reset without stacking toasts.
 */
export async function clearSupplementsData() {
  trackerState = getDefaultTrackerState();

  const userId = requireUserId();
  const { error } = await supabase.from('supplement_days').delete().eq('user_id', userId);
  if (error) throw error;
}

function getProteinDosageText() {
  const { proteinGoalG } = getGoals();
  return `${proteinGoalG} g total`;
}

function getDisplaySupplements() {
  return SUPPLEMENTS.map((supplement) => {
    if (supplement.id !== 'protein') return supplement;
    return { ...supplement, dosage: getProteinDosageText() };
  });
}

export function renderSupplements() {
  const root = document.getElementById('supplements-content');
  if (!root) return;

  const trackerState = loadTrackerState();
  const supplements = getDisplaySupplements();
  const { waterGoalMl } = getGoals();
  const completedCount = supplements.filter(item => trackerState.completed[item.id]).length;
  const waterProgress = Math.min(trackerState.waterConsumed / waterGoalMl, 1);
  const totalProgress = Math.round(((completedCount + waterProgress) / (supplements.length + 1)) * 100);

  root.innerHTML = `
    <div class="supplements-summary">
      <div class="supplement-stat">
        <span class="supplement-stat-label">Daily Progress</span>
        <span class="supplement-stat-value">${totalProgress}%</span>
      </div>
      <div class="supplement-stat">
        <span class="supplement-stat-label">Supplements Taken</span>
        <span class="supplement-stat-value">${completedCount}/${supplements.length}</span>
      </div>
      <div class="supplement-stat">
        <span class="supplement-stat-label">Hydration</span>
        <span class="supplement-stat-value">${trackerState.waterConsumed} / ${waterGoalMl} ml</span>
      </div>
    </div>

    <div class="supplements-water-card">
      <div class="supplements-water-header">
        <div class="supplements-water-title">
          <h3>Water Intake</h3>
          <span class="supplements-water-hint">Water you drink — food is assumed to cover the rest</span>
        </div>
        <label class="supplements-inline-setting">
          Bottle (ml)
          <input id="supplements-bottle-size" type="number" min="100" max="2000" step="50" value="${trackerState.bottleSize}">
        </label>
      </div>
      <div class="supplements-progress-track">
        <div class="supplements-progress-fill" style="width: ${waterProgress * 100}%"></div>
      </div>
      <div class="supplements-water-actions">
        <button class="btn btn-secondary" data-action="water-remove">
          <span class="material-symbols-rounded">remove</span>
          Remove Bottle
        </button>
        <button class="btn btn-primary" data-action="water-add">
          <span class="material-symbols-rounded">add</span>
          Add Bottle
        </button>
      </div>
    </div>

    <div class="supplements-list" id="supplements-list">
      ${supplements.map((item) => {
        const checked = !!trackerState.completed[item.id];
        return `
          <article class="supplement-item ${checked ? 'is-complete' : ''}" data-supplement-id="${item.id}">
            <button class="supplement-toggle" data-action="toggle" aria-label="Toggle ${item.name}">
              <span class="material-symbols-rounded">${checked ? 'check_circle' : 'radio_button_unchecked'}</span>
            </button>
            <div class="supplement-main">
              <h3>${item.name}</h3>
              <p>${item.note}</p>
              <div class="supplement-meta">
                <span><strong>Timing:</strong> ${item.timing}</span>
                <span><strong>Dosage:</strong> ${item.dosage}</span>
              </div>
            </div>
          </article>
        `;
      }).join('')}
    </div>
  `;
}

function updateTrackerState(updater) {
  const current = loadTrackerState();
  const nextState = updater(current);
  saveTrackerState(nextState);
  renderSupplements();
}

function resetDay() {
  saveTrackerState(getDefaultTrackerState());
  renderSupplements();
  showToast('Supplements tracker reset for today', 'success');
}

export function setupSupplementsListeners() {
  const supplementsTab = document.getElementById('supplements-tab');
  const resetBtn = document.getElementById('supplements-reset-btn');

  if (!supplementsTab) return;

  supplementsTab.addEventListener('click', (event) => {
    const actionButton = event.target.closest('[data-action]');
    if (!actionButton) return;

    const { waterGoalMl } = getGoals();
    const action = actionButton.dataset.action;

    if (action === 'toggle') {
      const row = actionButton.closest('[data-supplement-id]');
      const supplementId = row?.dataset?.supplementId;
      if (!supplementId) return;

      updateTrackerState((current) => ({
        ...current,
        completed: {
          ...current.completed,
          [supplementId]: !current.completed[supplementId]
        }
      }));
      return;
    }

    if (action === 'water-add') {
      updateTrackerState((current) => ({
        ...current,
        waterConsumed: Math.min(current.waterConsumed + current.bottleSize, waterGoalMl + 1000)
      }));
      return;
    }

    if (action === 'water-remove') {
      updateTrackerState((current) => ({
        ...current,
        waterConsumed: Math.max(0, current.waterConsumed - current.bottleSize)
      }));
      return;
    }

    if (action === 'reset-day') {
      resetDay();
      return;
    }
  });

  supplementsTab.addEventListener('change', (event) => {
    const bottleInput = event.target.closest('#supplements-bottle-size');
    if (!bottleInput) return;

    const bottleSize = Number(bottleInput.value);
    if (!Number.isFinite(bottleSize) || bottleSize < 100 || bottleSize > 2000) {
      showToast('Bottle size must be between 100 and 2000 ml', 'error');
      renderSupplements();
      return;
    }

    updateTrackerState((current) => ({
      ...current,
      bottleSize
    }));
  });

  if (resetBtn) {
    resetBtn.addEventListener('click', () => resetDay());
  }
}
