/**
 * Menu UI (meal cards, search filtering, import)
 */

import { dataStore, getMealById, setMeals } from '../core/dataStore.js';
import { FoodItem } from '../core/models.js';
import { hydrateMeal } from '../core/mealSerde.js';
import { saveMeals } from '../services/storage.js';
import { slugify } from '../utils/helpers.js';
import { showToast } from '../utils/feedback.js';
import { showMealDetail } from './navigation.js';
import { openEditMealModal, deleteMeal } from './mealCreation.js';

export function renderMenuCards() {
  const menuCards = document.getElementById('menu-cards');
  if (!menuCards) return;

  menuCards.innerHTML = '';

  if (!dataStore.meals.length) {
    menuCards.innerHTML = '<p class="empty-state">No meals in the menu yet.</p>';
    return;
  }

  dataStore.meals.forEach((meal) => {
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

    card.addEventListener('click', (e) => {
      if (!e.target.closest('.menu-card-actions')) {
        showMealDetail(meal.id);
      }
    });

    card.querySelector('[data-action="edit"]').addEventListener('click', (e) => {
      e.stopPropagation();
      openEditMealModal(meal.id);
    });

    card.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
      e.stopPropagation();
      card.classList.add('confirming-delete');
    });

    card.querySelector('[data-action="cancel-delete"]').addEventListener('click', (e) => {
      e.stopPropagation();
      card.classList.remove('confirming-delete');
    });

    card.querySelector('[data-action="confirm-delete"]').addEventListener('click', async (e) => {
      e.stopPropagation();
      await deleteMeal(meal.id, renderMenuCards);
    });

    menuCards.appendChild(card);
  });
}

export function filterMenuCards(query) {
  const menuCards = document.getElementById('menu-cards');
  if (!menuCards) return;

  const cards = menuCards.querySelectorAll('.menu-card');
  const lowerQuery = (query || '').toLowerCase();

  cards.forEach((card) => {
    const mealId = card.dataset.mealId;
    const meal = getMealById(mealId);
    const searchText = meal ? `${meal.name} ${meal.type}`.toLowerCase() : '';
    card.style.display = searchText.includes(lowerQuery) ? '' : 'none';
  });
}

async function handleMealsImport(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const asArray = Array.isArray(parsed) ? parsed : [parsed];

    const newMeals = asArray
      .filter(Boolean)
      .map((obj) => {
        try {
          if (!obj.name || !obj.type) return null;
          return hydrateMeal(obj);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    if (!newMeals.length) {
      showToast('No valid meals found in file', 'error');
      return;
    }

    const existingIds = new Set(dataStore.meals.map((m) => m.id));

    const mealsToAdd = newMeals.map((meal) => {
      if (existingIds.has(meal.id)) {
        meal.id = slugify(`${meal.name}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`);
      }
      return meal;
    });

    const previousMeals = [...dataStore.meals];
    setMeals([...dataStore.meals, ...mealsToAdd]);
    const saved = await saveMeals();
    if (!saved) {
      setMeals(previousMeals);
      showToast('Connect menu.json in Settings before importing meals', 'error');
      return;
    }

    renderMenuCards();
    showToast(`Imported ${mealsToAdd.length} meal${mealsToAdd.length === 1 ? '' : 's'}`, 'success');
  } catch (err) {
    console.error('Failed to import meals', err);
    showToast('Invalid JSON file', 'error');
  } finally {
    event.target.value = '';
  }
}

export function setupMenuListeners() {
  const importMealsBtn = document.getElementById('import-meals');
  const mealsFileInput = document.getElementById('meals-file');

  if (importMealsBtn && mealsFileInput) {
    importMealsBtn.addEventListener('click', () => mealsFileInput.click());
    mealsFileInput.addEventListener('change', handleMealsImport);
  }
}
