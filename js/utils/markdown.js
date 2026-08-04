/**
 * GitHub-flavoured Markdown for model messages.
 *
 * Marked handles structure while this renderer owns the unsafe surfaces. Raw
 * HTML is displayed as text, remote images are reduced to labelled links, and
 * only ordinary web/mail/anchor URLs become clickable.
 */

import { marked, Renderer } from '../vendor/markdown.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function safeHref(value) {
  const href = String(value || '').trim();
  if (/^https?:\/\//i.test(href) || /^mailto:/i.test(href) || href.startsWith('#')) return href;
  return null;
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/'/g, '&#39;');
}

const renderer = new Renderer();

renderer.html = ({ text }) => escapeHtml(text);

renderer.link = function ({ href, title, tokens }) {
  const label = this.parser.parseInline(tokens);
  const safe = safeHref(href);
  if (!safe) return label;

  const titleAttribute = title ? ` title="${escapeAttribute(title)}"` : '';
  const external = /^https?:\/\//i.test(safe);
  const externalAttributes = external ? ' target="_blank" rel="noopener noreferrer"' : '';
  return `<a href="${escapeAttribute(safe)}"${titleAttribute}${externalAttributes}>${label}</a>`;
};

renderer.image = function ({ href, title, text }) {
  const safe = safeHref(href);
  const label = escapeHtml(text || 'Image');
  if (!safe) return `<span class="chat-markdown-image">${label}</span>`;

  const titleAttribute = title ? ` title="${escapeAttribute(title)}"` : '';
  return `<a class="chat-markdown-image" href="${escapeAttribute(safe)}"${titleAttribute} target="_blank" rel="noopener noreferrer">Image: ${label}</a>`;
};

export function renderMarkdown(text) {
  return marked.parse(String(text || ''), {
    renderer,
    gfm: true,
    breaks: true,
    async: false
  });
}
