/**
 * Meal Creation / Editing UI (modals)
 */

import { dataStore, getMealById, setMeals } from '../core/dataStore.js';
import { Meal, FoodItemEntry, CookingInstruction } from '../core/models.js';
import { serializeMeal } from '../core/mealSerde.js';
import { saveMeals } from '../services/storage.js';
import { slugify } from '../utils/helpers.js';
import { showToast, showFieldError, clearValidationErrors } from '../utils/feedback.js';

let editingMealId = null;
let currentMealIngredients = [];
let currentMealInstructions = [];

function el(id) {
  return document.getElementById(id);
}

export function openCreateMealModal() {
  editingMealId = null;
  currentMealIngredients = [];
  currentMealInstructions = [];

  el('meal-name').value = '';
  el('meal-type').value = 'Breakfast';

  renderMealIngredientsList();
  renderMealInstructionsList();
  updateMealModalTitle();

  el('create-meal-modal')?.classList.remove('hidden');
}

export function openEditMealModal(mealId) {
  const meal = getMealById(mealId);
  if (!meal) return;

  editingMealId = mealId;
  currentMealIngredients = (meal.ingredients || []).map(
    (entry) => new FoodItemEntry({ item: entry.item, quantity: entry.quantity })
  );
  currentMealInstructions = (meal.instructions || []).map(
    (instr) => new CookingInstruction({ name: instr.name, steps: [...instr.steps] })
  );

  el('meal-name').value = meal.name;
  el('meal-type').value = meal.type;

  renderMealIngredientsList();
  renderMealInstructionsList();
  updateMealModalTitle();

  el('create-meal-modal')?.classList.remove('hidden');
}

export function closeCreateMealModal() {
  editingMealId = null;
  currentMealIngredients = [];
  currentMealInstructions = [];
  const modal = el('create-meal-modal');
  modal?.classList.add('hidden');
  clearValidationErrors(modal);
}

function updateMealModalTitle() {
  const modal = el('create-meal-modal');
  const titleEl = modal?.querySelector('h2');
  if (titleEl) titleEl.textContent = editingMealId ? 'Edit Meal' : 'Create New Meal';

  const saveBtn = modal?.querySelector('#save-meal');
  if (saveBtn) {
    const labelText = editingMealId ? 'Save Changes' : 'Save Meal';
    saveBtn.innerHTML = `<span class="material-symbols-rounded">save</span>${labelText}`;
  }
}

function renderMealIngredientsList() {
  const list = el('meal-ingredients-list');
  if (!list) return;

  if (!currentMealIngredients.length) {
    list.innerHTML = '<p class="empty-state-small">No ingredients added yet</p>';
    return;
  }

  list.innerHTML = currentMealIngredients
    .map(
      (entry, index) => `
      <div class="meal-ingredient-item" data-index="${index}">
        <div class="meal-ingredient-info">
          <span class="meal-ingredient-name">${entry.item.name}</span>
          <span class="meal-ingredient-qty">${entry.quantity} ${entry.item.unit}</span>
        </div>
        <button class="btn-icon btn-delete" data-action="remove" aria-label="Remove ingredient">
          <span class="material-symbols-rounded">close</span>
        </button>
      </div>
    `
    )
    .join('');

  list.querySelectorAll('[data-action="remove"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const index = parseInt(btn.closest('.meal-ingredient-item').dataset.index, 10);
      currentMealIngredients.splice(index, 1);
      renderMealIngredientsList();
    });
  });
}

function renderMealInstructionsList() {
  const list = el('meal-instructions-list');
  if (!list) return;

  if (!currentMealInstructions.length) {
    list.innerHTML = '<p class="empty-state-small">No instruction blocks added yet</p>';
    return;
  }

  list.innerHTML = currentMealInstructions
    .map(
      (instr, index) => `
      <div class="instruction-block-item" data-index="${index}">
        <div class="instruction-block-header">
          <span class="instruction-block-name">${instr.name}</span>
          <button class="btn-icon btn-delete" data-action="remove" aria-label="Remove instruction block">
            <span class="material-symbols-rounded">close</span>
          </button>
        </div>
        <ol class="instruction-block-steps">
          ${instr.steps.map((step) => `<li>${step}</li>`).join('')}
        </ol>
      </div>
    `
    )
    .join('');

  list.querySelectorAll('[data-action="remove"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const index = parseInt(btn.closest('.instruction-block-item').dataset.index, 10);
      currentMealInstructions.splice(index, 1);
      renderMealInstructionsList();
    });
  });
}

function openAddIngredientToMealModal() {
  const dropdown = el('select-ingredient');
  if (!dropdown) return;

  dropdown.innerHTML = '<option value="">Select an ingredient...</option>';
  [...dataStore.ingredients]
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((item) => {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = `${item.name} (${item.unit})`;
      dropdown.appendChild(option);
    });

  el('ingredient-quantity').value = '';
  el('add-ingredient-modal')?.classList.remove('hidden');
}

function closeAddIngredientToMealModal() {
  const modal = el('add-ingredient-modal');
  modal?.classList.add('hidden');
  clearValidationErrors(modal);
}

