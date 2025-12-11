/**
 * Utility Functions
 * Common helpers used throughout the app
 */

/**
 * Convert value to title case
 */
export function titleCase(value = '') {
  return value.replace(/(^|\s)\w/g, match => match.toUpperCase());
}

/**
 * Format number with 2 decimal places
 */
export function fmt(value) {
  return Number.isFinite(value) ? value.toFixed(2) : '0.00';
}

/**
 * Convert string to URL-safe slug
 */
export function slugify(value = '') {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || `item-${Date.now()}`;
}

/**
 * Get default time for a meal slot
 */
export function defaultTimeForSlot(slot) {
  switch (slot) {
    case 'breakfast': return '7:00 AM';
    case 'lunch': return '1:00 PM';
    case 'snack': return '4:00 PM';
    case 'dinner': return '7:00 PM';
    default: return '—';
  }
}

/**
 * Day names constant
 */
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
