// File System Access API integration for ingredients.json

let ingredientsFileHandle = null;

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
  try {
    const [fileHandle] = await window.showOpenFilePicker({
      types: [{
        description: 'Ingredients JSON',
        accept: { 'application/json': ['.json'] }
      }],
      multiple: false
    });
    
    ingredientsFileHandle = fileHandle;
    await saveFileHandlePermission(fileHandle);
    return fileHandle;
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('Failed to select file:', err);
    }
    return null;
  }
}

/**
 * Load ingredients from the selected file
 */
export async function loadIngredientsFromFile(fileHandle = ingredientsFileHandle) {
  if (!fileHandle) return null;
  
  try {
    const file = await fileHandle.getFile();
    const text = await file.text();
    return JSON.parse(text);
  } catch (err) {
    console.error('Failed to read ingredients file:', err);
    return null;
  }
}

/**
 * Save ingredients to the file
 */
export async function saveIngredientsToFile(ingredients, fileHandle = ingredientsFileHandle) {
  if (!fileHandle) return false;
  
  try {
    // Request write permission if needed
    const permission = await verifyPermission(fileHandle, true);
    if (!permission) return false;
    
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(ingredients, null, 2));
    await writable.close();
    return true;
  } catch (err) {
    console.error('Failed to save ingredients file:', err);
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
 * Save file handle to IndexedDB for persistence across sessions
 */
async function saveFileHandlePermission(fileHandle) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('fileHandles', 'readwrite');
      const store = tx.objectStore('fileHandles');
      const request = store.put(fileHandle, 'ingredientsFile');
      
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => db.close();
    });
  } catch (err) {
    console.warn('Could not persist file handle:', err);
  }
}

/**
 * Restore file handle from previous session
 */
export async function restoreFileHandle() {
  try {
    const db = await openDB();
    const handle = await new Promise((resolve, reject) => {
      const tx = db.transaction('fileHandles', 'readonly');
      const store = tx.objectStore('fileHandles');
      const request = store.get('ingredientsFile');
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => db.close();
    });
    
    if (handle) {
      // Check if we have permission (will prompt user if needed on first access)
      const hasPermission = await verifyPermission(handle, false);
      if (hasPermission) {
        ingredientsFileHandle = handle;
        return handle;
      } else {
        console.log('Permission not granted for stored file handle');
        // Still set the handle - user might grant permission later
        ingredientsFileHandle = handle;
        return null;
      }
    }
  } catch (err) {
    console.warn('Could not restore file handle:', err);
  }
  return null;
}

/**
 * Open IndexedDB for storing file handles
 */
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('MealPrepFileSystem', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('fileHandles')) {
        db.createObjectStore('fileHandles');
      }
    };
  });
}

/**
 * Clear stored file handle
 */
export async function clearFileHandle() {
  ingredientsFileHandle = null;
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('fileHandles', 'readwrite');
      const store = tx.objectStore('fileHandles');
      const request = store.delete('ingredientsFile');
      
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => db.close();
    });
  } catch (err) {
    console.warn('Could not clear file handle:', err);
  }
}

/**
 * Get current file handle
 */
export function getFileHandle() {
  return ingredientsFileHandle;
}

/**
 * Check if a file handle is stored (even if permission not yet granted)
 */
export async function hasStoredFileHandle() {
  try {
    const db = await openDB();
    const handle = await new Promise((resolve, reject) => {
      const tx = db.transaction('fileHandles', 'readonly');
      const store = tx.objectStore('fileHandles');
      const request = store.get('ingredientsFile');
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => db.close();
    });
    return !!handle;
  } catch (err) {
    return false;
  }
}

/**
 * Request permission and load from stored file handle
 * Returns the loaded data or null if permission denied/no handle
 */
export async function requestPermissionAndLoad() {
  try {
    const db = await openDB();
    const handle = await new Promise((resolve, reject) => {
      const tx = db.transaction('fileHandles', 'readonly');
      const store = tx.objectStore('fileHandles');
      const request = store.get('ingredientsFile');
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => db.close();
    });
    
    if (!handle) return null;
    
    // Request permission - this will show a prompt to the user
    const hasPermission = await verifyPermission(handle, false);
    if (hasPermission) {
      ingredientsFileHandle = handle;
      return await loadIngredientsFromFile(handle);
    }
  } catch (err) {
    console.warn('Could not request permission:', err);
  }
  return null;
}