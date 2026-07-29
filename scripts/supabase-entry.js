// Entry point for the vendored Supabase bundle.
// Only what the app actually uses is re-exported, so the bundle stays small.
// Regenerate with: npm run vendor:supabase
export { createClient } from '@supabase/supabase-js';
