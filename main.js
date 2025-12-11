import { dataStore, setIngredients, setMeals, setSchedule, aggregateShoppingList, getMealById } from './dataStore.js';
import { Meal, FoodItem, FoodItemEntry, CookingInstruction } from './models.js';
import { 
  isFileSystemSupported, 
  selectIngredientsFile, 
  loadIngredientsFromFile, 
  saveIngredientsToFile,
  restoreFileHandle,
  clearFileHandle,
  getFileHandle,
  hasStoredFileHandle,
  requestPermissionAndLoad
} from './fileSystem.js';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

let state = {
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

// DOM Elements
const onboardingModal = document.getElementById('onboarding-modal');
const app = document.getElementById('app');
const startDaySelect = document.getElementById('start-day');
const startBtn = document.getElementById('start-btn');
const tabBtns = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');
const shoppingList = document.getElementById('shopping-list');
const scheduleList = document.getElementById('schedule-list');
const scheduleCalendar = document.getElementById('schedule-calendar');
const viewBtns = document.querySelectorAll('.view-btn');
const menuCards = document.getElementById('menu-cards');
const menuSearch = document.getElementById('menu-search');
const importMealsBtn = document.getElementById('import-meals');
const mealsFileInput = document.getElementById('meals-file');
const mealDetail = document.getElementById('meal-detail');
const mealDetailContent = document.getElementById('meal-detail-content');
const ingredientsList = document.getElementById('ingredients-list');
const ingredientsSearch = document.getElementById('ingredients-search');
const importIngredientsBtn = document.getElementById('import-ingredients');
const ingredientsFileInput = document.getElementById('ingredients-file');
const addIngredientToggle = document.getElementById('add-ingredient-toggle');
const addIngredientForm = document.getElementById('add-ingredient-form');
const ingredientNameInput = document.getElementById('ingredient-name');
const ingredientCategoryInput = document.getElementById('ingredient-category');
const ingredientUnitInput = document.getElementById('ingredient-unit');
const ingredientKcalInput = document.getElementById('ingredient-kcal');
const ingredientProteinInput = document.getElementById('ingredient-protein');
const ingredientCarbsInput = document.getElementById('ingredient-carbs');
const ingredientLipidsInput = document.getElementById('ingredient-lipids');
const saveIngredientBtn = document.getElementById('save-ingredient');
const cancelIngredientBtn = document.getElementById('cancel-ingredient');
const backToMenuBtn = document.getElementById('back-to-menu');
const resetShoppingBtn = document.getElementById('reset-shopping');
const settingsBtn = document.getElementById('settings-btn');
const backFromSettingsBtn = document.getElementById('back-from-settings');
const settingsTab = document.getElementById('settings-tab');

// Edit ingredient modal elements
const editIngredientModal = document.getElementById('edit-ingredient-modal');
const editIngredientName = document.getElementById('edit-ingredient-name');
const editIngredientCategory = document.getElementById('edit-ingredient-category');
const editIngredientUnit = document.getElementById('edit-ingredient-unit');
const editIngredientKcal = document.getElementById('edit-ingredient-kcal');
const editIngredientProtein = document.getElementById('edit-ingredient-protein');
const editIngredientCarbs = document.getElementById('edit-ingredient-carbs');
const editIngredientLipids = document.getElementById('edit-ingredient-lipids');
const saveEditIngredientBtn = document.getElementById('save-edit-ingredient');
const cancelEditIngredientBtn = document.getElementById('cancel-edit-ingredient');

// Create meal modal elements
const createMealBtn = document.getElementById('create-meal-btn');
const createMealModal = document.getElementById('create-meal-modal');
const mealNameInput = document.getElementById('meal-name');
const mealTypeSelect = document.getElementById('meal-type');
const mealIngredientsList = document.getElementById('meal-ingredients-list');
const addMealIngredientBtn = document.getElementById('add-meal-ingredient');
const mealInstructionsList = document.getElementById('meal-instructions-list');
const addInstructionBlockBtn = document.getElementById('add-instruction-block');
const saveMealBtn = document.getElementById('save-meal');
const cancelMealBtn = document.getElementById('cancel-meal');

// Add ingredient to meal modal elements
const addIngredientModal = document.getElementById('add-ingredient-modal');
const selectIngredientDropdown = document.getElementById('select-ingredient');
const ingredientQuantityInput = document.getElementById('ingredient-quantity');
const confirmAddIngredientBtn = document.getElementById('confirm-add-ingredient');
const cancelAddIngredientBtn = document.getElementById('cancel-add-ingredient');

// Add instruction block modal elements
const addInstructionModal = document.getElementById('add-instruction-modal');
const instructionBlockNameInput = document.getElementById('instruction-block-name');
const instructionBlockStepsInput = document.getElementById('instruction-block-steps');
const confirmAddInstructionBtn = document.getElementById('confirm-add-instruction');
const cancelAddInstructionBtn = document.getElementById('cancel-add-instruction');

let editingIngredientId = null;
let editingMealId = null;
let previousTab = 'shopping';
let currentMealIngredients = []; // Temporary storage for meal ingredients being added
let currentMealInstructions = []; // Temporary storage for meal instructions being added

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

async function bootstrapData() {
  // Try to load ingredients from file system first
  let ingredientsLoaded = false;
  
  if (isFileSystemSupported()) {
    // Check if we have a stored file handle
    const hasHandle = await hasStoredFileHandle();
    if (hasHandle) {
      // Try to restore - this will request permission from user
      const fileHandle = await restoreFileHandle();
      if (fileHandle) {
        const ingredientsData = await loadIngredientsFromFile(fileHandle);
        if (ingredientsData && Array.isArray(ingredientsData)) {
          const items = ingredientsData.map(obj => new FoodItem(obj));
          setIngredients(items);
          ingredientsLoaded = true;
          console.log('Loaded ingredients from file system');
        }
      } else {
        console.log('File handle exists but permission not granted yet');
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
      setIngredients([]);
    }
  }

  // Load meals from localStorage if available
  const savedMeals = localStorage.getItem('mealPrepMeals');
  if (savedMeals) {
    try {
      const parsed = JSON.parse(savedMeals);
      const meals = Array.isArray(parsed) ? parsed.map(obj => hydrateMeal(obj)) : [];
      setMeals(meals);
    } catch (err) {
      console.error('Failed to load saved meals', err);
      setMeals([]);
    }
  } else {
    setMeals([]);
  }

  // Load schedule from localStorage if available
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

function loadState() {
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
}

function saveState() {
  localStorage.setItem('mealPrepState', JSON.stringify(state));
}

// Calorie calculation functions using Mifflin-St Jeor equation
function calculateBMR(weight, height, age, sex) {
  // weight in kg, height in cm, age in years
  if (sex === 'male') {
    return (10 * weight) + (6.25 * height) - (5 * age) + 5;
  } else {
    return (10 * weight) + (6.25 * height) - (5 * age) - 161;
  }
}

function calculateTDEE(bmr, activityLevel) {
  return Math.round(bmr * activityLevel);
}

function calculateRecommendedCalories(maintenanceCalories, currentWeight, goalWeight, goalMonths) {
  // 1 kg of body weight ≈ 7700 kcal
  const weightChange = currentWeight - goalWeight; // positive = weight loss, negative = weight gain
  const totalCalorieChange = weightChange * 7700;
  const days = goalMonths * 30; // approximate
  const dailyCalorieChange = totalCalorieChange / days;
  
  // Calculate recommended calories
  let recommended = Math.round(maintenanceCalories - dailyCalorieChange);
  
  // Safety limits: 
  // - Max healthy deficit is ~1000 kcal/day (lose ~1kg/week)
  // - Max healthy surplus is ~500 kcal/day (gain ~0.5kg/week)
  // - Never go below 1200 kcal
  const minCalories = 1200;
  const maxDeficit = 1000;
  const maxSurplus = 500;
  
  if (recommended < maintenanceCalories - maxDeficit) {
    recommended = maintenanceCalories - maxDeficit;
  }
  if (recommended < minCalories) {
    recommended = minCalories;
  }
  if (recommended > maintenanceCalories + maxSurplus) {
    recommended = maintenanceCalories + maxSurplus;
  }
  
  return recommended;
}

// Check if goal is realistic (0.5-1kg per week is healthy)
function isGoalRealistic(currentWeight, goalWeight, goalMonths) {
  const weightChange = Math.abs(currentWeight - goalWeight);
  const weeks = goalMonths * 4;
  const weeklyChange = weightChange / weeks;
  
  // Healthy rate: 0.5-1kg per week for loss, 0.25-0.5kg for gain
  const isLoss = currentWeight > goalWeight;
  const maxHealthyRate = isLoss ? 1.0 : 0.5;
  
  return {
    isRealistic: weeklyChange <= maxHealthyRate,
    weeklyChange: weeklyChange,
    recommendedMonths: Math.ceil(weightChange / (maxHealthyRate * 4))
  };
}

function calculateAndUpdateProfile() {
  const { age, sex, weight, height, activityLevel, goalWeight, goalMonths } = state.profile;
  
  if (age && weight && height && activityLevel && goalWeight && goalMonths) {
    const bmr = calculateBMR(weight, height, age, sex);
    const maintenanceCalories = calculateTDEE(bmr, activityLevel);
    const recommendedCalories = calculateRecommendedCalories(maintenanceCalories, weight, goalWeight, goalMonths);
    
    state.profile.maintenanceCalories = maintenanceCalories;
    state.profile.recommendedCalories = recommendedCalories;
    saveState();
    
    return { maintenanceCalories, recommendedCalories };
  }
  return null;
}

function getActivityLevelLabel(level) {
  const labels = {
    1.2: 'Sedentary',
    1.375: 'Lightly active',
    1.55: 'Moderately active',
    1.725: 'Very active',
    1.9: 'Extra active'
  };
  return labels[level] || 'Moderate';
}

async function saveIngredients() {
  // Save to file system if available
  if (isFileSystemSupported() && getFileHandle()) {
    const success = await saveIngredientsToFile(dataStore.ingredients);
    if (success) {
      console.log('Saved ingredients to file');
    } else {
      console.warn('Failed to save to file, falling back to localStorage');
      localStorage.setItem('mealPrepIngredients', JSON.stringify(dataStore.ingredients));
    }
  } else {
    // Fallback to localStorage
    localStorage.setItem('mealPrepIngredients', JSON.stringify(dataStore.ingredients));
  }
}

function saveSchedule() {
  localStorage.setItem('mealPrepSchedule', JSON.stringify(dataStore.schedule));
}

function showOnboarding() {
  onboardingModal.classList.remove('hidden');
  app.classList.add('hidden');
  startDaySelect.value = state.startDay;
  
  // Pre-fill onboarding fields if profile data exists
  if (state.profile) {
    const ageInput = document.getElementById('onboarding-age');
    const sexSelect = document.getElementById('onboarding-sex');
    const weightInput = document.getElementById('onboarding-weight');
    const heightInput = document.getElementById('onboarding-height');
    const activitySelect = document.getElementById('onboarding-activity');
    const goalWeightInput = document.getElementById('onboarding-goal-weight');
    const goalMonthsInput = document.getElementById('onboarding-goal-months');
    
    if (ageInput && state.profile.age) ageInput.value = state.profile.age;
    if (sexSelect && state.profile.sex) sexSelect.value = state.profile.sex;
    if (weightInput && state.profile.weight) weightInput.value = state.profile.weight;
    if (heightInput && state.profile.height) heightInput.value = state.profile.height;
    if (activitySelect && state.profile.activityLevel) activitySelect.value = state.profile.activityLevel;
    if (goalWeightInput && state.profile.goalWeight) goalWeightInput.value = state.profile.goalWeight;
    if (goalMonthsInput && state.profile.goalMonths) goalMonthsInput.value = state.profile.goalMonths;
  }
}

function showApp() {
  onboardingModal.classList.add('hidden');
  app.classList.remove('hidden');
  renderShoppingList();
  renderSchedule();
  renderScheduleOverview();
  renderMenuCards();
  renderIngredients();
  renderProfileCard();
}

function setupEventListeners() {
  startBtn.addEventListener('click', async () => {
    // Get all onboarding values
    const ageInput = document.getElementById('onboarding-age');
    const sexSelect = document.getElementById('onboarding-sex');
    const weightInput = document.getElementById('onboarding-weight');
    const heightInput = document.getElementById('onboarding-height');
    const activitySelect = document.getElementById('onboarding-activity');
    const goalWeightInput = document.getElementById('onboarding-goal-weight');
    const goalMonthsInput = document.getElementById('onboarding-goal-months');
    
    const age = parseInt(ageInput?.value, 10);
    const sex = sexSelect?.value || 'male';
    const weight = parseFloat(weightInput?.value);
    const height = parseFloat(heightInput?.value);
    const activityLevel = parseFloat(activitySelect?.value) || 1.55;
    const goalWeight = parseFloat(goalWeightInput?.value);
    const goalMonths = parseInt(goalMonthsInput?.value, 10);
    
    // Validate required fields
    clearValidationErrors(onboardingModal);
    let hasError = false;
    
    if (!age || age < 15 || age > 100) {
      showFieldError(ageInput, 'Please enter a valid age (15-100)');
      hasError = true;
    }
    if (!weight || weight < 30 || weight > 300) {
      showFieldError(weightInput, 'Please enter a valid weight (30-300 kg)');
      hasError = true;
    }
    if (!height || height < 100 || height > 250) {
      showFieldError(heightInput, 'Please enter a valid height (100-250 cm)');
      hasError = true;
    }
    if (!goalWeight || goalWeight < 30 || goalWeight > 300) {
      showFieldError(goalWeightInput, 'Please enter a valid goal weight (30-300 kg)');
      hasError = true;
    }
    if (!goalMonths || goalMonths < 1 || goalMonths > 24) {
      showFieldError(goalMonthsInput, 'Please enter a valid timeframe (1-24 months)');
      hasError = true;
    }
    
    if (hasError) return;
    
    // Save profile data
    state.profile = {
      age,
      sex,
      weight,
      height,
      activityLevel,
      goalWeight,
      goalMonths,
      maintenanceCalories: null,
      recommendedCalories: null
    };
    
    // Calculate calories
    calculateAndUpdateProfile();
    
    state.startDay = parseInt(startDaySelect.value, 10);
    state.onboarded = true;
    saveState();
    showApp();
    
    // Show success toast with calorie info
    if (state.profile.maintenanceCalories && state.profile.recommendedCalories) {
      const diff = state.profile.maintenanceCalories - state.profile.recommendedCalories;
      const direction = diff > 0 ? 'deficit' : diff < 0 ? 'surplus' : '';
      showToast(`Daily target: ${state.profile.recommendedCalories} kcal${direction ? ` (${Math.abs(diff)} kcal ${direction})` : ''}`, 'success');
    }
    
    // Prompt to connect ingredients file if no ingredients and File System API is supported
    if (isFileSystemSupported() && !getFileHandle() && dataStore.ingredients.length === 0) {
      setTimeout(async () => {
        const shouldConnect = confirm('Would you like to connect to your ingredients.json file? This will enable automatic syncing of ingredient changes.');
        if (shouldConnect) {
          const fileHandle = await selectIngredientsFile();
          if (fileHandle) {
            const ingredientsData = await loadIngredientsFromFile(fileHandle);
            if (ingredientsData && Array.isArray(ingredientsData)) {
              const items = ingredientsData.map(obj => new FoodItem(obj));
              setIngredients(items);
              renderIngredients();
              showToast('Connected to ingredients.json', 'success');
            } else {
              showToast('Invalid ingredients file', 'error');
            }
          }
        }
      }, 500);
    }
  });

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      switchTab(tabId);
    });
  });

  menuSearch.addEventListener('input', (e) => {
    filterMenuCards(e.target.value);
  });

  ingredientsSearch.addEventListener('input', (e) => {
    filterIngredients(e.target.value);
  });

  if (importMealsBtn && mealsFileInput) {
    importMealsBtn.addEventListener('click', () => mealsFileInput.click());
    mealsFileInput.addEventListener('change', handleMealsImport);
  }

  backToMenuBtn.addEventListener('click', () => {
    mealDetail.classList.remove('active');
    document.getElementById('menu-tab').classList.add('active');
  });

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
    state.checkedItems = {};
    saveState();
    renderShoppingList();
    resetWrapper.classList.remove('confirming');
  });

  settingsBtn.addEventListener('click', () => {
    const activeTab = document.querySelector('.tab-btn.active');
    if (activeTab) {
      previousTab = activeTab.dataset.tab;
    }
    tabBtns.forEach(btn => btn.classList.remove('active'));
    tabPanels.forEach(panel => panel.classList.remove('active'));
    settingsTab.classList.add('active');
    settingsBtn.classList.add('active');
  });

  backFromSettingsBtn.addEventListener('click', () => {
    settingsTab.classList.remove('active');
    settingsBtn.classList.remove('active');
    switchTab(previousTab);
  });

  // Settings event listeners
  setupSettingsListeners();
  
  // Profile event listeners
  setupProfileListeners();
  
  // Schedule event listeners
  setupScheduleListeners();

  const scheduleViewBtns = document.querySelectorAll('.view-btn');
  const scheduleGrid = document.getElementById('schedule-list');
  const scheduleCalendarElement = document.getElementById('schedule-calendar');

  scheduleViewBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      scheduleViewBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (view === 'list') {
        scheduleGrid.classList.remove('hidden');
        scheduleCalendarElement.classList.add('hidden');
        scrollToCurrentDay();
      } else {
        scheduleGrid.classList.add('hidden');
        scheduleCalendarElement.classList.remove('hidden');
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

  if (importIngredientsBtn && ingredientsFileInput) {
    importIngredientsBtn.addEventListener('click', () => ingredientsFileInput.click());
    ingredientsFileInput.addEventListener('change', handleIngredientsImport);
  }

  if (addIngredientToggle) {
    addIngredientToggle.addEventListener('click', () => {
      addIngredientForm.classList.toggle('hidden');
    });
  }

  if (saveIngredientBtn) {
    saveIngredientBtn.addEventListener('click', handleIngredientCreate);
  }

  if (cancelIngredientBtn) {
    cancelIngredientBtn.addEventListener('click', () => {
      clearIngredientForm();
      addIngredientForm.classList.add('hidden');
    });
  }

  // Edit ingredient modal event listeners
  if (saveEditIngredientBtn) {
    saveEditIngredientBtn.addEventListener('click', handleIngredientEdit);
  }

  if (cancelEditIngredientBtn) {
    cancelEditIngredientBtn.addEventListener('click', closeEditIngredientModal);
  }

  // Close modal when clicking outside
  if (editIngredientModal) {
    editIngredientModal.addEventListener('click', (e) => {
      if (e.target === editIngredientModal) {
        closeEditIngredientModal();
      }
    });
  }

  // Meal creation event listeners
  setupMealCreationListeners();
}

