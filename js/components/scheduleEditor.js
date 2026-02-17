/**
 * Schedule editor + overview
 */

import { dataStore, getMealById, setSchedule } from '../core/dataStore.js';
import { state } from '../services/state.js';
import { saveSchedule } from '../services/storage.js';
import { titleCase, defaultTimeForSlot, DAY_NAMES } from '../utils/helpers.js';
import { showToast } from '../utils/feedback.js';
import { renderSchedule } from './schedule.js';
import { renderShoppingList } from './shopping.js';

let tempSchedule = [];
let tempCheatDay = null;

function initializeEmptySchedule() {
  const days = [];
  for (let i = 0; i < 7; i++) {
    days.push({
      day: i,
      slots: [
        { slot: 'breakfast', mealId: null, time: '7:00 AM' },
        { slot: 'lunch', mealId: null, time: '1:00 PM' },
        { slot: 'snack', mealId: null, time: '4:00 PM' },
        { slot: 'dinner', mealId: null, time: '7:00 PM' }
      ],
      isCheatDay: false
    });
  }
  return days;
}

function getDayNames(count = 7) {
  const days = [];
  for (let i = 0; i < count; i++) {
    const dayIndex = (state.startDay + i) % 7;
    days.push(DAY_NAMES[dayIndex]);
  }
  return days;
}

function getWeeklyCalorieTarget() {
  const dailyTarget = state.profile?.recommendedCalories;
  if (!dailyTarget) return null;
  return dailyTarget * 7;
}

function calculateScheduleCalories(schedule, excludeCheatDay = false) {
  let total = 0;
  schedule.forEach((day) => {
    if (excludeCheatDay && day.isCheatDay) return;
    if (!day.slots) return;
    day.slots.forEach((slot) => {
      if (!slot.mealId) return;
      const meal = getMealById(slot.mealId);
      if (meal) total += meal.macros.kcal;
    });
  });
  return Math.round(total);
}

function calculateDayCalories(day) {
  let total = 0;
  if (!day?.slots) return 0;
  day.slots.forEach((slot) => {
    if (!slot.mealId) return;
    const meal = getMealById(slot.mealId);
    if (meal) total += meal.macros.kcal;
  });
  return Math.round(total);
}

function calculateScheduleNutrition(schedule, excludeCheatDay = false) {
  const totals = {
    kcal: 0,
    protein: 0,
    carbs: 0,
    lipids: 0,
    dayCount: 0
  };

  schedule.forEach((day) => {
    if (excludeCheatDay && day.isCheatDay) return;
    totals.dayCount += 1;

    if (!day.slots) return;
    day.slots.forEach((slot) => {
      if (!slot.mealId) return;
      const meal = getMealById(slot.mealId);
      if (!meal) return;
      totals.kcal += meal.macros.kcal;
      totals.protein += meal.macros.protein;
      totals.carbs += meal.macros.carbs;
      totals.lipids += meal.macros.lipids;
    });
  });

  return totals;
}

function formatMacroPills({ protein, carbs, fats }) {
  return `
    <span class="macro-pill macro-pill-protein">P ${Math.round(protein)}g</span>
    <span class="macro-pill macro-pill-carbs">C ${Math.round(carbs)}g</span>
    <span class="macro-pill macro-pill-fats">F ${Math.round(fats)}g</span>
  `;
}

function updateScheduleCalorieSummary() {
  const weeklyTarget = getWeeklyCalorieTarget();
  const totalCalories = calculateScheduleCalories(tempSchedule, true);
  const cheatDayIndex = tempSchedule.findIndex((d) => d.isCheatDay);

  const weeklyTargetEl = document.getElementById('schedule-weekly-target');
  const totalCaloriesEl = document.getElementById('schedule-total-calories');
  const remainingCaloriesEl = document.getElementById('schedule-remaining-calories');
  const warningEl = document.getElementById('schedule-calorie-warning');
  const cheatDayInfoEl = document.getElementById('schedule-cheat-day-info');
  const cheatDayBudgetEl = document.getElementById('cheat-day-budget');

  if (!weeklyTargetEl || !totalCaloriesEl || !remainingCaloriesEl || !warningEl || !cheatDayInfoEl || !cheatDayBudgetEl) {
    return;
  }

  if (weeklyTarget) {
    weeklyTargetEl.textContent = `${weeklyTarget.toLocaleString()} kcal`;
    totalCaloriesEl.textContent = `${totalCalories.toLocaleString()} kcal`;

    const remaining = weeklyTarget - totalCalories;
    remainingCaloriesEl.textContent = `${remaining.toLocaleString()} kcal`;

    if (remaining < 0) {
      remainingCaloriesEl.classList.add('over-budget');
      remainingCaloriesEl.classList.remove('under-budget');
      warningEl.classList.remove('hidden');
    } else {
      remainingCaloriesEl.classList.remove('over-budget');
      remainingCaloriesEl.classList.add('under-budget');
      warningEl.classList.add('hidden');
    }

    if (cheatDayIndex >= 0 && remaining > 0) {
      cheatDayInfoEl.classList.remove('hidden');
      cheatDayBudgetEl.textContent = remaining.toLocaleString();
    } else {
      cheatDayInfoEl.classList.add('hidden');
    }
  } else {
    weeklyTargetEl.textContent = 'Set profile first';
    totalCaloriesEl.textContent = `${totalCalories.toLocaleString()} kcal`;
    remainingCaloriesEl.textContent = '--';
    warningEl.classList.add('hidden');
    cheatDayInfoEl.classList.add('hidden');
  }
}

