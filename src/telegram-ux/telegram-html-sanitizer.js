'use strict';

const { redactSecrets } = require('./telegram-markdown-sanitizer');

const ALLOWED_TAGS = new Set(['b', 'strong', 'i', 'em', 'u', 'ins', 's', 'strike', 'del', 'a', 'code', 'pre']);

const ALLOWED_ATTRS = new Map([
  ['a', new Set(['href'])]
]);

function sanitizeTelegramHtml(text) {
  if (!text) return '';
  let result = String(text);
  result = redactSecrets(result);
  result = result.replace(/\r\n?/g, '\n');
  result = result.replace(/<([A-Za-z0-9]+)(\s[^>]*)?>/g, (match, tag, attrs) => {
    const lower = tag.toLowerCase();
    if (!ALLOWED_TAGS.has(lower)) return '';
    if (attrs && ALLOWED_ATTRS.has(lower)) {
      const allowed = ALLOWED_ATTRS.get(lower);
      const safeAttrs = attrs.replace(/([A-Za-z-]+)\s*=\s*"([^"]*)"/g, (am, attr, val) => {
        if (!allowed.has(attr.toLowerCase())) return '';
        const safeVal = redactSecrets(val);
        if (safeVal !== val) return '';
        return ` ${attr}="${safeVal.replace(/"/g, '&quot;')}"`;
      });
      return '<' + tag + safeAttrs + '>';
    }
    if (attrs) return '<' + tag + '>';
    return '<' + tag + '>';
  });
  result = result.replace(/<\/([A-Za-z0-9]+)>/g, (match, tag) => {
    if (ALLOWED_TAGS.has(tag.toLowerCase())) return match;
    return '';
  });
  result = result.replace(/\n{3,}/g, '\n\n');
  return result.trim();
}

function stripAllHtml(text) {
  if (!text) return '';
  return redactSecrets(String(text).replace(/<[^>]*>/g, '').replace(/\n{3,}/g, '\n\n').trim());
}

function escapeHtmlEntities(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = {
  ALLOWED_TAGS,
  escapeHtmlEntities,
  sanitizeTelegramHtml,
  stripAllHtml
};
