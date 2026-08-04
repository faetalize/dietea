/**
 * The chat surface: floating pill, panel, messages, attachments, and the
 * proposal cards that gate every write.
 *
 * The agent runs multi-step — it may search ingredients, read a recipe, then
 * draft a proposal, all inside one turn. A spinner for that whole stretch reads
 * as frozen, so tool activity is rendered as a live step list. GPT-5.6's
 * guidance is against scripting narration into the prompt, which means the
 * legibility has to come from here instead.
 */

import { runTurn, recordProposalOutcome, clearConversation } from '../services/agent.js';
import { describeAiError } from '../services/openai.js';
import { isUnlocked, needsUnlock, hasCredentialFor, unlockWithPassword } from '../services/credentials.js';
import { state, updateAiSettings } from '../services/state.js';
import { getTrackerState } from './supplements.js';
import { normalizeProposal, applyProposal, describeApplied } from './proposals.js';
import { openPreview, escapeHtml } from './proposalPreview.js';
import { showToast } from '../utils/feedback.js';

const TOOL_LABELS = {
  list_ingredients: 'Reading your ingredients',
  get_ingredient: 'Reading an ingredient',
  list_meals: 'Reading your meals',
  get_meal: 'Reading a recipe',
  get_schedule: 'Reading your schedule',
  get_profile: 'Reading your profile',
  get_supplements: "Reading today's tracking",
  get_shopping_list: 'Building your shopping list',
  propose_ingredient_changes: 'Preparing ingredient changes',
  propose_meal_changes: 'Preparing meal changes',
  propose_schedule_changes: 'Preparing schedule changes',
  propose_supplement_changes: 'Preparing tracking changes',
  propose_profile_changes: 'Preparing profile changes',
  propose_shopping_changes: 'Preparing shopping changes',
  propose_changes: 'Preparing combined changes'
};

const PROPOSAL_KIND_META = {
  ingredient: { label: 'Ingredients', icon: 'nutrition' },
  meal: { label: 'Meals', icon: 'restaurant_menu' },
  schedule: { label: 'Schedule', icon: 'calendar_month' },
  supplements: { label: 'Today’s tracking', icon: 'medication' },
  profile: { label: 'Profile & goals', icon: 'person' },
  shopping: { label: 'Shopping list', icon: 'shopping_cart' }
};

/** Files staged on the composer, cleared when the turn is sent. */
let attachments = [];
/** In-flight turn, so the stop button can cancel it. */
let controller = null;
/** Callbacks from main.js for re-rendering after an accepted proposal. */
let hooks = {};

function el(id) {
  return document.getElementById(id);
}

function messagesRoot() {
  return el('chat-messages');
}

/**
 * Keep the Settings dropdown in step when the provider is changed from here,
 * so the two surfaces never disagree about which credential is active.
 */
function syncProviderSelect(provider) {
  const select = el('ai-provider');
  if (select) select.value = provider;
}

/* ------------------------------------------------------------- open/close */

export function openChat() {
  el('chat-panel')?.classList.remove('hidden');
  el('chat-pill')?.classList.add('is-open');
  renderGate();
  el('chat-input')?.focus();
}

export function closeChat() {
  el('chat-panel')?.classList.add('hidden');
  el('chat-pill')?.classList.remove('is-open');
}

function toggleChat() {
  const panel = el('chat-panel');
  if (panel?.classList.contains('hidden')) openChat();
  else closeChat();
}

/* ------------------------------------------------------------------ gate */

/**
 * Show setup or unlock instead of the composer when the assistant cannot run.
 * Distinguishing "locked" from "not set up" matters: one needs a password, the
 * other needs a trip to Settings.
 */
