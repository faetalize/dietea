/**
 * Small, non-data runtime context for each model turn.
 *
 * Ingredients, meals, schedule, profile, supplements, and the shopping list
 * stay out of the prompt. The model reads those live objects through tools
 * when they are relevant to the user's request.
 */

import { getCurrentMealSlot } from './scheduleInfo.js';

export function buildRuntimeContext() {
  const now = new Date();
  const date = now.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const time = now.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit'
  });
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local time';
  const mealSlot = getCurrentMealSlot();

  return [
    `Local date and time: ${date}, ${time} (${timeZone}).`,
    mealSlot ? `Current meal window: ${mealSlot}.` : null,
    'Live application data is available through the provided tools.'
  ]
    .filter(Boolean)
    .join('\n');
}
