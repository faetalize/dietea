/**
 * Profile UI (settings profile card + edit modal)
 */

import { state, updateProfile } from '../services/state.js';
import {
  calculateProfileMetrics,
  getActivityLevelLabel,
  isGoalRealistic
} from '../services/calories.js';
import { showToast, showFieldError, clearValidationErrors } from '../utils/feedback.js';

const MACRO_COLORS = {
  protein: 'var(--primary)',
  carbs: 'var(--secondary)',
  fats: 'var(--meal-lunch)'
};

const MACRO_VIEW_MODES = ['percent', 'kcal', 'grams'];
let macroViewIndex = 0;

function el(id) {
  return document.getElementById(id);
}

export function renderProfileCard() {
  const profile = state.profile;
  if (!profile) return;

  const statsSummary = el('profile-stats-summary');
  const activityLabel = el('profile-activity-label');
  const maintenanceEl = el('profile-maintenance');
  const targetEl = el('profile-target');
  const differenceEl = el('profile-difference');
  const goalTextEl = el('profile-goal-text');
  const proteinRangeEl = el('profile-protein-range');
  const macroViewLabelEl = el('macro-view-label');
  const macroValuesEl = el('macro-breakdown-values');
  const macroWheelEl = el('macro-wheel');

  if (profile.age && profile.weight && profile.height) {
    statsSummary.textContent = `${profile.age}y, ${profile.weight}kg, ${profile.height}cm, ${profile.sex}`;
  } else {
    statsSummary.textContent = 'Profile not set';
  }

  activityLabel.textContent = getActivityLevelLabel(profile.activityLevel);

  maintenanceEl.textContent = profile.maintenanceCalories ? `${profile.maintenanceCalories} kcal` : '-- kcal';
  targetEl.textContent = profile.recommendedCalories ? `${profile.recommendedCalories} kcal` : '-- kcal';

  if (profile.maintenanceCalories && profile.recommendedCalories) {
    const diff = profile.maintenanceCalories - profile.recommendedCalories;
    if (diff > 0) {
      differenceEl.textContent = `-${diff} kcal`;
      differenceEl.className = 'calorie-value calorie-deficit';
    } else if (diff < 0) {
      differenceEl.textContent = `+${Math.abs(diff)} kcal`;
      differenceEl.className = 'calorie-value calorie-surplus';
    } else {
      differenceEl.textContent = '0 kcal';
      differenceEl.className = 'calorie-value';
    }
  } else {
    differenceEl.textContent = '--';
    differenceEl.className = 'calorie-value';
  }

  if (profile.goalWeight && profile.goalMonths && profile.weight) {
    const weightChange = profile.weight - profile.goalWeight;
    const direction = weightChange > 0 ? 'lose' : weightChange < 0 ? 'gain' : 'maintain';

    const goalCheck = isGoalRealistic(profile.weight, profile.goalWeight, profile.goalMonths);
    const goalEl = goalTextEl.closest('.profile-goal');

    if (direction === 'maintain') {
      goalTextEl.textContent = `Maintain ${profile.weight}kg`;
      goalEl?.classList.remove('profile-goal-warning');
    } else {
      let goalText = `${direction === 'lose' ? 'Lose' : 'Gain'} ${Math.abs(weightChange).toFixed(1)}kg in ${profile.goalMonths} month${profile.goalMonths > 1 ? 's' : ''} → ${profile.goalWeight}kg`;

      if (!goalCheck.isRealistic) {
        goalText += ` ⚠️ (${goalCheck.weeklyChange.toFixed(1)}kg/week is aggressive — recommend ${goalCheck.recommendedMonths}+ months)`;
        goalEl?.classList.add('profile-goal-warning');
      } else {
        goalEl?.classList.remove('profile-goal-warning');
      }

      goalTextEl.textContent = goalText;
    }
  } else {
    goalTextEl.textContent = 'No goal set';
    goalTextEl.closest('.profile-goal')?.classList.remove('profile-goal-warning');
  }

  const weight = Number(profile.weight);
  const proteinMin = Number.isFinite(weight) && weight > 0 ? Math.round(weight * 1.0) : null;
  const proteinMax = Number.isFinite(weight) && weight > 0 ? Math.round(weight * 1.6) : null;
  if (proteinRangeEl) {
    proteinRangeEl.textContent = proteinMin && proteinMax ? `${proteinMin} g - ${proteinMax} g` : '-- g - -- g';
  }

  const targetCalories = profile.recommendedCalories || profile.maintenanceCalories || 2000;
  renderMacroBreakdown(targetCalories, macroViewLabelEl, macroValuesEl, macroWheelEl);
}

