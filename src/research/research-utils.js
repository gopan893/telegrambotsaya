'use strict';

const crypto = require('crypto');

const SECRET_PATTERNS = [
  /token\s*[:=]\s*[^\s,;]+/ig,
  /secret\s*[:=]\s*[^\s,;]+/ig,
  /password\s*[:=]\s*[^\s,;]+/ig,
  /api[_-]?key\s*[:=]\s*[^\s,;]+/ig,
  /Authorization\s*:\s*[^\n]+/ig,
  /Bearer\s+[A-Za-z0-9._~+/-]+/ig,
  /DATABASE_URL\s*[:=]\s*[^\s]+/ig,
  /REDIS_URL\s*[:=]\s*[^\s]+/ig,
  /postgresql:\/\/[^\s)'"`]+/ig,
  /rediss?:\/\/[^\s)'"`]+/ig,
  /sk-[A-Za-z0-9_-]{3,}/g,
  /ghp_[A-Za-z0-9_]{3,}/g,
  /github_pat_[A-Za-z0-9_]{3,}/g,
  /gsk_[A-Za-z0-9_]{3,}/g,
  /tvly_[A-Za-z0-9_]{3,}/g,
  /TELEGRAM_TOKEN\s*[:=]\s*[^\s]+/ig,
  /GITHUB_TOKEN\s*[:=]\s*[^\s]+/ig,
  /GOOGLE_CLIENT_SECRET\s*[:=]\s*[^\s]+/ig,
  /CLOUDFLARE_API_TOKEN\s*[:=]\s*[^\s]+/ig,
  /RENDER_DEPLOY_HOOK\s*[:=]\s*[^\s]+/ig
];

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix = 'research') {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function compactText(text = '', max = 800) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, Math.max(0, max - 1)).trim()}…`;
}

function containsSecretLike(value) {
  const raw = typeof value === 'string' ? value : JSON.stringify(value || '');
  return SECRET_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(raw);
  });
}

function redactSecrets(text = '') {
  let out = String(text || '');
  for (const pattern of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    out = out.replace(pattern, '[REDACTED_SECRET]');
  }
  return out;
}

function sanitizeText(text = '', max = 1000) {
  return compactText(redactSecrets(text), max);
}

function sanitizePayload(value, options = {}) {
  const maxString = options.maxString || 1000;
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return sanitizeText(value, maxString);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, options.maxItems || 80).map((item) => sanitizePayload(item, options));
  if (typeof value === 'object') {
    const out = {};
    for (const [key, val] of Object.entries(value).slice(0, options.maxKeys || 80)) {
      if (/token|secret|password|api[_-]?key|authorization|database_url|redis_url/i.test(key)) {
        out[key] = '[REDACTED_SECRET]';
      } else {
        out[key] = sanitizePayload(val, options);
      }
    }
    return out;
  }
  return value;
}

function tokenize(text = '') {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u00c0-\u024f\u1e00-\u1eff\u0100-\u017f\u0400-\u04ff\u3040-\u30ff\u4e00-\u9fff]+/gi, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .slice(0, 120);
}

function textScore(query = '', text = '') {
  const q = new Set(tokenize(query));
  if (!q.size) return 0;
  const words = new Set(tokenize(text));
  let hit = 0;
  for (const word of q) if (words.has(word)) hit += 1;
  return hit / q.size;
}

function normalizeScope(scope = '') {
  const clean = String(scope || '').toLowerCase().trim();
  const valid = ['project_docs', 'technical_research', 'api_docs', 'deployment', 'security', 'cost', 'architecture', 'troubleshooting', 'external_tools', 'general'];
  return valid.includes(clean) ? clean : 'general';
}

function resolveWorkspaceId(input = {}, services = {}) {
  return String(input.workspaceId || services.workspaceId || 'default').trim() || 'default';
}

function resolveUserId(input = {}, services = {}) {
  return String(input.userId || services.userId || services.actorId || 'dashboard-admin').trim();
}

function checksum(value) {
  return crypto.createHash('sha256').update(JSON.stringify(sanitizePayload(value))).digest('hex');
}

async function auditResearch(action, data = {}, services = {}) {
  try {
    const auditLog = services.auditLog || require('../dashboard/audit-log');
    await auditLog.recordAuditLog({
      actorType: services.actorType || data.actorType || 'research',
      actorId: services.actorId || data.userId || '',
      action,
      targetType: data.targetType || 'research',
      targetId: data.targetId || data.id || '',
      userId: data.userId || services.userId || '',
      workspaceId: data.workspaceId || services.workspaceId || 'default',
      decision: data.decision || 'allowed',
      status: data.status || 'ok',
      reason: sanitizeText(data.reason || '', 300),
      afterSummary: sanitizePayload(data.summary || data, { maxString: 500 })
    }, services);
  } catch (_) {}
}

module.exports = {
  SECRET_PATTERNS,
  auditResearch,
  checksum,
  compactText,
  containsSecretLike,
  createId,
  normalizeScope,
  nowIso,
  redactSecrets,
  resolveUserId,
  resolveWorkspaceId,
  safeArray,
  sanitizePayload,
  sanitizeText,
  textScore,
  tokenize
};
