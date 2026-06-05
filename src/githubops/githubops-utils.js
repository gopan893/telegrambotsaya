'use strict';

function now() {
  return new Date().toISOString();
}

function shortId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function maskSecrets(text) {
  if (!text || typeof text !== 'string') return text || '';
  const patterns = [
    /token/i, /secret/i, /password/i, /api.?key/i,
    /authorization/i, /bearer/i, /database_url/i, /redis_url/i,
    /postgresql:\/\//, /rediss:\/\//, /sk-/, /ghp_/, /github_pat_/, /gsk_/, /tvly_/,
    /telegram_token/i, /github_token/i, /google_client_secret/i,
    /cloudflare_api_token/i, /render_deploy_hook/i
  ];
  let result = text;
  for (const pattern of patterns) {
    result = result.replace(new RegExp(`(${pattern.source})\\s*[=:]\\s*\\S+`, 'gi'), '$1=[REDACTED]');
  }
  return result;
}

function truncate(str, max) {
  if (!str) return '';
  return String(str).length > max ? String(str).slice(0, max) + '...' : String(str);
}

module.exports = { now, shortId, maskSecrets, truncate };
