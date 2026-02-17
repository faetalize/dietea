/**
 * Supplements Tracker UI Component
 * Daily supplement adherence + hydration tracking
 */

import { state } from '../services/state.js';
import { showToast } from '../utils/feedback.js';

const STORAGE_KEY = 'mealPrepSupplementsState';

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

function getGoals() {
  const weight = getWeightKg();
  const waterGoalMl = Math.round(weight * 35);
  const proteinGoalG = Math.round(weight * 1.6);
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

function loadTrackerState() {
  const fallback = getDefaultTrackerState();

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;

    const parsed = JSON.parse(raw);
    const merged = {
      ...fallback,
      ...(parsed || {}),
      completed: typeof parsed?.completed === 'object' && parsed.completed !== null ? parsed.completed : {}
    };

    if (merged.day !== todayKey()) {
      return { ...merged, day: todayKey(), completed: {}, waterConsumed: 0 };
    }

    return merged;
  } catch {
    return fallback;
  }
}

function saveTrackerState(nextState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
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
        <h3>Water Intake</h3>
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

    const trackerState = loadTrackerState();
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

    saveTrackerState(trackerState);
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
