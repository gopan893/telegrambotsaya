'use strict';

const CRYPTO = require('crypto');

function createCodingId(prefix = 'cd') {
  if (CRYPTO.randomUUID) return `${prefix}_${CRYPTO.randomUUID()}`;
  return `${prefix}_${Date.now()}_${CRYPTO.randomBytes(6).toString('hex')}`;
}

const SECRET_PATTERNS = [
  /token/gi,
  /secret/gi,
  /password/gi,
  /api_key/gi,
  /api-key/gi,
  /authorization/gi,
  /bearer\s+/gi,
  /DATABASE_URL/gi,
  /REDIS_URL/gi,
  /postgresql:\/\//gi,
  /rediss:\/\//gi,
  /sk-[a-zA-Z0-9]+/g,
  /ghp_[a-zA-Z0-9]+/g,
  /gsk_[a-zA-Z0-9]+/g,
  /tvly-[a-zA-Z0-9]+/g,
  /TELEGRAM_TOKEN/gi,
  /GITHUB_TOKEN/gi,
  /GOOGLE_CLIENT_SECRET/gi,
  /CLOUDFLARE_API_TOKEN/gi
];

function redactSecrets(text) {
  if (!text) return '';
  let result = String(text);
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]');
  }
  return result;
}

function sanitizeOutput(obj) {
  if (typeof obj === 'string') return redactSecrets(obj);
  if (Array.isArray(obj)) return obj.map(sanitizeOutput);
  if (obj && typeof obj === 'object') {
    const clean = {};
    for (const [k, v] of Object.entries(obj)) {
      clean[k] = sanitizeOutput(v);
    }
    return clean;
  }
  return obj;
}

const CODING_CATEGORIES = [
  'bug_fix',
  'feature_request',
  'phase_prompt',
  'refactor',
  'dashboard_issue',
  'telegram_bot_issue',
  'database_storage_issue',
  'integration_issue',
  'security_issue',
  'test_regression',
  'deployment_issue',
  'github_issue_pr'
];

function normalizeCategory(category) {
  const c = String(category || '').toLowerCase().replace(/[\s-]+/g, '_');
  return CODING_CATEGORIES.includes(c) ? c : 'feature_request';
}

function normalizeLimit(value, fallback = 10, max = 50) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.max(1, Math.min(Math.floor(n), max));
}

function textArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 30);
}

function jsonObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
}

const DEFAULT_CONSTRAINTS = {
  runtime: 'Node.js 20',
  moduleSystem: 'CommonJS',
  framework: 'Express webhook',
  dashboard: 'Vanilla HTML/CSS/JS',
  storage: 'PostgreSQL/Redis compatible',
  typescript: false,
  react: false,
  next: false,
  vue: false,
  largeRefactor: false,
  preserveOldCommands: true,
  approvalRequiredForExternal: true
};

module.exports = {
  createCodingId,
  SECRET_PATTERNS,
  redactSecrets,
  sanitizeOutput,
  CODING_CATEGORIES,
  normalizeCategory,
  normalizeLimit,
  textArray,
  jsonObject,
  DEFAULT_CONSTRAINTS
};
