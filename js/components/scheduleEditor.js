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

function autoGenerateSchedule() {
  const meals = dataStore.meals;
  const weeklyTarget = getWeeklyCalorieTarget();

  if (meals.length === 0) {
    showToast('Add some meals first', 'error');
    return;
  }

  const mealsByType = {
    breakfast: meals.filter((m) => m.type.toLowerCase() === 'breakfast').sort((a, b) => a.macros.kcal - b.macros.kcal),
    lunch: meals.filter((m) => m.type.toLowerCase() === 'lunch').sort((a, b) => a.macros.kcal - b.macros.kcal),
    snack: meals.filter((m) => m.type.toLowerCase() === 'snack').sort((a, b) => a.macros.kcal - b.macros.kcal),
    dinner: meals.filter((m) => m.type.toLowerCase() === 'dinner').sort((a, b) => a.macros.kcal - b.macros.kcal)
  };

  const existingCheatDay = tempSchedule.findIndex((d) => d.isCheatDay);
  const daysToSchedule = existingCheatDay >= 0 ? 6 : 7;
  const dailyBudget = weeklyTarget ? Math.floor(weeklyTarget / daysToSchedule) : null;

  const newSchedule = [];
  let totalCalories = 0;
  let dayCounter = 0;

  for (let i = 0; i < 7; i++) {
    const isCheatDay = i === existingCheatDay;

    if (isCheatDay) {
      newSchedule.push({ day: i, slots: initializeEmptySchedule()[0].slots, isCheatDay: true });
      continue;
    }

    const daySlots = [];
    let dayCalories = 0;

    ['breakfast', 'lunch', 'snack', 'dinner'].forEach((slotType) => {
      const available = mealsByType[slotType];
      let selectedMeal = null;

      if (available.length > 0) {
        if (dailyBudget) {
          const remainingDayBudget = dailyBudget - dayCalories;
          const fittingMeals = available.filter((m) => m.macros.kcal <= remainingDayBudget);

          if (fittingMeals.length > 0) {
            selectedMeal = fittingMeals[dayCounter % fittingMeals.length];
          } else {
            selectedMeal = available[0];
          }
        } else {
          selectedMeal = available[dayCounter % available.length];
        }
      } else {
        const allMealsSorted = [...meals].sort((a, b) => a.macros.kcal - b.macros.kcal);
        selectedMeal = allMealsSorted[dayCounter % allMealsSorted.length];
      }

      if (selectedMeal) {
        dayCalories += selectedMeal.macros.kcal;
        totalCalories += selectedMeal.macros.kcal;
      }

      daySlots.push({
        slot: slotType,
        mealId: selectedMeal ? selectedMeal.id : null,
        time: defaultTimeForSlot(slotType)
      });
    });

    newSchedule.push({ day: i, slots: daySlots, isCheatDay: false });
    dayCounter++;
  }

  tempSchedule = newSchedule;
  renderScheduleEditor();
  updateScheduleCalorieSummary();

  if (weeklyTarget && totalCalories <= weeklyTarget) {
    const remaining = weeklyTarget - totalCalories;
    showToast(`Generated within budget (${remaining.toLocaleString()} kcal remaining)`, 'success');
  } else if (weeklyTarget) {
    showToast('Generated (may exceed target - adjust manually)', 'default');
  } else {
    showToast('Schedule auto-generated', 'success');
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
  const totalCalories = calculateScheduleCalories(schedule, true);

  const weeklyTargetEl = document.getElementById('overview-weekly-target');
  const scheduledEl = document.getElementById('overview-scheduled');
  const remainingEl = document.getElementById('overview-remaining');
  const remainingContainer = document.getElementById('overview-remaining-container');
  const cheatDayEl = document.getElementById('overview-cheat-day');
  const cheatDayNameEl = document.getElementById('overview-cheat-day-name');
  const cheatBudgetEl = document.getElementById('overview-cheat-budget');

  if (!weeklyTargetEl || !scheduledEl || !remainingEl || !remainingContainer || !cheatDayEl || !cheatDayNameEl || !cheatBudgetEl) {
    return;
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