function openEditScheduleModal() {
  const modal = document.getElementById('edit-schedule-modal');
  if (!modal) return;

  if (dataStore.schedule.length > 0) {
    tempSchedule = JSON.parse(JSON.stringify(dataStore.schedule));
    tempSchedule.forEach((day) => {
      if (day.isCheatDay === undefined) day.isCheatDay = false;
    });
  } else {
    tempSchedule = initializeEmptySchedule();
  }

  tempCheatDay = tempSchedule.findIndex((d) => d.isCheatDay);
  if (tempCheatDay === -1) tempCheatDay = null;

  renderScheduleEditor();
  updateScheduleCalorieSummary();
  modal.classList.remove('hidden');
}

function closeEditScheduleModal() {
  const modal = document.getElementById('edit-schedule-modal');
  modal?.classList.add('hidden');
  tempSchedule = [];
  tempCheatDay = null;
}

function toggleCheatDay(dayIndex) {
  if (tempSchedule[dayIndex].isCheatDay) {
    tempSchedule[dayIndex].isCheatDay = false;
    tempCheatDay = null;
  } else {
    tempSchedule.forEach((day, i) => {
      day.isCheatDay = i === dayIndex;
    });
    tempCheatDay = dayIndex;
    tempSchedule[dayIndex].slots.forEach((slot) => {
      slot.mealId = null;
    });
  }

  renderScheduleEditor();
  updateScheduleCalorieSummary();
}

