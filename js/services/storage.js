/**
 * Storage Service
 * Routes each dataset to where it is persisted: ingredients and meals to their
 * JSON files via the File System Access API, schedule to localStorage.
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
 * Save ingredients to the connected ingredients.json.
 * Returns false without writing if the API is unsupported or no file is connected.
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
 * Save meals to the connected menu.json.
 * Returns false without writing if the API is unsupported or no file is connected.
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
 * Synchronous and always succeeds — no file handle involved.
 */
export function saveSchedule() {
  localStorage.setItem('mealPrepSchedule', JSON.stringify(dataStore.schedule));
}
