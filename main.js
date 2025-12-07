import { dataStore, setIngredients, setMeals, setSchedule, aggregateShoppingList, getMealById } from './dataStore.js';
import { Meal, FoodItem } from './models.js';

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

let previousTab = 'shopping';

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
  setMeals([]);
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
      <span class="meal-type ${typeClass}">${meal.type}</span>
      <h3>${meal.name}</h3>
      <div class="macros">
        <span><span class="material-symbols-rounded">local_fire_department</span> ${macros.kcal.toFixed(0)} kcal</span>
        <span><span class="material-symbols-rounded">fitness_center</span> ${macros.protein.toFixed(0)} g protein</span>
      </div>
    `;

    card.addEventListener('click', () => showMealDetail(meal.id));
    menuCards.appendChild(card);
  });
}

function renderIngredients() {
  ingredientsList.innerHTML = '';
  const items = dataStore.ingredients;

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
          <div class="ingredient-card">
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
      ${Array.isArray(meal.instructions) && meal.instructions.length
        ? meal.instructions.map(instr => `
          <div class="instruction-block">
            <h3>${instr.name}</h3>
            <ol class="instructions-list">
              ${instr.steps.map(step => `<li>${step}</li>`).join('')}
            </ol>
          </div>
        `).join('')
        : '<p class="empty-state">No instructions provided.</p>'}
    </div>
  `;

  document.getElementById('menu-tab').classList.remove('active');
  mealDetail.classList.add('active');
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

  if (!name || !unit) {
    alert('Name and unit are required.');
    return;
  }

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
  alert('Ingredient added.');
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
      alert('No valid ingredients found in file.');
    } else {
      setIngredients(cleaned);
      saveIngredients();
      renderIngredients();
      alert(`Imported ${cleaned.length} ingredient${cleaned.length === 1 ? '' : 's'}.`);
    }
  } catch (err) {
    console.error('Failed to import ingredients', err);
    alert('Invalid JSON. Please provide an array or object of ingredients.');
  } finally {
    event.target.value = '';
  }
}

document.addEventListener('DOMContentLoaded', init);
