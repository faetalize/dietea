/**
 * Settings UI
 */

import { dataStore, setIngredients, setMeals, setSchedule } from '../core/dataStore.js';
import { loadIngredients, loadMeals, seedStarterData } from '../core/dataLoader.js';
import { hydrateMeal } from '../core/mealSerde.js';
import { supabase, describeError } from '../services/supabase.js';
import { requireUserId, getCurrentUser, signOut } from '../services/auth.js';
import { state, updateState, updateAiSettings, saveState, resetState } from '../services/state.js';
import { saveIngredients, saveSchedule } from '../services/storage.js';
import { MODELS, EFFORTS } from '../services/openai.js';
import {
  isUnlocked,
  needsUnlock,
  hasVault,
  getApiKey,
  setApiKey,
  getCodexTokens,
  setCodexTokens,
  hasCredentialFor,
  unlockWithPassword,
  changePassword,
  clearVault
} from '../services/credentials.js';
import {
  beginAuthorization,
  completeAuthorization,
  cancelAuthorization,
  describeCodexOriginProblem
} from '../services/codexAuth.js';
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

/* ------------------------------------------------------------ AI settings */

function el(id) {
  return document.getElementById(id);
}

/**
 * Reflect vault and credential state.
 *
 * Three states worth telling apart, because each needs a different action:
 * nothing saved yet, saved but locked (needs a password), and open.
 */
