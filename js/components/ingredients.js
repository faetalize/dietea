/**
 * Ingredients UI (list + CRUD + import)
 */

import { dataStore, setIngredients } from '../core/dataStore.js';
import { FoodItem } from '../core/models.js';
import { saveIngredients } from '../services/storage.js';
import { fmt, slugify } from '../utils/helpers.js';
import { showToast, showFieldError, clearValidationErrors } from '../utils/feedback.js';

let editingIngredientId = null;

function el(id) {
  return document.getElementById(id);
}

function updateCategoryDatalist() {
  const datalist = el('category-options');
  if (!datalist) return;

  const categories = [
    ...new Set(
      dataStore.ingredients
        .map((item) => item.category)
        .filter(Boolean)
    )
  ].sort((a, b) => a.localeCompare(b));

  datalist.innerHTML = categories.map((cat) => `<option value="${cat}">`).join('');
}

export function renderIngredients() {
  const ingredientsList = el('ingredients-list');
  if (!ingredientsList) return;

  ingredientsList.innerHTML = '';
  const items = dataStore.ingredients;

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
        .map(
          (item) => `
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
        `
        )
        .join('');

      return `
        <div class="ingredient-category">
          <h2>${category}</h2>
          <div class="ingredients-grid">${cards}</div>
        </div>
      `;
    })
    .join('');

  ingredientsList.innerHTML = categoryHtml;

  ingredientsList.querySelectorAll('.ingredient-card').forEach((card) => {
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

export function filterIngredients(query) {
  const ingredientsList = el('ingredients-list');
  if (!ingredientsList) return;

  const cards = ingredientsList.querySelectorAll('.ingredient-card');
  const lowerQuery = (query || '').toLowerCase();

  cards.forEach((card) => {
    const ingredientId = card.dataset.ingredientId;
    const ingredient = dataStore.ingredients.find((i) => i.id === ingredientId);
    const searchText = ingredient ? `${ingredient.name} ${ingredient.category || ''}`.toLowerCase() : '';
    card.style.display = searchText.includes(lowerQuery) ? '' : 'none';
  });

  const categories = ingredientsList.querySelectorAll('.ingredient-category');
  categories.forEach((category) => {
    const visibleCards = category.querySelectorAll('.ingredient-card:not([style*="display: none"])');
    category.style.display = visibleCards.length > 0 ? '' : 'none';
  });
}

function clearIngredientForm() {
  el('ingredient-name').value = '';
  el('ingredient-category').value = '';
  el('ingredient-unit').value = '';
  el('ingredient-kcal').value = '';
  el('ingredient-protein').value = '';
  el('ingredient-carbs').value = '';
  el('ingredient-lipids').value = '';
}

async function handleIngredientCreate() {
  const addIngredientForm = el('add-ingredient-form');

  const name = (el('ingredient-name')?.value || '').trim();
  const category = (el('ingredient-category')?.value || '').trim() || 'Uncategorized';
  const unit = (el('ingredient-unit')?.value || '').trim();

  const kcal = parseFloat(el('ingredient-kcal')?.value) || 0;
  const protein = parseFloat(el('ingredient-protein')?.value) || 0;
  const carbs = parseFloat(el('ingredient-carbs')?.value) || 0;
  const lipids = parseFloat(el('ingredient-lipids')?.value) || 0;

  clearValidationErrors(addIngredientForm);

  let hasError = false;
  if (!name) {
    showFieldError(el('ingredient-name'), 'Name is required');
    hasError = true;
  }
  if (!unit) {
    showFieldError(el('ingredient-unit'), 'Unit is required');
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

  setIngredients([...dataStore.ingredients, newItem]);
  await saveIngredients();
  renderIngredients();
  clearIngredientForm();
  addIngredientForm?.classList.add('hidden');
  showToast('Ingredient added', 'success');
}

async function handleIngredientsImport(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const asArray = Array.isArray(parsed) ? parsed : [parsed];
    const cleaned = asArray.filter(Boolean).map((obj) => new FoodItem(obj));

    if (!cleaned.length) {
      showToast('No valid ingredients found in file', 'error');
      return;
    }

    const existingIds = new Set(dataStore.ingredients.map((ing) => ing.id));
    const newIngredients = cleaned.filter((ing) => !existingIds.has(ing.id));

    if (newIngredients.length === 0) {
      showToast('All ingredients already exist', 'default');
      return;
    }

    setIngredients([...dataStore.ingredients, ...newIngredients]);
    await saveIngredients();
    renderIngredients();
    showToast(`Imported ${newIngredients.length} new ingredient${newIngredients.length === 1 ? '' : 's'}`, 'success');
  } catch (err) {
    console.error('Failed to import ingredients', err);
    showToast('Invalid JSON file', 'error');
  } finally {
    event.target.value = '';
  }
}

function openEditIngredientModal(ingredientId) {
  const ingredient = dataStore.ingredients.find((i) => i.id === ingredientId);
  if (!ingredient) return;

  editingIngredientId = ingredientId;

  el('edit-ingredient-name').value = ingredient.name || '';
  el('edit-ingredient-category').value = ingredient.category || '';
  el('edit-ingredient-unit').value = ingredient.unit || '';
  el('edit-ingredient-kcal').value = ingredient.kcal || '';
  el('edit-ingredient-protein').value = ingredient.protein_per_unit || '';
  el('edit-ingredient-carbs').value = ingredient.carb_per_unit || '';
  el('edit-ingredient-lipids').value = ingredient.lipid_per_unit || '';

  el('edit-ingredient-modal')?.classList.remove('hidden');
}

function closeEditIngredientModal() {
  editingIngredientId = null;
  el('edit-ingredient-modal')?.classList.add('hidden');
  clearValidationErrors(el('edit-ingredient-modal'));
}

async function handleIngredientEdit() {
  if (!editingIngredientId) return;

  const editModal = el('edit-ingredient-modal');

  const name = (el('edit-ingredient-name')?.value || '').trim();
  const category = (el('edit-ingredient-category')?.value || '').trim() || 'Uncategorized';
  const unit = (el('edit-ingredient-unit')?.value || '').trim();

  const kcal = parseFloat(el('edit-ingredient-kcal')?.value) || 0;
  const protein = parseFloat(el('edit-ingredient-protein')?.value) || 0;
  const carbs = parseFloat(el('edit-ingredient-carbs')?.value) || 0;
  const lipids = parseFloat(el('edit-ingredient-lipids')?.value) || 0;

  clearValidationErrors(editModal);

  let hasError = false;
  if (!name) {
    showFieldError(el('edit-ingredient-name'), 'Name is required');
    hasError = true;
  }
  if (!unit) {
    showFieldError(el('edit-ingredient-unit'), 'Unit is required');
    hasError = true;
  }
  if (hasError) return;

  const updatedIngredients = dataStore.ingredients.map((item) => {
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
  const ingredient = dataStore.ingredients.find((i) => i.id === ingredientId);
  if (!ingredient) return;

  setIngredients(dataStore.ingredients.filter((i) => i.id !== ingredientId));
  await saveIngredients();
  renderIngredients();
  showToast(`"${ingredient.name}" deleted`, 'success');
}

export function setupIngredientsListeners() {
  const addToggle = el('add-ingredient-toggle');
  const addForm = el('add-ingredient-form');
  const saveBtn = el('save-ingredient');
  const cancelBtn = el('cancel-ingredient');

  const importBtn = el('import-ingredients');
  const fileInput = el('ingredients-file');

  const saveEditBtn = el('save-edit-ingredient');
  const cancelEditBtn = el('cancel-edit-ingredient');

  addToggle?.addEventListener('click', () => {
    addForm?.classList.toggle('hidden');
  });

  cancelBtn?.addEventListener('click', () => {
    clearIngredientForm();
    addForm?.classList.add('hidden');
    clearValidationErrors(addForm);
  });

  saveBtn?.addEventListener('click', handleIngredientCreate);

  if (importBtn && fileInput) {
    importBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleIngredientsImport);
  }

  cancelEditBtn?.addEventListener('click', closeEditIngredientModal);
  saveEditBtn?.addEventListener('click', handleIngredientEdit);
}
