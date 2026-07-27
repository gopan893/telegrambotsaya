'use strict';

const VALID_NODE_TYPES = [
  'project', 'phase', 'task', 'decision', 'incident', 'deploy', 'rollback',
  'proposal', 'agent', 'file', 'doc', 'environment', 'command', 'risk',
  'test', 'bug', 'feature', 'integration', 'cost', 'memory'
];

const VALID_EDGE_RELATIONS = [
  'depends_on', 'caused_by', 'fixed_by', 'relates_to', 'supersedes',
  'blocked_by', 'approved_by', 'proposed_by', 'implemented_in',
  'documented_in', 'tested_by', 'owned_by', 'affects', 'requires',
  'conflicts_with'
];

const VALID_SCOPES = [
  'temporary_chat', 'project_memory', 'agent_memory', 'decision_memory',
  'incident_memory', 'deployment_memory', 'portfolio_memory', 'documentation_memory'
];

const VALID_SENSITIVITY = ['public', 'internal', 'confidential', 'secret'];
const VALID_RETENTION = ['ignore', 'temporary', 'active', 'archive', 'blocked'];
const VALID_STATUS = ['active', 'archived', 'stale', 'blocked'];

const SECRET_PATTERNS = [
  /token\s*[:=]\s*\S+/gi,
  /secret\s*[:=]\s*\S+/gi,
  /password\s*[:=]\s*\S+/gi,
  /api[_-]?key\s*[:=]\s*\S+/gi,
  /Authorization\s*[:=]\s*\S+/gi,
  /Bearer\s+\S+/gi,
  /DATABASE_URL\s*[:=]\s*\S+/gi,
  /REDIS_URL\s*[:=]\s*\S+/gi,
  /postgresql:\/\/\S+/gi,
  /rediss:\/\/\S+/gi,
  /sk-[A-Za-z0-9_\-]+/g,
  /ghp_[A-Za-z0-9]+/g,
  /github_pat_[A-Za-z0-9_]+/g,
  /gsk_[A-Za-z0-9]+/g,
  /tvly_[A-Za-z0-9]+/g,
  /TELEGRAM_TOKEN\s*[:=]\s*\S+/gi,
  /GITHUB_TOKEN\s*[:=]\s*\S+/gi,
  /GOOGLE_CLIENT_SECRET\s*[:=]\s*\S+/gi,
  /CLOUDFLARE_API_TOKEN\s*[:=]\s*\S+/gi,
  /RENDER_DEPLOY_HOOK\s*[:=]\s*\S+/gi,
  /xox[baprs]-[A-Za-z0-9-]+/g
];

const SECRET_NAMES = [
  'token', 'secret', 'password', 'api_key', 'apikey',
  'authorization', 'bearer', 'database_url', 'redis_url',
  'telegram_token', 'github_token', 'google_client_secret',
  'cloudflare_api_token', 'render_deploy_hook'
];

const REDACTION_PLACEHOLDER = '[REDACTED_SECRET]';

const PROTECTED_DECISION_TITLES = [
  'Use Node.js 20',
  'Use CommonJS',
  'Use vanilla dashboard',
  'No TypeScript',
  'No React/Next/Vue',
  'Approval required for write/external/danger',
  'GitHub push requires proposal and approval',
  'Render deploy/rollback requires proposal and approval',
  'Gmail send disabled unless strict approval',
  'Optional env must not crash app',
  'Dashboard known tabs must not fallback to Overview',
  'Secrets must not be logged or stored',
  'No shell executor',
  'No autonomous repo mutation',
  'No hard delete memory without archive'
];

function nowIso() {
  return new Date().toISOString();
}

