/**
 * Meal Prep Planner - Main Entry Point
 *
 * Gates the app behind Supabase auth, loads the signed-in user's data, and
 * wires every component's listeners exactly once. Rendering lives in
 * js/components/.
 */

// Core data and models
import { dataStore, setIngredients, setMeals, setSchedule, getMealById } from './js/core/dataStore.js';
import { loadIngredients, loadMeals, loadSchedule, seedStarterData, isAccountEmpty } from './js/core/dataLoader.js';
import { hydrateMeal } from './js/core/mealSerde.js';

// Services
import { state, loadState, updateProfile, updateState, flushState } from './js/services/state.js';
import { calculateProfileMetrics } from './js/services/calories.js';
import { initAuth, onAuthChange, signIn, signUp, getCurrentUser } from './js/services/auth.js';
import { describeError } from './js/services/supabase.js';

// Utils
import { showToast, showFieldError, clearValidationErrors } from './js/utils/feedback.js';

// Components
import { renderShoppingList, resetShoppingList } from './js/components/shopping.js';
import { renderSchedule, scrollToCurrentDay } from './js/components/schedule.js';
import { switchTab, savePreviousTab, getPreviousTab, showMealDetail, setupMealDetailNavigation } from './js/components/navigation.js';
import { renderScheduleOverview, setupScheduleListeners } from './js/components/scheduleEditor.js';
import { renderMenuCards, filterMenuCards, setupMenuListeners } from './js/components/menu.js';
import { setupMealCreationListeners } from './js/components/mealCreation.js';
import { renderIngredients, filterIngredients, setupIngredientsListeners } from './js/components/ingredients.js';
import { renderSupplements, setupSupplementsListeners, loadSupplementsState } from './js/components/supplements.js';
import { setupSettingsListeners } from './js/components/settings.js';
import { renderProfileCard, setupProfileListeners } from './js/components/profile.js';

/** App listeners are wired once per page load, not once per sign-in. */
let appListenersReady = false;

/**
 * Initialize the application
 */
async function init() {
  setupAuthScreenListeners();

  const user = await initAuth();

  if (user) {
    await startSession();
  } else {
    showAuthScreen();
  }

  // Covers token expiry and sign-out from another tab.
  onAuthChange((nextUser) => {
    if (!nextUser) showAuthScreen();
  });
}

/**
 * Load everything for the signed-in user and hand off to the app.
 */
async function startSession() {
  setAuthBusy(true, 'Loading your data…');

  try {
    await bootstrapData();
    await loadState();
  } catch (err) {
    console.error('Could not start session', err);
    showAuthError(describeError(err) || err.message);
    setAuthBusy(false);
    return;
  }

  hideAuthScreen();
  setAuthBusy(false);

  if (!appListenersReady) {
    setupEventListeners();
    appListenersReady = true;
  }

  if (state.onboarded) {
    showApp();
  } else {
    showOnboarding();
  }
}

/**
 * Bootstrap data from Supabase, seeding a brand new account from the bundled
 * starter JSON so the app is never empty on first sign-in.
 */
async function bootstrapData() {
  if (await isAccountEmpty()) {
    await seedStarterData();
  }

  const items = await loadIngredients();
  setIngredients(items);

  // Ingredients must land first: hydrateMeal resolves each itemId against them.
  const mealObjects = await loadMeals();
  setMeals(mealObjects.map((obj) => hydrateMeal(obj)).filter(Boolean));

  setSchedule(await loadSchedule());

  await loadSupplementsState();
}

/* ---------------------------------------------------------------- auth UI */

function showAuthScreen() {
  document.getElementById('auth-screen')?.classList.remove('hidden');
  document.getElementById('app')?.classList.add('hidden');
  document.getElementById('onboarding-modal')?.classList.add('hidden');

  setIngredients([]);
  setMeals([]);
  setSchedule([]);
}

function hideAuthScreen() {
  document.getElementById('auth-screen')?.classList.add('hidden');
  showAuthError('');
}

function showAuthError(message) {
  const el = document.getElementById('auth-error');
  if (!el) return;
  el.textContent = message || '';
  el.classList.toggle('hidden', !message);
}

function setAuthBusy(busy, label) {
  const submit = document.getElementById('auth-submit');
  const status = document.getElementById('auth-status');

  if (submit) submit.disabled = busy;
  if (status) {
    status.textContent = busy ? (label || 'Working…') : '';
    status.classList.toggle('hidden', !busy);
  }
}