function setupMealCreationListeners() {
  if (createMealBtn) {
    createMealBtn.addEventListener('click', openCreateMealModal);
  }

  if (saveMealBtn) {
    saveMealBtn.addEventListener('click', handleMealCreate);
  }

  if (cancelMealBtn) {
    cancelMealBtn.addEventListener('click', closeCreateMealModal);
  }

  if (createMealModal) {
    createMealModal.addEventListener('click', (e) => {
      if (e.target === createMealModal) {
        closeCreateMealModal();
      }
    });
  }

  if (addMealIngredientBtn) {
    addMealIngredientBtn.addEventListener('click', openAddIngredientToMealModal);
  }

  if (confirmAddIngredientBtn) {
    confirmAddIngredientBtn.addEventListener('click', handleAddIngredientToMeal);
  }

  if (cancelAddIngredientBtn) {
    cancelAddIngredientBtn.addEventListener('click', closeAddIngredientToMealModal);
  }

  if (addIngredientModal) {
    addIngredientModal.addEventListener('click', (e) => {
      if (e.target === addIngredientModal) {
        closeAddIngredientToMealModal();
      }
    });
  }

  // Instruction block modal listeners
  if (addInstructionBlockBtn) {
    addInstructionBlockBtn.addEventListener('click', openAddInstructionModal);
  }

  if (confirmAddInstructionBtn) {
    confirmAddInstructionBtn.addEventListener('click', handleAddInstructionBlock);
  }

  if (cancelAddInstructionBtn) {
    cancelAddInstructionBtn.addEventListener('click', closeAddInstructionModal);
  }

  if (addInstructionModal) {
    addInstructionModal.addEventListener('click', (e) => {
      if (e.target === addInstructionModal) {
        closeAddInstructionModal();
      }
    });
  }
}