function safeStr(value, max = 500) {
  if (value === undefined || value === null) return '';
  const s = String(value);
  if (s.length <= max) return s;
  return s.slice(0, max) + '...';
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function isValidNodeType(t) {
  return VALID_NODE_TYPES.includes(String(t || ''));
}

function isValidRelation(r) {
  return VALID_EDGE_RELATIONS.includes(String(r || ''));
}

function isValidScope(s) {
  return VALID_SCOPES.includes(String(s || ''));
}

function isValidSensitivity(s) {
  return VALID_SENSITIVITY.includes(String(s || ''));
}

function isValidRetention(r) {
  return VALID_RETENTION.includes(String(r || ''));
}

function sanitizeString(input) {
  if (input === undefined || input === null) return '';
  let s = String(input);
  for (const pat of SECRET_PATTERNS) {
    s = s.replace(pat, REDACTION_PLACEHOLDER);
  }
  return s;
}

function detectSecretInText(text) {
  if (!text || typeof text !== 'string') return { found: false, matches: [] };
  const matches = [];
  for (const pat of SECRET_PATTERNS) {
    pat.lastIndex = 0;
    const m = text.match(pat);
    if (m) matches.push(...m);
  }
  if (matches.length) return { found: true, matches: Array.from(new Set(matches)).slice(0, 20) };
  return { found: false, matches: [] };
}

function detectSecretInObject(obj, depth = 0) {
  if (depth > 4 || !obj || typeof obj !== 'object') return { found: false, matches: [] };
  const allMatches = [];
  for (const [k, v] of Object.entries(obj)) {
    const keyLower = String(k).toLowerCase();
    if (SECRET_NAMES.some(n => keyLower.includes(n))) {
      if (v !== undefined && v !== null && v !== '' && String(v).length > 0) {
        allMatches.push(`key:${k}`);
      }
    }
    if (typeof v === 'string') {
      const r = detectSecretInText(v);
      if (r.found) allMatches.push(...r.matches);
    } else if (typeof v === 'object' && v !== null) {
      const r = detectSecretInObject(v, depth + 1);
      if (r.found) allMatches.push(...r.matches);
    }
  }
  if (allMatches.length) return { found: true, matches: Array.from(new Set(allMatches)).slice(0, 20) };
  return { found: false, matches: [] };
}

function redactObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const safe = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) {
    const keyLower = String(k).toLowerCase();
    if (SECRET_NAMES.some(n => keyLower.includes(n))) {
      safe[k] = REDACTION_PLACEHOLDER;
    } else if (typeof v === 'string') {
      safe[k] = sanitizeString(v);
    } else if (typeof v === 'object' && v !== null) {
      safe[k] = redactObject(v);
    } else {
      safe[k] = v;
    }
  }
  return safe;
}

function isProtectedDecisionTitle(title) {
  if (!title) return false;
  const lower = String(title).toLowerCase();
  return PROTECTED_DECISION_TITLES.some(t => lower.includes(t.toLowerCase()));
}

function clampLimit(limit, def, max) {
  const n = parseInt(limit, 10);
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.min(n, max);
}

function safeId(prefix, counter) {
  return `${prefix}_${Date.now()}_${counter}`;
}

function matchesQuery(text, query) {
  if (!query) return true;
  if (!text) return false;
  return String(text).toLowerCase().includes(String(query).toLowerCase());
}

function intersectIds(...lists) {
  if (!lists.length) return [];
  const [first, ...rest] = lists;
  return first.filter(x => rest.every(l => l.includes(x)));
}

module.exports = {
  VALID_NODE_TYPES,
  VALID_EDGE_RELATIONS,
  VALID_SCOPES,
  VALID_SENSITIVITY,
  VALID_RETENTION,
  VALID_STATUS,
  SECRET_PATTERNS,
  SECRET_NAMES,
  REDACTION_PLACEHOLDER,
  PROTECTED_DECISION_TITLES,
  nowIso,
  safeStr,
  safeArray,
  isValidNodeType,
  isValidRelation,
  isValidScope,
  isValidSensitivity,
  isValidRetention,
  sanitizeString,
  detectSecretInText,
  detectSecretInObject,
  redactObject,
  isProtectedDecisionTitle,
  clampLimit,
  safeId,
  matchesQuery,
  intersectIds
};
