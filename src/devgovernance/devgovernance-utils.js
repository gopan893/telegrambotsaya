'use strict';

const SECRET_PATTERNS = [
  /token/i, /secret/i, /password/i, /api.?key/i,
  /authorization/i, /bearer/i, /database_url/i, /redis_url/i,
  /postgresql:\/\//, /rediss:\/\//, /sk-/, /ghp_/, /gsk_/, /tvly_/,
  /telegram_token/i, /github_token/i, /google_client_secret/i,
  /cloudflare_api_token/i, /render_deploy_hook/i
];

function maskSecrets(text) {
  if (!text || typeof text !== 'string') return text || '';
  let result = text;
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(new RegExp(`(${pattern.source})\\s*[=:]\\s*\\S+`, 'gi'), '$1=[REDACTED_SECRET]');
  }
  return result;
}

function safeGitDiffExcerpt(diff) {
  if (!diff || typeof diff !== 'string') return '';
  return diff.split('\n')
    .filter(line => !SECRET_PATTERNS.some(p => p.test(line)))
    .slice(0, 100)
    .join('\n');
}

function now() {
  return new Date().toISOString();
}

function shortId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function validateAgentName(name) {
  const valid = ['codex', 'opencode', 'hermes', 'unknown'];
  const clean = String(name || '').toLowerCase().trim();
  return valid.includes(clean) ? clean : 'unknown';
}

function sanitizeForDoc(text) {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

module.exports = {
  maskSecrets,
  safeGitDiffExcerpt,
  now,
  shortId,
  validateAgentName,
  sanitizeForDoc,
  SECRET_PATTERNS
};
