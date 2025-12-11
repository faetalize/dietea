/**
 * Meal Detail UI
 */

import { getMealById } from '../core/dataStore.js';

export function renderMealDetail(mealId, mealDetailContent) {
  const container = mealDetailContent || document.getElementById('meal-detail-content');
  if (!container) return;

  const meal = getMealById(mealId);
  if (!meal) {
    container.innerHTML = '<p class="empty-state">Meal not found.</p>';
    return;
  }

  const hasInstructions = Array.isArray(meal.instructions) && meal.instructions.length;

  let instructionsHTML = '';
  if (hasInstructions) {
    if (meal.instructions.length === 1) {
      const instr = meal.instructions[0];
      instructionsHTML = `
        <div class="instruction-block">
          <h3>${instr.name}</h3>
          <ol class="instructions-list">
            ${instr.steps.map((step) => `<li>${step}</li>`).join('')}
          </ol>
        </div>
      `;
    } else {
      instructionsHTML = `
        <div class="instruction-tabs">
          <div class="instruction-tab-buttons">
            ${meal.instructions
              .map(
                (instr, i) =>
                  `<button class="instruction-tab-btn${i === 0 ? ' active' : ''}" data-tab-index="${i}">${instr.name}</button>`
              )
              .join('')}
          </div>
          <div class="instruction-tab-panels">
            ${meal.instructions
              .map(
                (instr, i) =>
                  `<div class="instruction-tab-panel${i === 0 ? ' active' : ''}" data-panel-index="${i}">
                    <ol class="instructions-list">${instr.steps.map((step) => `<li>${step}</li>`).join('')}</ol>
                  </div>`
              )
              .join('')}
          </div>
        </div>
      `;
    }
  } else {
    instructionsHTML = '<p class="empty-state">No instructions provided.</p>';
  }

  container.innerHTML = `
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
        ${meal.ingredients
          .map(
            (entry) =>
              `<li><span class="ingredient-name">${entry.item ? entry.item.name : 'Ingredient'}</span><span class="ingredient-amount">${entry.quantity} ${entry.item ? entry.item.unit : ''}</span></li>`
          )
          .join('')}
      </ul>
    </div>
    <div class="detail-section">
      <h2><span class="material-symbols-rounded">menu_book</span> Cooking Instructions</h2>
      ${instructionsHTML}
    </div>
  `;

  if (hasInstructions && meal.instructions.length > 1) {
    const tabButtons = container.querySelectorAll('.instruction-tab-btn');
    const tabPanels = container.querySelectorAll('.instruction-tab-panel');

    tabButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const index = btn.dataset.tabIndex;

        tabButtons.forEach((b) => b.classList.remove('active'));
        tabPanels.forEach((p) => p.classList.remove('active'));

        btn.classList.add('active');
        container.querySelector(`[data-panel-index="${index}"]`)?.classList.add('active');
      });
    });
  }
}