function setupAuthScreenListeners() {
  const form = document.getElementById('auth-form');
  const emailInput = document.getElementById('auth-email');
  const passwordInput = document.getElementById('auth-password');
  const submitBtn = document.getElementById('auth-submit');
  const toggleBtn = document.getElementById('auth-toggle-mode');
  const title = document.getElementById('auth-title');

  let mode = 'signin';

  const applyMode = () => {
    const signingIn = mode === 'signin';
    if (title) title.textContent = signingIn ? 'Sign in' : 'Create an account';
    if (submitBtn) submitBtn.textContent = signingIn ? 'Sign in' : 'Sign up';
    if (toggleBtn) {
      toggleBtn.textContent = signingIn
        ? 'No account? Create one'
        : 'Already have an account? Sign in';
    }
    showAuthError('');
  };

  applyMode();

  toggleBtn?.addEventListener('click', () => {
    mode = mode === 'signin' ? 'signup' : 'signin';
    applyMode();
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = (emailInput?.value || '').trim();
    const password = passwordInput?.value || '';

    if (!email || !password) {
      showAuthError('Enter an email and password.');
      return;
    }
    if (mode === 'signup' && password.length < 6) {
      showAuthError('Password must be at least 6 characters.');
      return;
    }

    showAuthError('');
    setAuthBusy(true, mode === 'signin' ? 'Signing in…' : 'Creating account…');

    const result = mode === 'signin'
      ? await signIn(email, password)
      : await signUp(email, password);

    if (result.error) {
      showAuthError(result.error);
      setAuthBusy(false);
      return;
    }

    if (result.needsConfirmation) {
      setAuthBusy(false);
      showAuthError('Check your inbox to confirm your email, then sign in.');
      mode = 'signin';
      applyMode();
      showAuthError('Check your inbox to confirm your email, then sign in.');
      return;
    }

    if (passwordInput) passwordInput.value = '';
    await startSession();
  });
}

/* ------------------------------------------------------------- app screens */

/**
 * Show onboarding modal
 */
function showOnboarding() {
  const onboardingModal = document.getElementById('onboarding-modal');
  const app = document.getElementById('app');
  const startDaySelect = document.getElementById('start-day');

  onboardingModal.classList.remove('hidden');
  app.classList.add('hidden');
  startDaySelect.value = state.startDay;

  // Pre-fill onboarding fields if profile data exists
  if (state.profile) {
    const fields = {
      'onboarding-age': state.profile.age,
      'onboarding-sex': state.profile.sex,
      'onboarding-weight': state.profile.weight,
      'onboarding-height': state.profile.height,
      'onboarding-activity': state.profile.activityLevel,
      'onboarding-goal-weight': state.profile.goalWeight,
      'onboarding-goal-months': state.profile.goalMonths
    };

    Object.entries(fields).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element && value) element.value = value;
    });
  }
}

/**
 * Show main app
 */
function showApp() {
  const onboardingModal = document.getElementById('onboarding-modal');
  const app = document.getElementById('app');

  onboardingModal.classList.add('hidden');
  app.classList.remove('hidden');

  // Render all components
  renderShoppingList();
  renderSchedule();
  renderScheduleOverview();
  renderMenuCards();
  renderIngredients();
  renderSupplements();
  renderProfileCard();
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
  const startBtn = document.getElementById('start-btn');
  const tabBtns = document.querySelectorAll('.tab-btn');

  // Onboarding submit
  startBtn.addEventListener('click', handleOnboardingSubmit);

  // Tab navigation
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      switchTab(tabId);
    });
  });

  // Shopping list reset
  const resetShoppingBtn = document.getElementById('reset-shopping');
  const resetWrapper = document.querySelector('.reset-wrapper');
  const resetConfirmBtn = document.getElementById('reset-confirm');
  const resetCancelBtn = document.getElementById('reset-cancel');

  resetShoppingBtn.addEventListener('click', () => {
    resetWrapper.classList.add('confirming');
  });

  resetCancelBtn.addEventListener('click', () => {
    resetWrapper.classList.remove('confirming');
  });

  resetConfirmBtn.addEventListener('click', () => {
    resetShoppingList();
    resetWrapper.classList.remove('confirming');
    showToast('Shopping list reset', 'success');
  });

  setupSettingsListeners({
    onScheduleChanged: () => {
      renderSchedule();
      renderScheduleOverview();
      renderShoppingList();
    },
    onIngredientsChanged: () => {
      renderIngredients();
      renderMenuCards();
      renderSchedule();
      renderScheduleOverview();
      renderShoppingList();
    },
    onMealsChanged: () => {
      renderMenuCards();
      renderSchedule();
      renderScheduleOverview();
      renderShoppingList();
    },
    onSupplementsChanged: renderSupplements,
    onShowOnboarding: showOnboarding,
    onSignedOut: showAuthScreen
  });
  setupProfileListeners();
  setupScheduleListeners();
  setupMealCreationListeners({
    onMealsChanged: () => {
      renderMenuCards();
      renderSchedule();
      renderScheduleOverview();
      renderShoppingList();
    }
  });
  setupMenuListeners();
  setupIngredientsListeners();
  setupSupplementsListeners();
  setupMealDetailNavigation();

  setupSearchListeners();
  setupScheduleViewListeners();
  setupSettingsNavigation();
}

/**
 * Handle onboarding form submission
 */
