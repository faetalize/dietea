/**
 * Storage Service
 * Handles data persistence for ingredients, meals, and schedule
 */

import { dataStore } from '../../dataStore.js';
import { 
  isFileSystemSupported, 
  saveIngredientsToFile, 
  getFileHandle 
} from '../../fileSystem.js';

/**
 * Save ingredients to file system or localStorage
 */
export async function saveIngredients() {
  // Save to file system if available
  if (isFileSystemSupported() && getFileHandle()) {
    const success = await saveIngredientsToFile(dataStore.ingredients);
    if (success) {
      console.log('Saved ingredients to file');
      return true;
    } else {
      console.warn('Failed to save to file, falling back to localStorage');
      localStorage.setItem('mealPrepIngredients', JSON.stringify(dataStore.ingredients));
      return false;
    }
  } else {
    // Fallback to localStorage
    localStorage.setItem('mealPrepIngredients', JSON.stringify(dataStore.ingredients));
    return true;
  }
}

/**
 * Save meals to localStorage
 */
export function saveMeals() {
  localStorage.setItem('mealPrepMeals', JSON.stringify(dataStore.meals));
}

/**
 * Save schedule to localStorage
 */
export function saveSchedule() {
  localStorage.setItem('mealPrepSchedule', JSON.stringify(dataStore.schedule));
}
