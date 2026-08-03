/**
 * Client-side encryption primitives for the credential vault.
 *
 * WebCrypto only — no dependency, no build step, available in every browser
 * that already runs this app. PBKDF2-SHA256 stretches the account password into
 * an AES-GCM key; the ciphertext is what lands in dietea.profiles.ai_vault.
 *
 * What this protects: the database at rest. A leaked service_role key, a stray
 * backup, or a mistaken RLS policy exposes ciphertext instead of a live OpenAI
 * key. What it does NOT protect: this page. At decrypt time the credential is
 * in memory, so anything with script execution here already wins.
 *
 * AES-GCM authenticates as well as encrypts, so a wrong password fails loudly
 * with an OperationError rather than returning plausible garbage. Callers rely
 * on that to tell "wrong password" apart from "no vault yet".
 */

const PBKDF2_ITERATIONS = 600_000;
const SALT_BYTES = 16;
const IV_BYTES = 12; // 96 bits, the size AES-GCM is specified for
const VAULT_VERSION = 1;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64(bytes) {
  let binary = '';
  const view = new Uint8Array(bytes);
  for (let i = 0; i < view.length; i++) binary += String.fromCharCode(view[i]);
  return btoa(binary);
}

function fromBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function randomBytes(length) {
  return crypto.getRandomValues(new Uint8Array(length));
}

/**
 * Stretch a password into an AES-GCM key.
 *
 * Returned non-extractable, so even a script running on this page cannot read
 * the raw bytes back out of the CryptoKey — it can only use it. That is also
 * why the derived key cannot be stashed in sessionStorage directly; see
 * exportDerivedKey() below for the deliberate exception.
 */
export async function deriveKey(password, salt) {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a JSON-serializable payload into the stored vault shape.
 *
 * A fresh salt per write means re-encrypting after a password change never
 * reuses key material, and a fresh IV per write is mandatory for GCM — reusing
 * one with the same key is the failure mode that breaks the cipher outright.
 */
export async function encryptVault(password, payload) {
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const key = await deriveKey(password, salt);

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(JSON.stringify(payload))
  );

  return {
    v: VAULT_VERSION,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(ciphertext)
  };
}

/**
 * Decrypt with an already-derived key, so a session can unlock repeatedly
 * without re-running 600k PBKDF2 iterations each time.
 *
 * Throws on a wrong key (AES-GCM tag mismatch). Callers translate that into
 * "re-enter your credentials" rather than treating it as an empty vault.
 */
export async function decryptVaultWithKey(vault, key) {
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(vault.iv) },
    key,
    fromBase64(vault.ciphertext)
  );
  return JSON.parse(decoder.decode(plaintext));
}

/**
 * Re-derive the key for a stored vault from its own salt.
 */
export async function deriveKeyForVault(password, vault) {
  return deriveKey(password, fromBase64(vault.salt));
}

/**
 * Re-encrypt an existing payload under a new password, reusing nothing.
 * Used by the rekey flow when the account password changes.
 */
export async function reencryptVault(payload, nextPassword) {
  return encryptVault(nextPassword, payload);
}

/**
 * Serialize a derived key so it survives a page reload within the same tab.
 *
 * This is the one place raw key material is exposed, and it is a considered
 * trade: the alternative is either re-prompting for the password on every
 * reload (which this app never does for anything else) or caching the password
 * itself (strictly worse — it would also unlock the Supabase account). The key
 * lives in sessionStorage, so it dies with the tab and never touches disk the
 * way localStorage does.
 */
export async function exportDerivedKey(key) {
  const raw = await crypto.subtle.exportKey('raw', key);
  return toBase64(raw);
}

export async function importDerivedKey(serialized) {
  return crypto.subtle.importKey(
    'raw',
    fromBase64(serialized),
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt with an already-derived key, preserving that key's salt.
 *
 * Needed when the session holds a derived key but not the password: saving a
 * newly pasted API key must not require the user to type their password again.
 */
export async function encryptVaultWithKey(vault, key, payload) {
  const iv = randomBytes(IV_BYTES);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(JSON.stringify(payload))
  );

  return {
    v: VAULT_VERSION,
    salt: vault.salt,
    iv: toBase64(iv),
    ciphertext: toBase64(ciphertext)
  };
}

/**
 * Build a brand new vault from a derived key that has no vault yet.
 * The salt must be carried alongside, since the key cannot reveal its own.
 */
export async function createVaultWithKey(key, salt, payload) {
  return encryptVaultWithKey({ salt }, key, payload);
}

export { toBase64, fromBase64, randomBytes, SALT_BYTES };
