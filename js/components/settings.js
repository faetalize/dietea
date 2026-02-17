/**
 * Settings UI
 */

import { dataStore, setIngredients, setMeals, setSchedule } from '../core/dataStore.js';
import { FoodItem } from '../core/models.js';
import {
  isFileSystemSupported,
  selectIngredientsFile,
  selectMealsFile,
  loadIngredientsFromFile,
  loadMealsFromFile,
  clearFileHandle,
  clearIngredientsFileHandle,
  clearMealsFileHandle,
  getIngredientsFileHandle,
  getMealsFileHandle
} from '../services/fileSystem.js';
import { loadIngredients, loadMeals } from '../core/dataLoader.js';
import { hydrateMeal } from '../core/mealSerde.js';
import { state, updateState, saveState, resetState } from '../services/state.js';
import { saveIngredients, saveMeals, saveSchedule } from '../services/storage.js';
import { showToast } from '../utils/feedback.js';

function setupDestructiveAction(button, onConfirm) {
  if (!button) return;

  const wrapper = button.closest('.setting-action-wrapper');
  if (!wrapper) return;

  const cancelBtn = wrapper.querySelector('[data-action="cancel"]');
  const confirmBtn = wrapper.querySelector('[data-action="confirm"]');

  button.addEventListener('click', () => {
    wrapper.classList.add('confirming');
  });

  cancelBtn?.addEventListener('click', () => {
    wrapper.classList.remove('confirming');
  });

  confirmBtn?.addEventListener('click', () => {
    wrapper.classList.remove('confirming');
    onConfirm();
  });
}

