import { FoodItem } from './models.js';

export async function loadIngredients() {
  const candidates = ['./data/ingredients.json', './ingredients.json'];
  let response = null;

  for (const url of candidates) {
    const r = await fetch(url, { cache: 'no-cache' });
    if (r.ok) {
      response = r;
      break;
    }
  }

  if (!response) throw new Error('Failed to load ingredients.json');

  const raw = await response.json();
  return raw.map(item => new FoodItem(item));
}

export async function loadMeals() {
  const candidates = ['./data/menu.json', './menu.json', './meals.json'];
  let response = null;

  for (const url of candidates) {
    const r = await fetch(url, { cache: 'no-cache' });
    if (r.ok) {
      response = r;
      break;
    }
  }

  if (!response) return [];

  const raw = await response.json();
  return Array.isArray(raw) ? raw : [];
}