function renderScheduleEditor() {
  const grid = document.getElementById('schedule-editor-grid');
  if (!grid) return;

  const days = getDayNames(7);
  const meals = dataStore.meals;

  while (tempSchedule.length < 7) {
    tempSchedule.push({
      day: tempSchedule.length,
      slots: [
        { slot: 'breakfast', mealId: null, time: '7:00 AM' },
        { slot: 'lunch', mealId: null, time: '1:00 PM' },
        { slot: 'snack', mealId: null, time: '4:00 PM' },
        { slot: 'dinner', mealId: null, time: '7:00 PM' }
      ],
      isCheatDay: false
    });
  }

  grid.innerHTML = tempSchedule
    .map((day, dayIndex) => {
      const slots = day.slots || [];
      const isCheatDay = day.isCheatDay || false;
      const dayCalories = calculateDayCalories(day);

      return `
      <div class="schedule-editor-day ${isCheatDay ? 'cheat-day-active' : ''}">
        <div class="schedule-editor-day-header">
          <h3>Day ${dayIndex + 1} — ${days[dayIndex]}</h3>
          <div class="day-header-right">
            <span class="day-calories">${dayCalories} kcal</span>
            <button class="btn-cheat-day ${isCheatDay ? 'active' : ''}" data-day="${dayIndex}" title="${isCheatDay ? 'Remove cheat day' : 'Set as cheat day'}">
              <span class="material-symbols-rounded">celebration</span>
            </button>
          </div>
        </div>
        ${
          isCheatDay
            ? `
          <div class="cheat-day-banner">
            <span class="material-symbols-rounded">celebration</span>
            Cheat Day — meals not scheduled
          </div>
        `
            : `
          <div class="schedule-editor-slots">
            ${['breakfast', 'lunch', 'snack', 'dinner']
              .map((slotType) => {
                const slot = slots.find((s) => s.slot === slotType) || { slot: slotType, mealId: null };
                const selectedMeal = slot.mealId || '';

                const matchingMeals = meals
                  .filter((m) => m.type.toLowerCase() === slotType.toLowerCase())
                  .sort((a, b) => a.name.localeCompare(b.name));
                const otherMeals = meals
                  .filter((m) => m.type.toLowerCase() !== slotType.toLowerCase())
                  .sort((a, b) => a.name.localeCompare(b.name));

                return `
                <div class="schedule-editor-slot">
                  <label class="slot-label">${titleCase(slotType)}</label>
                  <select class="slot-select" data-day="${dayIndex}" data-slot="${slotType}">
                    <option value="">— No meal —</option>
                    ${
                      matchingMeals.length
                        ? `<optgroup label="${titleCase(slotType)} Meals">
                          ${matchingMeals
                            .map(
                              (m) =>
                                `<option value="${m.id}" ${m.id === selectedMeal ? 'selected' : ''}>${m.name} (${m.macros.kcal.toFixed(0)} kcal)</option>`
                            )
                            .join('')}
                        </optgroup>`
                        : ''
                    }
                    ${
                      otherMeals.length
                        ? `<optgroup label="Other Meals">
                          ${otherMeals
                            .map(
                              (m) =>
                                `<option value="${m.id}" ${m.id === selectedMeal ? 'selected' : ''}>${m.name} (${m.macros.kcal.toFixed(0)} kcal)</option>`
                            )
                            .join('')}
                        </optgroup>`
                        : ''
                    }
                  </select>
                </div>
              `;
              })
              .join('')}
          </div>
        `
        }
      </div>
    `;
    })
    .join('');

  grid.querySelectorAll('.slot-select').forEach((select) => {
    select.addEventListener('change', (e) => {
      const dayIndex = parseInt(e.target.dataset.day, 10);
      const slotType = e.target.dataset.slot;
      const mealId = e.target.value || null;

      const slot = tempSchedule[dayIndex].slots.find((s) => s.slot === slotType);
      if (slot) slot.mealId = mealId;

      updateScheduleCalorieSummary();

      const dayEl = e.target.closest('.schedule-editor-day');
      const dayCaloriesEl = dayEl?.querySelector('.day-calories');
      if (dayCaloriesEl) {
        dayCaloriesEl.textContent = `${calculateDayCalories(tempSchedule[dayIndex])} kcal`;
      }
    });
  });

  grid.querySelectorAll('.btn-cheat-day').forEach((btn) => {
    btn.addEventListener('click', () => {
      const dayIndex = parseInt(btn.dataset.day, 10);
      toggleCheatDay(dayIndex);
    });
  });
}

function dedupeMealsById(meals = []) {
  const seen = new Set();
  return meals.filter((meal) => {
    if (!meal?.id || seen.has(meal.id)) return false;
    seen.add(meal.id);
    return true;
  });
}

function randomFrom(list = []) {
  if (!list.length) return null;
  return list[Math.floor(Math.random() * list.length)] || null;
}

function getDailyMacroTargets(dailyCalories) {
  const weight = Number(state.profile?.weight);
  const safeWeight = Number.isFinite(weight) && weight > 0 ? weight : 75;
  const safeCalories = Number.isFinite(dailyCalories) && dailyCalories > 0 ? dailyCalories : 2000;

  const proteinMinG = Math.max(0, Math.round(safeWeight * 1.6));
  const proteinKcal = proteinMinG * 4;

  const fatTargetG = Math.max(0, Math.round(safeWeight * 0.8));
  const fatFloorG = Math.max(0, Math.round(safeWeight * 0.6));
  const maxFatByRemaining = Math.max(0, Math.floor((safeCalories - proteinKcal) / 9));

  let fatsTargetG = fatTargetG;
  if (fatsTargetG > maxFatByRemaining) {
    fatsTargetG = Math.max(Math.min(fatFloorG, maxFatByRemaining), 0);
  }

  const carbsTargetKcal = Math.max(0, safeCalories - proteinKcal - fatsTargetG * 9);
  const carbsTargetG = Math.round(carbsTargetKcal / 4);

  return {
    proteinMinG,
    fatsMinG: Math.min(fatFloorG, maxFatByRemaining),
    proteinTargetG: proteinMinG,
    carbsTargetG,
    fatsTargetG,
    proteinRatio: safeCalories > 0 ? proteinKcal / safeCalories : 0,
    carbsRatio: safeCalories > 0 ? carbsTargetKcal / safeCalories : 0,
    fatsRatio: safeCalories > 0 ? (fatsTargetG * 9) / safeCalories : 0
  };
}

