import { FoodItem } from './models.js';

export async function loadIngredients() {
  const response = await fetch('./ingredients.json', { cache: 'no-cache' });
  if (!response.ok) {
    throw new Error('Failed to load ingredients.json');
  }
  const raw = await response.json();
  return raw.map(item => new FoodItem(item));
}
