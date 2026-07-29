// File System Access API integration for ingredients.json and menu.json

let ingredientsFileHandle = null;
let mealsFileHandle = null;

/**
 * Check if File System Access API is supported
 */
export function isFileSystemSupported() {
  return 'showOpenFilePicker' in window;
}

/**
 * Prompt user to select ingredients.json file
 */
export async function selectIngredientsFile() {
  return selectJsonFile('Ingredients JSON', (fileHandle) => {
    ingredientsFileHandle = fileHandle;
  });
}

export async function selectMealsFile() {
  return selectJsonFile('Menu JSON', (fileHandle) => {
    mealsFileHandle = fileHandle;
  });
}

/**
 * Load ingredients from the selected file
 */
export async function loadIngredientsFromFile(fileHandle = ingredientsFileHandle) {
  return loadJsonFromFile(fileHandle, 'ingredients');
}

export async function loadMealsFromFile(fileHandle = mealsFileHandle) {
  return loadJsonFromFile(fileHandle, 'menu');
}

/**
 * Save ingredients to the file
 */
export async function saveIngredientsToFile(ingredients, fileHandle = ingredientsFileHandle) {
  return saveJsonToFile(ingredients, fileHandle, 'ingredients');
}

export async function saveMealsToFile(meals, fileHandle = mealsFileHandle) {
  return saveJsonToFile(meals, fileHandle, 'menu');
}

async function selectJsonFile(description, assignHandle) {
  try {
    const [fileHandle] = await window.showOpenFilePicker({
      types: [{
        description,
        accept: { 'application/json': ['.json'] }
      }],
      multiple: false
    });

    assignHandle(fileHandle);
    return fileHandle;
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('Failed to select file:', err);
    }
    return null;
  }
}

async function loadJsonFromFile(fileHandle, label) {
  if (!fileHandle) return null;

  try {
    const file = await fileHandle.getFile();
    const text = await file.text();
    return JSON.parse(text);
  } catch (err) {
    console.error(`Failed to read ${label} file:`, err);
    return null;
  }
}

async function saveJsonToFile(data, fileHandle, label) {
  if (!fileHandle) return false;

  try {
    const permission = await verifyPermission(fileHandle, true);
    if (!permission) return false;

    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(data, null, 2));
    await writable.close();
    return true;
  } catch (err) {
    console.error(`Failed to save ${label} file:`, err);
    return false;
  }
}

/**
 * Verify file access permission
 */
async function verifyPermission(fileHandle, withWrite = false) {
  const opts = withWrite ? { mode: 'readwrite' } : { mode: 'read' };
  
  // Check if we already have permission
  if ((await fileHandle.queryPermission(opts)) === 'granted') {
    return true;
  }
  
  // Request permission
  if ((await fileHandle.requestPermission(opts)) === 'granted') {
    return true;
  }
  
  return false;
}

/*
 * The four stubs below (restoreFileHandle, openDB, hasStoredFileHandle,
 * requestPermissionAndLoad) plus getFileHandle are vestigial: they remain from an
 * earlier design that persisted handles in IndexedDB. Nothing calls them. Handles
 * now live only in the module-level variables above, so a reload drops them and the
 * user reconnects each session. Persisting handles again means reintroducing
 * IndexedDB — these stubs are not a working foundation for it.
 */

/**
 * Unused. Always null — handles are not persisted across sessions.
 */
export async function restoreFileHandle() {
  return null;
}

/**
 * Unused. Always null — no IndexedDB in the current design.
 */
function openDB() {
  return null;
}

/**
 * Clear stored file handle
 */
export async function clearFileHandle() {
  ingredientsFileHandle = null;
  mealsFileHandle = null;
  return true;
}

export async function clearIngredientsFileHandle() {
  ingredientsFileHandle = null;
  return true;
}

export async function clearMealsFileHandle() {
  mealsFileHandle = null;
  return true;
}

/**
 * Unused alias for getIngredientsFileHandle().
 */
export function getFileHandle() {
  return ingredientsFileHandle;
}

export function getIngredientsFileHandle() {
  return ingredientsFileHandle;
}

export function getMealsFileHandle() {
  return mealsFileHandle;
}

/**
 * Unused. Always false — no handles are stored between sessions.
 */
export async function hasStoredFileHandle() {
  return false;
}

/**
 * Unused. Always null — there is no stored handle to reload from.
 */
export async function requestPermissionAndLoad() {
  return null;
}