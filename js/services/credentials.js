/**
 * Credential vault.
 *
 * Holds the OpenAI API key and the Codex OAuth tokens. Both are secrets of the
 * same weight — a Codex refresh token buys the same access an API key does — so
 * they share one encrypted blob rather than getting separate treatment.
 *
 * ## Why unlocking is awkward
 *
 * The vault key is derived from the account password, but supabase-js persists
 * and auto-refreshes the session, so the password only exists for the instant it
 * is typed. Two paths follow from that:
 *
 *   - Fresh sign-in: main.js hands the password over before startSession(), we
 *     derive from it, and the vault opens with no extra prompt.
 *   - Restored session (the common case — reload, or reopening the tab): there is
 *     no password to derive from, so the vault stays locked until the user first
 *     reaches for the AI, which prompts.
 *
 * The *derived key* is cached in sessionStorage so a reload inside the same tab
 * does not re-prompt. The password itself is never stored anywhere.
 */

import { state, updateAiSettings, flushState } from './state.js';
import {
  deriveKey,
  deriveKeyForVault,
  decryptVaultWithKey,
  encryptVaultWithKey,
  createVaultWithKey,
  exportDerivedKey,
  importDerivedKey,
  toBase64,
  randomBytes,
  SALT_BYTES
} from './crypto.js';

const SESSION_KEY = 'dietea-ai-vault-key';

/** Derived AES key for this session. Null when locked. */
let derivedKey = null;
/** Salt that goes with derivedKey — a CryptoKey cannot reveal its own. */
let derivedSalt = null;
/** Decrypted contents. Null when locked. */
let payload = null;
/** Password held only between the sign-in handler and initVault(). */
let pendingPassword = null;

function emptyPayload() {
  return { apiKey: null, codex: null };
}

/* --------------------------------------------------------------- session */

function cacheSessionKey(serializedKey, salt) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ key: serializedKey, salt }));
  } catch {
    // Private mode or a full quota. Not fatal — it only costs a re-prompt.
  }
}

function readSessionKey() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function dropSessionKey() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* nothing to do */
  }
}

/* ----------------------------------------------------------------- state */

/**
 * Stash the password from the sign-in form. Called before the session loads,
 * because that is the only moment it exists.
 */
export function rememberPassword(password) {
  pendingPassword = password || null;
}

export function isUnlocked() {
  return !!derivedKey && !!payload;
}

export function hasVault() {
  return !!state.ai?.vault;
}

/**
 * True when there are credentials on file that this session cannot read yet.
 * The chat uses this to decide whether to prompt rather than to show setup.
 */
export function needsUnlock() {
  return hasVault() && !isUnlocked();
}

/* ---------------------------------------------------------------- unlock */

async function openWithKey(key, salt) {
  const vault = state.ai?.vault;

  if (!vault) {
    // No vault yet — hold the key so the first saved credential does not need
    // the password typed a second time.
    derivedKey = key;
    derivedSalt = salt;
    payload = emptyPayload();
  } else {
    payload = await decryptVaultWithKey(vault, key);
    derivedKey = key;
    derivedSalt = vault.salt;
  }

  cacheSessionKey(await exportDerivedKey(key), derivedSalt);
  return payload;
}

/**
 * Open the vault at startup, in preference order: the password just typed, then
 * a derived key cached earlier in this tab. Never throws — a vault that will not
 * open is a state the UI reports, not an error that should break sign-in.
 */
