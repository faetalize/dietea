/**
 * Storage Service
 * Handles data persistence for ingredients, meals, and schedule
 */

import { dataStore } from '../core/dataStore.js';
import { serializeMeal } from '../core/mealSerde.js';
import { 
  isFileSystemSupported, 
  saveIngredientsToFile, 
  saveMealsToFile,
  getIngredientsFileHandle,
  getMealsFileHandle
} from './fileSystem.js';

/**
 * Save ingredients to file system or localStorage
 */
export async function saveIngredients() {
  if (!isFileSystemSupported() || !getIngredientsFileHandle()) {
    return false;
  }

  const success = await saveIngredientsToFile(dataStore.ingredients);
  if (success) {
    console.log('Saved ingredients to file');
    return true;
  }

  return false;
}

/**
 * Save meals to localStorage
 */
export async function saveMeals() {
  if (!isFileSystemSupported() || !getMealsFileHandle()) {
    return false;
  }

  const serialized = dataStore.meals.map(serializeMeal);
  const success = await saveMealsToFile(serialized);
  return success;
}

/**
 * Save schedule to localStorage
 */
export function saveSchedule() {
  localStorage.setItem('mealPrepSchedule', JSON.stringify(dataStore.schedule));
}
