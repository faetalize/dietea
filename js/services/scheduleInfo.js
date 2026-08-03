/**
 * Where the user is in their week, right now.
 *
 * Pure derivation over `state` and `dataStore` with no DOM access. It lives in
 * services rather than alongside the schedule rendering because two very
 * different consumers need identical answers — the schedule views highlight
 * "today" and "now" with it, and the AI context tells the model what day and
 * meal it is. Keeping one copy is what stops the assistant from disagreeing
 * with the screen the user is looking at.
 */

import { dataStore } from '../core/dataStore.js';
import { state } from './state.js';
import { DAY_NAMES } from '../utils/helpers.js';

/**
 * Weekday names for the schedule, rotated to the user's chosen start day.
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
 * Index of today within the schedule, or -1 when the week is empty.
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
 * Which meal slot the current time falls into, or null outside eating hours.
 *
 * Windows are fixed rather than read from each slot's `time` field, since those
 * are per-day and free-form while this only needs a coarse "roughly lunchtime".
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
