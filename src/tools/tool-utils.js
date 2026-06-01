'use strict';

const crypto = require('crypto');
const dashboardGuards = require('../dashboard/dashboard-guards');
const workspace = require('../workspace');

const TOOL_REGISTRY_KEY = 'tool_registry';
const TOOL_RUNS_KEY = 'tool_runs';
const TOOL_AUDIT_KEY = 'tool_audit';
const RISK_LEVELS = ['low', 'medium', 'high', 'danger'];
const CATEGORIES = ['ai', 'planner', 'workflow', 'memory', 'goal', 'ops', 'report', 'search', 'weather', 'dashboard', 'graph', 'utility'];

const SECRET_VALUE_PATTERNS = [
  /\b(token|secret|password|api[_\s-]?key|authorization|credential|private\s+key)\b/i,
  /\b(database_url|redis_url|telegram_token|groq_api_key|mistral_api_key|openweather_api_key|tavily_api_key)\b/i,
  /\bpostgres(?:ql)?:\/\/[^:\s]+:[^@\s]+@/i,
  /\brediss?:\/\/[^:\s]+:[^@\s]+@/i,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}\b/i,
  /\b(?:sk|gsk|tvly|ghp|github_pat|xoxb|bot)[-_][A-Za-z0-9_-]{12,}\b/i
];

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix = 'tool') {
  if (crypto.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;
}

function compactText(value = '', max = 500) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function normalizeRiskLevel(value = 'low') {
  const risk = String(value || 'low').toLowerCase();
  return RISK_LEVELS.includes(risk) ? risk : 'low';
}

function normalizeCategory(value = 'utility') {
  const category = String(value || 'utility').toLowerCase();
  return CATEGORIES.includes(category) ? category : 'utility';
}

function normalizeSource(value = 'builtin') {
  const source = String(value || 'builtin').toLowerCase();
  return ['builtin', 'internal', 'plugin'].includes(source) ? source : 'builtin';
}

function normalizeToolId(value = '') {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_.:-]+/g, '.').replace(/\.+/g, '.').replace(/^\.+|\.+$/g, '').slice(0, 120);
}

function containsSecretLike(value = {}) {
  const raw = typeof value === 'string' ? value : JSON.stringify(value || {});
  return SECRET_VALUE_PATTERNS.some(pattern => pattern.test(raw)) || dashboardGuards.preventSecretLeak(raw) !== raw;
}

function sanitize(value) {
  return dashboardGuards.preventSecretLeak(value);
}

function parseToolInput(raw = '') {
  if (raw && typeof raw === 'object') return raw;
  const text = String(raw || '').trim();
  if (!text) return {};
  if ((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']'))) {
    try {
      return JSON.parse(text);
    } catch (_) {
      return { text };
    }
  }
  return { text, query: text, city: text };
}

function maxRiskLevel(levels = []) {
  return levels
    .map(level => RISK_LEVELS.indexOf(normalizeRiskLevel(level)))
    .reduce((max, index) => Math.max(max, index), 0);
}

function isWriteLikeTool(tool = {}) {
  const permissions = Array.isArray(tool.permissionsRequired) ? tool.permissionsRequired : [];
  if (permissions.includes('write') || permissions.includes('danger')) return true;
  return /update|add|done|block|archive|delete|write|create|mutate/i.test(`${tool.id} ${tool.actionType} ${tool.description}`);
}

async function resolveWorkspaceId(userId, workspaceId, services = {}) {
  const cleanWorkspaceId = String(workspaceId || '').trim();
  if (cleanWorkspaceId) return cleanWorkspaceId;
  try {
    const personal = await workspace.store.getDefaultWorkspaceForUser(userId, services);
    return personal?.id || workspace.utils.getPersonalWorkspaceId(userId);
  } catch (_) {
    return workspace.utils.getPersonalWorkspaceId(userId);
  }
}

function summarizeTool(tool = {}) {
  return sanitize({
    id: tool.id,
    name: tool.name,
    category: tool.category,
    source: tool.source,
    actionType: tool.actionType,
    riskLevel: tool.riskLevel,
    requiresApproval: tool.requiresApproval,
    enabled: tool.enabled,
    permissionsRequired: tool.permissionsRequired || []
  });
}

function summarizeRun(run = {}) {
  return sanitize({
    id: run.id,
    toolId: run.toolId,
    actionType: run.actionType,
    status: run.status,
    latencyMs: run.latencyMs,
    success: run.success,
    error: compactText(run.error || '', 200)
  });
}

module.exports = {
  CATEGORIES,
  RISK_LEVELS,
  SECRET_VALUE_PATTERNS,
  TOOL_AUDIT_KEY,
  TOOL_REGISTRY_KEY,
  TOOL_RUNS_KEY,
  compactText,
  containsSecretLike,
  createId,
  isWriteLikeTool,
  maxRiskLevel,
  normalizeCategory,
  normalizeRiskLevel,
  normalizeSource,
  normalizeToolId,
  nowIso,
  parseToolInput,
  resolveWorkspaceId,
  sanitize,
  summarizeRun,
  summarizeTool
};