function getRandomizedSlotPools(meals) {
  const breakfast = meals.filter((m) => m.type.toLowerCase() === 'breakfast');
  const lunch = meals.filter((m) => m.type.toLowerCase() === 'lunch');
  const snack = meals.filter((m) => m.type.toLowerCase() === 'snack');
  const dinner = meals.filter((m) => m.type.toLowerCase() === 'dinner');
  const lunchDinnerShared = dedupeMealsById([...lunch, ...dinner]);

  return {
    breakfast: breakfast.length ? breakfast : meals,
    lunch: lunchDinnerShared.length ? lunchDinnerShared : meals,
    snack: snack.length ? snack : meals,
    dinner: lunchDinnerShared.length ? lunchDinnerShared : meals
  };
}

function sumDayMacros(selectedMeals = []) {
  return selectedMeals.reduce(
    (acc, meal) => ({
      kcal: acc.kcal + (meal?.macros?.kcal || 0),
      protein: acc.protein + (meal?.macros?.protein || 0),
      carbs: acc.carbs + (meal?.macros?.carbs || 0),
      lipids: acc.lipids + (meal?.macros?.lipids || 0)
    }),
    { kcal: 0, protein: 0, carbs: 0, lipids: 0 }
  );
}

function scoreDayCandidate(macros, dailyBudget, targets) {
  const proteinShortfall = Math.max(0, targets.proteinMinG - macros.protein);
  const fatsShortfall = Math.max(0, targets.fatsMinG - macros.lipids);
  const minPenalty = proteinShortfall + fatsShortfall;

  const kcal = Math.max(1, macros.kcal);
  const proteinRatio = (macros.protein * 4) / kcal;
  const carbsRatio = (macros.carbs * 4) / kcal;
  const fatsRatio = (macros.lipids * 9) / kcal;

  const ratioPenalty =
    Math.abs(proteinRatio - targets.proteinRatio) +
    Math.abs(carbsRatio - targets.carbsRatio) +
    Math.abs(fatsRatio - targets.fatsRatio);

  const calorieGap = dailyBudget ? Math.max(0, dailyBudget - macros.kcal) : 0;

  return { minPenalty, ratioPenalty, calorieGap };
}

function isBetterScore(next, current) {
  if (!current) return true;
  if (next.minPenalty !== current.minPenalty) return next.minPenalty < current.minPenalty;
  if (Math.abs(next.ratioPenalty - current.ratioPenalty) > 1e-6) return next.ratioPenalty < current.ratioPenalty;
  return next.calorieGap < current.calorieGap;
}

function randomizeDaySlots(slotPools, dailyBudget, targets) {
  const slotOrder = ['breakfast', 'lunch', 'snack', 'dinner'];
  let best = null;

  for (let attempt = 0; attempt < 500; attempt++) {
    const candidateMeals = [];

    for (const slotType of slotOrder) {
      const pool = slotPools[slotType] || [];
      candidateMeals.push(randomFrom(pool));
    }

    const macros = sumDayMacros(candidateMeals);
    if (dailyBudget && macros.kcal > dailyBudget) continue;

    const score = scoreDayCandidate(macros, dailyBudget, targets);
    if (isBetterScore(score, best?.score)) {
      best = { candidateMeals, macros, score };
    }
  }

  if (best) return best;

  const fallbackMeals = [];
  let runningKcal = 0;

  for (const slotType of ['breakfast', 'lunch', 'snack', 'dinner']) {
    const pool = [...(slotPools[slotType] || [])].sort((a, b) => a.macros.kcal - b.macros.kcal);
    const fitting = !dailyBudget ? pool : pool.filter((meal) => runningKcal + meal.macros.kcal <= dailyBudget);
    const chosen = randomFrom(fitting.length ? fitting : pool) || null;
    if (chosen) runningKcal += chosen.macros.kcal;
    fallbackMeals.push(chosen);
  }

  const fallbackMacros = sumDayMacros(fallbackMeals);
  return {
    candidateMeals: fallbackMeals,
    macros: fallbackMacros,
    score: scoreDayCandidate(fallbackMacros, dailyBudget, targets)
  };
}

