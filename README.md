# Dietea — Meal Prep Planner

A single-page, dependency-free vanilla-JS webapp for planning a week of meals: keep a
menu of recipes, schedule them across the week against a calorie and macro target, and
generate the shopping list that falls out of that schedule.

Ingredients and meals live in `ingredients.json` and `menu.json`. In Chrome and Edge the
app edits those files in place through the File System Access API, so the repo itself is
the database.

## Run it

```bash
npm run dev
```

Then open <http://localhost:3000>.

The app has to be served over HTTP. Opening `index.html` straight from disk (`file://`)
does not work: `main.js` is loaded as an ES module and the data files are read with
`fetch()`, and browsers block both on a `file://` origin.

## Docs

- [Overview and getting started](documentation/README.md)
- [Project structure](documentation/PROJECT_STRUCTURE.md)
- [Module reference](documentation/MODULE_GUIDE.md)
- [Refactor history](documentation/REFACTORING.md)
