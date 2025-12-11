# Refactoring Summary

- `main.js` imports and orchestrates all features via ES modules.
- Core/data/model code lives in `js/core/`.
- Persistence + File System Access integration lives in `js/services/`.
- UI rendering + listeners live in `js/components/`.
- `main.legacy.js` has been deleted; no `window.*` delegation remains.

See `PROJECT_STRUCTURE.md` and `MODULE_GUIDE.md` for the up-to-date breakdown.
