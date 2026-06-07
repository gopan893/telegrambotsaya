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

const LIFE_TYPES = [
  'personal_task',
  'habit',
  'reminder',
  'focus_session',
  'daily_plan',
  'weekly_plan',
  'personal_goal',
  'energy_note',
  'mood_note',
  'reflection',
  'routine',
  'calendar_proposal',
  'email_draft_proposal'
];

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix = 'life') {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
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
  if (Array.isArray(value)) return value.slice(0, options.maxItems || 120).map((item) => sanitizePayload(item, options));
  if (typeof value === 'object') {
    const out = {};
    for (const [key, val] of Object.entries(value).slice(0, options.maxKeys || 100)) {
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

function resolveWorkspaceId(input = {}, services = {}) {
  return String(input.workspaceId || services.workspaceId || 'default').trim() || 'default';
}

function resolveUserId(input = {}, services = {}) {
  return String(input.userId || services.userId || services.actorId || 'dashboard-admin').trim();
}

function normalizeType(type = 'personal_task') {
  const clean = String(type || '').trim().toLowerCase();
  return LIFE_TYPES.includes(clean) ? clean : 'personal_task';
}

function normalizeStatus(status = 'active') {
  const clean = String(status || '').trim().toLowerCase();
  const valid = ['planned', 'active', 'todo', 'doing', 'done', 'paused', 'skipped', 'completed', 'archived', 'proposal_ready'];
  return valid.includes(clean) ? clean : 'active';
}

function normalizePriority(priority = 'medium') {
  const clean = String(priority || '').trim().toLowerCase();
  return ['low', 'medium', 'high', 'critical'].includes(clean) ? clean : 'medium';
}

function normalizeSensitivity(value = 'normal') {
  const clean = String(value || '').trim().toLowerCase();
  return ['public', 'normal', 'private', 'sensitive'].includes(clean) ? clean : 'normal';
}

function getDateKey(date = new Date()) {
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const d = date instanceof Date ? date : new Date(date || Date.now());
  return Number.isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
}

function getWeekKey(date = new Date()) {
  const d = date instanceof Date ? new Date(date) : new Date(date || Date.now());
  if (Number.isNaN(d.getTime())) return getWeekKey(new Date());
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function buildLifeItem(input = {}, services = {}) {
  const now = nowIso();
  const type = normalizeType(input.type);
  return sanitizePayload({
    id: input.id || createId(type),
    workspaceId: resolveWorkspaceId(input, services),
    userId: resolveUserId(input, services),
    type,
    title: sanitizeText(input.title || input.name || type.replace(/_/g, ' '), 180),
    description: sanitizeText(input.description || input.text || input.note || '', 1000),
    status: normalizeStatus(input.status || (type === 'personal_task' ? 'todo' : 'active')),
    priority: normalizePriority(input.priority),
    dueAt: input.dueAt || '',
    scheduledAt: input.scheduledAt || input.date || '',
    tags: safeArray(input.tags).map((tag) => sanitizeText(tag, 48)).slice(0, 12),
    source: sanitizeText(input.source || services.actorType || 'lifeos', 80),
    sensitivity: normalizeSensitivity(input.sensitivity || inferSensitivity(input)),
    createdAt: input.createdAt || now,
    updatedAt: now,
    data: sanitizePayload(input.data || {}, { maxString: 800, maxItems: 100, maxKeys: 80 })
  }, { maxString: 1200, maxItems: 200, maxKeys: 120 });
}

function inferSensitivity(input = {}) {
  const text = `${input.title || ''} ${input.description || ''} ${input.note || ''} ${input.text || ''}`;
  if (containsSecretLike(input)) return 'sensitive';
  if (/mood|energy|capek|sedih|cemas|stres|stress|relationship|keluarga|pribadi|private/i.test(text)) return 'private';
  return 'normal';
}

function detectCrisisText(text = '') {
  return /\b(bunuh diri|mengakhiri hidup|self harm|menyakiti diri|suicide|ingin mati)\b/i.test(String(text || ''));
}

async function auditLife(action, data = {}, services = {}) {
  try {
    const auditLog = services.auditLog || require('../dashboard/audit-log');
    await auditLog.recordAuditLog({
      actorType: services.actorType || data.actorType || 'lifeos',
      actorId: services.actorId || data.userId || '',
      action,
      targetType: data.targetType || 'lifeos',
      targetId: data.targetId || data.id || '',
      userId: data.userId || services.userId || '',
      workspaceId: data.workspaceId || services.workspaceId || 'default',
      decision: data.decision || 'allowed',
      status: data.status || 'ok',
      reason: sanitizeText(data.reason || '', 300),
      afterSummary: sanitizePayload(data.summary || data, { maxString: 500, maxItems: 80, maxKeys: 60 })
    }, services);
  } catch (_) {}
}

module.exports = {
  LIFE_TYPES,
  SECRET_PATTERNS,
  auditLife,
  buildLifeItem,
  compactText,
  containsSecretLike,
  createId,
  detectCrisisText,
  getDateKey,
  getWeekKey,
  inferSensitivity,
  normalizePriority,
  normalizeSensitivity,
  normalizeStatus,
  normalizeType,
  nowIso,
  redactSecrets,
  resolveUserId,
  resolveWorkspaceId,
  safeArray,
  sanitizePayload,
  sanitizeText
};
