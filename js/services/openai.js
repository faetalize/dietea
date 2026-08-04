/**
 * Model transport. The only module that talks to OpenAI.
 *
 * Two providers behind one call, so nothing upstream knows or cares which is
 * active: an OpenAI API key, or a ChatGPT subscription via Codex OAuth.
 *
 * Plain `fetch` rather than the `openai` SDK. Both endpoints do accept the SDK's
 * headers (their CORS preflight reflects whatever it is asked for), so this is
 * not a compatibility workaround — it is that pulling in the SDK would mean
 * vendoring another esbuild bundle, and this app's whole shape is no build step
 * and no runtime dependency. The Responses API over fetch is a few dozen lines.
 *
 * ## Privacy
 *
 * `store: false`, always. This app holds body weight, composition and eating
 * habits, and `previous_response_id` would require OpenAI to retain that thread
 * server-side to work. Instead reasoning is carried in-band via
 * `include: ['reasoning.encrypted_content']` — the model still gets its chain of
 * thought back across tool calls, but nothing about the conversation is stored.
 */

import { state } from './state.js';
import { getApiKey, getCodexTokens, setCodexTokens, isUnlocked } from './credentials.js';
import { isExpired, refreshTokens, isCodexOriginSupported, describeCodexOriginProblem } from './codexAuth.js';

const API_URL = 'https://api.openai.com/v1/responses';
const CODEX_URL = 'https://chatgpt.com/backend-api/codex/responses';

/**
 * Identifies this chat to the Codex backend for prompt caching. Regenerated
 * when the conversation is cleared, since a fresh chat shares no prefix with
 * the old one.
 */
let conversationId = crypto.randomUUID();
let streamSequence = 0;

export function resetConversationId() {
  conversationId = crypto.randomUUID();
}

export const MODELS = [
  { id: 'gpt-5.6-sol', label: 'Sol — most capable', hint: 'Best at messy photos and multi-step planning.' },
  { id: 'gpt-5.6-terra', label: 'Terra — balanced', hint: 'The default. Handles labels and recipes well.' },
  { id: 'gpt-5.6-luna', label: 'Luna — fastest', hint: 'Cheapest and quickest for simple questions.' }
];

/**
 * Reasoning effort levels. `none` and `xhigh` are real values the Responses API
 * accepts, not just the low/medium/high middle.
 */
export const EFFORTS = [
  { id: 'none', label: 'None — no reasoning' },
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
  { id: 'xhigh', label: 'Extra high' }
];

/**
 * Codex serves the same canonical model ids as the Platform API — `gpt-5.6-sol`
 * and friends — so the selected model passes straight through. It is the same
 * models behind a different endpoint and a smaller context window (272k rather
 * than 1.05M), not a separate "codex" model.
 */

export function describeAiError(error) {
  if (!error) return '';

  if (error.name === 'AbortError') return '';

  const status = error.status;

  if (status === 401) {
    return state.ai?.provider === 'codex'
      ? 'Codex rejected your sign-in. Reconnect it in Settings.'
      : 'OpenAI rejected your API key. Check it in Settings.';
  }
  if (status === 429) {
    return 'Rate limited by OpenAI. Wait a moment and try again.';
  }
  if (status === 413) {
    return 'That attachment is too large. Try a smaller image.';
  }
  if (status >= 500) {
    return 'OpenAI had a server error. Try again in a moment.';
  }
  if (error.message?.includes('Failed to fetch')) {
    return 'Could not reach OpenAI. Check your connection.';
  }

  return error.message || 'The model returned an error with no detail.';
}

/**
 * Resolve credentials and endpoint for the active provider, refreshing the
 * Codex token when it is close enough to expiry to die mid-request.
 */
async function resolveProvider() {
  if (!isUnlocked()) {
    throw new Error('Unlock your credentials to use the assistant.');
  }

  const provider = state.ai?.provider || 'apikey';

  if (provider === 'codex') {
    // Fail here with something actionable. Letting it through produces a raw
    // CORS rejection, which reaches the user as "could not reach the server" —
    // technically true and completely unhelpful.
    if (!isCodexOriginSupported()) {
      throw new Error(describeCodexOriginProblem());
    }

    let tokens = getCodexTokens();
    if (!tokens?.refreshToken) {
      throw new Error('Codex is not connected. Link it in Settings, or switch to an API key.');
    }

    if (isExpired(tokens)) {
      tokens = await refreshTokens(tokens);
      await setCodexTokens(tokens);
    }

    return {
      url: CODEX_URL,
      // Same model ids as the Platform API — pass the selection straight through.
      model: state.ai?.model || 'gpt-5.6-terra',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        Authorization: `Bearer ${tokens.accessToken}`,
        'chatgpt-account-id': tokens.accountId || '',
        // Required. Without it the backend rejects the request outright — it is
        // what selects the Responses surface on this endpoint.
        'OpenAI-Beta': 'responses=experimental',
        originator: 'codex_cli_rs',
        // Stable per conversation, which is what lets the backend reuse a
        // prompt cache across the turns of one chat.
        session_id: conversationId,
        conversation_id: conversationId
      }
    };
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('No OpenAI API key saved. Add one in Settings, or connect Codex.');
  }

  return {
    url: API_URL,
    model: state.ai?.model || 'gpt-5.6-terra',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    }
  };
}

/**
 * Run one model turn.
 *
 * Streams text deltas through `onEvent` for the UI, then resolves with the
 * authoritative output items from `response.completed`. Callers append those
 * items verbatim to their history — including the reasoning items, which the
 * model needs back on the next request to keep its chain of thought across
 * tool calls.
 */
