/**
 * Settings UI
 */

import { dataStore, setIngredients, setMeals, setSchedule } from '../core/dataStore.js';
import { loadIngredients, loadMeals, seedStarterData } from '../core/dataLoader.js';
import { hydrateMeal } from '../core/mealSerde.js';
import { supabase, describeError } from '../services/supabase.js';
import { requireUserId, getCurrentUser, signOut } from '../services/auth.js';
import { state, updateState, saveState, resetState } from '../services/state.js';
import { saveIngredients, saveSchedule } from '../services/storage.js';
import { clearSupplementsData } from './supplements.js';
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
  onSupplementsChanged,
  onShowOnboarding,
  onSignedOut
} = {}) {
  const settingsStartDay = document.getElementById('settings-start-day');
  const clearShoppingBtn = document.getElementById('clear-shopping-data');
  const deleteIngredientsBtn = document.getElementById('delete-ingredients-data');
  const deleteAllBtn = document.getElementById('delete-all-data');

  const accountEmail = document.getElementById('account-email');
  const signOutBtn = document.getElementById('sign-out-btn');

  if (accountEmail) {
    accountEmail.textContent = getCurrentUser()?.email || 'Not signed in';
  }

  signOutBtn?.addEventListener('click', async () => {
    const { error } = await signOut();
    if (error) {
      showToast(error, 'error');
      return;
    }
    onSignedOut?.();
  });

  if (settingsStartDay) {
    settingsStartDay.value = String(state.startDay);
    settingsStartDay.addEventListener('change', () => {
      updateState({ startDay: parseInt(settingsStartDay.value, 10) });
      onScheduleChanged?.();
      showToast('Start day updated', 'success');
    });
  }

  setupDestructiveAction(clearShoppingBtn, () => {
    state.checkedItems = {};
    saveState();
    // shopping list is rendered from schedule + meals, but checkmarks are in state
    onScheduleChanged?.();
    showToast('Shopping checklist cleared', 'success');
  });

  setupDestructiveAction(deleteIngredientsBtn, async () => {
    const previous = [...dataStore.ingredients];
    setIngredients([]);

    if (!await saveIngredients()) {
      setIngredients(previous);
      return;
    }

    onIngredientsChanged?.();
    showToast('All ingredients deleted', 'success');
  });

  setupDestructiveAction(deleteAllBtn, async () => {
    try {
      const userId = requireUserId();

      for (const table of ['ingredients', 'meals', 'schedules']) {
        const { error } = await supabase.from(table).delete().eq('user_id', userId);
        if (error) throw error;
      }

      await clearSupplementsData();
      await resetState();

      // Put the starter menu back, matching what a brand new account gets.
      await seedStarterData();

      const items = await loadIngredients();
      setIngredients(items);

      const meals = await loadMeals();
      setMeals(meals.map((obj) => hydrateMeal(obj)).filter(Boolean));

      setSchedule([]);
      await saveSchedule();

      onIngredientsChanged?.();
      onMealsChanged?.();
      onSupplementsChanged?.();

      showToast('All data deleted', 'success');

      setTimeout(() => {
        onShowOnboarding?.();
      }, 500);
    } catch (err) {
      console.error('Failed to delete all data', err);
      showToast(describeError(err), 'error');
    }
  });
}
