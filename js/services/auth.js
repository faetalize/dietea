/**
 * Authentication
 *
 * Email + password via Supabase Auth. The session is persisted by supabase-js
 * under the `dietea-auth` storage key and refreshed automatically, so signing
 * in on a second device is all that "accessible from anywhere" requires.
 */

import { supabase, describeError } from './supabase.js';

let currentUser = null;

/**
 * The signed-in user, or null. Populated by initAuth() and kept current by the
 * auth state subscription, so the rest of the app can read it synchronously.
 */
export function getCurrentUser() {
  return currentUser;
}

export function getCurrentUserId() {
  return currentUser?.id ?? null;
}

/**
 * Resolve the user id, throwing if signed out. Every write goes through this so
 * a stale session surfaces as one clear error rather than an RLS rejection.
 */
export function requireUserId() {
  if (!currentUser?.id) {
    throw new Error('You are signed out. Sign in again to save changes.');
  }
  return currentUser.id;
}

/**
 * Read the existing session once at startup.
 * Returns the user, or null when signed out.
 */
export async function initAuth() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.warn('Could not read session', error);
    currentUser = null;
    return null;
  }

  currentUser = data.session?.user ?? null;
  return currentUser;
}

/**
 * Subscribe to sign-in / sign-out. The callback receives the user or null.
 */
export function onAuthChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user ?? null;
    callback(currentUser);
  });
  return () => data.subscription.unsubscribe();
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { user: null, error: describeError(error) };

  currentUser = data.user;
  return { user: data.user, error: null };
}

/**
 * Create an account. When the project requires email confirmation, Supabase
 * returns a user with no session — the caller has to tell the user to go check
 * their inbox rather than assuming they are signed in.
 */
export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { user: null, needsConfirmation: false, error: describeError(error) };

  const needsConfirmation = !data.session;
  currentUser = data.session?.user ?? null;
  return { user: data.user, needsConfirmation, error: null };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  currentUser = null;
  return { error: error ? describeError(error) : null };
}
