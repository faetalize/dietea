/**
 * Supabase connection settings.
 *
 * Both values are public by design. The publishable key only ever grants the
 * `anon` role, and every table in the `dietea` schema is protected by row level
 * security, so a signed-out key can read nothing. Committing them is expected
 * for a static frontend — that is what makes this deployable to Cloudflare
 * Pages with no build step and no server-side secrets.
 */

export const SUPABASE_URL = 'https://hglcltvwunzynnzduauy.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_K_ck1x_wPaD74ueDNMUKzg_NoxX4h1T';

/**
 * All app tables live in their own Postgres schema rather than `public`.
 * This schema must be listed under Project Settings → API → Exposed schemas,
 * otherwise PostgREST rejects every request with PGRST106.
 */
export const SUPABASE_SCHEMA = 'dietea';
