# Project Structure

```
dietea/
├── index.html
├── main.css
├── main.js
├── ingredients.json
├── js/
│   ├── core/
│   ├── services/
│   ├── utils/
│   └── components/
├── documentation/
│   ├── README.md
│   ├── PROJECT_STRUCTURE.md
│   ├── MODULE_GUIDE.md
│   ├── REFACTORING.md
│   └── REFACTORING_SUMMARY.md
├── package.json
└── .github/
    └── copilot-instructions.md
```

## Module Overview

### `js/core/`
- `dataStore.js`: central store + aggregation
- `models.js`: data models
- `dataLoader.js`: bundled ingredient loading
- `mealSerde.js`: meal serialize/hydrate

### `js/services/`
- `fileSystem.js`: File System Access API integration
- `state.js`: app state + localStorage persistence
- `calories.js`: nutrition calculations
- `storage.js`: persistence for ingredients/meals/schedule

### `js/utils/`
- `helpers.js`: formatting + slugify + day names
- `feedback.js`: toast + validation

### `js/components/`
- `shopping.js`
- `schedule.js`
- `scheduleEditor.js`
- `menu.js`
- `mealDetail.js`
- `mealCreation.js`
- `ingredients.js`
- `profile.js`
- `settings.js`
- `navigation.js`

---

Last updated: December 12, 2025