function autoGenerateSchedule() {
  const meals = dataStore.meals;
  const weeklyTarget = getWeeklyCalorieTarget();

  if (meals.length === 0) {
    showToast('Add some meals first', 'error');
    return;
  }

  const slotPools = getRandomizedSlotPools(meals);

  const existingCheatDay = tempSchedule.findIndex((d) => d.isCheatDay);
  const daysToSchedule = existingCheatDay >= 0 ? 6 : 7;
  const dailyBudget = weeklyTarget ? Math.floor(weeklyTarget / daysToSchedule) : null;
  const macroTargets = getDailyMacroTargets(dailyBudget || state.profile?.recommendedCalories || state.profile?.maintenanceCalories || 2000);

  const newSchedule = [];
  let totalCalories = 0;
  let underBudgetDays = 0;
  let macroMinDays = 0;

  for (let i = 0; i < 7; i++) {
    const isCheatDay = i === existingCheatDay;

    if (isCheatDay) {
      newSchedule.push({ day: i, slots: initializeEmptySchedule()[0].slots, isCheatDay: true });
      continue;
    }

    const dayResult = randomizeDaySlots(slotPools, dailyBudget, macroTargets);
    const dayMeals = dayResult.candidateMeals;

    const daySlots = ['breakfast', 'lunch', 'snack', 'dinner'].map((slotType, index) => ({
      slot: slotType,
      mealId: dayMeals[index]?.id || null,
      time: defaultTimeForSlot(slotType)
    }));

    totalCalories += dayResult.macros.kcal;

    if (!dailyBudget || dayResult.macros.kcal <= dailyBudget) underBudgetDays++;

    const proteinMet = dayResult.macros.protein >= macroTargets.proteinMinG;
    const fatsMet = dayResult.macros.lipids >= macroTargets.fatsMinG;
    if (proteinMet && fatsMet) macroMinDays++;

    newSchedule.push({ day: i, slots: daySlots, isCheatDay: false });
  }

  tempSchedule = newSchedule;
  renderScheduleEditor();
  updateScheduleCalorieSummary();

  if (weeklyTarget && totalCalories <= weeklyTarget) {
    const remaining = Math.round(weeklyTarget - totalCalories);
    showToast(
      `Generated random plan: ${underBudgetDays}/${daysToSchedule} days under cap, ${macroMinDays}/${daysToSchedule} days met macro minimums (${remaining.toLocaleString()} kcal weekly remaining)`,
      'success'
    );
  } else if (weeklyTarget) {
    showToast(
      `Generated random plan: ${underBudgetDays}/${daysToSchedule} days under cap, ${macroMinDays}/${daysToSchedule} days met macro minimums`,
      'default'
    );
  } else {
    showToast(`Schedule auto-generated (${macroMinDays}/${daysToSchedule} days met macro minimums)`, 'success');
  }
}

function clearScheduleEditor() {
  const existingCheatDay = tempSchedule.findIndex((d) => d.isCheatDay);
  tempSchedule = initializeEmptySchedule();
  if (existingCheatDay >= 0) tempSchedule[existingCheatDay].isCheatDay = true;

  renderScheduleEditor();
  updateScheduleCalorieSummary();
  showToast('Schedule cleared', 'default');
}

function saveEditedSchedule() {
  const hasAnyMeal = tempSchedule.some((day) => day.isCheatDay || day.slots.some((slot) => slot.mealId));

  setSchedule(hasAnyMeal ? tempSchedule : []);
  saveSchedule();

  renderSchedule();
  renderScheduleOverview();
  renderShoppingList();

  closeEditScheduleModal();
  showToast('Schedule saved', 'success');
}

