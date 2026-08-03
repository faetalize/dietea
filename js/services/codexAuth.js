/**
 * Codex OAuth (ChatGPT subscription) — PKCE against auth.openai.com.
 *
 * Uses the same public client the Codex CLI uses, which is how every third-party
 * Codex integration works. Two things to understand before touching this:
 *
 * ## The redirect cannot come back to us
 *
 * `redirect_uri` is registered as http://localhost:1455/auth/callback — the port
 * the CLI opens a local server on. A web page cannot listen on a port, so after
 * the user authorizes, the browser lands on a dead URL carrying the code in its
 * query string. The user copies that URL back to us. It looks unpolished and it
 * is: there is no version of this flow that a static page can complete on its
 * own, and the redirect_uri is fixed on OpenAI's side, not ours.
 *
 * ## This is an unofficial contract
 *
 * OpenAI documents API keys for programmatic use; this path exists for Codex
 * clients. It can change without notice. Everything here is behind the provider
 * abstraction in openai.js so a break degrades to the API key rather than taking
 * the feature down.
 */

/**
 * Origins the Codex backend will answer a CORS preflight for.
 *
 * Measured against the live endpoint, not documented anywhere: it sends
 * Access-Control-Allow-Origin only for these exact strings and returns no CORS
 * headers at all for anything else — including http://127.0.0.1:3000, which is
 * the same server as localhost:3000 but a different origin, and including any
 * deployed domain.
 *
 * The practical consequence is that **Codex works in local development only**.
 * There is no workaround from a static page: the allowlist is OpenAI's, and the
 * two entries here are plainly meant for local dev servers (3000 and Vite's
 * 5173). Deployed builds must use an API key.
 */
const CORS_ALLOWED_ORIGINS = ['http://localhost:3000', 'http://localhost:5173'];

export function isCodexOriginSupported(origin = location.origin) {
  return CORS_ALLOWED_ORIGINS.includes(origin);
}

export function describeCodexOriginProblem(origin = location.origin) {
  if (isCodexOriginSupported(origin)) return '';

  // Same server, different origin string — by far the most common way to hit
  // this, and a one-word fix, so it gets its own message.
  if (/^https?:\/\/127\.0\.0\.1:(3000|5173)$/.test(origin)) {
    const port = origin.endsWith('5173') ? '5173' : '3000';
    return `Codex blocks requests from ${origin}. Open the app at http://localhost:${port} instead — it is the same server, but Codex only accepts the "localhost" spelling.`;
  }

  return `Codex only accepts requests from http://localhost:3000 or http://localhost:5173, and this app is running at ${origin}. Use an OpenAI API key here.`;
}

const CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
const AUTHORIZE_URL = 'https://auth.openai.com/oauth/authorize';
const TOKEN_URL = 'https://auth.openai.com/oauth/token';
const REDIRECT_URI = 'http://localhost:1455/auth/callback';
const SCOPE = 'openid profile email offline_access';

/** Refresh this far ahead of expiry so a long request cannot expire mid-flight. */
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

/** Pending flow state, held between opening the tab and pasting the URL back. */
let pending = null;

function base64UrlEncode(bytes) {
  let binary = '';
  const view = new Uint8Array(bytes);
  for (let i = 0; i < view.length; i++) binary += String.fromCharCode(view[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomUrlSafe(byteLength = 32) {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(byteLength)));
}

async function pkceChallenge(verifier) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64UrlEncode(digest);
}

/**
 * Build the authorization URL and remember the verifier + state for the
 * exchange. The caller opens the URL in a new tab.
 */
export async function beginAuthorization() {
  const verifier = randomUrlSafe();
  const state = randomUrlSafe(16);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: SCOPE,
    code_challenge: await pkceChallenge(verifier),
    code_challenge_method: 'S256',
    state,
    id_token_add_organizations: 'true',
    codex_cli_simplified_flow: 'true',
    originator: 'codex_cli_rs'
  });

  pending = { verifier, state };
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * Pull the code out of the URL the user pasted back.
 *
 * Verifying `state` is what makes the paste step safe: it proves the callback
 * came from the authorization we started, not from a URL handed to the user by
 * someone else.
 */
function parseCallback(pastedUrl) {
  let url;
  try {
    url = new URL(pastedUrl.trim());
  } catch {
    throw new Error('That does not look like a URL. Paste the whole address, starting with http://localhost:1455/.');
  }

  const error = url.searchParams.get('error');
  if (error) {
    const description = url.searchParams.get('error_description');
    throw new Error(description || `Authorization failed: ${error}`);
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code) throw new Error('That URL has no authorization code in it. Copy the full address from the failed tab.');
  if (!pending) throw new Error('This sign-in attempt expired. Start again from Settings.');
  if (state !== pending.state) throw new Error('That URL is from a different sign-in attempt. Start again from Settings.');

  return code;
}

function tokensFromResponse(data) {
  const accessToken = data.access_token;
  const claims = decodeJwtClaims(data.id_token) || decodeJwtClaims(accessToken) || {};

  return {
    accessToken,
    refreshToken: data.refresh_token || null,
    // expires_in is seconds; store an absolute instant so a reload cannot make
    // a stale token look fresh.
    expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
    accountId: extractAccountId(claims)
  };
}

/**
 * The Codex backend wants the ChatGPT account id in its own header. It is
 * carried as a claim on the token rather than returned as a field.
 */
function extractAccountId(claims) {
  return (
    claims?.['https://api.openai.com/auth']?.chatgpt_account_id ||
    claims?.chatgpt_account_id ||
    null
  );
}

function decodeJwtClaims(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;

  try {
    const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(padded + '='.repeat((4 - (padded.length % 4)) % 4)));
  } catch {
    return null;
  }
}

async function postToken(body) {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString()
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const detail = data?.error_description || data?.error || `HTTP ${response.status}`;
    throw new Error(`Codex sign-in failed: ${detail}`);
  }

  return tokensFromResponse(data);
}

/**
 * Exchange the pasted callback for tokens.
 */
export async function completeAuthorization(pastedUrl) {
  const code = parseCallback(pastedUrl);
  const verifier = pending.verifier;

  const tokens = await postToken({
    grant_type: 'authorization_code',
    client_id: CLIENT_ID,
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier
  });

  pending = null;

  if (!tokens.refreshToken) {
    throw new Error('Codex returned no refresh token, so the connection would break within the hour. Try again.');
  }

  return tokens;
}

export function cancelAuthorization() {
  pending = null;
}

export function isExpired(tokens) {
  if (!tokens?.expiresAt) return true;
  return Date.now() >= tokens.expiresAt - REFRESH_MARGIN_MS;
}

/**
 * Trade the refresh token for a fresh access token.
 *
 * Some responses omit a new refresh token, meaning the old one stays valid —
 * carrying it forward rather than overwriting with null is what keeps a
 * connection alive past the first refresh.
 */
export async function refreshTokens(tokens) {
  if (!tokens?.refreshToken) {
    throw new Error('Codex is not connected. Link it again in Settings.');
  }

  const refreshed = await postToken({
    grant_type: 'refresh_token',
    client_id: CLIENT_ID,
    refresh_token: tokens.refreshToken,
    scope: SCOPE
  });

  return {
    ...refreshed,
    refreshToken: refreshed.refreshToken || tokens.refreshToken,
    accountId: refreshed.accountId || tokens.accountId
  };
}

export { CLIENT_ID, REDIRECT_URI };
