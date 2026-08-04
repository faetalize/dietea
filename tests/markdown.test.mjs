import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { renderMarkdown } from '../js/utils/markdown.js';

test('renders GitHub-flavoured structure instead of leaving Markdown literal', () => {
  const html = renderMarkdown(`### Plan

1. First
2. Second

- Protein
- Carbs

| Day | Meal |
| --- | --- |
| Mon | Soup |

**Bold** and \`code\`.`);

  assert.match(html, /<h3>Plan<\/h3>/);
  assert.match(html, /<ol>/);
  assert.match(html, /<ul>/);
  assert.match(html, /<table>/);
  assert.match(html, /<strong>Bold<\/strong>/);
  assert.match(html, /<code>code<\/code>/);
});

test('chat lists explicitly restore visible ordered and unordered markers', async () => {
  const css = await readFile(new URL('../main.css', import.meta.url), 'utf8');

  assert.match(css, /\.chat-message ul\s*\{\s*list-style:\s*disc outside;/);
  assert.match(css, /\.chat-message ol\s*\{\s*list-style:\s*decimal outside;/);
});

test('escapes raw HTML and refuses unsafe Markdown URLs', () => {
  const html = renderMarkdown('<img src=x onerror=alert(1)> [click](javascript:alert(1))');

  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img/);
  assert.doesNotMatch(html, /href="javascript:/);
  assert.match(html, /\bclick\b/);
});

test('safe external links open separately without opener access', () => {
  const html = renderMarkdown('[OpenAI](https://openai.com)');

  assert.match(html, /href="https:\/\/openai\.com"/);
  assert.match(html, /target="_blank"/);
  assert.match(html, /rel="noopener noreferrer"/);
});
