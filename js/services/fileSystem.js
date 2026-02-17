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

/**
 * Restore file handle from previous session
 * Not supported in strict file-only mode without IndexedDB/localStorage.
 */
export async function restoreFileHandle() {
  return null;
}

/**
 * Open IndexedDB for storing file handles
 * Disabled in strict file-only mode.
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
 * Get current file handle
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
 * Check if a file handle is stored (even if permission not yet granted)
 * Disabled in strict file-only mode.
 */
export async function hasStoredFileHandle() {
  return false;
}

/**
 * Request permission and load from stored file handle
 * Disabled in strict file-only mode.
 */
export async function requestPermissionAndLoad() {
  return null;
}