function renderMacroBreakdown(targetCalories, modeEl, valuesEl, wheelEl) {
  const mode = MACRO_VIEW_MODES[macroViewIndex];
  const weight = Number(state.profile?.weight);
  const safeWeight = Number.isFinite(weight) && weight > 0 ? weight : 75;

  const proteinG = Math.round(safeWeight * 1.6);
  const proteinKcal = proteinG * 4;

  const fatTargetG = Math.round(safeWeight * 0.8);
  const fatFloorG = Math.round(safeWeight * 0.6);
  const maxFatByRemaining = Math.max(0, Math.floor((targetCalories - proteinKcal) / 9));

  let fatsG = fatTargetG;
  if (fatsG > maxFatByRemaining) {
    fatsG = Math.max(Math.min(fatFloorG, maxFatByRemaining), 0);
  }

  const fatsKcal = fatsG * 9;
  const carbsKcal = Math.max(0, targetCalories - proteinKcal - fatsKcal);
  const carbsG = Math.round(carbsKcal / 4);
  const noteEl = el('macro-breakdown-note');

  const proteinPct = targetCalories > 0 ? Math.round((proteinKcal / targetCalories) * 100) : 0;
  const fatsPct = targetCalories > 0 ? Math.round((fatsKcal / targetCalories) * 100) : 0;
  const carbsPct = Math.max(0, 100 - proteinPct - fatsPct);

  const rowsByMode = {
    percent: [
      { key: 'protein', label: 'Protein', value: `${proteinPct}%` },
      { key: 'carbs', label: 'Carbs', value: `${carbsPct}%` },
      { key: 'fats', label: 'Fats', value: `${fatsPct}%` }
    ],
    kcal: [
      { key: 'protein', label: 'Protein', value: `${proteinKcal} kcal` },
      { key: 'carbs', label: 'Carbs', value: `${carbsKcal} kcal` },
      { key: 'fats', label: 'Fats', value: `${fatsKcal} kcal` }
    ],
    grams: [
      { key: 'protein', label: 'Protein', value: `${proteinG} g` },
      { key: 'carbs', label: 'Carbs', value: `${carbsG} g` },
      { key: 'fats', label: 'Fats', value: `${fatsG} g` }
    ]
  };

  if (modeEl) {
    const modeLabels = { percent: 'Percent', kcal: 'Calories', grams: 'Grams' };
    modeEl.textContent = modeLabels[mode] || 'Percent';
  }

  if (valuesEl) {
    valuesEl.innerHTML = rowsByMode[mode]
      .map((row) => `
        <div class="profile-macro-row">
          <span class="profile-macro-left">
            <span class="profile-macro-dot" style="background:${MACRO_COLORS[row.key]}"></span>
            ${row.label}
          </span>
          <strong>${row.value}</strong>
        </div>
      `)
      .join('');
  }

  if (wheelEl) {
    const proteinEnd = proteinPct;
    const carbsEnd = proteinPct + carbsPct;
    wheelEl.style.background = `conic-gradient(${MACRO_COLORS.protein} 0 ${proteinEnd}%, ${MACRO_COLORS.carbs} ${proteinEnd}% ${carbsEnd}%, ${MACRO_COLORS.fats} ${carbsEnd}% 100%)`;
  }

  if (noteEl) {
    const fatMode = fatsG < fatTargetG ? 'calorie-limited floor mode' : 'standard fat target mode';
    noteEl.textContent = `Rules: protein = 1.6g/kg (${proteinG}g), fat target = 0.8g/kg (${fatTargetG}g), fat floor = 0.6g/kg (${fatFloorG}g). Current: ${fatMode}; carbs fill remaining calories.`;
  }
}

