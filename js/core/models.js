export class FoodItem {
  constructor({ id, name, category, unit, kcal, carb_per_unit, protein_per_unit, lipid_per_unit }) {
    this.id = id;
    this.name = name;
    this.category = category;
    this.unit = unit;
    this.kcal = kcal;
    this.carb_per_unit = carb_per_unit;
    this.protein_per_unit = protein_per_unit;
    this.lipid_per_unit = lipid_per_unit;
  }

  macrosFor(quantity = 0) {
    const qty = Number(quantity) || 0;
    return {
      kcal: +(this.kcal * qty).toFixed(2),
      carbs: +(this.carb_per_unit * qty).toFixed(2),
      protein: +(this.protein_per_unit * qty).toFixed(2),
      lipids: +(this.lipid_per_unit * qty).toFixed(2)
    };
  }
}

export class FoodItemEntry {
  constructor({ item, quantity = 0 }) {
    this.item = item; // FoodItem
    this.quantity = Number(quantity) || 0;
  }

  get label() {
    if (!this.item) return '';
    return `${this.item.name} — ${this.quantity} ${this.item.unit}`.trim();
  }

  get macros() {
    return this.item ? this.item.macrosFor(this.quantity) : { kcal: 0, carbs: 0, protein: 0, lipids: 0 };
  }
}

export class CookingInstruction {
  constructor({ name, steps = [] }) {
    this.name = name;
    this.steps = Array.isArray(steps) ? steps : [];
  }
}

export class Meal {
  constructor({ id, name, type, ingredients = [], instructions = [] }) {
    this.id = id;
    this.name = name;
    this.type = type; // Breakfast | Lunch | Snack | Dinner
    this.ingredients = ingredients; // FoodItemEntry[]
    this.instructions = instructions; // CookingInstruction[]
  }

  get macros() {
    return this.ingredients.reduce(
      (acc, entry) => {
        const mac = entry.macros;
        return {
          kcal: +(acc.kcal + mac.kcal),
          carbs: +(acc.carbs + mac.carbs),
          protein: +(acc.protein + mac.protein),
          lipids: +(acc.lipids + mac.lipids)
        };
      },
      { kcal: 0, carbs: 0, protein: 0, lipids: 0 }
    );
  }
}
