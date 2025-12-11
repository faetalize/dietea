# Module Usage Guide

Quick reference for working with the new modular structure.

## Services

### State Management (`js/services/state.js`)

```javascript
import { state, loadState, saveState, updateState, updateProfile, resetState } from './js/services/state.js';

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
} from './js/services/calories.js';

// Calculate BMR
const bmr = calculateBMR(75, 180, 30, 'male'); // weight, height, age, sex

// Calculate TDEE
const tdee = calculateTDEE(bmr, 1.55); // bmr, activity level

// Calculate recommended calories
const recommended = calculateRecommendedCalories(2000, 75, 70, 6);
// maintenanceCalories, currentWeight, goalWeight, goalMonths

// Check if goal is realistic
const check = isGoalRealistic(75, 70, 6);
console.log(check.isRealistic); // true/false
console.log(check.recommendedMonths); // suggested timeline

// Get activity level label
const label = getActivityLevelLabel(1.55); // "Moderately active"

// Calculate all metrics at once
const metrics = calculateProfileMetrics(state.profile);
console.log(metrics.maintenanceCalories);
console.log(metrics.recommendedCalories);
```

### Storage (`js/services/storage.js`)

```javascript
import { saveIngredients, saveMeals, saveSchedule } from './js/services/storage.js';

// Save data (async for file system support)
await saveIngredients();
saveMeals();
saveSchedule();
```

## Utils

### Helpers (`js/utils/helpers.js`)

```javascript
import { titleCase, fmt, slugify, defaultTimeForSlot, DAY_NAMES } from './js/utils/helpers.js';

// Title case
titleCase('hello world'); // "Hello World"

// Format number
fmt(123.456); // "123.46"
fmt(NaN); // "0.00"

// Create slug
slugify('My Meal Name!'); // "my-meal-name"

// Default time for meal slot
defaultTimeForSlot('breakfast'); // "7:00 AM"
defaultTimeForSlot('lunch'); // "1:00 PM"

// Day names
DAY_NAMES[0]; // "Sunday"
```

### Feedback (`js/utils/feedback.js`)

```javascript
import { showToast, showFieldError, clearValidationErrors } from './js/utils/feedback.js';

// Show toast notification
showToast('Meal saved!', 'success'); // green checkmark
showToast('Invalid input', 'error'); // red error icon
showToast('Loading...', 'default'); // blue info icon

// Show field error
const inputElement = document.getElementById('my-input');
showFieldError(inputElement, 'This field is required');

// Clear all validation errors in a container
const formContainer = document.getElementById('my-form');
clearValidationErrors(formContainer);
```

## Components

### Shopping List (`js/components/shopping.js`)

```javascript
import { renderShoppingList, resetShoppingList } from './js/components/shopping.js';

// Render shopping list
renderShoppingList();

// Reset all checkmarks
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
} from './js/components/schedule.js';

// Render both views
renderSchedule();

// Render specific view
renderScheduleList();
renderScheduleCalendar();

// Get schedule information
const days = getScheduleDays(); // ["Monday", "Tuesday", ...]
const currentDay = getCurrentDayIndex(); // 0-6 or -1
const currentSlot = getCurrentMealSlot(); // "breakfast" | "lunch" | "snack" | "dinner" | null

// Scroll to current day
scrollToCurrentDay();
```

## Creating New Modules

### Service Module Template

```javascript
/**
 * My Service
 * Description of what this service does
 */

import { dataStore } from '../../dataStore.js';
import { state } from './state.js';

/**
 * Function description
 * @param {type} paramName - Parameter description
 * @returns {type} Return description
 */
export function myFunction(paramName) {
  // Implementation
  return result;
}

/**
 * Another function
 */
export function anotherFunction() {
  // Implementation
}
```

### Component Module Template

```javascript
/**
 * My Component
 * Renders and manages [feature name]
 */

import { dataStore } from '../../dataStore.js';
import { state, saveState } from '../services/state.js';
import { showToast } from '../utils/feedback.js';

/**
 * Render the component
 */
export function renderMyComponent() {
  const container = document.getElementById('my-container');
  if (!container) return;
  
  // Build and render UI
  container.innerHTML = buildHTML();
  
  // Attach event listeners
  attachEventListeners();
}

/**
 * Build component HTML
 */
function buildHTML() {
  return `<div class="my-component">...</div>`;
}

/**
 * Attach event listeners
 */
function attachEventListeners() {
  // Add listeners
}

/**
 * Handle user interaction
 */
export function handleMyAction() {
  // Handle action
  saveState();
  renderMyComponent();
  showToast('Action completed', 'success');
}
```

## Migration Pattern

When migrating a function from `main.legacy.js`:

1. **Identify dependencies** - What does the function import/use?
2. **Create module file** - Place in appropriate folder
3. **Export function** - Make it available to other modules
4. **Update imports** - Import from new module location
5. **Test** - Verify functionality works
6. **Remove from legacy** - Once fully migrated

### Example Migration

**Before (in main.legacy.js):**
```javascript
function myFunction() {
  // Code here
  saveState();
  showToast('Done', 'success');
}
```

**After (in js/components/myComponent.js):**
```javascript
import { saveState } from '../services/state.js';
import { showToast } from '../utils/feedback.js';

export function myFunction() {
  // Code here
  saveState();
  showToast('Done', 'success');
}
```

**Update imports in main.js:**
```javascript
import { myFunction } from './js/components/myComponent.js';
```

## Best Practices

### ✅ Do
- Keep functions small and focused
- Use descriptive names
- Add JSDoc comments
- Export only what's needed
- Import specific functions, not entire modules
- Group related functions in same module
- Use relative imports (`./`, `../`)

### ❌ Don't
- Create circular dependencies
- Mix business logic with UI rendering
- Mutate state without saving
- Use global variables
- Export implementation details
- Create mega-modules (keep files under 300 lines)

## Testing Modules

```javascript
// Example: Test a pure utility function
import { fmt } from './js/utils/helpers.js';

console.assert(fmt(123.456) === '123.46', 'fmt works correctly');
console.assert(fmt(NaN) === '0.00', 'fmt handles NaN');
```

## Debugging

```javascript
// Add logging to track module execution
import { state } from './js/services/state.js';

export function myFunction() {
  console.log('[myComponent] Starting myFunction');
  console.log('[myComponent] Current state:', state);
  
  // Your code here
  
  console.log('[myComponent] Finished myFunction');
}
```

## Module Load Order

The modules load in this order:

1. **Core dependencies** (dataStore, models, fileSystem)
2. **Services** (state, calories, storage)
3. **Utils** (helpers, feedback)
4. **Components** (shopping, schedule, etc.)
5. **Main entry point** (main.js)

Services and utils have no dependencies on components, ensuring clean architecture.

---

Happy coding! 🎉