export async function streamResponse({
  input,
  tools,
  instructions,
  effort,
  signal,
  onEvent,
  toolChoice = 'auto',
  parallelToolCalls = false
}) {
  const provider = await resolveProvider();

  const body = {
    model: provider.model,
    instructions,
    input,
    tools,
    stream: true,
    store: false,
    include: ['reasoning.encrypted_content'],
    tool_choice: toolChoice,
    parallel_tool_calls: parallelToolCalls,
    // `summary` is the user-visible explanation surface used by Codex. The
    // encrypted/raw reasoning stays in history for model continuity but is
    // never displayed.
    reasoning: {
      effort: effort || state.ai?.reasoningEffort || 'medium',
      summary: 'auto'
    }
  };

  const response = await fetch(provider.url, {
    method: 'POST',
    headers: provider.headers,
    body: JSON.stringify(body),
    signal
  });

  if (!response.ok) {
    throw await buildHttpError(response);
  }

  return consumeResponseStream(response, onEvent, `stream-${++streamSequence}`);
}

async function buildHttpError(response) {
  let detail = '';
  try {
    const data = await response.json();
    detail = data?.error?.message || data?.detail || '';
  } catch {
    detail = await response.text().catch(() => '');
  }

  const error = new Error(detail || `HTTP ${response.status}`);
  error.status = response.status;
  return error;
}

/**
 * Parse the SSE body.
 *
 * Events arrive as `event:`/`data:` pairs separated by a blank line, and a chunk
 * boundary can land anywhere — including mid-line — so the tail of each read is
 * held back until a delimiter proves it complete.
 */
export async function consumeResponseStream(response, onEvent, streamId = `stream-${++streamSequence}`) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let buffer = '';
  let completed = null;
  let failure = null;
  let streamedText = '';
  const streamedItems = [];

  function capture(payload) {
    if (!payload) return;

    if (payload.type === 'response.completed') {
      completed = payload.response;
    } else if (payload.type === 'response.failed' || payload.type === 'error') {
      failure = payload.response?.error || payload.error || { message: 'The model run failed.' };
    } else {
      if (payload.type === 'response.output_text.delta') {
        streamedText += payload.delta || '';
      } else if (payload.type === 'response.output_item.done' && payload.item) {
        // The Codex endpoint can leave `response.completed.response.output`
        // incomplete even though it emitted the finished items while
        // streaming. Retain those authoritative done events by output index.
        const index = Number.isInteger(payload.output_index) ? payload.output_index : streamedItems.length;
        streamedItems[index] = payload.item;
      }
      dispatch(payload, onEvent, streamId);
    }
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    let boundary;
    while ((boundary = buffer.search(/\r?\n\r?\n/)) !== -1) {
      const delimiter = buffer.slice(boundary).match(/^\r?\n\r?\n/)?.[0] || '\n\n';
      const raw = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + delimiter.length);
      capture(parseEvent(raw));
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) capture(parseEvent(buffer));

  if (failure) {
    const error = new Error(failure.message || 'The model run failed.');
    error.status = failure.status;
    throw error;
  }

  if (!completed) {
    throw new Error('The model stream ended before completing.');
  }

  const completedItems = Array.isArray(completed.output) ? completed.output : [];
  const outputLength = Math.max(completedItems.length, streamedItems.length);
  const output = [];

  for (let index = 0; index < outputLength; index++) {
    const item = streamedItems[index] || completedItems[index];
    if (item) output.push(item);
  }

  return {
    ...completed,
    output,
    // Kept separately as a last-resort consistency check. The UI already saw
    // these exact deltas, so a non-empty value is a real assistant response.
    streamedText: streamedText.trim()
  };
}

function parseEvent(raw) {
  const dataLines = raw
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim());

  if (!dataLines.length) return null;

  const data = dataLines.join('\n');
  if (data === '[DONE]') return null;

  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Translate stream events into the small set the UI actually renders.
 * Everything else is deliberately dropped rather than surfaced.
 */
function dispatch(payload, onEvent, streamId) {
  if (!onEvent) return;

  switch (payload.type) {
    case 'response.output_text.delta':
      onEvent({ type: 'text', delta: payload.delta || '' });
      break;

    case 'response.reasoning_summary_text.delta':
      onEvent({
        type: 'reasoning-summary',
        delta: payload.delta || '',
        reasoningId: payload.item_id || `${streamId}-${payload.output_index ?? 0}-${payload.summary_index ?? 0}`,
        summaryIndex: payload.summary_index ?? 0
      });
      break;

    case 'response.reasoning_summary_text.done':
      onEvent({
        type: 'reasoning-summary-done',
        text: payload.text || '',
        reasoningId: payload.item_id || `${streamId}-${payload.output_index ?? 0}-${payload.summary_index ?? 0}`,
        summaryIndex: payload.summary_index ?? 0
      });
      break;

    case 'response.output_item.added':
      // Surfaces a tool call the instant the model commits to it, so the step
      // list can show "searching…" while the arguments are still streaming.
      if (payload.item?.type === 'function_call') {
        onEvent({ type: 'tool-start', name: payload.item.name, callId: payload.item.call_id });
      } else if (payload.item?.type === 'reasoning') {
        onEvent({ type: 'thinking' });
      }
      break;

    case 'response.output_item.done':
      if (payload.item?.type === 'function_call') {
        onEvent({
          type: 'tool-args',
          name: payload.item.name,
          callId: payload.item.call_id,
          args: payload.item.arguments
        });
      }
      break;

    default:
      break;
  }
}