function handleAddIngredientToMeal() {
  const dropdown = el('select-ingredient');
  const qtyInput = el('ingredient-quantity');
  const ingredientId = dropdown?.value;
  const quantity = parseFloat(qtyInput?.value) || 0;

  const modal = el('add-ingredient-modal');
  clearValidationErrors(modal);

  let hasError = false;
  if (!ingredientId) {
    showFieldError(dropdown, 'Please select an ingredient');
    hasError = true;
  }
  if (quantity <= 0) {
    showFieldError(qtyInput, 'Quantity must be greater than 0');
    hasError = true;
  }
  if (hasError) return;

  const item = dataStore.ingredients.find((i) => i.id === ingredientId);
  if (!item) return;

  currentMealIngredients.push(new FoodItemEntry({ item, quantity }));
  renderMealIngredientsList();
  closeAddIngredientToMealModal();
}

function openAddInstructionModal() {
  el('instruction-block-name').value = '';
  el('instruction-block-steps').value = '';
  el('add-instruction-modal')?.classList.remove('hidden');
}

function closeAddInstructionModal() {
  const modal = el('add-instruction-modal');
  modal?.classList.add('hidden');
  clearValidationErrors(modal);
}

function handleAddInstructionBlock() {
  const nameInput = el('instruction-block-name');
  const stepsInput = el('instruction-block-steps');

  const name = (nameInput?.value || '').trim();
  const stepsText = (stepsInput?.value || '').trim();

  const modal = el('add-instruction-modal');
  clearValidationErrors(modal);

  let hasError = false;
  if (!name) {
    showFieldError(nameInput, 'Block name is required');
    hasError = true;
  }
  if (!stepsText) {
    showFieldError(stepsInput, 'At least one step is required');
    hasError = true;
  }
  if (hasError) return;

  const steps = stepsText
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!steps.length) {
    showFieldError(stepsInput, 'At least one step is required');
    return;
  }

  currentMealInstructions.push(new CookingInstruction({ name, steps }));
  renderMealInstructionsList();
  closeAddInstructionModal();
}

async function handleMealSave(onAfterSave) {
  const modal = el('create-meal-modal');
  const nameInput = el('meal-name');
  const typeSelect = el('meal-type');
  const name = (nameInput?.value || '').trim();
  const type = typeSelect?.value;

  clearValidationErrors(modal);

  let hasError = false;
  if (!name) {
    showFieldError(nameInput, 'Meal name is required');
    hasError = true;
  }
  if (!currentMealIngredients.length) {
    showToast('Please add at least one ingredient', 'error');
    hasError = true;
  }
  if (hasError) return;

  if (editingMealId) {
    const existingIndex = dataStore.meals.findIndex((m) => m.id === editingMealId);
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
    const previousMeals = [...dataStore.meals];
    setMeals(updatedMeals);
    const saved = await saveMeals();
    if (!saved) {
      setMeals(previousMeals);
      showToast('Connect menu.json in Settings before saving meals', 'error');
      return;
    }

    closeCreateMealModal();
    showToast('Meal updated', 'success');
    onAfterSave?.();
    return;
  }

  const newMeal = new Meal({
    id: slugify(`${name}-${Date.now()}`),
    name,
    type,
    ingredients: currentMealIngredients,
    instructions: currentMealInstructions
  });

  const updatedMeals = [...dataStore.meals, newMeal];
  const previousMeals = [...dataStore.meals];
  setMeals(updatedMeals);
  const saved = await saveMeals();
  if (!saved) {
    setMeals(previousMeals);
    showToast('Connect menu.json in Settings before creating meals', 'error');
    return;
  }

  closeCreateMealModal();
  showToast('Meal created', 'success');
  onAfterSave?.();
}

export async function deleteMeal(mealId, onAfterDelete) {
  const previousMeals = [...dataStore.meals];
  const updatedMeals = dataStore.meals.filter((m) => m.id !== mealId);
  setMeals(updatedMeals);
  const saved = await saveMeals();
  if (!saved) {
    setMeals(previousMeals);
    showToast('Connect menu.json in Settings before deleting meals', 'error');
    return;
  }

  showToast('Meal deleted', 'success');
  onAfterDelete?.();
}

export function setupMealCreationListeners({ onMealsChanged } = {}) {
  const createBtn = el('create-meal-btn');
  const cancelBtn = el('cancel-meal');
  const saveBtn = el('save-meal');

  const addIngredientBtn = el('add-meal-ingredient');
  const confirmAddIngredientBtn = el('confirm-add-ingredient');
  const cancelAddIngredientBtn = el('cancel-add-ingredient');

  const addInstructionBtn = el('add-instruction-block');
  const confirmAddInstructionBtn = el('confirm-add-instruction');
  const cancelAddInstructionBtn = el('cancel-add-instruction');

  createBtn?.addEventListener('click', openCreateMealModal);
  cancelBtn?.addEventListener('click', closeCreateMealModal);
  saveBtn?.addEventListener('click', async () => {
    await handleMealSave(onMealsChanged);
  });

  addIngredientBtn?.addEventListener('click', openAddIngredientToMealModal);
  confirmAddIngredientBtn?.addEventListener('click', handleAddIngredientToMeal);
  cancelAddIngredientBtn?.addEventListener('click', closeAddIngredientToMealModal);

  addInstructionBtn?.addEventListener('click', openAddInstructionModal);
  confirmAddInstructionBtn?.addEventListener('click', handleAddInstructionBlock);
  cancelAddInstructionBtn?.addEventListener('click', closeAddInstructionModal);
}
