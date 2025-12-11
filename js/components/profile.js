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
}