export function setupSettingsListeners({
  onScheduleChanged,
  onIngredientsChanged,
  onMealsChanged,
  onShowOnboarding
} = {}) {
  const settingsStartDay = document.getElementById('settings-start-day');
  const clearShoppingBtn = document.getElementById('clear-shopping-data');
  const deleteIngredientsBtn = document.getElementById('delete-ingredients-data');
  const deleteAllBtn = document.getElementById('delete-all-data');

  const connectIngredientsFileBtn = document.getElementById('connect-ingredients-file');
  const disconnectFileBtn = document.getElementById('disconnect-ingredients-file');
  const ingredientsFileStatus = document.getElementById('ingredients-file-status');
  const disconnectIngredientsItem = document.getElementById('disconnect-ingredients-item');

  const connectMealsFileBtn = document.getElementById('connect-meals-file');
  const disconnectMealsFileBtn = document.getElementById('disconnect-meals-file');
  const mealsFileStatus = document.getElementById('meals-file-status');
  const disconnectMealsItem = document.getElementById('disconnect-meals-item');

  if (settingsStartDay) {
    settingsStartDay.value = String(state.startDay);
    settingsStartDay.addEventListener('change', () => {
      updateState({ startDay: parseInt(settingsStartDay.value, 10) });
      onScheduleChanged?.();
      showToast('Start day updated', 'success');
    });
  }

  async function updateFileSystemUI() {
    const hasIngredientsFile = !!getIngredientsFileHandle();
    const hasMealsFile = !!getMealsFileHandle();

    if (ingredientsFileStatus && disconnectIngredientsItem && connectIngredientsFileBtn) {
      if (hasIngredientsFile) {
        ingredientsFileStatus.textContent = '✓ Connected to ingredients.json - changes auto-save';
        ingredientsFileStatus.style.color = 'var(--success)';
        disconnectIngredientsItem.style.display = 'flex';
        connectIngredientsFileBtn.innerHTML = '<span class="material-symbols-rounded">sync</span> Connect Other File';
      } else {
        ingredientsFileStatus.textContent = 'No file connected. Changes require selecting ingredients.json each session.';
        ingredientsFileStatus.style.color = '';
        disconnectIngredientsItem.style.display = 'none';
        connectIngredientsFileBtn.innerHTML = '<span class="material-symbols-rounded">attach_file</span> Select File';
      }
    }

    if (mealsFileStatus && disconnectMealsItem && connectMealsFileBtn) {
      if (hasMealsFile) {
        mealsFileStatus.textContent = '✓ Connected to menu.json - changes auto-save';
        mealsFileStatus.style.color = 'var(--success)';
        disconnectMealsItem.style.display = 'flex';
        connectMealsFileBtn.innerHTML = '<span class="material-symbols-rounded">sync</span> Connect Other File';
      } else {
        mealsFileStatus.textContent = 'No file connected. Changes require selecting menu.json each session.';
        mealsFileStatus.style.color = '';
        disconnectMealsItem.style.display = 'none';
        connectMealsFileBtn.innerHTML = '<span class="material-symbols-rounded">attach_file</span> Select File';
      }
    }
  }

  if (isFileSystemSupported()) {
    updateFileSystemUI();

    connectIngredientsFileBtn?.addEventListener('click', async () => {
      const fileHandle = await selectIngredientsFile();
      if (!fileHandle) return;

      const ingredientsData = await loadIngredientsFromFile(fileHandle);
      if (ingredientsData && Array.isArray(ingredientsData)) {
        setIngredients(ingredientsData.map((obj) => new FoodItem(obj)));
        onIngredientsChanged?.();
        await updateFileSystemUI();
        showToast('Connected to ingredients.json', 'success');
      } else {
        showToast('Invalid ingredients file', 'error');
      }
    });

    disconnectFileBtn?.addEventListener('click', async () => {
      await clearIngredientsFileHandle();
      const defaultIngredients = await loadIngredients();
      setIngredients(defaultIngredients);
      onIngredientsChanged?.();
      await updateFileSystemUI();
      showToast('Disconnected. Reverted to bundled ingredients.json', 'success');
    });

    connectMealsFileBtn?.addEventListener('click', async () => {
      const fileHandle = await selectMealsFile();
      if (!fileHandle) return;

      const mealsData = await loadMealsFromFile(fileHandle);
      if (mealsData && Array.isArray(mealsData)) {
        setMeals(mealsData.map(obj => hydrateMeal(obj)).filter(Boolean));
        onMealsChanged?.();
        await updateFileSystemUI();
        showToast('Connected to menu.json', 'success');
      } else {
        showToast('Invalid menu file', 'error');
      }
    });

    disconnectMealsFileBtn?.addEventListener('click', async () => {
      await clearMealsFileHandle();
      const defaultMeals = await loadMeals();
      setMeals(defaultMeals.map(obj => hydrateMeal(obj)).filter(Boolean));
      onMealsChanged?.();
      await updateFileSystemUI();
      showToast('Disconnected. Reverted to bundled menu.json', 'success');
    });
  } else {
    if (connectIngredientsFileBtn) {
      connectIngredientsFileBtn.disabled = true;
      connectIngredientsFileBtn.innerHTML = '<span class="material-symbols-rounded">block</span> Not Supported';
    }
    if (ingredientsFileStatus) {
      ingredientsFileStatus.textContent = 'File System Access API not supported in this browser. Use Chrome or Edge.';
    }

    if (connectMealsFileBtn) {
      connectMealsFileBtn.disabled = true;
      connectMealsFileBtn.innerHTML = '<span class="material-symbols-rounded">block</span> Not Supported';
    }
    if (mealsFileStatus) {
      mealsFileStatus.textContent = 'File System Access API not supported in this browser. Use Chrome or Edge.';
    }
  }

  setupDestructiveAction(clearShoppingBtn, () => {
    state.checkedItems = {};
    saveState();
    // shopping list is rendered from schedule + meals, but checkmarks are in state
    onScheduleChanged?.();
    showToast('Shopping checklist cleared', 'success');
  });

  setupDestructiveAction(deleteIngredientsBtn, async () => {
    if (!getIngredientsFileHandle()) {
      showToast('Connect ingredients.json first', 'error');
      return;
    }

    setIngredients([]);
    const saved = await saveIngredients();
    if (!saved) {
      showToast('Failed to save ingredients.json', 'error');
      return;
    }

    onIngredientsChanged?.();
    showToast('All ingredients deleted', 'success');
  });

  setupDestructiveAction(deleteAllBtn, async () => {
    localStorage.removeItem('mealPrepState');
    localStorage.removeItem('mealPrepSchedule');

    await clearFileHandle();

    resetState();
    const defaultIngredients = await loadIngredients();
    const defaultMeals = await loadMeals();
    setIngredients(defaultIngredients);
    setMeals(defaultMeals.map(obj => hydrateMeal(obj)).filter(Boolean));
    setSchedule([]);
    await saveIngredients();
    await saveMeals();
    saveSchedule();

    showToast('All data deleted', 'success');

    setTimeout(() => {
      onShowOnboarding?.();
    }, 500);
  });
}
