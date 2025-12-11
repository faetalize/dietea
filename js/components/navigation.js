/**
 * Navigation Module
 * Handles tab switching and page navigation
 */

import { scrollToCurrentDay } from './schedule.js';
import { renderMealDetail } from './mealDetail.js';

let previousTab = 'shopping';

/**
 * Switch between tabs
 */
export function switchTab(tabId) {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');
  const settingsBtn = document.getElementById('settings-btn');
  const scheduleList = document.getElementById('schedule-list');

  tabBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });

  tabPanels.forEach(panel => {
    panel.classList.remove('active');
  });

  const panel = document.getElementById(`${tabId}-tab`);
  if (panel) {
    panel.classList.add('active');
  }

  if (settingsBtn) settingsBtn.classList.remove('active');

  if (tabId === 'schedule' && scheduleList && !scheduleList.classList.contains('hidden')) {
    scrollToCurrentDay();
  }
}

/**
 * Show meal detail view
 */
export function showMealDetail(mealId) {
  const mealDetail = document.getElementById('meal-detail');
  const mealDetailContent = document.getElementById('meal-detail-content');
  
  if (!mealDetail) return;
  
  // Hide tab content, show meal detail
  document.getElementById('menu-tab').classList.remove('active');
  mealDetail.classList.add('active');

  renderMealDetail(mealId, mealDetailContent);
}

/**
 * Hide meal detail and go back to menu
 */
export function hideMealDetail() {
  const mealDetail = document.getElementById('meal-detail');
  const menuTab = document.getElementById('menu-tab');
  
  if (mealDetail && menuTab) {
    mealDetail.classList.remove('active');
    menuTab.classList.add('active');
  }
}

export function setupMealDetailNavigation() {
  const backToMenuBtn = document.getElementById('back-to-menu');
  if (backToMenuBtn) {
    backToMenuBtn.addEventListener('click', hideMealDetail);
  }
}

/**
 * Save previous tab for settings navigation
 */
export function savePreviousTab() {
  const activeTab = document.querySelector('.tab-btn.active');
  if (activeTab) {
    previousTab = activeTab.dataset.tab;
  }
  return previousTab;
}

/**
 * Get previous tab
 */
export function getPreviousTab() {
  return previousTab;
}
