'use strict';

const crypto = require('crypto');
const dashboardGuards = require('../dashboard/dashboard-guards');
const workspace = require('../workspace');

const BACKUP_MANIFESTS_KEY = 'backup_manifests';
const BACKUP_SNAPSHOTS_KEY = 'backup_snapshots';
const RESTORE_LOGS_KEY = 'restore_logs';
const IMPORT_JOBS_KEY = 'import_jobs';

const BACKUP_VERSION = '1.0.0';
const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
const MAX_BACKUPS = 100;
const MAX_RESTORE_LOGS = 500;

const SAFE_DATA_KEYS = [
  'workspaces',
  'aios_memories',
  'aios_goals',
  'aios_workflows',
  'aios_insights',
  'aios_graph',
  'aios_graph_nodes',
  'aios_graph_edges',
  'planner_sessions',
  'planner_tasks',
  'executor_proposals',
  'executor_runs',
  'tool_registry',
  'tool_runs',
  'tool_audit',
  'backup_schedules',
  'backup_schedule_runs',
  'dashboard_audit_logs'
];

const SECRET_PATTERNS = [
  /\b(token|secret|password|api[_\s-]?key|authorization|credential|private\s+key)\b/i,
  /\b(database_url|redis_url|telegram_token|groq_api_key|mistral_api_key|openweather_api_key|tavily_api_key|dashboard_admin_token)\b/i,
  /\bpostgres(?:ql)?:\/\/[^:\s]+:[^@\s]+@/i,
  /\brediss?:\/\/[^:\s]+:[^@\s]+@/i,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}\b/i,
  /\b(?:sk|gsk|tvly|ghp|github_pat|xoxb|bot)[-_][A-Za-z0-9_-]{12,}\b/i,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/i
];

