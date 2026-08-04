import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clearConversation,
  deleteConversation,
  getHistory,
  recordProposalOutcome
} from '../js/services/agent.js';

test('conversation histories and proposal outcomes stay isolated by tab id', () => {
  const firstId = 'conversation-test-first';
  const secondId = 'conversation-test-second';

  clearConversation(firstId);
  clearConversation(secondId);
  getHistory(firstId).push({ role: 'user', content: 'first tab' });
  getHistory(secondId).push({ role: 'user', content: 'second tab' });
  recordProposalOutcome(firstId, 'proposal-1', 'accepted', ['first-only change']);

  assert.equal(getHistory(firstId).length, 2);
  assert.equal(getHistory(secondId).length, 1);
  assert.equal(getHistory(secondId)[0].content, 'second tab');
  assert.match(getHistory(firstId)[1].content[0].text, /first-only change/);

  deleteConversation(firstId);
  deleteConversation(secondId);
});

test('clearing one conversation leaves sibling tab history intact', () => {
  const firstId = 'conversation-clear-first';
  const secondId = 'conversation-clear-second';

  getHistory(firstId).push({ role: 'user', content: 'discard me' });
  getHistory(secondId).push({ role: 'user', content: 'keep me' });
  clearConversation(firstId);

  assert.deepEqual(getHistory(firstId), []);
  assert.deepEqual(getHistory(secondId), [{ role: 'user', content: 'keep me' }]);

  deleteConversation(firstId);
  deleteConversation(secondId);
});
