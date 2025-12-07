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

## Testing
Open `index.html` directly in browser. Use DevTools Application tab to inspect localStorage (`mealPrepState`). Clear localStorage to reset onboarding.
