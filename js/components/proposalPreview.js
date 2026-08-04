/**
 * Preview overlay: what the app looks like if this proposal is accepted.
 *
 * Renders proposal data through the app's own CSS classes so it reads as the
 * real thing, but it is a separate render path that never touches `dataStore`.
 * Reusing the live render functions was the obvious alternative and is wrong
 * here — they write to fixed element ids and read the store directly, so
 * driving them would either paint into the live DOM or require swapping the
 * store out and back, which risks leaving the app half-applied if anything
 * throws in between.
 *
 * Dismissable with Escape, the backdrop, or the close button. Opening and
 * closing it changes nothing.
 */

import { dataStore, getMealById } from '../core/dataStore.js';
import { getScheduleDays } from '../services/scheduleInfo.js';
import { withScheduleChanges } from './proposals.js';
import { fmt } from '../utils/helpers.js';

let escapeHandler = null;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const BADGE = {
  create: { cls: 'is-new', text: 'New' },
  update: { cls: 'is-updated', text: 'Updates' },
  delete: { cls: 'is-removed', text: 'Removes' }
};

function badge(op) {
  const { cls, text } = BADGE[op] || BADGE.update;
  return `<span class="preview-badge ${cls}">${text}</span>`;
}

function impactMarkup(impact = []) {
  if (!impact.length) return '';
  return impact
    .map(
      (item) => `
      <p class="preview-impact preview-impact-${item.severity}">
        <span class="material-symbols-rounded">${item.severity === 'warn' ? 'warning' : 'info'}</span>
        ${escapeHtml(item.text)}
      </p>`
    )
    .join('');
}

/**
 * Show old → new for the fields that actually moved. Listing every field would
 * bury the one number the user needs to check.
 */
function diffRows(change) {
  if (change.op !== 'update' || !change.before) return '';

  const rows = (change.fields || [])
    .map(({ key, label }) => {
      const before = change.before[key];
      const after = change.after[key];
      if (before === undefined || String(before) === String(after)) return '';
      return `
        <div class="preview-diff-row">
          <span class="preview-diff-label">${escapeHtml(label)}</span>
          <span class="preview-diff-old">${escapeHtml(before)}</span>
          <span class="material-symbols-rounded preview-diff-arrow">arrow_forward</span>
          <span class="preview-diff-new">${escapeHtml(after)}</span>
        </div>`;
    })
    .filter(Boolean)
    .join('');

  return rows ? `<div class="preview-diff">${rows}</div>` : '';
}

function renderIngredient(change) {
  const data = change.after || change.before;
  const unit = escapeHtml(data.unit);

  return `
    <div class="ingredient-card preview-card preview-${change.op}">
      ${badge(change.op)}
      <div class="ingredient-name">${escapeHtml(data.name)}</div>
      <div class="ingredient-meta">${unit} unit · ${escapeHtml(data.category || 'Uncategorized')}</div>
      <div class="ingredient-macros">
        <span class="macro-kcal">${fmt(Number(data.kcal))} kcal/${unit}</span>
        <span class="macro-protein">${fmt(Number(data.protein_per_unit))} g protein/${unit}</span>
        <span class="macro-carbs">${fmt(Number(data.carb_per_unit))} g carbs/${unit}</span>
        <span class="macro-fats">${fmt(Number(data.lipid_per_unit))} g lipids/${unit}</span>
      </div>
      ${diffRows(change)}
      ${impactMarkup(change.impact)}
    </div>`;
}

/**
 * Meal totals have to be computed from the proposal, not looked up: for a new
 * meal there is nothing to look up, and for an edited one the stored totals are
 * the old ones. Ingredients created in this same proposal are resolved from the
 * proposal too, since they are not in the store yet.
 */
function previewMealMacros(after, pendingIngredients) {
  return (after.ingredients || []).reduce(
    (acc, entry) => {
      const pending = pendingIngredients.find((c) => c.id === entry.itemId && c.op !== 'delete');
      const source = pending ? pending.after : dataStore.ingredients.find((i) => i.id === entry.itemId);
      const qty = Number(entry.quantity) || 0;

      if (!source) return acc;
      return {
        kcal: acc.kcal + Number(source.kcal || 0) * qty,
        protein: acc.protein + Number(source.protein_per_unit || 0) * qty
      };
    },
    { kcal: 0, protein: 0 }
  );
}

function renderMeal(change, pendingIngredients) {
  if (change.op === 'delete') {
    return `
      <div class="menu-card preview-card preview-delete">
        ${badge('delete')}
        <span class="meal-type ${escapeHtml((change.before.type || '').toLowerCase())}">${escapeHtml(change.before.type)}</span>
        <h3>${escapeHtml(change.before.name)}</h3>
        ${impactMarkup(change.impact)}
      </div>`;
  }

  const macros = previewMealMacros(change.after, pendingIngredients);
  const count = (change.after.ingredients || []).length;

  return `
    <div class="menu-card preview-card preview-${change.op}">
      ${badge(change.op)}
      <span class="meal-type ${escapeHtml((change.after.type || '').toLowerCase())}">${escapeHtml(change.after.type)}</span>
      <h3>${escapeHtml(change.after.name)}</h3>
      <div class="macros">
        <span><span class="material-symbols-rounded">local_fire_department</span> ${Math.round(macros.kcal)} kcal</span>
        <span><span class="material-symbols-rounded">fitness_center</span> ${Math.round(macros.protein)} g protein</span>
      </div>
      <p class="preview-subtle">${count} ingredient${count === 1 ? '' : 's'}</p>
      ${diffRows(change)}
      ${impactMarkup(change.impact)}
    </div>`;
}