const SECRET_VALUE_PATTERNS = [
  /\b(token|secret|password|api[_\s-]?key|authorization|credential|private\s+key)\s*[:=]\s*[^,\s"}]{6,}/i,
  /\b(database_url|redis_url|telegram_token|groq_api_key|mistral_api_key|openweather_api_key|tavily_api_key|dashboard_admin_token)\s*[:=]\s*[^,\s"}]{6,}/i,
  /\bpostgres(?:ql)?:\/\/[^:\s]+:[^@\s]+@/i,
  /\brediss?:\/\/[^:\s]+:[^@\s]+@/i,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}\b/i,
  /\b(?:sk|gsk|tvly|ghp|github_pat|xoxb|bot)[-_][A-Za-z0-9_-]{12,}\b/i,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/i
];

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix = 'backup') {
  if (crypto.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
}

function compactText(value = '', max = 500) {
  const clean = dashboardGuards.preventSecretLeak(String(value || '').replace(/\s+/g, ' ').trim());
  if (clean.length <= max) return clean;
  return `${clean.slice(0, Math.max(0, max - 3)).trim()}...`;
}

function normalizeBackupType(type = 'workspace') {
  const clean = String(type || 'workspace').toLowerCase();
  return ['workspace', 'user', 'system', 'audit', 'full_safe'].includes(clean) ? clean : 'workspace';
}

function normalizeBackupStatus(status = 'created') {
  const clean = String(status || 'created').toLowerCase();
  return ['created', 'validated', 'restored', 'failed', 'archived'].includes(clean) ? clean : 'created';
}

function normalizeRestoreStatus(status = 'planned') {
  const clean = String(status || 'planned').toLowerCase();
  return ['planned', 'previewed', 'running', 'completed', 'failed', 'cancelled'].includes(clean) ? clean : 'planned';
}

function containsSecretLike(value) {
  if (value === null || typeof value === 'undefined') return false;
  if (typeof value === 'string') return SECRET_VALUE_PATTERNS.some(pattern => pattern.test(value)) || dashboardGuards.preventSecretLeak(value) !== value;
  if (typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(containsSecretLike);
  for (const [key, item] of Object.entries(value)) {
    const secretKey = SECRET_PATTERNS.some(pattern => pattern.test(key));
    if (secretKey && item && !['[redacted]', 'set', 'missing'].includes(String(item))) return true;
    if (containsSecretLike(item)) return true;
  }
  return false;
}

function sanitize(value) {
  if (value === null || typeof value === 'undefined') return value;
  if (typeof value === 'string') return dashboardGuards.preventSecretLeak(value);
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sanitize);
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (SECRET_PATTERNS.some(pattern => pattern.test(key))) {
      out[key] = item ? '[redacted]' : '';
      continue;
    }
    out[key] = sanitize(item);
  }
  return dashboardGuards.preventSecretLeak(out);
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function checksum(value) {
  return crypto.createHash('sha256').update(stableStringify(value)).digest('hex');
}

function estimateBytes(value) {
  return Buffer.byteLength(JSON.stringify(value || {}), 'utf8');
}

function getItemWorkspaceId(item = {}, fallback = '') {
  return item.workspaceId || item.workspace_id || item.metadata?.workspaceId || item.metadata?.workspace_id || fallback || '';
}

function getItemUserId(item = {}, fallback = '') {
  return item.userId || item.user_id || item.telegramUserId || item.telegram_user_id || fallback || '';
}

function defaultWorkspaceId(userId) {
  return workspace.utils.getPersonalWorkspaceId(userId);
}

function itemMatchesScope(item = {}, scope = {}) {
  const type = normalizeBackupType(scope.type);
  if (type === 'system' || type === 'full_safe' || type === 'audit') return true;
  const userId = String(scope.userId || '').trim();
  const workspaceId = String(scope.workspaceId || '').trim();
  const itemUserId = String(getItemUserId(item, '') || '').trim();
  const itemWorkspaceId = String(getItemWorkspaceId(item, userId ? defaultWorkspaceId(userId) : '') || '').trim();
  if (type === 'user') return !userId || itemUserId === userId || itemWorkspaceId === defaultWorkspaceId(userId);
  if (type === 'workspace') return !workspaceId || itemWorkspaceId === workspaceId || item.id === workspaceId;
  return true;
}

function filterByScope(value, scope = {}, key = '') {
  if (scope.type === 'full_safe' || scope.type === 'system') return value;
  if (key === 'dashboard_audit_logs' && !scope.includeAudit) return [];
  if (Array.isArray(value)) return value.filter(item => itemMatchesScope(item, scope)).slice(0, 1000);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [bucketKey, bucketValue] of Object.entries(value)) {
      if (scope.type === 'user' && scope.userId && String(bucketKey) !== String(scope.userId)) continue;
      if (Array.isArray(bucketValue)) out[bucketKey] = bucketValue.filter(item => itemMatchesScope(item, { ...scope, userId: bucketKey })).slice(0, 1000);
      else if (bucketValue && typeof bucketValue === 'object') out[bucketKey] = filterByScope(bucketValue, { ...scope, userId: bucketKey }, key);
      else out[bucketKey] = bucketValue;
    }
    return out;
  }
  return value;
}

function countItems(value) {
  if (Array.isArray(value)) return value.length;
  if (!value || typeof value !== 'object') return value ? 1 : 0;
  return Object.values(value).reduce((sum, item) => sum + countItems(item), 0);
}

function buildItemCounts(data = {}) {
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, countItems(value)]));
}

function summarizeManifest(manifest = {}) {
  return sanitize({
    id: manifest.id,
    type: manifest.type,
    workspaceId: manifest.workspaceId,
    userId: manifest.userId,
    createdBy: manifest.createdBy,
    status: manifest.status,
    version: manifest.version,
    itemCounts: manifest.itemCounts || {},
    checksum: manifest.checksum,
    sanitized: manifest.sanitized === true,
    includes: manifest.includes || [],
    excludes: manifest.excludes || [],
    createdAt: manifest.createdAt,
    restoredAt: manifest.restoredAt || null,
    errorSummary: compactText(manifest.errorSummary || '', 300)
  });
}

module.exports = {
  BACKUP_MANIFESTS_KEY,
  BACKUP_SNAPSHOTS_KEY,
  BACKUP_VERSION,
  IMPORT_JOBS_KEY,
  MAX_BACKUPS,
  MAX_IMPORT_BYTES,
  MAX_RESTORE_LOGS,
  RESTORE_LOGS_KEY,
  SAFE_DATA_KEYS,
  buildItemCounts,
  checksum,
  compactText,
  containsSecretLike,
  countItems,
  createId,
  estimateBytes,
  filterByScope,
  getItemUserId,
  getItemWorkspaceId,
  itemMatchesScope,
  normalizeBackupStatus,
  normalizeBackupType,
  normalizeRestoreStatus,
  nowIso,
  sanitize,
  summarizeManifest
};
