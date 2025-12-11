# Meal Prep Planner

A single-page vanilla JavaScript webapp for meal prep planning with automatic ingredient syncing via the File System Access API.

## Features

- 📊 **Weekly meal scheduling** - Plan meals for breakfast, lunch, snack, and dinner across 6 days
- 🛒 **Auto-generated shopping lists** - Aggregate ingredients from your meal plan
- 🍽️ **Custom meal creation** - Build meals with ingredients and cooking instructions
- 🥗 **Ingredient database** - Maintain a database of ingredients with nutrition info
- 💾 **File System Sync** - Connect to `ingredients.json` for automatic read/write
- 📱 **Responsive design** - Works on desktop and mobile

## Getting Started

1. Open `index.html` in a modern browser (Chrome or Edge recommended for File System API support)
2. Complete the onboarding wizard to set your preferred start day
3. Connect to your `ingredients.json` file for automatic syncing (optional)

## File System Integration

The app uses the [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API) to read and write to your local `ingredients.json` file:

### First-Time Setup

1. When you first launch the app, you'll be prompted to connect to `ingredients.json`
2. Click "Yes" and select the file from your project directory
3. Grant read/write permissions when prompted
4. All ingredient changes will automatically save to the file

### Managing Connection

Go to **Settings** → **File System** to:
- **Select File** - Connect to `ingredients.json` (or reconnect if permissions expired)
- **Disconnect** - Stop syncing with the file (falls back to `localStorage`)
- View connection status

### Browser Support

| Feature | Chrome/Edge | Firefox | Safari |
|---------|-------------|---------|--------|
| File System API | ✅ Full support | ❌ Not supported | ❌ Not supported |
| App functionality | ✅ Full | ✅ Full (localStorage only) | ✅ Full (localStorage only) |

**Note**: In unsupported browsers, the app automatically falls back to `localStorage` for ingredient storage. You can still import/export JSON files manually.

## File Structure

```
dietea/
├── index.html          # Main HTML file
├── main.js            # Application logic
├── main.css           # Styles
├── fileSystem.js      # File System Access API integration
├── dataStore.js       # Data management
├── models.js          # Data models (FoodItem, Meal, etc.)
├── package.json       # Dev server scripts
└── data/
    └── ingredients.json   # Ingredient database (in data/ to avoid reload loops)
```

## Data Structure

### ingredients.json
```json
[
  {
    "id": "greek-yogurt",
    "name": "Plain Greek yogurt (low-lactose)",
    "category": "Dairy",
    "unit": "g",
    "kcal": 0.59,
    "carb_per_unit": 0.04,
    "protein_per_unit": 0.1,
    "lipid_per_unit": 0.007
  }
]
```

All nutritional values are **per unit** (e.g., per gram, per milliliter, per piece).

## Usage

### Adding Ingredients

1. Go to the **Ingredients** tab
2. Click **Add Ingredient**
3. Fill in the form with name, category, unit, and nutrition info
4. Click **Save Ingredient**
5. If connected to a file, changes auto-save immediately

### Creating Meals

1. Go to the **Menu** tab
2. Click **Create Meal**
3. Add a name, type (Breakfast/Lunch/Snack/Dinner)
4. Add ingredients with quantities
5. Add cooking instructions (optional)
6. Click **Save Meal**

### Building a Schedule

_(Coming soon - schedule generation feature)_

### Shopping List

The shopping list automatically aggregates all ingredients from your scheduled meals, grouped by category.

## Development

No build process required! Just open `index.html` in a browser.

For local development with live reload, you can use:
```bash
npx live-server
```

## License

MIT
