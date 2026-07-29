/**
 * Supabase client.
 *
 * supabase-js is vendored into js/vendor/ rather than pulled from a CDN, so the
 * frontend is fully self-contained and deployable as static files.
 * Regenerate the bundle with: npm run vendor:supabase
 */

import { createClient } from '../vendor/supabase.js';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SCHEMA } from '../config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  db: { schema: SUPABASE_SCHEMA },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'dietea-auth'
  }
});

/**
 * Turn a PostgREST error into something worth showing a human.
 *
 * PGRST106 is the one worth special-casing: it means the `dietea` schema is not
 * in the project's exposed schemas, which is a one-time project setting and not
 * anything the user did wrong. Without this the app would just say "not found".
 */
export function describeError(error) {
  if (!error) return '';

  if (error.code === 'PGRST106') {
    return `The "${SUPABASE_SCHEMA}" schema is not exposed by the API. Add it under Project Settings → API → Exposed schemas.`;
  }

  if (error.code === '42501' || error.message?.includes('permission denied')) {
    return 'Permission denied. You may need to sign in again.';
  }

  if (error.message?.includes('Failed to fetch')) {
    return 'Could not reach the server. Check your connection.';
  }

  if (error.message) return error.message;

  // Some responses carry no body to parse — a failed HEAD request being the
  // classic case — so there is no code or message to report. Say what is
  // actually known rather than "something went wrong", and name the most
  // likely cause for the status.
  const status = error.status ?? error.statusCode;
  if (status === 406) {
    return `HTTP 406 with no detail. The "${SUPABASE_SCHEMA}" schema is most likely not exposed by the API — add it under Project Settings → API → Exposed schemas.`;
  }
  if (status) {
    return `The server rejected the request with HTTP ${status} and no detail.`;
  }

  return 'The server returned an error with no detail.';
}

/**
 * Throw with a readable message so callers can let it bubble to one handler.
 */
export function assertOk(error, context) {
  if (!error) return;
  const detail = describeError(error);
  const err = new Error(context ? `${context}: ${detail}` : detail);
  err.cause = error;
  throw err;
}