export async function initVault() {
  const password = pendingPassword;
  pendingPassword = null;

  if (password) {
    try {
      const vault = state.ai?.vault;
      const salt = vault ? vault.salt : toBase64(randomBytes(SALT_BYTES));
      const key = vault
        ? await deriveKeyForVault(password, vault)
        : await deriveKey(password, base64ToBytes(salt));

      await openWithKey(key, salt);
      return { unlocked: true };
    } catch {
      // Wrong password for this vault — almost always means the Supabase
      // password was changed outside the rekey flow in Settings.
      dropSessionKey();
      return { unlocked: false, reason: 'password-mismatch' };
    }
  }

  const cached = readSessionKey();
  if (cached) {
    try {
      const key = await importDerivedKey(cached.key);
      await openWithKey(key, cached.salt);
      return { unlocked: true };
    } catch {
      dropSessionKey();
    }
  }

  return { unlocked: false, reason: hasVault() ? 'locked' : 'empty' };
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Unlock from an explicitly typed password. This is the prompt path on a
 * restored session. Throws with a readable message when the password is wrong.
 */
export async function unlockWithPassword(password) {
  const vault = state.ai?.vault;

  if (!vault) {
    const salt = toBase64(randomBytes(SALT_BYTES));
    const key = await deriveKey(password, base64ToBytes(salt));
    return openWithKey(key, salt);
  }

  try {
    const key = await deriveKeyForVault(password, vault);
    return await openWithKey(key, vault.salt);
  } catch {
    throw new Error(
      'That password did not unlock your saved credentials. If you changed your account password outside Settings, you will need to re-enter your API key.'
    );
  }
}

export function lock() {
  derivedKey = null;
  derivedSalt = null;
  payload = null;
  pendingPassword = null;
  dropSessionKey();
}

/* ------------------------------------------------------------------ read */

export function getApiKey() {
  return payload?.apiKey || null;
}

export function getCodexTokens() {
  return payload?.codex || null;
}

/**
 * True when the currently selected provider has a usable credential.
 */
export function hasCredentialFor(provider) {
  if (!isUnlocked()) return false;
  return provider === 'codex' ? !!payload.codex?.refreshToken : !!payload.apiKey;
}

/* ----------------------------------------------------------------- write */

async function persist() {
  if (!derivedKey) throw new Error('The credential vault is locked.');

  const existing = state.ai?.vault;
  const vault = existing
    ? await encryptVaultWithKey(existing, derivedKey, payload)
    : await createVaultWithKey(derivedKey, derivedSalt, payload);

  updateAiSettings({ vault });
  // Credentials are worth waiting on: a reload between the debounce and the
  // write would silently drop a key the user believes they just saved.
  await flushState();
}

export async function setApiKey(apiKey) {
  if (!isUnlocked()) throw new Error('The credential vault is locked.');
  payload = { ...payload, apiKey: apiKey || null };
  await persist();
}

export async function setCodexTokens(tokens) {
  if (!isUnlocked()) throw new Error('The credential vault is locked.');
  payload = { ...payload, codex: tokens || null };
  await persist();
}

/* ----------------------------------------------------------------- rekey */

/**
 * Change the account password and carry the vault across.
 *
 * Order is deliberate: decrypt first so a wrong current password fails before
 * anything changes, then update the password, then re-encrypt. If the final
 * write fails the plaintext is still in memory, so the error is thrown loudly
 * for the caller to surface and retry — swallowing it would strand the vault
 * under a password that no longer exists.
 */
export async function changePassword(currentPassword, nextPassword, updateAuthPassword) {
  const vault = state.ai?.vault;

  let contents = emptyPayload();
  if (vault) {
    try {
      const key = await deriveKeyForVault(currentPassword, vault);
      contents = await decryptVaultWithKey(vault, key);
    } catch {
      throw new Error('Your current password is incorrect.');
    }
  }

  await updateAuthPassword(nextPassword);

  const salt = toBase64(randomBytes(SALT_BYTES));
  const key = await deriveKey(nextPassword, base64ToBytes(salt));

  payload = contents;
  derivedKey = key;
  derivedSalt = salt;

  try {
    const rewrapped = await createVaultWithKey(key, salt, payload);
    updateAiSettings({ vault: rewrapped });
    await flushState();
  } catch (err) {
    throw new Error(
      `Your password was changed, but re-encrypting your saved credentials failed (${err.message}). Re-enter your API key in Settings to fix this.`
    );
  }

  cacheSessionKey(await exportDerivedKey(key), salt);
}

/**
 * Forget every stored credential without touching the account password.
 */
export async function clearVault() {
  payload = emptyPayload();
  updateAiSettings({ vault: null });
  await flushState();
}
