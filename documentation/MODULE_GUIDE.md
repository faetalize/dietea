# Module Usage Guide

Quick reference for working with the modular structure.

## Services

### State Management (`js/services/state.js`)

```javascript
import { state, loadState, saveState, updateState, updateProfile, resetState } from '../js/services/state.js';

// Access state
console.log(state.onboarded);
console.log(state.profile.weight);

// Update state
updateState({ startDay: 2 });

// Update profile
updateProfile({ weight: 75, height: 180 });

// Reset to defaults
resetState();
```

### Calorie Calculations (`js/services/calories.js`)

```javascript
import {
  calculateBMR,
  calculateTDEE,
  calculateRecommendedCalories,
  isGoalRealistic,
  getActivityLevelLabel,
  calculateProfileMetrics
} from '../js/services/calories.js';

const bmr = calculateBMR(75, 180, 30, 'male');
const tdee = calculateTDEE(bmr, 1.55);

const recommended = calculateRecommendedCalories(2000, 75, 70, 6);

const check = isGoalRealistic(75, 70, 6);
console.log(check.isRealistic);
console.log(check.recommendedMonths);

const label = getActivityLevelLabel(1.55);

const metrics = calculateProfileMetrics(state.profile);
console.log(metrics.maintenanceCalories);
console.log(metrics.recommendedCalories);
```

### Storage (`js/services/storage.js`)

```javascript
import { saveIngredients, saveMeals, saveSchedule } from '../js/services/storage.js';

await saveIngredients();
saveMeals();
saveSchedule();
```

## Utils

### Helpers (`js/utils/helpers.js`)

```javascript
import { titleCase, fmt, slugify, defaultTimeForSlot, DAY_NAMES } from '../js/utils/helpers.js';

titleCase('hello world');
fmt(123.456);
slugify('My Meal Name!');

defaultTimeForSlot('breakfast');

DAY_NAMES[0];
```

### Feedback (`js/utils/feedback.js`)

```javascript
import { showToast, showFieldError, clearValidationErrors } from '../js/utils/feedback.js';

showToast('Meal saved!', 'success');
showToast('Invalid input', 'error');
showToast('Loading...', 'default');

const inputElement = document.getElementById('my-input');
showFieldError(inputElement, 'This field is required');

const formContainer = document.getElementById('my-form');
clearValidationErrors(formContainer);
```

## Components

### Shopping List (`js/components/shopping.js`)

```javascript
import { renderShoppingList, resetShoppingList } from '../js/components/shopping.js';

renderShoppingList();
resetShoppingList();
```

### Schedule (`js/components/schedule.js`)

```javascript
import {
  renderSchedule,
  renderScheduleList,
  renderScheduleCalendar,
  getScheduleDays,
  getCurrentDayIndex,
  getCurrentMealSlot,
  scrollToCurrentDay
} from '../js/components/schedule.js';

renderSchedule();
```

## Moving Code Between Modules

1. Identify dependencies
2. Place in the right folder (`js/core`, `js/services`, `js/utils`, `js/components`)
3. Export only what’s needed
4. Update imports
5. Test the UI flow