function switchTab(tabId) {
  tabBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });

  tabPanels.forEach(panel => {
    panel.classList.remove('active');
  });

  const panel = document.getElementById(`${tabId}-tab`);
  if (panel) {
    panel.classList.add('active');
  }

  settingsBtn.classList.remove('active');

  if (tabId === 'schedule' && !scheduleList.classList.contains('hidden')) {
    scrollToCurrentDay();
  }
}

function renderShoppingList() {
  shoppingList.innerHTML = '';
  const aggregated = aggregateShoppingList();

  if (!aggregated.length) {
    shoppingList.innerHTML = '<p class="empty-state">No planned meals yet. Build a schedule to generate a shopping list.</p>';
    return;
  }

  aggregated.forEach(({ category, items }) => {
    const categoryDiv = document.createElement('div');
    categoryDiv.className = 'shopping-category';

    categoryDiv.innerHTML = `
      <h2>${category}</h2>
      <div class="shopping-items">
        ${items.map((item, index) => {
          const itemId = `${category}-${item.id || index}`;
          const isChecked = state.checkedItems[itemId] || false;
          return `
            <div class="shopping-item ${isChecked ? 'checked' : ''}">
              <input type="checkbox" id="${itemId}" ${isChecked ? 'checked' : ''}>
              <label for="${itemId}">${item.name}</label>
              <span class="amount">${item.quantity} ${item.unit}</span>
            </div>
          `;
        }).join('')}
      </div>
    `;

    shoppingList.appendChild(categoryDiv);
  });

  shoppingList.querySelectorAll('.shopping-item').forEach(item => {
    item.addEventListener('click', () => {
      const checkbox = item.querySelector('input[type="checkbox"]');
      checkbox.checked = !checkbox.checked;
      const itemId = checkbox.id;
      state.checkedItems[itemId] = checkbox.checked;
      item.classList.toggle('checked', checkbox.checked);
      saveState();
    });
  });
}

function getScheduleDays() {
  const days = [];
  for (let i = 0; i < dataStore.schedule.length; i++) {
    const dayIndex = (state.startDay + i) % 7;
    days.push(DAY_NAMES[dayIndex]);
  }
  return days;
}

function getCurrentDayIndex() {
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

function getCurrentMealSlot() {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (minutes >= 300 && minutes < 630) return 'breakfast';
  if (minutes >= 630 && minutes < 900) return 'lunch';
  if (minutes >= 900 && minutes < 1080) return 'snack';
  if (minutes >= 1080 && minutes < 1320) return 'dinner';
  return null;
}

function renderScheduleList() {
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

function renderScheduleCalendar() {
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
    <div class="calendar-grid">
      <div class="calendar-column time-column">
        <div class="calendar-time-label"></div>
        <div class="calendar-time-label">7:00 AM</div>
        <div class="calendar-time-label">1:00 PM</div>
        <div class="calendar-time-label">4:00 PM</div>
        <div class="calendar-time-label">7:00 PM</div>
      </div>
      ${schedule.map((day, i) => {
        const slots = Array.isArray(day.slots) ? day.slots : [];
        return `
          <div class="calendar-column${i === currentDayIndex ? ' current-day-column' : ''}">
            <div class="calendar-day-header">Day ${i + 1}<br><span>${days[i]}</span></div>
            ${['breakfast', 'lunch', 'snack', 'dinner'].map(slotKey => {
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
      <div class="calendar-column cheat-column">
        <div class="calendar-day-header cheat-day">Cheat Day</div>
        <div class="calendar-cell cheat-cell">🎉</div>
        <div class="calendar-cell cheat-cell">🎉</div>
        <div class="calendar-cell cheat-cell">🎉</div>
        <div class="calendar-cell cheat-cell">🎉</div>
      </div>
    </div>
  `;

  scheduleCalendar.innerHTML = calendarHTML;
}

function renderSchedule() {
  renderScheduleList();
  renderScheduleCalendar();
}

function renderMenuCards() {
  menuCards.innerHTML = '';

  if (!dataStore.meals.length) {
    menuCards.innerHTML = '<p class="empty-state">No meals in the menu yet.</p>';
    return;
  }

  dataStore.meals.forEach(meal => {
    const card = document.createElement('div');
    card.className = 'menu-card';
    card.dataset.mealId = meal.id;

    const typeClass = meal.type === 'Snack' ? 'snack' : '';
    const macros = meal.macros;

    card.innerHTML = `
      <div class="menu-card-actions">
        <div class="action-buttons">
          <button class="btn-icon-sm btn-edit" data-action="edit" aria-label="Edit meal">
            <span class="material-symbols-rounded">edit</span>
          </button>
          <button class="btn-icon-sm btn-delete" data-action="delete" aria-label="Delete meal">
            <span class="material-symbols-rounded">delete</span>
          </button>
        </div>
        <div class="delete-confirm">
          <button class="btn-icon-sm btn-cancel" data-action="cancel-delete" aria-label="Cancel delete">
            <span class="material-symbols-rounded">close</span>
          </button>
          <button class="btn-icon-sm btn-confirm" data-action="confirm-delete" aria-label="Confirm delete">
            <span class="material-symbols-rounded">check</span>
          </button>
        </div>
      </div>
      <span class="meal-type ${typeClass}">${meal.type}</span>
      <h3>${meal.name}</h3>
      <div class="macros">
        <span><span class="material-symbols-rounded">local_fire_department</span> ${macros.kcal.toFixed(0)} kcal</span>
        <span><span class="material-symbols-rounded">fitness_center</span> ${macros.protein.toFixed(0)} g protein</span>
      </div>
    `;

    // Click on card (not on action buttons) shows detail
    card.addEventListener('click', (e) => {
      if (!e.target.closest('.menu-card-actions')) {
        showMealDetail(meal.id);
      }
    });

    // Edit button
    card.querySelector('[data-action="edit"]').addEventListener('click', (e) => {
      e.stopPropagation();
      openEditMealModal(meal.id);
    });

    // Delete button - show confirmation
    card.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
      e.stopPropagation();
      card.classList.add('confirming-delete');
    });

    // Cancel delete
    card.querySelector('[data-action="cancel-delete"]').addEventListener('click', (e) => {
      e.stopPropagation();
      card.classList.remove('confirming-delete');
    });

    // Confirm delete
    card.querySelector('[data-action="confirm-delete"]').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteMeal(meal.id);
    });

    menuCards.appendChild(card);
  });
}

function renderIngredients() {
  ingredientsList.innerHTML = '';
  const items = dataStore.ingredients;

  // Update category datalist for autocomplete
  updateCategoryDatalist();

  if (!items.length) {
    ingredientsList.innerHTML = '<p class="empty-state">No ingredients loaded.</p>';
    return;
  }

  const grouped = items.reduce((acc, item) => {
    const category = item.category || 'Uncategorized';
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {});

  const categoryHtml = Object.entries(grouped)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([category, list]) => {
      const cards = list
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(item => `
          <div class="ingredient-card" data-ingredient-id="${item.id}">
            <div class="ingredient-card-actions">
              <div class="action-buttons">
                <button class="btn-icon-sm btn-edit" data-action="edit" aria-label="Edit ingredient">
                  <span class="material-symbols-rounded">edit</span>
                </button>
                <button class="btn-icon-sm btn-delete" data-action="delete" aria-label="Delete ingredient">
                  <span class="material-symbols-rounded">delete</span>
                </button>
              </div>
              <div class="delete-confirm">
                <button class="btn-icon-sm btn-cancel" data-action="cancel-delete" aria-label="Cancel delete">
                  <span class="material-symbols-rounded">close</span>
                </button>
                <button class="btn-icon-sm btn-confirm" data-action="confirm-delete" aria-label="Confirm delete">
                  <span class="material-symbols-rounded">check</span>
                </button>
              </div>
            </div>
            <div class="ingredient-name">${item.name}</div>
            <div class="ingredient-meta">${item.unit} unit · ${category}</div>
            <div class="ingredient-macros">
              <span>${fmt(item.kcal)} kcal/${item.unit}</span>
              <span>${fmt(item.protein_per_unit)} g protein/${item.unit}</span>
              <span>${fmt(item.carb_per_unit)} g carbs/${item.unit}</span>
              <span>${fmt(item.lipid_per_unit)} g lipids/${item.unit}</span>
            </div>
          </div>
        `).join('');

      return `
        <div class="ingredient-category">
          <h2>${category}</h2>
          <div class="ingredients-grid">${cards}</div>
        </div>
      `;
    }).join('');

  ingredientsList.innerHTML = categoryHtml;

  // Attach event listeners for edit and delete
  ingredientsList.querySelectorAll('.ingredient-card').forEach(card => {
    const ingredientId = card.dataset.ingredientId;
    
    card.querySelector('[data-action="edit"]').addEventListener('click', (e) => {
      e.stopPropagation();
      openEditIngredientModal(ingredientId);
    });
    
    card.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
      e.stopPropagation();
      card.classList.add('confirming-delete');
    });

    card.querySelector('[data-action="cancel-delete"]').addEventListener('click', (e) => {
      e.stopPropagation();
      card.classList.remove('confirming-delete');
    });

    card.querySelector('[data-action="confirm-delete"]').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteIngredient(ingredientId);
    });
  });
}

