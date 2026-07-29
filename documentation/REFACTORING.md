# Refactor History

Historical note. The app began as a single large script and was pulled apart into ES
modules. That work is finished — this file records the shape it settled on and the rules
that came out of it.

## What changed

- `main.js` became a thin entry point: bootstrap data, decide onboarding vs. app, wire
  listeners once. It holds no rendering logic.
- Data, models, and aggregation moved to `js/core/`.
- Persistence, File System Access integration, and calorie math moved to `js/services/`.
- Rendering and listeners moved to `js/components/`, one module per feature area.
- `main.legacy.js`, the temporary bridge that re-exported functions onto `window` during
  the migration, was deleted. No `window.*` delegation remains — modules import each
  other directly.

## Rules the refactor settled on

- Imports flow one way: `components` → `services`/`utils` → `core`. Nothing in `core`
  imports a component.
- Components read `dataStore` and `state` directly rather than receiving props.
- Cross-feature updates go through the `on*Changed` callbacks that `main.js` passes into
  each component, not through direct calls between components.
- Every module is loaded as a native ES module. There is no bundler, so relative import
  paths must include the `.js` extension.

For the current structure and what each module does, see
[PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) and [MODULE_GUIDE.md](MODULE_GUIDE.md).
