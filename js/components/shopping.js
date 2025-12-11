/**
 * Shopping List UI Component
 * Renders and manages the shopping list view
 */

import { aggregateShoppingList } from '../core/dataStore.js';
import { state, saveState } from '../services/state.js';

export function renderShoppingList() {
  const shoppingList = document.getElementById('shopping-list');
  if (!shoppingList) return;
  
  shoppingList.innerHTML = '';
  const aggregated = aggregateShoppingList();

  if (!aggregated.length) {
    shoppingList.innerHTML = '<p class="empty-state">No planned meals yet. Build a schedule to generate a shopping list.</p>';
    return;
  }

  aggregated.forEach(({ category, items }) => {
    const categoryDiv = document.createElement('div');
    categoryDiv.className = 'shopping-category';

    const safeCategoryId = slugify(category);

    categoryDiv.innerHTML = `
      <h2>${category}</h2>
      <div class="shopping-items">
        ${items.map((item, index) => {
          const itemId = `${safeCategoryId}-${item.id || index}`;
          const isChecked = state.checkedItems[itemId] || false;
          return `
            <div class="shopping-item ${isChecked ? 'checked' : ''}">
              <input type="checkbox" id="${itemId}" ${isChecked ? 'checked' : ''}>
              <label for="${itemId}">${item.name}</label>
              <span class="amount">${item.quantity} ${item.unit}</span>
            </div>
          `;
        }).join('')}
      </div>
    `;

    shoppingList.appendChild(categoryDiv);
  });

  // Checkbox + row click handlers (avoid double-toggle)
  shoppingList.querySelectorAll('.shopping-item').forEach(row => {
    const checkbox = row.querySelector('input[type="checkbox"]');
    if (!checkbox) return;

    checkbox.addEventListener('change', () => {
      const itemId = checkbox.id;
      state.checkedItems[itemId] = checkbox.checked;
      row.classList.toggle('checked', checkbox.checked);
      saveState();
    });

    row.addEventListener('click', (e) => {
      if (e.target && e.target.matches('input[type="checkbox"], label')) return;
      checkbox.click();
    });
  });
}

export function resetShoppingList() {
  state.checkedItems = {};
  saveState();
  renderShoppingList();
}

function slugify(value = '') {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