function filterMenuCards(query) {
  const cards = menuCards.querySelectorAll('.menu-card');
  const lowerQuery = query.toLowerCase();

  cards.forEach(card => {
    const mealId = card.dataset.mealId;
    const meal = getMealById(mealId);
    const searchText = meal ? `${meal.name} ${meal.type}`.toLowerCase() : '';
    card.style.display = searchText.includes(lowerQuery) ? '' : 'none';
  });
}

function filterIngredients(query) {
  const cards = ingredientsList.querySelectorAll('.ingredient-card');
  const lowerQuery = query.toLowerCase();

  cards.forEach(card => {
    const ingredientId = card.dataset.ingredientId;
    const ingredient = dataStore.ingredients.find(i => i.id === ingredientId);
    const searchText = ingredient ? `${ingredient.name} ${ingredient.category || ''}`.toLowerCase() : '';
    card.style.display = searchText.includes(lowerQuery) ? '' : 'none';
  });
}

function showMealDetail(mealId) {
  const meal = getMealById(mealId);
  if (!meal) {
    mealDetailContent.innerHTML = '<p class="empty-state">Meal not found.</p>';
    document.getElementById('menu-tab').classList.remove('active');
    mealDetail.classList.add('active');
    return;
  }

  const hasInstructions = Array.isArray(meal.instructions) && meal.instructions.length;
  
  // Build instruction tabs if multiple instruction blocks exist
  let instructionsHTML = '';
  if (hasInstructions) {
    if (meal.instructions.length === 1) {
      // Single instruction block - no tabs needed
      const instr = meal.instructions[0];
      instructionsHTML = `
        <div class="instruction-block">
          <h3>${instr.name}</h3>
          <ol class="instructions-list">
            ${instr.steps.map(step => `<li>${step}</li>`).join('')}
          </ol>
        </div>
      `;
    } else {
      // Multiple instruction blocks - use tabs
      instructionsHTML = `
        <div class="instruction-tabs">
          <div class="instruction-tab-buttons">
            ${meal.instructions.map((instr, i) => `
              <button class="instruction-tab-btn${i === 0 ? ' active' : ''}" data-tab-index="${i}">
                ${instr.name}
              </button>
            `).join('')}
          </div>
          <div class="instruction-tab-panels">
            ${meal.instructions.map((instr, i) => `
              <div class="instruction-tab-panel${i === 0 ? ' active' : ''}" data-panel-index="${i}">
                <ol class="instructions-list">
                  ${instr.steps.map(step => `<li>${step}</li>`).join('')}
                </ol>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }
  } else {
    instructionsHTML = '<p class="empty-state">No instructions provided.</p>';
  }

  mealDetailContent.innerHTML = `
    <h1>${meal.name}</h1>
    <span class="meal-type ${meal.type === 'Snack' ? 'snack' : ''}" style="display: inline-block; margin-bottom: 1.5rem;">${meal.type}</span>
    <div class="detail-section">
      <h2><span class="material-symbols-rounded">monitoring</span> Nutrition Information</h2>
      <div class="nutrition-grid">
        <div class="nutrition-item">
          <div class="value">${meal.macros.kcal.toFixed(0)}</div>
          <div class="label">Calories (kcal)</div>
        </div>
        <div class="nutrition-item">
          <div class="value">${meal.macros.protein.toFixed(0)}</div>
          <div class="label">Protein (g)</div>
        </div>
      </div>
    </div>
    <div class="detail-section">
      <h2><span class="material-symbols-rounded">grocery</span> Ingredients</h2>
      <ul class="ingredients-list">
        ${meal.ingredients.map(entry => `
          <li>
            <span class="ingredient-name">${entry.item ? entry.item.name : 'Ingredient'}</span>
            <span class="ingredient-amount">${entry.quantity} ${entry.item ? entry.item.unit : ''}</span>
          </li>
        `).join('')}
      </ul>
    </div>
    <div class="detail-section">
      <h2><span class="material-symbols-rounded">menu_book</span> Cooking Instructions</h2>
      ${instructionsHTML}
    </div>
  `;

  // Setup tab switching if multiple instruction blocks
  if (hasInstructions && meal.instructions.length > 1) {
    const tabButtons = mealDetailContent.querySelectorAll('.instruction-tab-btn');
    const tabPanels = mealDetailContent.querySelectorAll('.instruction-tab-panel');
    
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const index = btn.dataset.tabIndex;
        
        tabButtons.forEach(b => b.classList.remove('active'));
        tabPanels.forEach(p => p.classList.remove('active'));
        
        btn.classList.add('active');
        mealDetailContent.querySelector(`[data-panel-index="${index}"]`).classList.add('active');
      });
    });
  }

  document.getElementById('menu-tab').classList.remove('active');
  mealDetail.classList.add('active');
}

function updateCategoryDatalist() {
  const datalist = document.getElementById('category-options');
  if (!datalist) return;

  const categories = [...new Set(
    dataStore.ingredients
      .map(item => item.category)
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));

  datalist.innerHTML = categories
    .map(cat => `<option value="${cat}">`)
    .join('');
}

function scrollToCurrentDay() {
  const currentDayElement = scheduleList.querySelector('.schedule-day.current-day');
  if (currentDayElement) {
    setTimeout(() => {
      const header = document.querySelector('.tab-nav');
      const headerHeight = header ? header.offsetHeight : 0;
      const elementTop = currentDayElement.getBoundingClientRect().top + window.scrollY;
      const offsetPosition = elementTop - headerHeight - 16;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }, 100);
  }
}

function showToast(message, type = 'default') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const icon = type === 'success' ? 'check_circle' : type === 'error' ? 'error' : 'info';
  toast.innerHTML = `<span class="material-symbols-rounded">${icon}</span>${message}`;
  
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function defaultTimeForSlot(slot) {
  switch (slot) {
    case 'breakfast': return '7:00 AM';
    case 'lunch': return '1:00 PM';
    case 'snack': return '4:00 PM';
    case 'dinner': return '7:00 PM';
    default: return '—';
  }
}

function titleCase(value = '') {
  return value.replace(/(^|\s)\w/g, match => match.toUpperCase());
}

function fmt(value) {
  return Number.isFinite(value) ? value.toFixed(2) : '0.00';
}

function showFieldError(inputElement, message) {
  const formField = inputElement.closest('.form-field');
  if (!formField) return;
  
  formField.classList.add('error');
  
  // Add or update error message
  let errorMsg = formField.querySelector('.error-message');
  if (!errorMsg) {
    errorMsg = document.createElement('span');
    errorMsg.className = 'error-message';
    formField.appendChild(errorMsg);
  }
  errorMsg.textContent = message;
  
  // Remove error on input
  inputElement.addEventListener('input', () => {
    formField.classList.remove('error');
  }, { once: true });
}

function clearValidationErrors(container) {
  if (!container) return;
  container.querySelectorAll('.form-field.error').forEach(field => {
    field.classList.remove('error');
  });
}

function slugify(value = '') {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || `item-${Date.now()}`;
}

async function handleIngredientCreate() {
  const name = (ingredientNameInput?.value || '').trim();
  const category = (ingredientCategoryInput?.value || '').trim() || 'Uncategorized';
  const unit = (ingredientUnitInput?.value || '').trim();
  const kcal = parseFloat(ingredientKcalInput?.value) || 0;
  const protein = parseFloat(ingredientProteinInput?.value) || 0;
  const carbs = parseFloat(ingredientCarbsInput?.value) || 0;
  const lipids = parseFloat(ingredientLipidsInput?.value) || 0;

  // Clear previous validation errors
  clearValidationErrors(addIngredientForm);

  // Validate required fields
  let hasError = false;
  if (!name) {
    showFieldError(ingredientNameInput, 'Name is required');
    hasError = true;
  }
  if (!unit) {
    showFieldError(ingredientUnitInput, 'Unit is required');
    hasError = true;
  }
  if (hasError) return;

  const newItem = new FoodItem({
    id: slugify(`${name}-${Date.now()}`),
    name,
    category,
    unit,
    kcal,
    protein_per_unit: protein,
    carb_per_unit: carbs,
    lipid_per_unit: lipids
  });

  const next = [...dataStore.ingredients, newItem];
  setIngredients(next);
  await saveIngredients();
  renderIngredients();
  clearIngredientForm();
  addIngredientForm.classList.add('hidden');
  showToast('Ingredient added', 'success');
}

function clearIngredientForm() {
  if (!ingredientNameInput) return;
  ingredientNameInput.value = '';
  ingredientCategoryInput.value = '';
  ingredientUnitInput.value = '';
  ingredientKcalInput.value = '';
  ingredientProteinInput.value = '';
  ingredientCarbsInput.value = '';
  ingredientLipidsInput.value = '';
}

async function handleIngredientsImport(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const asArray = Array.isArray(parsed) ? parsed : [parsed];
    const cleaned = asArray
      .filter(Boolean)
      .map(obj => new FoodItem(obj));

    if (!cleaned.length) {
      showToast('No valid ingredients found in file', 'error');
    } else {
      setIngredients(cleaned);
      await saveIngredients();
      renderIngredients();
      showToast(`Imported ${cleaned.length} ingredient${cleaned.length === 1 ? '' : 's'}`, 'success');
    }
  } catch (err) {
    console.error('Failed to import ingredients', err);
    showToast('Invalid JSON file', 'error');
  } finally {
    event.target.value = '';
  }
}

