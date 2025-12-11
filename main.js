import { dataStore, setIngredients, setMeals, setSchedule, aggregateShoppingList, getMealById } from './dataStore.js';
import { Meal, FoodItem, FoodItemEntry, CookingInstruction } from './models.js';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

let state = {
  onboarded: false,
  startDay: 1,
  checkedItems: {}
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
  bootstrapData();
  loadState();

  if (state.onboarded) {
    showApp();
  } else {
    showOnboarding();
  }

  setupEventListeners();
}

function bootstrapData() {
  // Load ingredients from localStorage if available
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

  setSchedule([]);
}

function loadState() {
  const saved = localStorage.getItem('mealPrepState');
  if (saved) {
    state = JSON.parse(saved);
  }
}

function saveState() {
  localStorage.setItem('mealPrepState', JSON.stringify(state));
}

function saveIngredients() {
  localStorage.setItem('mealPrepIngredients', JSON.stringify(dataStore.ingredients));
}

function showOnboarding() {
  onboardingModal.classList.remove('hidden');
  app.classList.add('hidden');
  startDaySelect.value = state.startDay;
}

function showApp() {
  onboardingModal.classList.add('hidden');
  app.classList.remove('hidden');
  renderShoppingList();
  renderSchedule();
  renderMenuCards();
  renderIngredients();
}

function setupEventListeners() {
  startBtn.addEventListener('click', () => {
    state.startDay = parseInt(startDaySelect.value, 10);
    state.onboarded = true;
    saveState();
    showApp();
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

function handleIngredientCreate() {
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
  saveIngredients();
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
      saveIngredients();
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

function handleIngredientEdit() {
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
  saveIngredients();
  renderIngredients();
  closeEditIngredientModal();
  showToast('Ingredient updated', 'success');
}

function deleteIngredient(ingredientId) {
  const ingredient = dataStore.ingredients.find(i => i.id === ingredientId);
  if (!ingredient) return;

  const updatedIngredients = dataStore.ingredients.filter(i => i.id !== ingredientId);
  setIngredients(updatedIngredients);
  saveIngredients();
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

  // Setup confirmation wrappers for destructive actions
  setupDestructiveAction(clearShoppingBtn, () => {
    state.checkedItems = {};
    saveState();
    renderShoppingList();
    showToast('Shopping checklist cleared', 'success');
  });

  setupDestructiveAction(deleteIngredientsBtn, () => {
    setIngredients([]);
    saveIngredients();
    renderIngredients();
    showToast('All ingredients deleted', 'success');
  });

  setupDestructiveAction(deleteAllBtn, () => {
    // Clear all localStorage data
    localStorage.removeItem('mealPrepState');
    localStorage.removeItem('mealPrepIngredients');
    localStorage.removeItem('mealPrepMeals');
    
    // Reset state
    state = {
      onboarded: false,
      startDay: 1,
      checkedItems: {}
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

document.addEventListener('DOMContentLoaded', init);
