# Refactoring Plan for main.js

## Overview
The current `main.js` is 2,695 lines. This document outlines the refactoring into a modular structure.

## New Structure

```
dietea/
├── index.html
├── main.css
├── data/
│   └── ingredients.json
├── js/
│   ├── main.js (new entry point ~200 lines)
│   ├── services/
│   │   ├── state.js (state management)
│   │   ├── calories.js (BMR/TDEE calculations)
│   │   └── storage.js (persistence)
│   ├── utils/
│   │   ├── helpers.js (formatting, utilities)
│   │   ├── feedback.js (toasts, validation)
│   │   └── dom.js (DOM helpers)
│   ├── components/
│   │   ├── shopping.js (shopping list)
│   │   ├── schedule.js (schedule views)
│   │   ├── menu.js (meal cards)
│   │   ├── ingredients.js (ingredients list)
│   │   └── profile.js (profile card)
│   └── ui/
│       ├── modals.js (modal management)
│       ├── navigation.js (tab switching)
│       ├── onboarding.js (onboarding flow)
│       └── forms.js (form handlers)
├── dataStore.js
├── models.js
├── fileSystem.js
└── dataLoader.js
```

## Module Responsibilities

### Services (Business Logic)
- **state.js** - Application state and persistence
- **calories.js** - Nutrition calculations
- **storage.js** - Data persistence (localStorage, file system)

### Utils (Pure Functions)
- **helpers.js** - Formatting, slugify, titleCase, etc.
- **feedback.js** - Toast notifications, form validation
- **dom.js** - DOM manipulation helpers

### Components (UI Rendering)
- **shopping.js** - Shopping list rendering
- **schedule.js** - Schedule list & calendar views
- **menu.js** - Meal cards rendering
- **ingredients.js** - Ingredients list rendering
- **profile.js** - Profile card rendering

### UI (User Interactions)
- **modals.js** - Modal open/close, management
- **navigation.js** - Tab switching, routing
- **onboarding.js** - Onboarding flow
- **forms.js** - Form submissions, validation

## Benefits

1. **Maintainability** - Each file has a single responsibility
2. **Testability** - Pure functions can be tested in isolation
3. **Reusability** - Components can be reused
4. **Collaboration** - Multiple developers can work on different modules
5. **Performance** - Only load what's needed
6. **Debugging** - Easier to find and fix issues

## Migration Strategy

1. ✅ Create folder structure
2. ✅ Extract pure utility functions first (completed)
3. ✅ Extract service layer (state, calories, storage) (completed)
4. 🔄 Extract UI components (in progress)
5. Extract modal/form handlers
6. Create new main.js entry point
7. Update index.html imports
8. Test thoroughly
9. Remove old main.js

## Notes

- Keep existing imports (dataStore.js, models.js, fileSystem.js, dataLoader.js)
- Maintain backward compatibility
- No build step required - pure ES6 modules
- Each module exports specific functions
- Main entry point orchestrates everything