async function handleMealsImport(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const asArray = Array.isArray(parsed) ? parsed : [parsed];
    
    // Filter valid meals and hydrate them
    const newMeals = asArray
      .filter(Boolean)
      .map(obj => {
        try {
          // Basic validation
          if (!obj.name || !obj.type) return null;
          return hydrateMeal(obj);
        } catch (e) {
          return null;
        }
      })
      .filter(Boolean);

    if (!newMeals.length) {
      showToast('No valid meals found in file', 'error');
    } else {
      // Check for ID conflicts and regenerate if needed
      const existingIds = new Set(dataStore.meals.map(m => m.id));
      
      const mealsToAdd = newMeals.map(meal => {
        if (existingIds.has(meal.id)) {
          // Regenerate ID
          meal.id = slugify(`${meal.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
        }
        return meal;
      });

      const updatedMeals = [...dataStore.meals, ...mealsToAdd];
      setMeals(updatedMeals);
      saveMeals();
      renderMenuCards();
      showToast(`Imported ${mealsToAdd.length} meal${mealsToAdd.length === 1 ? '' : 's'}`, 'success');
    }
  } catch (err) {
    console.error('Failed to import meals', err);
    showToast('Invalid JSON file', 'error');
  } finally {
    event.target.value = '';
  }
}

function openEditIngredientModal(ingredientId) {
  const ingredient = dataStore.ingredients.find(i => i.id === ingredientId);
  if (!ingredient) return;

  editingIngredientId = ingredientId;
  editIngredientName.value = ingredient.name || '';
  editIngredientCategory.value = ingredient.category || '';
  editIngredientUnit.value = ingredient.unit || '';
  editIngredientKcal.value = ingredient.kcal || '';
  editIngredientProtein.value = ingredient.protein_per_unit || '';
  editIngredientCarbs.value = ingredient.carb_per_unit || '';
  editIngredientLipids.value = ingredient.lipid_per_unit || '';

  editIngredientModal.classList.remove('hidden');
}

function closeEditIngredientModal() {
  editingIngredientId = null;
  editIngredientName.value = '';
  editIngredientCategory.value = '';
  editIngredientUnit.value = '';
  editIngredientKcal.value = '';
  editIngredientProtein.value = '';
  editIngredientCarbs.value = '';
  editIngredientLipids.value = '';
  editIngredientModal.classList.add('hidden');
}

async function handleIngredientEdit() {
  if (!editingIngredientId) return;

  const name = (editIngredientName.value || '').trim();
  const category = (editIngredientCategory.value || '').trim() || 'Uncategorized';
  const unit = (editIngredientUnit.value || '').trim();
  const kcal = parseFloat(editIngredientKcal.value) || 0;
  const protein = parseFloat(editIngredientProtein.value) || 0;
  const carbs = parseFloat(editIngredientCarbs.value) || 0;
  const lipids = parseFloat(editIngredientLipids.value) || 0;

  // Clear previous validation errors
  clearValidationErrors(editIngredientModal);

  // Validate required fields
  let hasError = false;
  if (!name) {
    showFieldError(editIngredientName, 'Name is required');
    hasError = true;
  }
  if (!unit) {
    showFieldError(editIngredientUnit, 'Unit is required');
    hasError = true;
  }
  if (hasError) return;

  const updatedIngredients = dataStore.ingredients.map(item => {
    if (item.id === editingIngredientId) {
      return new FoodItem({
        id: item.id,
        name,
        category,
        unit,
        kcal,
        protein_per_unit: protein,
        carb_per_unit: carbs,
        lipid_per_unit: lipids
      });
    }
    return item;
  });

  setIngredients(updatedIngredients);
  await saveIngredients();
  renderIngredients();
  closeEditIngredientModal();
  showToast('Ingredient updated', 'success');
}

async function deleteIngredient(ingredientId) {
  const ingredient = dataStore.ingredients.find(i => i.id === ingredientId);
  if (!ingredient) return;

  const updatedIngredients = dataStore.ingredients.filter(i => i.id !== ingredientId);
  setIngredients(updatedIngredients);
  await saveIngredients();
  renderIngredients();
  showToast(`"${ingredient.name}" deleted`, 'success');
}

// ===== Meal Creation Functions =====

function saveMeals() {
  localStorage.setItem('mealPrepMeals', JSON.stringify(dataStore.meals));
}

function hydrateMeal(obj) {
  // Reconstruct Meal with proper class instances from plain JSON
  const ingredients = (obj.ingredients || []).map(entry => {
    const item = dataStore.ingredients.find(i => i.id === entry.itemId);
    return new FoodItemEntry({
      item: item || new FoodItem({ id: entry.itemId, name: entry.itemName || 'Unknown', unit: entry.itemUnit || '', kcal: 0, protein_per_unit: 0, carb_per_unit: 0, lipid_per_unit: 0 }),
      quantity: entry.quantity
    });
  });

  const instructions = (obj.instructions || []).map(instr => 
    new CookingInstruction({ name: instr.name, steps: instr.steps })
  );

  return new Meal({
    id: obj.id,
    name: obj.name,
    type: obj.type,
    ingredients,
    instructions
  });
}

function serializeMeal(meal) {
  // Convert Meal to plain JSON for storage
  return {
    id: meal.id,
    name: meal.name,
    type: meal.type,
    ingredients: meal.ingredients.map(entry => ({
      itemId: entry.item?.id,
      itemName: entry.item?.name,
      itemUnit: entry.item?.unit,
      quantity: entry.quantity
    })),
    instructions: meal.instructions.map(instr => ({
      name: instr.name,
      steps: instr.steps
    }))
  };
}

function openCreateMealModal() {
  editingMealId = null;
  currentMealIngredients = [];
  currentMealInstructions = [];
  mealNameInput.value = '';
  mealTypeSelect.value = 'Breakfast';
  renderMealIngredientsList();
  renderMealInstructionsList();
  updateMealModalTitle();
  createMealModal.classList.remove('hidden');
}

function openEditMealModal(mealId) {
  const meal = getMealById(mealId);
  if (!meal) return;

  editingMealId = mealId;
  currentMealIngredients = meal.ingredients.map(entry => 
    new FoodItemEntry({ item: entry.item, quantity: entry.quantity })
  );
  currentMealInstructions = meal.instructions.map(instr => 
    new CookingInstruction({ name: instr.name, steps: [...instr.steps] })
  );

  mealNameInput.value = meal.name;
  mealTypeSelect.value = meal.type;
  renderMealIngredientsList();
  renderMealInstructionsList();
  updateMealModalTitle();
  createMealModal.classList.remove('hidden');
}

function updateMealModalTitle() {
  const titleEl = createMealModal.querySelector('h2');
  if (titleEl) {
    titleEl.textContent = editingMealId ? 'Edit Meal' : 'Create New Meal';
  }
  const saveBtn = createMealModal.querySelector('#save-meal');
  if (saveBtn) {
    const span = saveBtn.querySelector('.material-symbols-rounded');
    const iconText = editingMealId ? 'save' : 'save';
    const labelText = editingMealId ? 'Save Changes' : 'Save Meal';
    saveBtn.innerHTML = `<span class="material-symbols-rounded">${iconText}</span>${labelText}`;
  }
}

function closeCreateMealModal() {
  editingMealId = null;
  currentMealIngredients = [];
  currentMealInstructions = [];
  createMealModal.classList.add('hidden');
  clearValidationErrors(createMealModal);
}

function renderMealIngredientsList() {
  if (!currentMealIngredients.length) {
    mealIngredientsList.innerHTML = '<p class="empty-state-small">No ingredients added yet</p>';
    return;
  }

  mealIngredientsList.innerHTML = currentMealIngredients.map((entry, index) => `
    <div class="meal-ingredient-item" data-index="${index}">
      <div class="meal-ingredient-info">
        <span class="meal-ingredient-name">${entry.item.name}</span>
        <span class="meal-ingredient-qty">${entry.quantity} ${entry.item.unit}</span>
      </div>
      <button class="btn-icon btn-delete" data-action="remove" aria-label="Remove ingredient">
        <span class="material-symbols-rounded">close</span>
      </button>
    </div>
  `).join('');

  // Attach remove listeners
  mealIngredientsList.querySelectorAll('[data-action="remove"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(btn.closest('.meal-ingredient-item').dataset.index, 10);
      currentMealIngredients.splice(index, 1);
      renderMealIngredientsList();
    });
  });
}

function openAddIngredientToMealModal() {
  // Populate ingredient dropdown
  selectIngredientDropdown.innerHTML = '<option value="">Select an ingredient...</option>';
  dataStore.ingredients
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach(item => {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = `${item.name} (${item.unit})`;
      selectIngredientDropdown.appendChild(option);
    });

  ingredientQuantityInput.value = '';
  addIngredientModal.classList.remove('hidden');
}

function closeAddIngredientToMealModal() {
  addIngredientModal.classList.add('hidden');
  clearValidationErrors(addIngredientModal);
}

function handleAddIngredientToMeal() {
  const ingredientId = selectIngredientDropdown.value;
  const quantity = parseFloat(ingredientQuantityInput.value) || 0;

  clearValidationErrors(addIngredientModal);

  let hasError = false;
  if (!ingredientId) {
    showFieldError(selectIngredientDropdown, 'Please select an ingredient');
    hasError = true;
  }
  if (quantity <= 0) {
    showFieldError(ingredientQuantityInput, 'Quantity must be greater than 0');
    hasError = true;
  }
  if (hasError) return;

  const item = dataStore.ingredients.find(i => i.id === ingredientId);
  if (!item) return;

  currentMealIngredients.push(new FoodItemEntry({ item, quantity }));
  renderMealIngredientsList();
  closeAddIngredientToMealModal();
}

function handleMealCreate() {
  const name = (mealNameInput.value || '').trim();
  const type = mealTypeSelect.value;

  clearValidationErrors(createMealModal);

  let hasError = false;
  if (!name) {
    showFieldError(mealNameInput, 'Meal name is required');
    hasError = true;
  }
  if (!currentMealIngredients.length) {
    showToast('Please add at least one ingredient', 'error');
    hasError = true;
  }
  if (hasError) return;

  if (editingMealId) {
    // Update existing meal
    const existingIndex = dataStore.meals.findIndex(m => m.id === editingMealId);
    if (existingIndex === -1) {
      showToast('Meal not found', 'error');
      return;
    }

    const updatedMeal = new Meal({
      id: editingMealId,
      name,
      type,
      ingredients: currentMealIngredients,
      instructions: currentMealInstructions
    });

    const updatedMeals = [...dataStore.meals];
    updatedMeals[existingIndex] = updatedMeal;
    setMeals(updatedMeals);
    localStorage.setItem('mealPrepMeals', JSON.stringify(updatedMeals.map(serializeMeal)));

    renderMenuCards();
    closeCreateMealModal();
    showToast('Meal updated', 'success');
  } else {
    // Create new meal
    const newMeal = new Meal({
      id: slugify(`${name}-${Date.now()}`),
      name,
      type,
      ingredients: currentMealIngredients,
      instructions: currentMealInstructions
    });

    const updatedMeals = [...dataStore.meals, newMeal];
    setMeals(updatedMeals);
    localStorage.setItem('mealPrepMeals', JSON.stringify(updatedMeals.map(serializeMeal)));

    renderMenuCards();
    closeCreateMealModal();
    showToast('Meal created', 'success');
  }
}

function deleteMeal(mealId) {
  const updatedMeals = dataStore.meals.filter(m => m.id !== mealId);
  setMeals(updatedMeals);
  localStorage.setItem('mealPrepMeals', JSON.stringify(updatedMeals.map(serializeMeal)));
  renderMenuCards();
  showToast('Meal deleted', 'success');
}

// ===== Instruction Block Functions =====

function renderMealInstructionsList() {
  if (!currentMealInstructions.length) {
    mealInstructionsList.innerHTML = '<p class="empty-state-small">No instruction blocks added yet</p>';
    return;
  }

  mealInstructionsList.innerHTML = currentMealInstructions.map((instr, index) => `
    <div class="instruction-block-item" data-index="${index}">
      <div class="instruction-block-header">
        <span class="instruction-block-name">${instr.name}</span>
        <button class="btn-icon btn-delete" data-action="remove" aria-label="Remove instruction block">
          <span class="material-symbols-rounded">close</span>
        </button>
      </div>
      <ol class="instruction-block-steps">
        ${instr.steps.map(step => `<li>${step}</li>`).join('')}
      </ol>
    </div>
  `).join('');

  // Attach remove listeners
  mealInstructionsList.querySelectorAll('[data-action="remove"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(btn.closest('.instruction-block-item').dataset.index, 10);
      currentMealInstructions.splice(index, 1);
      renderMealInstructionsList();
    });
  });
}

function openAddInstructionModal() {
  instructionBlockNameInput.value = '';
  instructionBlockStepsInput.value = '';
  addInstructionModal.classList.remove('hidden');
}

function closeAddInstructionModal() {
  addInstructionModal.classList.add('hidden');
  clearValidationErrors(addInstructionModal);
}

function handleAddInstructionBlock() {
  const name = (instructionBlockNameInput.value || '').trim();
  const stepsText = (instructionBlockStepsInput.value || '').trim();

  clearValidationErrors(addInstructionModal);

  let hasError = false;
  if (!name) {
    showFieldError(instructionBlockNameInput, 'Block name is required');
    hasError = true;
  }
  if (!stepsText) {
    showFieldError(instructionBlockStepsInput, 'At least one step is required');
    hasError = true;
  }
  if (hasError) return;

  const steps = stepsText.split('\n').map(s => s.trim()).filter(Boolean);
  if (!steps.length) {
    showFieldError(instructionBlockStepsInput, 'At least one step is required');
    return;
  }

  currentMealInstructions.push(new CookingInstruction({ name, steps }));
  renderMealInstructionsList();
  closeAddInstructionModal();
}

function setupSettingsListeners() {
  const settingsStartDay = document.getElementById('settings-start-day');
  const clearShoppingBtn = document.getElementById('clear-shopping-data');
  const deleteIngredientsBtn = document.getElementById('delete-ingredients-data');
  const deleteAllBtn = document.getElementById('delete-all-data');
  const connectFileBtn = document.getElementById('connect-ingredients-file');
  const disconnectFileBtn = document.getElementById('disconnect-ingredients-file');
  const fileStatus = document.getElementById('file-status');
  const disconnectItem = document.getElementById('disconnect-file-item');

  // Initialize start day select with current value
  if (settingsStartDay) {
    settingsStartDay.value = state.startDay;
    settingsStartDay.addEventListener('change', () => {
      state.startDay = parseInt(settingsStartDay.value, 10);
      saveState();
      renderSchedule();
      showToast('Start day updated', 'success');
    });
  }

  // File system integration
  if (connectFileBtn && isFileSystemSupported()) {
    updateFileSystemUI();
    
    connectFileBtn.addEventListener('click', async () => {
      // First, try to reconnect to stored handle by requesting permission
      const hasStoredHandle = await hasStoredFileHandle();
      if (hasStoredHandle && !getFileHandle()) {
        // Try to get permission for stored handle
        const ingredientsData = await requestPermissionAndLoad();
        if (ingredientsData && Array.isArray(ingredientsData)) {
          const items = ingredientsData.map(obj => new FoodItem(obj));
          setIngredients(items);
          renderIngredients();
          await updateFileSystemUI();
          showToast('Reconnected to ingredients.json', 'success');
          return;
        }
      }
      
      // Otherwise, show file picker
      const fileHandle = await selectIngredientsFile();
      if (fileHandle) {
        const ingredientsData = await loadIngredientsFromFile(fileHandle);
        if (ingredientsData && Array.isArray(ingredientsData)) {
          const items = ingredientsData.map(obj => new FoodItem(obj));
          setIngredients(items);
          renderIngredients();
          await updateFileSystemUI();
          showToast('Connected to ingredients.json', 'success');
        } else {
          showToast('Invalid ingredients file', 'error');
        }
      }
    });

    disconnectFileBtn?.addEventListener('click', async () => {
      await clearFileHandle();
      await updateFileSystemUI();
      showToast('Disconnected from file', 'success');
    });
  } else if (connectFileBtn && !isFileSystemSupported()) {
    connectFileBtn.disabled = true;
    connectFileBtn.innerHTML = '<span class="material-symbols-rounded">block</span> Not Supported';
    if (fileStatus) {
      fileStatus.textContent = 'File System Access API not supported in this browser. Use Chrome or Edge.';
    }
  }

  async function updateFileSystemUI() {
    const hasFile = !!getFileHandle();
    const hasStoredHandle = await hasStoredFileHandle();
    
    if (fileStatus && disconnectItem) {
      if (hasFile) {
        fileStatus.textContent = '✓ Connected to ingredients.json - changes auto-save';
        fileStatus.style.color = 'var(--success)';
        disconnectItem.style.display = 'flex';
        connectFileBtn.innerHTML = '<span class="material-symbols-rounded">sync</span> Reconnect';
      } else if (hasStoredHandle) {
        fileStatus.textContent = '⚠ File connected but needs permission - click Reconnect';
        fileStatus.style.color = 'var(--warning, #f59e0b)';
        disconnectItem.style.display = 'flex';
        connectFileBtn.innerHTML = '<span class="material-symbols-rounded">lock_open</span> Reconnect';
      } else {
        fileStatus.textContent = 'Connect to ingredients.json file for automatic sync';
        fileStatus.style.color = '';
        disconnectItem.style.display = 'none';
        connectFileBtn.innerHTML = '<span class="material-symbols-rounded">attach_file</span> Select File';
      }
    }
  }

  // Setup confirmation wrappers for destructive actions
  setupDestructiveAction(clearShoppingBtn, () => {
    state.checkedItems = {};
    saveState();
    renderShoppingList();
    showToast('Shopping checklist cleared', 'success');
  });

  setupDestructiveAction(deleteIngredientsBtn, async () => {
    setIngredients([]);
    await saveIngredients();
    renderIngredients();
    showToast('All ingredients deleted', 'success');
  });

  setupDestructiveAction(deleteAllBtn, () => {
    // Clear all localStorage data
    localStorage.removeItem('mealPrepState');
    localStorage.removeItem('mealPrepIngredients');
    localStorage.removeItem('mealPrepMeals');
    localStorage.removeItem('mealPrepSchedule');
    
    // Reset state
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
    
    // Reset data store
    setIngredients([]);
    setMeals([]);
    setSchedule([]);
    
    showToast('All data deleted', 'success');
    
    // Show onboarding after a brief delay
    setTimeout(() => {
      showOnboarding();
    }, 500);
  });
}

function setupDestructiveAction(button, onConfirm) {
  if (!button) return;
  
  const wrapper = button.closest('.setting-action-wrapper');
  if (!wrapper) return;
  
  const cancelBtn = wrapper.querySelector('[data-action="cancel"]');
  const confirmBtn = wrapper.querySelector('[data-action="confirm"]');
  
  button.addEventListener('click', () => {
    wrapper.classList.add('confirming');
  });
  
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      wrapper.classList.remove('confirming');
    });
  }
  
  if (confirmBtn) {
    confirmBtn.addEventListener('click', () => {
      wrapper.classList.remove('confirming');
      onConfirm();
    });
  }
}

// Profile card rendering
function renderProfileCard() {
  const profile = state.profile;
  if (!profile) return;
  
  const statsSummary = document.getElementById('profile-stats-summary');
  const activityLabel = document.getElementById('profile-activity-label');
  const maintenanceEl = document.getElementById('profile-maintenance');
  const targetEl = document.getElementById('profile-target');
  const differenceEl = document.getElementById('profile-difference');
  const goalTextEl = document.getElementById('profile-goal-text');
  
  if (profile.age && profile.weight && profile.height) {
    statsSummary.textContent = `${profile.age}y, ${profile.weight}kg, ${profile.height}cm, ${profile.sex}`;
  } else {
    statsSummary.textContent = 'Profile not set';
  }
  
  activityLabel.textContent = getActivityLevelLabel(profile.activityLevel);
  
  if (profile.maintenanceCalories) {
    maintenanceEl.textContent = `${profile.maintenanceCalories} kcal`;
  } else {
    maintenanceEl.textContent = '-- kcal';
  }
  
  if (profile.recommendedCalories) {
    targetEl.textContent = `${profile.recommendedCalories} kcal`;
  } else {
    targetEl.textContent = '-- kcal';
  }
  
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
    
    // Check if goal is realistic
    const goalCheck = isGoalRealistic(profile.weight, profile.goalWeight, profile.goalMonths);
    const goalEl = goalTextEl.closest('.profile-goal');
    
    if (direction === 'maintain') {
      goalTextEl.textContent = `Maintain ${profile.weight}kg`;
      goalEl.classList.remove('profile-goal-warning');
    } else {
      let goalText = `${direction === 'lose' ? 'Lose' : 'Gain'} ${Math.abs(weightChange).toFixed(1)}kg in ${profile.goalMonths} month${profile.goalMonths > 1 ? 's' : ''} → ${profile.goalWeight}kg`;
      
      if (!goalCheck.isRealistic) {
        goalText += ` ⚠️ (${goalCheck.weeklyChange.toFixed(1)}kg/week is aggressive — recommend ${goalCheck.recommendedMonths}+ months)`;
        goalEl.classList.add('profile-goal-warning');
      } else {
        goalEl.classList.remove('profile-goal-warning');
      }
      
      goalTextEl.textContent = goalText;
    }
  } else {
    goalTextEl.textContent = 'No goal set';
    const goalEl = goalTextEl.closest('.profile-goal');
    if (goalEl) goalEl.classList.remove('profile-goal-warning');
  }
}

// Edit profile modal functions
function openEditProfileModal() {
  const profile = state.profile || {};
  const editProfileModal = document.getElementById('edit-profile-modal');
  
  const ageInput = document.getElementById('edit-profile-age');
  const sexSelect = document.getElementById('edit-profile-sex');
  const weightInput = document.getElementById('edit-profile-weight');
  const heightInput = document.getElementById('edit-profile-height');
  const activitySelect = document.getElementById('edit-profile-activity');
  const goalWeightInput = document.getElementById('edit-profile-goal-weight');
  const goalMonthsInput = document.getElementById('edit-profile-goal-months');
  
  if (ageInput) ageInput.value = profile.age || '';
  if (sexSelect) sexSelect.value = profile.sex || 'male';
  if (weightInput) weightInput.value = profile.weight || '';
  if (heightInput) heightInput.value = profile.height || '';
  if (activitySelect) activitySelect.value = profile.activityLevel || 1.55;
  if (goalWeightInput) goalWeightInput.value = profile.goalWeight || '';
  if (goalMonthsInput) goalMonthsInput.value = profile.goalMonths || '';
  
  editProfileModal.classList.remove('hidden');
}

function closeEditProfileModal() {
  const editProfileModal = document.getElementById('edit-profile-modal');
  editProfileModal.classList.add('hidden');
  clearValidationErrors(editProfileModal);
}

function handleSaveProfile() {
  const editProfileModal = document.getElementById('edit-profile-modal');
  
  const ageInput = document.getElementById('edit-profile-age');
  const sexSelect = document.getElementById('edit-profile-sex');
  const weightInput = document.getElementById('edit-profile-weight');
  const heightInput = document.getElementById('edit-profile-height');
  const activitySelect = document.getElementById('edit-profile-activity');
  const goalWeightInput = document.getElementById('edit-profile-goal-weight');
  const goalMonthsInput = document.getElementById('edit-profile-goal-months');
  
  const age = parseInt(ageInput?.value, 10);
  const sex = sexSelect?.value || 'male';
  const weight = parseFloat(weightInput?.value);
  const height = parseFloat(heightInput?.value);
  const activityLevel = parseFloat(activitySelect?.value) || 1.55;
  const goalWeight = parseFloat(goalWeightInput?.value);
  const goalMonths = parseInt(goalMonthsInput?.value, 10);
  
  clearValidationErrors(editProfileModal);
  let hasError = false;
  
  if (!age || age < 15 || age > 100) {
    showFieldError(ageInput, 'Please enter a valid age (15-100)');
    hasError = true;
  }
  if (!weight || weight < 30 || weight > 300) {
    showFieldError(weightInput, 'Please enter a valid weight (30-300 kg)');
    hasError = true;
  }
  if (!height || height < 100 || height > 250) {
    showFieldError(heightInput, 'Please enter a valid height (100-250 cm)');
    hasError = true;
  }
  if (!goalWeight || goalWeight < 30 || goalWeight > 300) {
    showFieldError(goalWeightInput, 'Please enter a valid goal weight (30-300 kg)');
    hasError = true;
  }
  if (!goalMonths || goalMonths < 1 || goalMonths > 24) {
    showFieldError(goalMonthsInput, 'Please enter a valid timeframe (1-24 months)');
    hasError = true;
  }
  
  if (hasError) return;
  
  // Update profile
  state.profile = {
    age,
    sex,
    weight,
    height,
    activityLevel,
    goalWeight,
    goalMonths,
    maintenanceCalories: null,
    recommendedCalories: null
  };
  
  // Recalculate calories
  calculateAndUpdateProfile();
  
  saveState();
  renderProfileCard();
  closeEditProfileModal();
  
  showToast('Profile updated', 'success');
}

// Setup edit profile event listeners
function setupProfileListeners() {
  const editProfileBtn = document.getElementById('edit-profile-btn');
  const saveEditProfileBtn = document.getElementById('save-edit-profile');
  const cancelEditProfileBtn = document.getElementById('cancel-edit-profile');
  
  if (editProfileBtn) {
    editProfileBtn.addEventListener('click', openEditProfileModal);
  }
  if (saveEditProfileBtn) {
    saveEditProfileBtn.addEventListener('click', handleSaveProfile);
  }
  if (cancelEditProfileBtn) {
    cancelEditProfileBtn.addEventListener('click', closeEditProfileModal);
  }
}

// Schedule editing
let tempSchedule = []; // Temporary schedule being edited
let tempCheatDay = null; // Index of cheat day (0-6) or null

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

function getWeeklyCalorieTarget() {
  const dailyTarget = state.profile?.recommendedCalories;
  if (!dailyTarget) return null;
  return dailyTarget * 7;
}

function calculateScheduleCalories(schedule, excludeCheatDay = false) {
  let total = 0;
  schedule.forEach((day, index) => {
    if (excludeCheatDay && day.isCheatDay) return;
    if (!day.slots) return;
    day.slots.forEach(slot => {
      if (slot.mealId) {
        const meal = getMealById(slot.mealId);
        if (meal) {
          total += meal.macros.kcal;
        }
      }
    });
  });
  return Math.round(total);
}

function calculateDayCalories(day) {
  let total = 0;
  if (!day.slots) return 0;
  day.slots.forEach(slot => {
    if (slot.mealId) {
      const meal = getMealById(slot.mealId);
      if (meal) {
        total += meal.macros.kcal;
      }
    }
  });
  return Math.round(total);
}

function updateScheduleCalorieSummary() {
  const weeklyTarget = getWeeklyCalorieTarget();
  const totalCalories = calculateScheduleCalories(tempSchedule, true); // Exclude cheat day
  const cheatDayIndex = tempSchedule.findIndex(d => d.isCheatDay);
  
  const weeklyTargetEl = document.getElementById('schedule-weekly-target');
  const totalCaloriesEl = document.getElementById('schedule-total-calories');
  const remainingCaloriesEl = document.getElementById('schedule-remaining-calories');
  const warningEl = document.getElementById('schedule-calorie-warning');
  const cheatDayInfoEl = document.getElementById('schedule-cheat-day-info');
  const cheatDayBudgetEl = document.getElementById('cheat-day-budget');
  
  if (weeklyTarget) {
    weeklyTargetEl.textContent = `${weeklyTarget.toLocaleString()} kcal`;
    totalCaloriesEl.textContent = `${totalCalories.toLocaleString()} kcal`;
    
    const remaining = weeklyTarget - totalCalories;
    remainingCaloriesEl.textContent = `${remaining.toLocaleString()} kcal`;
    
    // Update styling based on over/under
    if (remaining < 0) {
      remainingCaloriesEl.classList.add('over-budget');
      remainingCaloriesEl.classList.remove('under-budget');
      warningEl.classList.remove('hidden');
    } else {
      remainingCaloriesEl.classList.remove('over-budget');
      remainingCaloriesEl.classList.add('under-budget');
      warningEl.classList.add('hidden');
    }
    
    // Cheat day info
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
  
  // Clone current schedule or create empty one
  if (dataStore.schedule.length > 0) {
    tempSchedule = JSON.parse(JSON.stringify(dataStore.schedule));
    // Ensure isCheatDay property exists
    tempSchedule.forEach(day => {
      if (day.isCheatDay === undefined) day.isCheatDay = false;
    });
  } else {
    tempSchedule = initializeEmptySchedule();
  }
  
  tempCheatDay = tempSchedule.findIndex(d => d.isCheatDay);
  if (tempCheatDay === -1) tempCheatDay = null;
  
  renderScheduleEditor();
  updateScheduleCalorieSummary();
  modal.classList.remove('hidden');
}

function closeEditScheduleModal() {
  const modal = document.getElementById('edit-schedule-modal');
  modal.classList.add('hidden');
  tempSchedule = [];
  tempCheatDay = null;
}

function renderScheduleEditor() {
  const grid = document.getElementById('schedule-editor-grid');
  const days = getScheduleDays();
  const meals = dataStore.meals;
  
  // Ensure we have 7 days
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
  
  grid.innerHTML = tempSchedule.map((day, dayIndex) => {
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
        ${isCheatDay ? `
          <div class="cheat-day-banner">
            <span class="material-symbols-rounded">celebration</span>
            Cheat Day — meals not scheduled
          </div>
        ` : `
          <div class="schedule-editor-slots">
            ${['breakfast', 'lunch', 'snack', 'dinner'].map(slotType => {
              const slot = slots.find(s => s.slot === slotType) || { slot: slotType, mealId: null };
              const selectedMeal = slot.mealId || '';
              
              // Filter meals by type matching slot
              const matchingMeals = meals.filter(m => m.type.toLowerCase() === slotType.toLowerCase());
              const otherMeals = meals.filter(m => m.type.toLowerCase() !== slotType.toLowerCase());
              
              return `
                <div class="schedule-editor-slot">
                  <label class="slot-label">${titleCase(slotType)}</label>
                  <select class="slot-select" data-day="${dayIndex}" data-slot="${slotType}">
                    <option value="">— No meal —</option>
                    ${matchingMeals.length > 0 ? `
                      <optgroup label="${titleCase(slotType)} Meals">
                        ${matchingMeals.map(m => `<option value="${m.id}" ${m.id === selectedMeal ? 'selected' : ''}>${m.name} (${m.macros.kcal.toFixed(0)} kcal)</option>`).join('')}
                      </optgroup>
                    ` : ''}
                    ${otherMeals.length > 0 ? `
                      <optgroup label="Other Meals">
                        ${otherMeals.map(m => `<option value="${m.id}" ${m.id === selectedMeal ? 'selected' : ''}>${m.name} (${m.macros.kcal.toFixed(0)} kcal)</option>`).join('')}
                      </optgroup>
                    ` : ''}
                  </select>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    `;
  }).join('');
  
  // Attach change listeners for meal selection
  grid.querySelectorAll('.slot-select').forEach(select => {
    select.addEventListener('change', (e) => {
      const dayIndex = parseInt(e.target.dataset.day, 10);
      const slotType = e.target.dataset.slot;
      const mealId = e.target.value || null;
      
      const slot = tempSchedule[dayIndex].slots.find(s => s.slot === slotType);
      if (slot) {
        slot.mealId = mealId;
      }
      updateScheduleCalorieSummary();
      // Update day calories display
      const dayEl = e.target.closest('.schedule-editor-day');
      const dayCaloriesEl = dayEl.querySelector('.day-calories');
      if (dayCaloriesEl) {
        dayCaloriesEl.textContent = `${calculateDayCalories(tempSchedule[dayIndex])} kcal`;
      }
    });
  });
  
  // Attach cheat day toggle listeners
  grid.querySelectorAll('.btn-cheat-day').forEach(btn => {
    btn.addEventListener('click', () => {
      const dayIndex = parseInt(btn.dataset.day, 10);
      toggleCheatDay(dayIndex);
    });
  });
}

function toggleCheatDay(dayIndex) {
  // If this day is already cheat day, remove it
  if (tempSchedule[dayIndex].isCheatDay) {
    tempSchedule[dayIndex].isCheatDay = false;
    tempCheatDay = null;
  } else {
    // Remove cheat day from any other day
    tempSchedule.forEach((day, i) => {
      day.isCheatDay = i === dayIndex;
    });
    tempCheatDay = dayIndex;
    // Clear meals for cheat day
    tempSchedule[dayIndex].slots.forEach(slot => {
      slot.mealId = null;
    });
  }
  renderScheduleEditor();
  updateScheduleCalorieSummary();
}

function autoGenerateSchedule() {
  const meals = dataStore.meals;
  const weeklyTarget = getWeeklyCalorieTarget();
  
  if (meals.length === 0) {
    showToast('Add some meals first', 'error');
    return;
  }
  
  // Group meals by type and sort by calories (lowest first for pessimistic approach)
  const mealsByType = {
    breakfast: meals.filter(m => m.type.toLowerCase() === 'breakfast').sort((a, b) => a.macros.kcal - b.macros.kcal),
    lunch: meals.filter(m => m.type.toLowerCase() === 'lunch').sort((a, b) => a.macros.kcal - b.macros.kcal),
    snack: meals.filter(m => m.type.toLowerCase() === 'snack').sort((a, b) => a.macros.kcal - b.macros.kcal),
    dinner: meals.filter(m => m.type.toLowerCase() === 'dinner').sort((a, b) => a.macros.kcal - b.macros.kcal)
  };
  
  // Find the current cheat day if set
  const existingCheatDay = tempSchedule.findIndex(d => d.isCheatDay);
  
  // Calculate how many days we're scheduling (exclude cheat day)
  const daysToSchedule = existingCheatDay >= 0 ? 6 : 7;
  
  // Calculate daily budget if we have a target
  const dailyBudget = weeklyTarget ? Math.floor(weeklyTarget / daysToSchedule) : null;
  
  // Generate schedule
  const newSchedule = [];
  let totalCalories = 0;
  let dayCounter = 0;
  
  for (let i = 0; i < 7; i++) {
    const isCheatDay = i === existingCheatDay;
    
    if (isCheatDay) {
      newSchedule.push({
        day: i,
        slots: [
          { slot: 'breakfast', mealId: null, time: '7:00 AM' },
          { slot: 'lunch', mealId: null, time: '1:00 PM' },
          { slot: 'snack', mealId: null, time: '4:00 PM' },
          { slot: 'dinner', mealId: null, time: '7:00 PM' }
        ],
        isCheatDay: true
      });
      continue;
    }
    
    const daySlots = [];
    let dayCalories = 0;
    
    ['breakfast', 'lunch', 'snack', 'dinner'].forEach(slotType => {
      const available = mealsByType[slotType];
      let selectedMeal = null;
      
      if (available.length > 0) {
        // Pessimistic: try to pick lowest calorie meals that fit budget
        if (dailyBudget) {
          // Find the best meal that fits remaining daily budget
          const remainingDayBudget = dailyBudget - dayCalories;
          const fittingMeals = available.filter(m => m.macros.kcal <= remainingDayBudget);
          
          if (fittingMeals.length > 0) {
            // Rotate through fitting meals for variety
            selectedMeal = fittingMeals[dayCounter % fittingMeals.length];
          } else {
            // If nothing fits, pick the lowest calorie option
            selectedMeal = available[0];
          }
        } else {
          // No target, just rotate
          selectedMeal = available[dayCounter % available.length];
        }
      } else {
        // Fallback: pick any low-calorie meal
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
  const existingCheatDay = tempSchedule.findIndex(d => d.isCheatDay);
  tempSchedule = initializeEmptySchedule();
  // Preserve cheat day selection
  if (existingCheatDay >= 0) {
    tempSchedule[existingCheatDay].isCheatDay = true;
  }
  renderScheduleEditor();
  updateScheduleCalorieSummary();
  showToast('Schedule cleared', 'default');
}

function saveEditedSchedule() {
  // Filter out days with no meals assigned (except cheat day)
  const hasAnyMeal = tempSchedule.some(day => 
    day.isCheatDay || day.slots.some(slot => slot.mealId)
  );
  
  if (!hasAnyMeal) {
    setSchedule([]);
  } else {
    setSchedule(tempSchedule);
  }
  
  saveSchedule();
  renderSchedule();
  renderScheduleOverview();
  renderShoppingList();
  closeEditScheduleModal();
  showToast('Schedule saved', 'success');
}

function renderScheduleOverview() {
  const overview = document.getElementById('schedule-overview');
  const schedule = dataStore.schedule;
  
  if (!schedule.length) {
    overview.classList.add('hidden');
    return;
  }
  
  overview.classList.remove('hidden');
  
  const weeklyTarget = getWeeklyCalorieTarget();
  const cheatDayIndex = schedule.findIndex(d => d.isCheatDay);
  const totalCalories = calculateScheduleCalories(schedule, true); // Exclude cheat day
  
  const weeklyTargetEl = document.getElementById('overview-weekly-target');
  const scheduledEl = document.getElementById('overview-scheduled');
  const remainingEl = document.getElementById('overview-remaining');
  const remainingContainer = document.getElementById('overview-remaining-container');
  const cheatDayEl = document.getElementById('overview-cheat-day');
  const cheatDayNameEl = document.getElementById('overview-cheat-day-name');
  const cheatBudgetEl = document.getElementById('overview-cheat-budget');
  
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
    
    // Cheat day info
    if (cheatDayIndex >= 0) {
      const days = getScheduleDays();
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

function setupScheduleListeners() {
  const editScheduleBtn = document.getElementById('edit-schedule-btn');
  const saveScheduleBtn = document.getElementById('save-schedule');
  const cancelScheduleBtn = document.getElementById('cancel-schedule');
  const autoGenerateBtn = document.getElementById('auto-generate-schedule');
  const clearScheduleBtn = document.getElementById('clear-schedule');
  
  if (editScheduleBtn) {
    editScheduleBtn.addEventListener('click', openEditScheduleModal);
  }
  if (saveScheduleBtn) {
    saveScheduleBtn.addEventListener('click', saveEditedSchedule);
  }
  if (cancelScheduleBtn) {
    cancelScheduleBtn.addEventListener('click', closeEditScheduleModal);
  }
  if (autoGenerateBtn) {
    autoGenerateBtn.addEventListener('click', autoGenerateSchedule);
  }
  if (clearScheduleBtn) {
    clearScheduleBtn.addEventListener('click', clearScheduleEditor);
  }
}

document.addEventListener('DOMContentLoaded', init);
