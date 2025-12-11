/**
 * Settings UI
 */

import { dataStore, setIngredients, setMeals, setSchedule } from '../core/dataStore.js';
import { FoodItem } from '../core/models.js';
import {
  isFileSystemSupported,
  selectIngredientsFile,
  loadIngredientsFromFile,
  clearFileHandle,
  getFileHandle,
  hasStoredFileHandle,
  requestPermissionAndLoad
} from '../services/fileSystem.js';
import { state, updateState, saveState, resetState } from '../services/state.js';
import { saveIngredients, saveSchedule } from '../services/storage.js';
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

  const connectFileBtn = document.getElementById('connect-ingredients-file');
  const disconnectFileBtn = document.getElementById('disconnect-ingredients-file');
  const fileStatus = document.getElementById('file-status');
  const disconnectItem = document.getElementById('disconnect-file-item');

  if (settingsStartDay) {
    settingsStartDay.value = String(state.startDay);
    settingsStartDay.addEventListener('change', () => {
      updateState({ startDay: parseInt(settingsStartDay.value, 10) });
      onScheduleChanged?.();
      showToast('Start day updated', 'success');
    });
  }

  async function updateFileSystemUI() {
    const hasFile = !!getFileHandle();
    const hasStoredHandle = await hasStoredFileHandle();

    if (!fileStatus || !disconnectItem || !connectFileBtn) return;

    if (hasFile) {
      fileStatus.textContent = '✓ Connected to ingredients.json - changes auto-save';
      fileStatus.style.color = 'var(--success)';
      disconnectItem.style.display = 'flex';
      connectFileBtn.innerHTML = '<span class="material-symbols-rounded">sync</span> Reconnect';
      return;
    }

    if (hasStoredHandle) {
      fileStatus.textContent = '⚠ File connected but needs permission - click Reconnect';
      fileStatus.style.color = 'var(--warning)';
      disconnectItem.style.display = 'flex';
      connectFileBtn.innerHTML = '<span class="material-symbols-rounded">lock_open</span> Reconnect';
      return;
    }

    fileStatus.textContent = 'Connect to ingredients.json file for automatic sync';
    fileStatus.style.color = '';
    disconnectItem.style.display = 'none';
    connectFileBtn.innerHTML = '<span class="material-symbols-rounded">attach_file</span> Select File';
  }

  if (connectFileBtn && isFileSystemSupported()) {
    updateFileSystemUI();

    connectFileBtn.addEventListener('click', async () => {
      const stored = await hasStoredFileHandle();

      if (stored && !getFileHandle()) {
        const ingredientsData = await requestPermissionAndLoad();
        if (ingredientsData && Array.isArray(ingredientsData)) {
          setIngredients(ingredientsData.map((obj) => new FoodItem(obj)));
          onIngredientsChanged?.();
          await updateFileSystemUI();
          showToast('Reconnected to ingredients.json', 'success');
          return;
        }
      }

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

  setupDestructiveAction(clearShoppingBtn, () => {
    state.checkedItems = {};
    saveState();
    // shopping list is rendered from schedule + meals, but checkmarks are in state
    onScheduleChanged?.();
    showToast('Shopping checklist cleared', 'success');
  });

  setupDestructiveAction(deleteIngredientsBtn, async () => {
    setIngredients([]);
    await saveIngredients();
    onIngredientsChanged?.();
    showToast('All ingredients deleted', 'success');
  });

  setupDestructiveAction(deleteAllBtn, async () => {
    localStorage.removeItem('mealPrepState');
    localStorage.removeItem('mealPrepIngredients');
    localStorage.removeItem('mealPrepMeals');
    localStorage.removeItem('mealPrepSchedule');

    await clearFileHandle();

    resetState();
    setIngredients([]);
    setMeals([]);
    setSchedule([]);
    saveSchedule();

    showToast('All data deleted', 'success');

    setTimeout(() => {
      onShowOnboarding?.();
    }, 500);
  });
}
