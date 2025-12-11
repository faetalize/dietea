/**
 * Shopping List UI Component
 * Renders and manages the shopping list view
 */

import { aggregateShoppingList } from '../../dataStore.js';
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

    categoryDiv.innerHTML = `
      <h2>${category}</h2>
      <div class="shopping-items">
        ${items.map((item, index) => {
          const itemId = `${category}-${item.id || index}`;
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

  // Add click handlers
  shoppingList.querySelectorAll('.shopping-item').forEach(item => {
    item.addEventListener('click', () => {
      const checkbox = item.querySelector('input[type="checkbox"]');
      checkbox.checked = !checkbox.checked;
      const itemId = checkbox.id;
      state.checkedItems[itemId] = checkbox.checked;
      item.classList.toggle('checked', checkbox.checked);
      saveState();
    });
  });
}

export function resetShoppingList() {
  state.checkedItems = {};
  saveState();
  renderShoppingList();
}
