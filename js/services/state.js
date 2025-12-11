/**
 * State Management Module
 * Handles application state persistence and updates
 */

export let state = {
  onboarded: false,
  startDay: 1,
  checkedItems: {},
  profile: {
    age: null,
    sex: 'male',
    weight: null,       // in kg
    height: null,       // in cm
    activityLevel: 1.55, // moderate
    goalWeight: null,   // in kg
    goalMonths: null,   // timeframe in months
    maintenanceCalories: null,
    recommendedCalories: null
  }
};

/**
 * Load state from localStorage
 */
export function loadState() {
  const saved = localStorage.getItem('mealPrepState');
  if (saved) {
    const loaded = JSON.parse(saved);
    state = {
      ...state,
      ...loaded,
      // Ensure profile object exists with defaults for backward compatibility
      profile: {
        age: null,
        sex: 'male',
        weight: null,
        height: null,
        activityLevel: 1.55,
        goalWeight: null,
        goalMonths: null,
        maintenanceCalories: null,
        recommendedCalories: null,
        ...(loaded.profile || {})
      }
    };
  }
  return state;
}

/**
 * Save state to localStorage
 */
export function saveState() {
  localStorage.setItem('mealPrepState', JSON.stringify(state));
}

/**
 * Update state and automatically save
 */
export function updateState(updates) {
  Object.assign(state, updates);
  saveState();
}

/**
 * Update profile and automatically save
 */
export function updateProfile(profileUpdates) {
  state.profile = {
    ...state.profile,
    ...profileUpdates
  };
  saveState();
}

/**
 * Reset state to defaults
 */
export function resetState() {
  state = {
    onboarded: false,
    startDay: 1,
    checkedItems: {},
    profile: {
      age: null,
      sex: 'male',
      weight: null,
      height: null,
      activityLevel: 1.55,
      goalWeight: null,
      goalMonths: null,
      maintenanceCalories: null,
      recommendedCalories: null
    }
  };
  saveState();
}