async function handleOnboardingSubmit() {
  const onboardingModal = document.getElementById('onboarding-modal');
  const startDaySelect = document.getElementById('start-day');

  // Get all onboarding values
  const age = parseInt(document.getElementById('onboarding-age')?.value, 10);
  const sex = document.getElementById('onboarding-sex')?.value || 'male';
  const weight = parseFloat(document.getElementById('onboarding-weight')?.value);
  const height = parseFloat(document.getElementById('onboarding-height')?.value);
  const activityLevel = parseFloat(document.getElementById('onboarding-activity')?.value) || 1.55;
  const goalWeight = parseFloat(document.getElementById('onboarding-goal-weight')?.value);
  const goalMonths = parseInt(document.getElementById('onboarding-goal-months')?.value, 10);

  // Validate required fields
  clearValidationErrors(onboardingModal);
  let hasError = false;

  const validations = [
    { value: age, min: 15, max: 100, id: 'onboarding-age', msg: 'Please enter a valid age (15-100)' },
    { value: weight, min: 30, max: 300, id: 'onboarding-weight', msg: 'Please enter a valid weight (30-300 kg)' },
    { value: height, min: 100, max: 250, id: 'onboarding-height', msg: 'Please enter a valid height (100-250 cm)' },
    { value: goalWeight, min: 30, max: 300, id: 'onboarding-goal-weight', msg: 'Please enter a valid goal weight (30-300 kg)' },
    { value: goalMonths, min: 1, max: 24, id: 'onboarding-goal-months', msg: 'Please enter a valid timeframe (1-24 months)' }
  ];

  validations.forEach(({ value, min, max, id, msg }) => {
    if (!value || value < min || value > max) {
      showFieldError(document.getElementById(id), msg);
      hasError = true;
    }
  });

  if (hasError) return;

  // Update profile
  updateProfile({
    age,
    sex,
    weight,
    height,
    activityLevel,
    goalWeight,
    goalMonths
  });

  // Calculate calories
  const metrics = calculateProfileMetrics(state.profile);
  if (metrics) {
    updateProfile({
      maintenanceCalories: metrics.maintenanceCalories,
      recommendedCalories: metrics.recommendedCalories
    });
  }

  updateState({ startDay: parseInt(startDaySelect.value, 10), onboarded: true });

  // Onboarding is the one write worth waiting on — a reload before it lands
  // would drop the user straight back into onboarding.
  await flushState();

  showApp();

  // Show success toast with calorie info
  if (state.profile.maintenanceCalories && state.profile.recommendedCalories) {
    const diff = state.profile.maintenanceCalories - state.profile.recommendedCalories;
    const direction = diff > 0 ? 'deficit' : diff < 0 ? 'surplus' : '';
    showToast(`Daily target: ${state.profile.recommendedCalories} kcal${direction ? ` (${Math.abs(diff)} kcal ${direction})` : ''}`, 'success');
  }

}

/**
 * Setup search listeners
 */
function setupSearchListeners() {
  const menuSearch = document.getElementById('menu-search');
  const ingredientsSearch = document.getElementById('ingredients-search');

  if (menuSearch) {
    menuSearch.addEventListener('input', (e) => filterMenuCards(e.target.value));
  }

  if (ingredientsSearch) {
    ingredientsSearch.addEventListener('input', (e) => filterIngredients(e.target.value));
  }
}

/**
 * Setup schedule view listeners
 */
function setupScheduleViewListeners() {
  const scheduleViewBtns = document.querySelectorAll('.view-btn');
  const scheduleList = document.getElementById('schedule-list');
  const scheduleCalendar = document.getElementById('schedule-calendar');

  scheduleViewBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      scheduleViewBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (view === 'list') {
        scheduleList.classList.remove('hidden');
        scheduleCalendar.classList.add('hidden');
        scrollToCurrentDay();
      } else {
        scheduleList.classList.add('hidden');
        scheduleCalendar.classList.remove('hidden');
      }
    });
  });

  const handleMealClick = (e) => {
    const mealElement = e.target.closest('[data-meal-id]');
    if (mealElement) {
      const mealId = mealElement.dataset.mealId;
      const meal = getMealById(mealId);
      if (meal) {
        switchTab('menu');
        showMealDetail(mealId);
      }
    }
  };

  scheduleList.addEventListener('click', handleMealClick);
  scheduleCalendar.addEventListener('click', handleMealClick);
}

/**
 * Setup settings navigation
 */
function setupSettingsNavigation() {
  const settingsBtn = document.getElementById('settings-btn');
  const backFromSettingsBtn = document.getElementById('back-from-settings');
  const settingsTab = document.getElementById('settings-tab');
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      savePreviousTab();
      tabBtns.forEach(btn => btn.classList.remove('active'));
      tabPanels.forEach(panel => panel.classList.remove('active'));
      settingsTab.classList.add('active');
      settingsBtn.classList.add('active');
    });
  }

  if (backFromSettingsBtn) {
    backFromSettingsBtn.addEventListener('click', () => {
      settingsTab.classList.remove('active');
      if (settingsBtn) settingsBtn.classList.remove('active');
      switchTab(getPreviousTab());
    });
  }
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', init);