function renderAiStatus(onChanged) {
  const status = el('ai-vault-status');
  const actions = el('ai-vault-actions');
  const codexStatus = el('ai-codex-status');
  const codexActions = el('ai-codex-actions');
  const keyInput = el('ai-api-key');

  if (!status || !actions) return;

  if (needsUnlock()) {
    status.textContent = 'Saved, but locked for this session.';
    actions.innerHTML = `
      <div class="setting-inline">
        <input type="password" id="ai-unlock-password" class="setting-input" placeholder="Account password" autocomplete="current-password">
        <button id="ai-unlock" class="btn btn-primary">Unlock</button>
      </div>`;

    el('ai-unlock')?.addEventListener('click', async () => {
      try {
        await unlockWithPassword(el('ai-unlock-password')?.value || '');
        showToast('Credentials unlocked', 'success');
        renderAiStatus(onChanged);
        onChanged?.();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  } else if (isUnlocked()) {
    status.textContent = hasVault()
      ? 'Unlocked and encrypted with your password.'
      : 'Ready. Nothing saved yet.';
    actions.innerHTML = hasVault()
      ? `<button id="ai-forget" class="btn btn-secondary btn-danger-hover">Forget all credentials</button>`
      : '';

    el('ai-forget')?.addEventListener('click', async () => {
      await clearVault();
      showToast('Credentials removed', 'success');
      renderAiStatus(onChanged);
      onChanged?.();
    });
  } else {
    status.textContent = 'Sign in again to set up the assistant.';
    actions.innerHTML = '';
  }

  if (keyInput) {
    const key = isUnlocked() ? getApiKey() : null;
    keyInput.value = key || '';
    keyInput.placeholder = key ? '' : 'sk-…';
  }

  const tokens = isUnlocked() ? getCodexTokens() : null;
  if (codexStatus) {
    const originProblem = describeCodexOriginProblem();

    if (originProblem) {
      // Say this whether or not Codex is linked — the link succeeds fine from
      // any origin, it is only the model requests that get blocked, so without
      // this the setup looks complete right up until the first message fails.
      codexStatus.textContent = originProblem;
      codexStatus.classList.add('setting-warning');
    } else {
      codexStatus.textContent = tokens?.refreshToken
        ? 'Connected to your ChatGPT account.'
        : 'Not connected.';
      codexStatus.classList.remove('setting-warning');
    }
  }
  if (codexActions) {
    codexActions.innerHTML = tokens?.refreshToken
      ? `<button id="ai-codex-disconnect" class="btn btn-secondary btn-danger-hover">Disconnect</button>`
      : `<button id="ai-codex-connect" class="btn btn-secondary">
           <span class="material-symbols-rounded">link</span>
           Connect Codex
         </button>`;

    el('ai-codex-connect')?.addEventListener('click', startCodexFlow);
    el('ai-codex-disconnect')?.addEventListener('click', async () => {
      await setCodexTokens(null);
      showToast('Codex disconnected', 'success');
      // Fall back rather than leaving the assistant pointed at a credential
      // that no longer exists.
      if (state.ai?.provider === 'codex' && hasCredentialFor('apikey')) {
        autoSelectProvider('apikey');
      }
      renderAiStatus(onChanged);
      onChanged?.();
    });
  }

  markProviderAvailability();
}

/**
 * Label each provider option with whether it can actually be used, so the
 * dropdown itself explains why one of them would not work.
 */
function markProviderAvailability() {
  const select = el('ai-provider');
  if (!select) return;

  const labels = { apikey: 'OpenAI API key', codex: 'Codex subscription' };
  [...select.options].forEach((option) => {
    const ready = hasCredentialFor(option.value);
    option.textContent = `${labels[option.value]}${ready ? '' : ' — not set up'}`;
  });
}

/**
 * Make a freshly saved credential the active one when the other slot is empty.
 *
 * Connecting Codex with no API key on file, and then being told the assistant
 * needs an API key, is the wrong answer to an unambiguous situation. This only
 * fires when there is nothing to choose between — if both credentials exist the
 * user's selection is left alone.
 */
function autoSelectProvider(justSaved) {
  const other = justSaved === 'codex' ? 'apikey' : 'codex';
  if (hasCredentialFor(other)) return;
  if (state.ai?.provider === justSaved) return;

  updateAiSettings({ provider: justSaved });

  const select = el('ai-provider');
  if (select) select.value = justSaved;

  showToast(`Assistant switched to ${justSaved === 'codex' ? 'Codex' : 'your API key'}`, 'default');
}

function showCodexError(message) {
  const box = el('codex-error');
  if (!box) return;
  box.textContent = message || '';
  box.classList.toggle('hidden', !message);
}

async function startCodexFlow() {
  if (!isUnlocked()) {
    showToast('Unlock your credentials first', 'error');
    return;
  }

  try {
    const url = await beginAuthorization();
    showCodexError('');
    const input = el('codex-callback');
    if (input) input.value = '';
    el('codex-modal')?.classList.remove('hidden');
    window.open(url, '_blank', 'noopener');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function setupCodexModal(onChanged) {
  el('codex-cancel')?.addEventListener('click', () => {
    cancelAuthorization();
    el('codex-modal')?.classList.add('hidden');
  });

  el('codex-complete')?.addEventListener('click', async () => {
    const pasted = el('codex-callback')?.value || '';

    try {
      const tokens = await completeAuthorization(pasted);
      await setCodexTokens(tokens);
      el('codex-modal')?.classList.add('hidden');
      showToast('Codex connected', 'success');
      autoSelectProvider('codex');
      renderAiStatus(onChanged);
      onChanged?.();
    } catch (err) {
      showCodexError(err.message);
    }
  });
}

export function setupAiSettingsListeners({ onCredentialsChanged } = {}) {
  const modelSelect = el('ai-model');
  const providerSelect = el('ai-provider');
  const effortSelect = el('ai-effort');

  /**
   * The model hint describes the model only.
   *
   * Context window deliberately does NOT live here: it is identical across Sol,
   * Terra and Luna and varies by provider instead, so stating it on this row
   * would imply a difference between models that does not exist.
   */
  function renderModelHint() {
    const hint = el('ai-model-hint');
    const chosen = MODELS.find((m) => m.id === (modelSelect?.value || state.ai?.model));
    if (hint && chosen) hint.textContent = chosen.hint;
  }

  /**
   * Context window is a property of the endpoint, not the model — Codex caps
   * every model at 272k where the Platform API allows 1.05M.
   */
  function renderProviderHint() {
    const hint = el('ai-provider-hint');
    if (!hint) return;

    const viaCodex = (providerSelect?.value || state.ai?.provider) === 'codex';
    hint.textContent = viaCodex
      ? 'Which credential the assistant uses. Codex caps every model at 272k context.'
      : 'Which credential the assistant uses. The API allows 1.05M context.';
  }

  if (modelSelect) {
    modelSelect.innerHTML = MODELS.map(
      (m) => `<option value="${m.id}">${m.label}</option>`
    ).join('');
    modelSelect.value = state.ai?.model || 'gpt-5.6-terra';
    modelSelect.addEventListener('change', () => {
      updateAiSettings({ model: modelSelect.value });
      renderModelHint();
    });
  }

  if (providerSelect) {
    providerSelect.value = state.ai?.provider || 'apikey';
    providerSelect.addEventListener('change', () => {
      updateAiSettings({ provider: providerSelect.value });
      renderProviderHint();
      onCredentialsChanged?.();
    });
  }

  renderModelHint();
  renderProviderHint();

  if (effortSelect) {
    effortSelect.innerHTML = EFFORTS.map(
      (e) => `<option value="${e.id}">${e.label}</option>`
    ).join('');
    effortSelect.value = state.ai?.reasoningEffort || 'medium';
    effortSelect.addEventListener('change', () => {
      updateAiSettings({ reasoningEffort: effortSelect.value });
    });
  }

  el('ai-api-key-reveal')?.addEventListener('click', () => {
    const input = el('ai-api-key');
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  el('ai-save-key')?.addEventListener('click', async () => {
    const value = (el('ai-api-key')?.value || '').trim();
    if (!value) {
      showToast('Paste a key first', 'error');
      return;
    }

    try {
      await setApiKey(value);
      showToast('API key saved', 'success');
      autoSelectProvider('apikey');
      renderAiStatus(onCredentialsChanged);
      onCredentialsChanged?.();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  el('ai-clear-key')?.addEventListener('click', async () => {
    try {
      await setApiKey(null);
      showToast('API key removed', 'success');
      renderAiStatus(onCredentialsChanged);
      onCredentialsChanged?.();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  el('ai-change-password')?.addEventListener('click', async () => {
    const current = el('ai-password-current')?.value || '';
    const next = el('ai-password-next')?.value || '';

    if (next.length < 6) {
      showToast('New password must be at least 6 characters', 'error');
      return;
    }

    try {
      await changePassword(current, next, async (password) => {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw new Error(describeError(error));
      });

      const currentInput = el('ai-password-current');
      const nextInput = el('ai-password-next');
      if (currentInput) currentInput.value = '';
      if (nextInput) nextInput.value = '';

      showToast('Password changed and credentials re-encrypted', 'success');
      renderAiStatus(onCredentialsChanged);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  setupCodexModal(onCredentialsChanged);
  renderAiStatus(onCredentialsChanged);
}

export { renderAiStatus };

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
