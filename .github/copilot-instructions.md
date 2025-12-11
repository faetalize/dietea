# Meal Prep Planner - Copilot Instructions

## Project Overview
A single-page vanilla JavaScript webapp for meal prep planning. No build tools, frameworks, or bundlers—just open `index.html` in a browser.

## Architecture

### File Structure
- `index.html` - Single HTML file with all markup; uses semantic sections for tab panels
- `main.js` - All application logic, data, and state management
- `main.css` - Component-based CSS with CSS custom properties for theming
- `specs.md` - Source of truth for all meal/nutrition data

### Data Flow
1. **Source data**: All meals, schedules, and shopping lists are defined as JS objects at the top of `main.js` (derived from `specs.md`)
2. **State**: Single `state` object holds `onboarded`, `startDay`, and `checkedItems`
3. **Persistence**: State syncs to `localStorage` via `saveState()`/`loadState()`
4. **Rendering**: Functions like `renderShoppingList()`, `renderSchedule()`, `renderMenuCards()` rebuild DOM from data

### Navigation Pattern
- Tab-based SPA using CSS class `.active` toggling
- Tab buttons use `data-tab` attribute matching panel IDs (`shopping-tab`, `schedule-tab`, `menu-tab`)
- Meal detail is a pseudo-page within menu tab (hide menu-tab, show meal-detail)

## Key Conventions

### Data Structures
```javascript
// Meals use consistent shape:
{ id: string, name: string, type: 'Breakfast'|'Lunch'|'Snack'|'Dinner',
  calories: number, protein: number, ingredients: [{name, amount}], instructions: string[] }

// Shopping items:
{ name: string, amount: string, notes: string }
```

### CSS Patterns
- Use CSS custom properties from `:root` (e.g., `--primary`, `--card-bg`, `--shadow`)
- BEM-lite naming: `.shopping-item`, `.menu-card`, `.meal-time`
- Responsive breakpoint at 600px via `@media (max-width: 600px)`

### DOM ID Conventions
- Tab panels: `{tabname}-tab` (e.g., `shopping-tab`)
- Content containers: descriptive nouns (`shopping-list`, `schedule-grid`, `menu-cards`)
- Shopping item checkboxes: `{category}-{index}` for unique localStorage keys

### Scrolling Behavior
- The tab navigation header (`.tab-nav`) is sticky/fixed at the top of the viewport
- **All programmatic scrolling must account for the header height** to prevent content from being hidden behind it
- Use `element.getBoundingClientRect().top + window.scrollY - headerHeight` pattern for scroll calculations
- Add extra padding (e.g., 16px) for visual breathing room below the header
- Smooth scrolling is set globally via `scroll-behavior: smooth` on the `html` element in CSS

## Adding New Features

### New Meal
1. Add entry to `MEALS` object in `main.js` with all required fields
2. If used in schedule, update `SCHEDULE` array
3. Update `SHOPPING_LIST` if new ingredients needed

### New Tab
1. Add button in `.tab-nav` with `data-tab="newtab"`
2. Add section `#newtab-tab` with class `tab-panel`
3. Add render function and call it in `showApp()`

## UX Patterns

### User Feedback - No JS Alerts/Confirms
Never use `alert()` or `confirm()`. Instead:

#### Toast Notifications
For non-blocking feedback (success messages, errors):
```javascript
showToast('Ingredient added', 'success');  // green
showToast('Invalid JSON file', 'error');   // red
showToast('Info message', 'default');      // dark
```
Toasts auto-dismiss after 3 seconds. Container is `#toast-container`.

#### Inline Form Validation
For required field errors, highlight the field instead of alerting:
```javascript
showFieldError(inputElement, 'Name is required');
clearValidationErrors(containerElement);
```
Adds `.error` class to `.form-field`, shows `.error-message` span.

### Action Confirmation - Inline Button Swap
For destructive actions (delete, reset, clear data), use inline confirmation instead of `confirm()`:

#### HTML Pattern
```html
<div class="setting-action-wrapper">  <!-- or .reset-wrapper, .ingredient-card-actions -->
  <button id="action-btn" class="btn btn-secondary">Delete</button>
  <div class="setting-confirm">  <!-- or .reset-confirm, .delete-confirm -->
    <button class="btn-icon btn-cancel" data-action="cancel">
      <span class="material-symbols-rounded">close</span>
    </button>
    <button class="btn-icon btn-confirm" data-action="confirm">
      <span class="material-symbols-rounded">check</span>
    </button>
  </div>
</div>
```

#### CSS Pattern
Wrapper uses `overflow: hidden`. On `.confirming` class:
- Original button slides left with `transform: translateX(-100%)` and `opacity: 0`
- Confirm buttons slide in from right with `transform: translateX(0)`

#### JS Pattern
```javascript
// Simple setup
button.addEventListener('click', () => wrapper.classList.add('confirming'));
cancelBtn.addEventListener('click', () => wrapper.classList.remove('confirming'));
confirmBtn.addEventListener('click', () => {
  wrapper.classList.remove('confirming');
  performDestructiveAction();
});

// Or use helper for settings page
setupDestructiveAction(button, () => { /* action */ });
```

#### When to Use
- **Non-destructive**: Just do it, show success toast
- **Destructive/irreversible**: Inline button swap confirmation, then success toast

### Action Buttons Visibility
Edit and delete buttons on cards (meals, ingredients) must **always be visible**—never hidden behind hover states.

#### Why
- Hover states don't work on touch devices (mobile, tablet)
- Hidden UI makes the app unusable for mobile users
- Action buttons are a core part of the UI, not progressive disclosure

#### CSS Pattern
```css
/* CORRECT - always visible */
.card-actions .btn-icon {
    background: var(--surface);
    border: 1px solid var(--border-light);
}

/* WRONG - don't do this */
.card-actions .btn-icon {
    opacity: 0;  /* Hidden by default */
}
.card:hover .card-actions .btn-icon {
    opacity: 1;  /* Only visible on hover */
}
```

## Testing
Open `index.html` directly in browser. Use DevTools Application tab to inspect localStorage (`mealPrepState`). Clear localStorage to reset onboarding.
