/**
 * Meal (de)serialization helpers
 * Keeps localStorage JSON stable while restoring class instances.
 */

import { dataStore } from './dataStore.js';
import { Meal, FoodItem, FoodItemEntry, CookingInstruction } from './models.js';

export function hydrateMeal(obj, ingredients = dataStore.ingredients) {
  if (!obj) return null;

  const ingredientsList = Array.isArray(ingredients) ? ingredients : [];

  const hydratedIngredients = (obj.ingredients || []).map((entry) => {
    const item = ingredientsList.find((i) => i.id === entry.itemId);
    return new FoodItemEntry({
      item:
        item ||
        new FoodItem({
          id: entry.itemId,
          name: entry.itemName || 'Unknown',
          unit: entry.itemUnit || '',
          kcal: 0,
          protein_per_unit: 0,
          carb_per_unit: 0,
          lipid_per_unit: 0
        }),
      quantity: entry.quantity
    });
  });

  const hydratedInstructions = (obj.instructions || []).map(
    (instr) => new CookingInstruction({ name: instr.name, steps: instr.steps })
  );

  return new Meal({
    id: obj.id,
    name: obj.name,
    type: obj.type,
    ingredients: hydratedIngredients,
    instructions: hydratedInstructions
  });
}

export function serializeMeal(meal) {
  if (!meal) return null;

  return {
    id: meal.id,
    name: meal.name,
    type: meal.type,
    ingredients: (meal.ingredients || []).map((entry) => ({
      itemId: entry.item?.id,
      itemName: entry.item?.name,
      itemUnit: entry.item?.unit,
      quantity: entry.quantity
    })),
    instructions: (meal.instructions || []).map((instr) => ({
      name: instr.name,
      steps: instr.steps
    }))
  };
}
