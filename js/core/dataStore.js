import { Meal } from './models.js';

export const dataStore = {
  ingredients: [],
  meals: [],
  schedule: []
};

export function setIngredients(list) {
  dataStore.ingredients = Array.isArray(list) ? list : [];
}

export function setMeals(list) {
  dataStore.meals = Array.isArray(list) ? list : [];
}

export function setSchedule(list) {
  dataStore.schedule = Array.isArray(list) ? list : [];
}

export function getMealById(id) {
  return dataStore.meals.find(meal => meal.id === id);
}

export function aggregateShoppingList(schedule = dataStore.schedule, meals = dataStore.meals) {
  if (!Array.isArray(schedule) || !Array.isArray(meals) || !meals.length || !schedule.length) {
    return [];
  }

  const mealMap = new Map(meals.map(meal => [meal.id, meal]));
  const categoryBuckets = new Map();

  schedule.forEach(day => {
    if (!day || !Array.isArray(day.slots)) return;
    day.slots.forEach(slot => {
      const meal = mealMap.get(slot.mealId);
      if (!meal || !(meal instanceof Meal)) return;
      meal.ingredients.forEach(entry => {
        const item = entry.item;
        if (!item) return;
        const category = item.category || 'Other';
        if (!categoryBuckets.has(category)) {
          categoryBuckets.set(category, new Map());
        }

        const key = item.id || slugify(item.name);
        const bucket = categoryBuckets.get(category);
        const existing = bucket.get(key) || { item, totalQuantity: 0 };
        existing.totalQuantity += entry.quantity;
        bucket.set(key, existing);
      });
    });
  });

  return Array.from(categoryBuckets.entries())
    .map(([category, itemsMap]) => ({
      category,
      items: Array.from(itemsMap.values()).map(({ item, totalQuantity }) => ({
        id: item.id || slugify(item.name),
        name: item.name,
        unit: item.unit,
        quantity: +totalQuantity.toFixed(2),
        category
      }))
    }))
    .sort((a, b) => a.category.localeCompare(b.category));
}

function slugify(value = '') {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
