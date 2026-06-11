'use strict';

const markdownSanitizer = require('./telegram-markdown-sanitizer');
const messageSplitter = require('./telegram-message-splitter');

function buildSafeMessage(text) {
  if (!text) return '';
  return markdownSanitizer.sanitizeTelegramMarkdown(String(text));
}

function prepareMessageParts(text, options) {
  const safe = buildSafeMessage(text);
  return messageSplitter.splitTelegramMessage(safe, options);
}

function truncateText(text, maxLen) {
  if (!text) return '';
  const str = String(text);
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

function formatBulletList(items) {
  if (!items || !Array.isArray(items) || items.length === 0) return '';
  return items.map(item => '• ' + String(item)).join('\n');
}

function formatNumberedList(items) {
  if (!items || !Array.isArray(items) || items.length === 0) return '';
  return items.map((item, i) => (i + 1) + '. ' + String(item)).join('\n');
}

function formatKeyValue(obj) {
  if (!obj || typeof obj !== 'object') return '';
  return Object.entries(obj)
    .filter(([k, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => k + ': ' + String(v))
    .join('\n');
}

function estimateTokenCount(text) {
  if (!text) return 0;
  return Math.ceil(String(text).length / 4);
}

function detectCodeRequest(text) {
  if (!text) return false;
  const patterns = [/buat\s+(codex|opencode|hermes)\s+prompt/i, /buat\s+(kode|code|fungsi|function)/i, /fix\s+(bug|error|masalah)/i, /buat\s+test/i, /implementasi/i];
  return patterns.some(p => p.test(String(text)));
}

function detectSecurityRequest(text) {
  if (!text) return false;
  const patterns = [/token\s+(bocor|expose|terekspos)/i, /securit/i, /hack/i, /vulnerabilit/i];
  return patterns.some(p => p.test(String(text)));
}

module.exports = {
  buildSafeMessage,
  detectCodeRequest,
  detectSecurityRequest,
  estimateTokenCount,
  formatBulletList,
  formatKeyValue,
  formatNumberedList,
  prepareMessageParts,
  truncateText
};
