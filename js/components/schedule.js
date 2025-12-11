/**
 * Schedule UI Components
 * Renders schedule list, calendar, and overview
 */

import { dataStore, getMealById } from '../core/dataStore.js';
import { state } from '../services/state.js';
import { titleCase, defaultTimeForSlot, DAY_NAMES } from '../utils/helpers.js';

/**
 * Get schedule day names based on start day
 */
export function getScheduleDays() {
  const days = [];
  for (let i = 0; i < dataStore.schedule.length; i++) {
    const dayIndex = (state.startDay + i) % 7;
    days.push(DAY_NAMES[dayIndex]);
  }
  return days;
}

/**
 * Get current day index in schedule
 */
export function getCurrentDayIndex() {
  if (!dataStore.schedule.length) return -1;
  const today = new Date().getDay();
  for (let i = 0; i < dataStore.schedule.length; i++) {
    const scheduleDay = (state.startDay + i) % 7;
    if (scheduleDay === today) {
      return i;
    }
  }
  return -1;
}

/**
 * Get current meal slot based on time of day
 */
export function getCurrentMealSlot() {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (minutes >= 300 && minutes < 630) return 'breakfast';
  if (minutes >= 630 && minutes < 900) return 'lunch';
  if (minutes >= 900 && minutes < 1080) return 'snack';
  if (minutes >= 1080 && minutes < 1320) return 'dinner';
  return null;
}

/**
 * Scroll to current day in schedule
 */
export function scrollToCurrentDay() {
  const currentDay = document.querySelector('.schedule-day.current-day');
  if (!currentDay) return;
  
  const header = document.querySelector('.tab-nav');
  const headerHeight = header ? header.offsetHeight : 0;
  const offset = currentDay.getBoundingClientRect().top + window.scrollY - headerHeight - 16;
  
  window.scrollTo({ top: offset, behavior: 'smooth' });
}

/**
 * Render schedule list view
 */
export function renderScheduleList() {
  const scheduleList = document.getElementById('schedule-list');
  if (!scheduleList) return;
  
  const schedule = dataStore.schedule;
  const days = getScheduleDays();
  const currentDayIndex = getCurrentDayIndex();
  const currentSlot = getCurrentMealSlot();
  scheduleList.innerHTML = '';

  if (!schedule.length) {
    scheduleList.innerHTML = '<p class="empty-state">No schedule yet. Add meals to see them here.</p>';
    return;
  }

  schedule.forEach((day, index) => {
    const dayDiv = document.createElement('div');
    dayDiv.className = 'schedule-day';
    if (index === currentDayIndex) {
      dayDiv.classList.add('current-day');
    }

    const slots = Array.isArray(day.slots) ? day.slots : [];
    const slotsMarkup = slots.map(slot => {
      const meal = getMealById(slot.mealId);
      const isCurrent = index === currentDayIndex && slot.slot === currentSlot;
      const timeLabel = slot.time || defaultTimeForSlot(slot.slot);
      const calories = meal ? `${meal.macros.kcal.toFixed(0)} kcal` : '—';
      const protein = meal ? `${meal.macros.protein.toFixed(0)} g protein` : '';
      return `
        <div class="schedule-meal${isCurrent ? ' current-meal' : ''}" data-meal-id="${slot.mealId || ''}">
          <span class="meal-time">${timeLabel}</span>
          <span class="meal-name">${slot.slot ? titleCase(slot.slot) : 'Meal'}</span>
          <span class="meal-calories">${calories}</span>
          ${protein ? `<span class="meal-protein">${protein}</span>` : ''}
          <span class="meal-target">${meal ? meal.name : 'Unassigned meal'}</span>
        </div>
      `;
    }).join('');

    dayDiv.innerHTML = `
      <h2>Day ${index + 1} — ${days[index]}</h2>
      <div class="schedule-meals">${slotsMarkup || '<div class="schedule-empty">No meals assigned.</div>'}</div>
    `;

    scheduleList.appendChild(dayDiv);
  });

  scrollToCurrentDay();
}

/**
 * Render schedule calendar view
 */
export function renderScheduleCalendar() {
  const scheduleCalendar = document.getElementById('schedule-calendar');
  if (!scheduleCalendar) return;
  
  const schedule = dataStore.schedule;
  const days = getScheduleDays();
  const currentDayIndex = getCurrentDayIndex();
  const currentSlot = getCurrentMealSlot();
  scheduleCalendar.innerHTML = '';

  if (!schedule.length) {
    scheduleCalendar.innerHTML = '<p class="empty-state">No schedule yet. Add meals to the plan.</p>';
    return;
  }

  const calendarHTML = `
    <div class="calendar-grid" style="--calendar-days: ${schedule.length}">
      <div class="calendar-column time-column">
        <div class="calendar-time-label"></div>
        <div class="calendar-time-label">7:00 AM</div>
        <div class="calendar-time-label">1:00 PM</div>
        <div class="calendar-time-label">4:00 PM</div>
        <div class="calendar-time-label">7:00 PM</div>
      </div>
      ${schedule.map((day, i) => {
        const slots = Array.isArray(day.slots) ? day.slots : [];
        const isCheatDay = day.isCheatDay || false;
        const columnClasses = ['calendar-column'];
        if (i === currentDayIndex) columnClasses.push('current-day-column');
        if (isCheatDay) columnClasses.push('cheat-column');
        
        return `
          <div class="${columnClasses.join(' ')}">
            <div class="calendar-day-header${isCheatDay ? ' cheat-day' : ''}">Day ${i + 1}<br><span>${days[i]}</span></div>
            ${isCheatDay ? `
              <div class="calendar-cell cheat-cell">🎉</div>
              <div class="calendar-cell cheat-cell">🎉</div>
              <div class="calendar-cell cheat-cell">🎉</div>
              <div class="calendar-cell cheat-cell">🎉</div>
            ` : ['breakfast', 'lunch', 'snack', 'dinner'].map(slotKey => {
              const slot = slots.find(s => s.slot === slotKey) || {};
              const meal = getMealById(slot.mealId);
              const classes = ['calendar-cell'];
              if (i === currentDayIndex && slotKey === currentSlot) {
                classes.push('current-day', 'current-meal');
              } else if (i === currentDayIndex) {
                classes.push('current-day');
              }
              return `<div class="${classes.join(' ')}" data-meal-id="${slot.mealId || ''}">${slotKey ? titleCase(slotKey) : 'Meal'}${meal ? ` — ${meal.name}` : ''}</div>`;
            }).join('')}
          </div>
        `;
      }).join('')}
    </div>
  `;

  scheduleCalendar.innerHTML = calendarHTML;
}

/**
 * Render both schedule views
 */
export function renderSchedule() {
  renderScheduleList();
  renderScheduleCalendar();
}