function cycleMacroView() {
  macroViewIndex = (macroViewIndex + 1) % MACRO_VIEW_MODES.length;
  renderProfileCard();
}

function openEditProfileModal() {
  const profile = state.profile || {};
  const modal = el('edit-profile-modal');

  el('edit-profile-age').value = profile.age || '';
  el('edit-profile-sex').value = profile.sex || 'male';
  el('edit-profile-weight').value = profile.weight || '';
  el('edit-profile-height').value = profile.height || '';
  el('edit-profile-activity').value = profile.activityLevel || 1.55;
  el('edit-profile-goal-weight').value = profile.goalWeight || '';
  el('edit-profile-goal-months').value = profile.goalMonths || '';

  modal?.classList.remove('hidden');
}

function closeEditProfileModal() {
  const modal = el('edit-profile-modal');
  modal?.classList.add('hidden');
  clearValidationErrors(modal);
}

function handleSaveProfile() {
  const modal = el('edit-profile-modal');

  const age = parseInt(el('edit-profile-age')?.value, 10);
  const sex = el('edit-profile-sex')?.value || 'male';
  const weight = parseFloat(el('edit-profile-weight')?.value);
  const height = parseFloat(el('edit-profile-height')?.value);
  const activityLevel = parseFloat(el('edit-profile-activity')?.value) || 1.55;
  const goalWeight = parseFloat(el('edit-profile-goal-weight')?.value);
  const goalMonths = parseInt(el('edit-profile-goal-months')?.value, 10);

  clearValidationErrors(modal);
  let hasError = false;

  if (!age || age < 15 || age > 100) {
    showFieldError(el('edit-profile-age'), 'Please enter a valid age (15-100)');
    hasError = true;
  }
  if (!weight || weight < 30 || weight > 300) {
    showFieldError(el('edit-profile-weight'), 'Please enter a valid weight (30-300 kg)');
    hasError = true;
  }
  if (!height || height < 100 || height > 250) {
    showFieldError(el('edit-profile-height'), 'Please enter a valid height (100-250 cm)');
    hasError = true;
  }
  if (!goalWeight || goalWeight < 30 || goalWeight > 300) {
    showFieldError(el('edit-profile-goal-weight'), 'Please enter a valid goal weight (30-300 kg)');
    hasError = true;
  }
  if (!goalMonths || goalMonths < 1 || goalMonths > 24) {
    showFieldError(el('edit-profile-goal-months'), 'Please enter a valid timeframe (1-24 months)');
    hasError = true;
  }

  if (hasError) return;

  updateProfile({
    age,
    sex,
    weight,
    height,
    activityLevel,
    goalWeight,
    goalMonths,
    maintenanceCalories: null,
    recommendedCalories: null
  });

  const metrics = calculateProfileMetrics(state.profile);
  if (metrics) {
    updateProfile({
      maintenanceCalories: metrics.maintenanceCalories,
      recommendedCalories: metrics.recommendedCalories
    });
  }

  renderProfileCard();
  closeEditProfileModal();
  showToast('Profile updated', 'success');
}

export function setupProfileListeners() {
  el('edit-profile-btn')?.addEventListener('click', openEditProfileModal);
  el('save-edit-profile')?.addEventListener('click', handleSaveProfile);
  el('cancel-edit-profile')?.addEventListener('click', closeEditProfileModal);

  const macroCard = el('macro-breakdown-card');
  if (macroCard && !macroCard.dataset.bound) {
    macroCard.addEventListener('click', cycleMacroView);
    macroCard.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        cycleMacroView();
      }
    });
    macroCard.dataset.bound = 'true';
  }
}