function renderGate() {
  const gate = el('chat-gate');
  const composer = el('chat-composer');
  if (!gate || !composer) return;

  const provider = state.ai?.provider || 'apikey';

  if (needsUnlock()) {
    gate.innerHTML = `
      <p>Unlock your saved credentials to use the assistant.</p>
      <form class="chat-unlock" id="chat-unlock-form">
        <input type="password" id="chat-unlock-password" placeholder="Account password" autocomplete="current-password">
        <button type="submit" class="btn btn-primary">Unlock</button>
      </form>
      <p class="chat-gate-hint">Your credentials are encrypted with your password, so they cannot be read without it.</p>`;

    gate.classList.remove('hidden');
    composer.classList.add('hidden');

    el('chat-unlock-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const password = el('chat-unlock-password')?.value || '';
      try {
        await unlockWithPassword(password);
        renderGate();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
    return;
  }

  if (!isUnlocked() || !hasCredentialFor(provider)) {
    const other = provider === 'codex' ? 'apikey' : 'codex';
    const otherName = other === 'codex' ? 'Codex' : 'your API key';

    // The likely case is a credential set up under the other provider while the
    // dropdown was left alone. Offer the switch here rather than sending them
    // to Settings to hunt for a select they have no reason to suspect.
    if (isUnlocked() && hasCredentialFor(other)) {
      gate.innerHTML = `
        <p>${otherName === 'Codex' ? 'Codex is connected' : 'An API key is saved'}, but the assistant is set to use
           ${provider === 'codex' ? 'Codex' : 'an OpenAI API key'}.</p>
        <button class="btn btn-primary" id="chat-switch-provider">
          <span class="material-symbols-rounded">swap_horiz</span>
          Use ${otherName} instead
        </button>`;

      gate.classList.remove('hidden');
      composer.classList.add('hidden');

      el('chat-switch-provider')?.addEventListener('click', () => {
        updateAiSettings({ provider: other });
        syncProviderSelect(other);
        renderGate();
      });
      return;
    }

    gate.innerHTML = `
      <p>The assistant needs ${provider === 'codex' ? 'a Codex connection' : 'an OpenAI API key'}.</p>
      <button class="btn btn-primary" id="chat-open-settings">
        <span class="material-symbols-rounded">settings</span>
        Open settings
      </button>`;

    gate.classList.remove('hidden');
    composer.classList.add('hidden');

    el('chat-open-settings')?.addEventListener('click', () => {
      closeChat();
      el('settings-btn')?.click();
      el('ai-settings-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return;
  }

  gate.classList.add('hidden');
  gate.innerHTML = '';
  composer.classList.remove('hidden');
}

/* -------------------------------------------------------------- messages */

function appendMessage(role, html, classes = '') {
  const root = messagesRoot();
  if (!root) return null;

  const wrapper = document.createElement('div');
  wrapper.className = `chat-message chat-message-${role} ${classes}`.trim();
  wrapper.innerHTML = html;
  root.appendChild(wrapper);
  scrollToBottom();
  return wrapper;
}

function scrollToBottom() {
  const root = messagesRoot();
  if (root) root.scrollTop = root.scrollHeight;
}

/**
 * Minimal markdown: paragraphs, bullets, bold, and inline code.
 *
 * Escaped first, so model output — which may be quoting a label photographed
 * from who knows where — cannot inject markup into the page.
 */
function renderMarkdown(text) {
  const escaped = escapeHtml(text);

  return escaped
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block.split('\n');
      if (lines.every((line) => /^\s*[-*]\s+/.test(line))) {
        const items = lines.map((line) => `<li>${inline(line.replace(/^\s*[-*]\s+/, ''))}</li>`).join('');
        return `<ul>${items}</ul>`;
      }
      return `<p>${inline(lines.join('<br>'))}</p>`;
    })
    .join('');
}

function inline(text) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

/* ----------------------------------------------------------- step traces */

function createTrace() {
  const wrapper = appendMessage('assistant', '<div class="chat-steps"></div>', 'chat-message-trace');
  const list = wrapper?.querySelector('.chat-steps');
  const toolSteps = new Map();
  const reasoningSteps = new Map();
  let statusRow = null;
  let statusKind = null;
  let hasWork = false;

  function createRow(label, className = '') {
    if (!list) return null;
    const row = document.createElement('div');
    row.className = `chat-step is-running ${className}`.trim();
    row.innerHTML = `
      <span class="chat-step-spinner"></span>
      <span class="chat-step-copy">
        <span class="chat-step-label"></span>
      </span>`;
    row.querySelector('.chat-step-label').textContent = label;
    list.appendChild(row);
    scrollToBottom();
    return row;
  }

  function finishRow(row, icon = 'check') {
    if (!row || row.classList.contains('is-done')) return;
    row.classList.remove('is-running');
    row.classList.add('is-done');
    row.querySelector('.chat-step-spinner')?.replaceWith(iconNode(icon));
  }

  function setToolDetail(row) {
    const copy = row?.querySelector('.chat-step-copy');
    if (!copy) return;

    let detail = copy.querySelector('.chat-step-detail');
    const text = [row.dataset.args, row.dataset.result].filter(Boolean).join(' · ');
    if (!text) {
      detail?.remove();
      return;
    }

    if (!detail) {
      detail = document.createElement('span');
      detail.className = 'chat-step-detail';
      copy.appendChild(detail);
    }
    detail.textContent = text;
  }

  function finishReasoning(index, finalText) {
    const entry = reasoningSteps.get(index);
    if (!entry) return;
    if (finalText) entry.text = finalText;

    const heading = reasoningHeading(entry.text);
    if (heading) entry.row.querySelector('.chat-step-label').textContent = heading;
    finishRow(entry.row, 'psychology');

    const detailText = reasoningDetail(entry.text, heading);
    const copy = entry.row.querySelector('.chat-step-copy');
    if (detailText && copy && !copy.querySelector('.chat-reasoning-details')) {
      const details = document.createElement('details');
      details.className = 'chat-reasoning-details';
      const summary = document.createElement('summary');
      summary.textContent = 'Work summary';
      const content = document.createElement('div');
      content.className = 'chat-reasoning-text';
      content.textContent = detailText;
      details.append(summary, content);
      copy.appendChild(details);
    }
  }

  function settleStatus() {
    if (!statusRow) return;

    if (statusKind === 'reasoning') {
      const label = statusRow.querySelector('.chat-step-label');
      if (label?.textContent === 'Thinking') label.textContent = 'Reasoned';
      finishRow(statusRow, 'psychology');
      hasWork = true;
    } else {
      statusRow.remove();
    }

    statusRow = null;
    statusKind = null;
  }

  return {
    status(label, kind = 'activity') {
      if (!list) return;
      if (!statusRow) statusRow = createRow(label, 'chat-step-status');
      else statusRow.querySelector('.chat-step-label').textContent = label;
      statusKind = kind;
    },
    thinking() {
      if (!list) return;
      hasWork = true;
      if (!statusRow) statusRow = createRow('Thinking', 'chat-step-reasoning');
      else statusRow.querySelector('.chat-step-label').textContent = 'Thinking';
      statusRow.classList.add('chat-step-reasoning');
      statusKind = 'reasoning';
    },
    textStarted() {
      // Text streaming is its own visible progress signal. Remove a generic
      // request spinner, or complete a real reasoning item if one preceded it.
      settleStatus();
    },
    reasoning(delta, reasoningId, summaryIndex = 0) {
      if (!delta || !list) return;
      hasWork = true;
      const key = reasoningId || `summary-${summaryIndex}`;

      let entry = reasoningSteps.get(key);
      if (!entry) {
        const row = statusRow || createRow('Thinking', 'chat-step-reasoning');
        statusRow = null;
        statusKind = null;
        row?.classList.add('chat-step-reasoning');
        entry = { row, text: '' };
        reasoningSteps.set(key, entry);
      }

      entry.text += delta;
      const heading = reasoningHeading(entry.text);
      const label = entry.row?.querySelector('.chat-step-label');
      if (heading && label) label.textContent = heading;
      scrollToBottom();
    },
    reasoningDone(text, reasoningId, summaryIndex = 0) {
      const key = reasoningId || `summary-${summaryIndex}`;
      if (!reasoningSteps.has(key) && text) this.reasoning(text, reasoningId, summaryIndex);
      finishReasoning(key, text);
    },
    start(callId, name) {
      if (!list) return;
      if (toolSteps.has(callId)) return;
      hasWork = true;
      settleStatus();
      reasoningSteps.forEach((_, index) => finishReasoning(index));
      const row = createRow(TOOL_LABELS[name] || name, 'chat-step-tool');
      toolSteps.set(callId, row);
    },
    args(callId, name, rawArgs) {
      this.start(callId, name);
      const row = toolSteps.get(callId);
      if (!row) return;
      row.dataset.args = summarizeToolArgs(name, rawArgs);
      setToolDetail(row);
    },
    finish(callId, detail) {
      const row = toolSteps.get(callId);
      if (!row) return;
      row.dataset.result = detail || '';
      setToolDetail(row);
      finishRow(row);
    },
    complete() {
      reasoningSteps.forEach((_, index) => finishReasoning(index));
      settleStatus();
      if (!hasWork) wrapper?.remove();
    }
  };
}

function reasoningHeading(text) {
  const value = String(text || '');
  const bold = value.match(/\*\*([^*]+)\*\*/)?.[1]?.trim();
  const firstLine = value
    .split('\n')
    .map((line) => line.replace(/^#+\s*/, '').replace(/^\*\*|\*\*$/g, '').trim())
    .find(Boolean);
  const heading = bold || firstLine || '';
  return heading.length > 90 ? `${heading.slice(0, 87)}…` : heading;
}

function reasoningDetail(text, heading) {
  const value = String(text || '')
    .replace(/^\s*\*\*[^*]+\*\*\s*/, '')
    .trim();
  return value && value !== heading ? value : '';
}

function iconNode(name) {
  const span = document.createElement('span');
  span.className = 'material-symbols-rounded chat-step-icon';
  span.textContent = name;
  return span;
}

function summarizeToolResult(name, result) {
  if (!result) return '';
  if (result.error) return result.error;
  if (name === 'list_ingredients' || name === 'list_meals') {
    const count = result.results?.length || 0;
    const total = result.total || 0;
    return total ? `${count} of ${total}` : 'none found';
  }
  if (name === 'get_ingredient') return result.name || '';
  if (name === 'get_meal') return result.name || '';
  if (name === 'get_schedule') {
    const count = result.days?.length || 0;
    return count ? `${count} day${count === 1 ? '' : 's'}` : 'empty';
  }
  if (name === 'get_profile') return result.isComplete ? 'profile loaded' : 'not set up';
  if (name === 'get_supplements') {
    const total = result.supplements?.length || 0;
    return `${result.completedCount || 0} of ${total} taken`;
  }
  if (name === 'get_shopping_list') {
    const count = result.categories?.length || 0;
    return count ? `${count} categor${count === 1 ? 'y' : 'ies'}` : 'empty';
  }
  if (name.startsWith('propose_')) return result.status === 'staged' ? 'ready for review' : '';
  return '';
}

function summarizeToolArgs(name, rawArgs) {
  let args = {};
  try {
    args = rawArgs ? JSON.parse(rawArgs) : {};
  } catch {
    return '';
  }

  if (name === 'list_ingredients' || name === 'list_meals') {
    return args.query ? `“${args.query}”` : args.type || args.category || 'all';
  }
  if (name === 'get_ingredient') return args.ingredientId || '';
  if (name === 'get_meal') return args.mealId || '';
  if (name === 'get_schedule') return args.day === null ? 'full week' : `day ${Number(args.day) + 1}`;
  if (name.startsWith('propose_')) return args.summary || '';
  return '';
}

/* --------------------------------------------------------- proposal card */

/**
 * Render a proposal as an editable card.
 *
 * Editable on purpose: the most common failure is one wrong number off a blurry
 * label, and making the user re-prompt to fix a single digit would be worse than
 * the manual form this is meant to replace. Edits write straight into the
 * proposal, and the applied values are what gets echoed back to the model.
 *
 * Exported so a proposal can be rendered outside a live turn — re-displaying a
 * past one, or exercising the gate without spending a model call.
 */
export function renderProposal(proposal) {
  const normalized = normalizeProposal(proposal);

  if (!normalized.changes.length) {
    appendMessage('assistant', '<p class="chat-empty">Nothing to change — everything already matches.</p>');
    return;
  }

  const card = appendMessage('assistant', buildProposalMarkup(normalized), 'chat-message-proposal');
  if (!card) return;

  card.querySelectorAll('[data-field]').forEach((input) => {
    input.addEventListener('input', () => {
      const changeIndex = Number(input.dataset.change);
      const key = input.dataset.field;
      const change = normalized.changes[changeIndex];
      if (!change) return;

      const field = change.fields?.find((entry) => entry.key === key);
      change.after[key] = field?.type === 'number' ? Number(input.value) : input.value;
      if (key === 'name') {
        change.label = input.value;
        const heading = card.querySelector(`[data-change-label="${changeIndex}"]`);
        if (heading) heading.textContent = input.value;
      }
    });
  });

  card.querySelector('[data-action="preview"]')?.addEventListener('click', () => openPreview(normalized));

  card.querySelector('[data-action="suggest"]')?.addEventListener('click', () => {
    const input = el('chat-input');
    if (input) {
      input.value = `About "${normalized.summary}": `;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
    setDecided(card, 'Asked for changes');
    recordProposalOutcome(normalized.id, 'rejected', 'They want changes; their message follows.');
  });

  card.querySelector('[data-action="accept"]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = 'Applying…';

    const result = await applyProposal(normalized);

    if (!result.ok) {
      button.disabled = false;
      button.textContent = 'Accept';
      return;
    }

    setDecided(card, 'Applied');
    recordProposalOutcome(normalized.id, 'accepted', describeApplied(result.applied));
    hooks.onApplied?.(result.applied);
    showToast('Changes applied', 'success');
  });
}

function setDecided(card, label) {
  card.classList.add('is-decided');
  const actions = card.querySelector('.chat-proposal-actions');
  if (actions) actions.innerHTML = `<span class="chat-proposal-status">${escapeHtml(label)}</span>`;
}

function buildProposalMarkup(normalized) {
  const renderChange = (change, index) => {
      const fields = (change.fields || [])
        .map(
          ({ key, label, type, options }) => `
        <label class="chat-field">
          <span>${escapeHtml(label)}</span>
          ${
            type === 'select'
              ? `<select data-change="${index}" data-field="${key}">
                   ${(options || [])
                     .map(
                       (opt) =>
                         `<option value="${escapeHtml(opt)}" ${opt === change.after[key] ? 'selected' : ''}>${escapeHtml(opt)}</option>`
                     )
                     .join('')}
                 </select>`
              : `<input type="${type === 'number' ? 'number' : 'text'}" step="any"
                        data-change="${index}" data-field="${key}"
                        value="${escapeHtml(change.after?.[key] ?? '')}">`
          }
        </label>`
        )
        .join('');

      const impact = (change.impact || [])
        .map(
          (item) => `
        <p class="chat-impact chat-impact-${item.severity}">
          <span class="material-symbols-rounded">${item.severity === 'warn' ? 'warning' : 'info'}</span>
          ${escapeHtml(item.text)}
        </p>`
        )
        .join('');

      return `
      <div class="chat-change chat-change-${change.op}">
        <div class="chat-change-head">
          <span class="chat-change-op chat-op-${change.op}">${change.op}</span>
          <strong data-change-label="${index}">${escapeHtml(change.label)}</strong>
        </div>
        ${change.summaryText ? `<p class="chat-change-note">${escapeHtml(change.summaryText)}</p>` : ''}
        ${fields ? `<div class="chat-fields">${fields}</div>` : ''}
        ${impact}
      </div>`;
    };

  const indexed = normalized.changes.map((change, index) => ({ change, index }));
  const kinds = [...new Set(indexed.map(({ change }) => change.kind))];
  const groups = kinds
    .map((kind) => {
      const meta = PROPOSAL_KIND_META[kind] || { label: kind, icon: 'edit' };
      const entries = indexed.filter(({ change }) => change.kind === kind);
      return `
        <section class="chat-change-group">
          <h3 class="chat-change-group-title">
            <span class="material-symbols-rounded">${meta.icon}</span>
            ${escapeHtml(meta.label)}
            <span class="chat-change-count">${entries.length}</span>
          </h3>
          <div class="chat-change-group-items">
            ${entries.map(({ change, index }) => renderChange(change, index)).join('')}
          </div>
        </section>`;
    })
    .join('');

  return `
    <div class="chat-proposal">
      <p class="chat-proposal-summary">${escapeHtml(normalized.summary)}</p>
      <div class="chat-changes">${groups}</div>
      <p class="chat-proposal-ask">Does this look good to you?</p>
      <div class="chat-proposal-actions">
        <button class="btn btn-secondary btn-sm" data-action="preview">
          <span class="material-symbols-rounded">visibility</span>
          Preview
        </button>
        <button class="btn btn-secondary btn-sm" data-action="suggest">Suggest changes</button>
        <button class="btn btn-primary btn-sm" data-action="accept">Accept</button>
      </div>
    </div>`;
}

/* ------------------------------------------------------------ attachments */

const IMAGE_TYPES = /^image\//;
const TEXT_TYPES = /^(text\/|application\/(json|csv))/;

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

async function addFiles(files) {
  for (const file of files) {
    try {
      if (IMAGE_TYPES.test(file.type)) {
        attachments.push({ kind: 'image', name: file.name, dataUrl: await readAsDataUrl(file) });
      } else if (TEXT_TYPES.test(file.type) || /\.(md|txt|csv|json)$/i.test(file.name)) {
        attachments.push({ kind: 'text', name: file.name, text: await file.text() });
      } else if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
        attachments.push({ kind: 'file', name: file.name, dataUrl: await readAsDataUrl(file) });
      } else {
        showToast(`${file.name} is not a supported attachment`, 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
  renderAttachments();
}

function renderAttachments() {
  const root = el('chat-attachments');
  if (!root) return;

  root.classList.toggle('hidden', !attachments.length);
  root.innerHTML = attachments
    .map(
      (file, index) => `
      <div class="chat-attachment">
        ${file.kind === 'image' ? `<img src="${file.dataUrl}" alt="">` : `<span class="material-symbols-rounded">description</span>`}
        <span class="chat-attachment-name">${escapeHtml(file.name)}</span>
        <button class="btn-icon-sm" data-remove="${index}" aria-label="Remove ${escapeHtml(file.name)}">
          <span class="material-symbols-rounded">close</span>
        </button>
      </div>`
    )
    .join('');

  root.querySelectorAll('[data-remove]').forEach((button) => {
    button.addEventListener('click', () => {
      attachments.splice(Number(button.dataset.remove), 1);
      renderAttachments();
    });
  });
}

/* ------------------------------------------------------------------ send */

function setBusy(busy) {
  el('chat-send')?.classList.toggle('hidden', busy);
  el('chat-stop')?.classList.toggle('hidden', !busy);
  const input = el('chat-input');
  if (input) input.disabled = busy;
}

async function send() {
  const input = el('chat-input');
  const text = (input?.value || '').trim();
  if (!text && !attachments.length) return;

  const sent = attachments;
  attachments = [];

  appendMessage(
    'user',
    `${sent.length ? `<div class="chat-message-files">${sent.map((f) => escapeHtml(f.name)).join(', ')}</div>` : ''}
     <p>${escapeHtml(text)}</p>`
  );

  if (input) input.value = '';
  renderAttachments();
  setBusy(true);

  controller = new AbortController();
  const trace = createTrace();

  let bubble = null;
  let streamed = '';

  try {
    const result = await runTurn({
      text,
      attachments: sent,
      getSupplements: getTrackerState,
      signal: controller.signal,
      onProposal: renderProposal,
      onEvent: (event) => {
        if (event.type === 'turn-start' || event.type === 'status') {
          trace.status(event.label || 'Waiting for response');
        } else if (event.type === 'thinking') {
          trace.thinking();
        } else if (event.type === 'reasoning-summary') {
          trace.reasoning(event.delta, event.reasoningId, event.summaryIndex);
        } else if (event.type === 'reasoning-summary-done') {
          trace.reasoningDone(event.text, event.reasoningId, event.summaryIndex);
        } else if (event.type === 'tool-start' || event.type === 'tool-running') {
          trace.start(event.callId, event.name);
        } else if (event.type === 'tool-args') {
          trace.args(event.callId, event.name, event.args);
        } else if (event.type === 'tool-done') {
          trace.finish(event.callId, summarizeToolResult(event.name, event.result));
        } else if (event.type === 'text') {
          trace.textStarted();
          streamed += event.delta;
          if (!bubble) bubble = appendMessage('assistant', '');
          if (bubble) bubble.innerHTML = renderMarkdown(streamed);
          scrollToBottom();
        }
      }
    });

    trace.complete();

    // A turn that ends in a proposal often has no prose at all, which is fine.
    if (!streamed && result.text) {
      appendMessage('assistant', renderMarkdown(result.text));
    }
    const contradictsVisibleText =
      streamed && result.error === 'The model completed without returning a message. Please try again.';
    if (result.error && !contradictsVisibleText) {
      appendMessage('assistant', `<p class="chat-error">${escapeHtml(result.error)}</p>`);
    }
  } catch (err) {
    trace.complete();
    const message = describeAiError(err);
    if (message) appendMessage('assistant', `<p class="chat-error">${escapeHtml(message)}</p>`);
  } finally {
    controller = null;
    setBusy(false);
    input?.focus();
  }
}

/* ----------------------------------------------------------------- setup */

export function setupChat(callbacks = {}) {
  hooks = callbacks;

  el('chat-pill')?.addEventListener('click', toggleChat);
  el('chat-close')?.addEventListener('click', closeChat);
  el('chat-send')?.addEventListener('click', send);

  el('chat-stop')?.addEventListener('click', () => {
    controller?.abort();
  });

  el('chat-clear')?.addEventListener('click', () => {
    clearConversation();
    const root = messagesRoot();
    if (root) root.innerHTML = '';
    showToast('Conversation cleared', 'default');
  });

  const input = el('chat-input');

  // Enter sends, Shift+Enter breaks the line — the convention everywhere else.
  input?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  });

  input?.addEventListener('paste', (event) => {
    const files = [...(event.clipboardData?.files || [])];
    if (files.length) {
      event.preventDefault();
      addFiles(files);
    }
  });

  const panel = el('chat-panel');

  panel?.addEventListener('dragover', (event) => {
    event.preventDefault();
    panel.classList.add('is-dropping');
  });
  panel?.addEventListener('dragleave', () => panel.classList.remove('is-dropping'));
  panel?.addEventListener('drop', (event) => {
    event.preventDefault();
    panel.classList.remove('is-dropping');
    addFiles([...(event.dataTransfer?.files || [])]);
  });

  el('chat-attach')?.addEventListener('click', () => el('chat-file')?.click());
  el('chat-file')?.addEventListener('change', (event) => {
    addFiles([...event.target.files]);
    event.target.value = '';
  });

  renderGate();
}

export { renderGate };
