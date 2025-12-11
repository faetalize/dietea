/**
 * Meal Prep Planner - Main Entry Point
 * Fully refactored modular structure
 */

// Core data and models
import { dataStore, setIngredients, setMeals, setSchedule, aggregateShoppingList, getMealById } from './js/core/dataStore.js';
import { Meal, FoodItem } from './js/core/models.js';
import { loadIngredients } from './js/core/dataLoader.js';
import { hydrateMeal } from './js/core/mealSerde.js';
import { 
  isFileSystemSupported, 
  selectIngredientsFile, 
  loadIngredientsFromFile,
  restoreFileHandle,
  getFileHandle,
  hasStoredFileHandle
} from './js/services/fileSystem.js';

// Services
import { state, loadState, saveState, updateProfile, updateState } from './js/services/state.js';
import { calculateProfileMetrics } from './js/services/calories.js';
import { saveIngredients, saveMeals, saveSchedule } from './js/services/storage.js';

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
import { setupSettingsListeners } from './js/components/settings.js';
import { renderProfileCard, setupProfileListeners } from './js/components/profile.js';

// Legacy file - for temporary delegation of unmigrated functions
// (legacy file removed after full migration)

/**
 * Initialize the application
 */
async function init() {
  await bootstrapData();
  loadState();

  if (state.onboarded) {
    showApp();
  } else {
    showOnboarding();
  }

  setupEventListeners();
}

/**
 * Bootstrap data from storage
 */
async function bootstrapData() {
  // Try to load ingredients from file system first
  let ingredientsLoaded = false;
  
  if (isFileSystemSupported()) {
    const hasHandle = await hasStoredFileHandle();
    if (hasHandle) {
      const fileHandle = await restoreFileHandle();
      if (fileHandle) {
        const ingredientsData = await loadIngredientsFromFile(fileHandle);
        if (ingredientsData && Array.isArray(ingredientsData)) {
          const items = ingredientsData.map(obj => new FoodItem(obj));
          setIngredients(items);
          ingredientsLoaded = true;
          console.log('Loaded ingredients from file system');
        }
      }
    }
  }
  
  // Fallback to localStorage if file system didn't work
  if (!ingredientsLoaded) {
    const savedIngredients = localStorage.getItem('mealPrepIngredients');
    if (savedIngredients) {
      try {
        const parsed = JSON.parse(savedIngredients);
        const items = Array.isArray(parsed) ? parsed.map(obj => new FoodItem(obj)) : [];
        setIngredients(items);
      } catch (err) {
        console.error('Failed to load saved ingredients', err);
        setIngredients([]);
      }
    } else {
      // Final fallback: load bundled ingredients.json on first run
      try {
        const items = await loadIngredients();
        setIngredients(items);
        ingredientsLoaded = true;
      } catch (err) {
        console.warn('Could not load bundled ingredients.json', err);
        setIngredients([]);
      }
    }
  }

  // Load meals from localStorage
  const savedMeals = localStorage.getItem('mealPrepMeals');
  if (savedMeals) {
    try {
      const parsed = JSON.parse(savedMeals);
      const meals = Array.isArray(parsed)
        ? parsed.map(obj => hydrateMeal(obj))
        : [];
      setMeals(meals);
    } catch (err) {
      console.error('Failed to load saved meals', err);
      setMeals([]);
    }
  } else {
    setMeals([]);
  }

  // Load schedule from localStorage
  const savedSchedule = localStorage.getItem('mealPrepSchedule');
  if (savedSchedule) {
    try {
      const parsed = JSON.parse(savedSchedule);
      setSchedule(Array.isArray(parsed) ? parsed : []);
    } catch (err) {
      console.error('Failed to load saved schedule', err);
      setSchedule([]);
    }
  } else {
    setSchedule([]);
  }
}

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
  
  setupSettingsListeners();
  setupProfileListeners();
  setupScheduleListeners();
  setupMealCreationListeners();
  setupMenuListeners();
  setupIngredientsListeners();
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
  
  showApp();
  
  // Show success toast with calorie info
  if (state.profile.maintenanceCalories && state.profile.recommendedCalories) {
    const diff = state.profile.maintenanceCalories - state.profile.recommendedCalories;
    const direction = diff > 0 ? 'deficit' : diff < 0 ? 'surplus' : '';
    showToast(`Daily target: ${state.profile.recommendedCalories} kcal${direction ? ` (${Math.abs(diff)} kcal ${direction})` : ''}`, 'success');
  }
  
  // Prompt to connect ingredients file if supported
  if (isFileSystemSupported() && !getFileHandle() && dataStore.ingredients.length === 0) {
    setTimeout(async () => {
      showToast('Tip: Connect ingredients.json from Settings to enable auto-sync.', 'default');
    }, 500);
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