/**
 * The schedule previews as a whole week rather than a list of edits, because
 * "Thursday dinner changes" only means something next to the other six days.
 */
function renderSchedule(scheduleChanges, pendingMeals) {
  const week = withScheduleChanges(scheduleChanges);
  const dayNames = getScheduleDays();
  const touched = new Set(scheduleChanges.map((c) => c.after.day));

  const nameFor = (mealId) => {
    if (!mealId) return '—';
    const pending = pendingMeals.find((m) => m.id === mealId && m.op !== 'delete');
    if (pending) return pending.after.name;
    return getMealById(mealId)?.name || 'Unassigned meal';
  };

  const days = week
    .map((day, i) => {
      const isTouched = touched.has(i);
      const slots = day.isCheatDay
        ? '<div class="schedule-empty">Cheat day</div>'
        : day.slots
            .map(
              (slot) => `
                <div class="preview-slot">
                  <span class="preview-slot-name">${slot.slot}</span>
                  <span class="preview-slot-meal">${escapeHtml(nameFor(slot.mealId))}</span>
                </div>`
            )
            .join('');

      return `
        <div class="schedule-day preview-day ${isTouched ? 'preview-day-changed' : ''}">
          <h2>${escapeHtml(dayNames[i] || `Day ${i + 1}`)} ${isTouched ? badge('update') : ''}</h2>
          <div class="preview-slots">${slots}</div>
        </div>`;
    })
    .join('');

  return `<div class="preview-week">${days}</div>`;
}

function renderSimple(change) {
  const rows = (change.fields || [])
    .map(({ key, label }) => {
      const after = change.after?.[key];
      if (after === null || after === undefined) return '';
      const before = change.before?.[key];
      const moved = before !== undefined && String(before) !== String(after);

      return `
        <div class="preview-diff-row">
          <span class="preview-diff-label">${escapeHtml(label)}</span>
          ${moved ? `<span class="preview-diff-old">${escapeHtml(before)}</span>
          <span class="material-symbols-rounded preview-diff-arrow">arrow_forward</span>` : ''}
          <span class="preview-diff-new">${escapeHtml(after)}</span>
        </div>`;
    })
    .filter(Boolean)
    .join('');

  return `
    <div class="preview-card preview-panel preview-${change.op}">
      ${badge(change.op)}
      <h3>${escapeHtml(change.label)}</h3>
      ${change.summaryText ? `<p class="preview-subtle">${escapeHtml(change.summaryText)}</p>` : ''}
      <div class="preview-diff">${rows}</div>
      ${impactMarkup(change.impact)}
    </div>`;
}

function section(title, icon, body) {
  if (!body) return '';
  return `
    <section class="preview-section">
      <h2><span class="material-symbols-rounded">${icon}</span> ${title}</h2>
      ${body}
    </section>`;
}

/**
 * Open the overlay for a normalized proposal.
 */
export function openPreview(normalized) {
  const root = document.getElementById('proposal-preview');
  if (!root) return;

  const changes = normalized.changes || [];
  const ingredients = changes.filter((c) => c.kind === 'ingredient');
  const meals = changes.filter((c) => c.kind === 'meal');
  const schedule = changes.filter((c) => c.kind === 'schedule');
  const supplements = changes.filter((c) => c.kind === 'supplements');
  const profile = changes.filter((c) => c.kind === 'profile');
  const shopping = changes.filter((c) => c.kind === 'shopping');

  root.innerHTML = `
    <div class="preview-backdrop" data-action="close"></div>
    <div class="preview-sheet" role="dialog" aria-modal="true" aria-label="Preview proposed changes">
      <header class="preview-header">
        <div>
          <h1>Preview</h1>
          <p>${escapeHtml(normalized.summary)}</p>
        </div>
        <button class="btn-icon" data-action="close" aria-label="Close preview">
          <span class="material-symbols-rounded">close</span>
        </button>
      </header>

      <div class="preview-body">
        ${section('Ingredients', 'nutrition', ingredients.length ? `<div class="ingredients-grid">${ingredients.map(renderIngredient).join('')}</div>` : '')}
        ${section('Meals', 'restaurant_menu', meals.length ? `<div class="preview-grid">${meals.map((m) => renderMeal(m, ingredients)).join('')}</div>` : '')}
        ${section('Schedule', 'calendar_month', schedule.length ? renderSchedule(schedule, meals) : '')}
        ${section("Today's tracking", 'medication', supplements.map(renderSimple).join(''))}
        ${section('Profile & goals', 'person', profile.map(renderSimple).join(''))}
        ${section('Shopping list', 'shopping_cart', shopping.map(renderSimple).join(''))}
      </div>

      <footer class="preview-footer">
        <p class="preview-note">Nothing has been saved. Close this and choose Accept to apply.</p>
        <button class="btn btn-secondary" data-action="close">
          <span class="material-symbols-rounded">arrow_back</span>
          Back to chat
        </button>
      </footer>
    </div>`;

  root.classList.remove('hidden');

  root.querySelectorAll('[data-action="close"]').forEach((el) => {
    el.addEventListener('click', closePreview);
  });

  escapeHandler = (event) => {
    if (event.key === 'Escape') closePreview();
  };
  document.addEventListener('keydown', escapeHandler);
}

export function closePreview() {
  const root = document.getElementById('proposal-preview');
  if (!root) return;

  root.classList.add('hidden');
  root.innerHTML = '';

  if (escapeHandler) {
    document.removeEventListener('keydown', escapeHandler);
    escapeHandler = null;
  }
}

export { escapeHtml };
