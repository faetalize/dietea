import test from 'node:test';
import assert from 'node:assert/strict';

import { consumeResponseStream } from '../js/services/openai.js';

function event(type, payload) {
  return `event: ${type}\ndata: ${JSON.stringify({ type, ...payload })}\n\n`;
}

function responseFrom(text, chunkSize = 17) {
  const bytes = new TextEncoder().encode(text);
  return new Response(
    new ReadableStream({
      start(controller) {
        for (let offset = 0; offset < bytes.length; offset += chunkSize) {
          controller.enqueue(bytes.slice(offset, offset + chunkSize));
        }
        controller.close();
      }
    })
  );
}

test('rebuilds final output from output_item.done when response.completed omits it', async () => {
  const message = {
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    status: 'completed',
    content: [{ type: 'output_text', text: 'Hello!', annotations: [] }]
  };
  const sse =
    event('response.output_text.delta', { delta: 'Hello!' }) +
    event('response.output_item.done', { output_index: 0, item: message }) +
    event('response.completed', { response: { id: 'resp_1', status: 'completed', output: [] } });

  const seen = [];
  const result = await consumeResponseStream(responseFrom(sse), (item) => seen.push(item), 'test-stream');

  assert.deepEqual(result.output, [message]);
  assert.equal(result.streamedText, 'Hello!');
  assert.deepEqual(seen.find((item) => item.type === 'text'), { type: 'text', delta: 'Hello!' });
});

test('retains streamed text when neither final event contains a message', async () => {
  const sse =
    event('response.output_text.delta', { delta: 'Still visible' }) +
    event('response.completed', { response: { id: 'resp_2', status: 'completed', output: [] } });

  const result = await consumeResponseStream(responseFrom(sse, 5), null, 'test-stream');

  assert.deepEqual(result.output, []);
  assert.equal(result.streamedText, 'Still visible');
});

test('parses CRLF streams and a final event without a blank-line terminator', async () => {
  const completed = event('response.completed', {
    response: { id: 'resp_3', status: 'completed', output: [] }
  })
    .replace(/\n/g, '\r\n')
    .replace(/\r\n\r\n$/, '');

  const result = await consumeResponseStream(responseFrom(completed, 3), null, 'test-stream');

  assert.equal(result.id, 'resp_3');
  assert.deepEqual(result.output, []);
});