export function renderScheduleOverview() {
  const overview = document.getElementById('schedule-overview');
  if (!overview) return;

  const schedule = dataStore.schedule;

  if (!schedule.length) {
    overview.classList.add('hidden');
    return;
  }

  overview.classList.remove('hidden');

  const weeklyTarget = getWeeklyCalorieTarget();
  const cheatDayIndex = schedule.findIndex((d) => d.isCheatDay);
  const totals = calculateScheduleNutrition(schedule, true);
  const totalCalories = Math.round(totals.kcal);
  const dayCount = Math.max(1, totals.dayCount || 0);
  const avgDailyCalories = Math.round(totals.kcal / dayCount);
  const avgDailyProtein = totals.protein / dayCount;
  const avgDailyCarbs = totals.carbs / dayCount;
  const avgDailyFats = totals.lipids / dayCount;

  const dailyCaloriesTarget = state.profile?.recommendedCalories || state.profile?.maintenanceCalories || null;
  const dailyMacroTargets = dailyCaloriesTarget ? getDailyMacroTargets(dailyCaloriesTarget) : null;

  const weeklyTargetEl = document.getElementById('overview-weekly-target');
  const scheduledEl = document.getElementById('overview-scheduled');
  const remainingEl = document.getElementById('overview-remaining');
  const remainingContainer = document.getElementById('overview-remaining-container');
  const dailyAverageEl = document.getElementById('overview-daily-average');
  const macrosTotalEl = document.getElementById('overview-macros-total');
  const macrosAverageEl = document.getElementById('overview-macros-average');
  const macrosTargetEl = document.getElementById('overview-macros-target');
  const cheatDayEl = document.getElementById('overview-cheat-day');
  const cheatDayNameEl = document.getElementById('overview-cheat-day-name');
  const cheatBudgetEl = document.getElementById('overview-cheat-budget');

  if (
    !weeklyTargetEl ||
    !scheduledEl ||
    !remainingEl ||
    !remainingContainer ||
    !dailyAverageEl ||
    !macrosTotalEl ||
    !macrosAverageEl ||
    !macrosTargetEl ||
    !cheatDayEl ||
    !cheatDayNameEl ||
    !cheatBudgetEl
  ) {
    return;
  }

  dailyAverageEl.textContent = `${avgDailyCalories.toLocaleString()} kcal/day`;
  macrosTotalEl.innerHTML = `
    <span class="overview-macro-row">${formatMacroPills({ protein: totals.protein, carbs: totals.carbs, fats: totals.lipids })}</span>
  `;
  macrosAverageEl.innerHTML = `
    <span class="overview-macro-row">${formatMacroPills({ protein: avgDailyProtein, carbs: avgDailyCarbs, fats: avgDailyFats })}</span>
  `;

  if (dailyMacroTargets) {
    const totalProteinTarget = dailyMacroTargets.proteinMinG * dayCount;
    const totalCarbTarget = dailyMacroTargets.carbsTargetG * dayCount;
    const totalFatTarget = dailyMacroTargets.fatsMinG * dayCount;

    macrosTargetEl.innerHTML = `
      <span class="overview-target-row">
        <span class="overview-target-label">Daily</span>
        <span class="overview-macro-row">${formatMacroPills({ protein: dailyMacroTargets.proteinMinG, carbs: dailyMacroTargets.carbsTargetG, fats: dailyMacroTargets.fatsMinG })}</span>
      </span>
      <span class="overview-target-row">
        <span class="overview-target-label">Total target (${dayCount}d)</span>
        <span class="overview-macro-row">${formatMacroPills({ protein: totalProteinTarget, carbs: totalCarbTarget, fats: totalFatTarget })}</span>
      </span>
    `;
  } else {
    macrosTargetEl.textContent = 'Set profile for macro targets';
  }

  if (weeklyTarget) {
    weeklyTargetEl.textContent = `${weeklyTarget.toLocaleString()} kcal`;
    scheduledEl.textContent = `${totalCalories.toLocaleString()} kcal`;

    const remaining = weeklyTarget - totalCalories;
    remainingEl.textContent = `${remaining.toLocaleString()} kcal`;

    if (remaining < 0) {
      remainingContainer.classList.add('over-budget');
      remainingContainer.classList.remove('under-budget');
    } else {
      remainingContainer.classList.remove('over-budget');
      remainingContainer.classList.add('under-budget');
    }

    if (cheatDayIndex >= 0) {
      const days = getDayNames(schedule.length);
      cheatDayEl.classList.remove('hidden');
      cheatDayNameEl.textContent = days[cheatDayIndex];
      cheatBudgetEl.textContent = remaining > 0 ? remaining.toLocaleString() : '0';
    } else {
      cheatDayEl.classList.add('hidden');
    }
  } else {
    weeklyTargetEl.textContent = 'Set profile';
    scheduledEl.textContent = `${totalCalories.toLocaleString()} kcal`;
    remainingEl.textContent = '--';
    remainingContainer.classList.remove('over-budget', 'under-budget');
    cheatDayEl.classList.add('hidden');
  }
}

export function setupScheduleListeners() {
  document.getElementById('edit-schedule-btn')?.addEventListener('click', openEditScheduleModal);
  document.getElementById('save-schedule')?.addEventListener('click', saveEditedSchedule);
  document.getElementById('cancel-schedule')?.addEventListener('click', closeEditScheduleModal);
  document.getElementById('auto-generate-schedule')?.addEventListener('click', autoGenerateSchedule);
  document.getElementById('clear-schedule')?.addEventListener('click', clearScheduleEditor);
}
