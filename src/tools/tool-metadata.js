'use strict';

const utils = require('./tool-utils');

function normalizePermissions(list = []) {
  const values = Array.isArray(list) ? list : String(list || '').split(',');
  return Array.from(new Set(values.map(item => String(item || '').trim().toLowerCase()).filter(Boolean))).filter(item => (
    ['read', 'write', 'danger', 'ops', 'limited_read'].includes(item)
  ));
}

function normalizeSchema(schema = {}) {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return {};
  return utils.sanitize(schema);
}

function normalizeToolDefinition(tool = {}) {
  const now = utils.nowIso();
  const id = utils.normalizeToolId(tool.id || tool.actionType || tool.name);
  const riskLevel = utils.normalizeRiskLevel(tool.riskLevel || 'low');
  const permissionsRequired = normalizePermissions(tool.permissionsRequired || (riskLevel === 'low' ? ['read'] : ['write']));
  return {
    id,
    name: utils.compactText(tool.name || id, 120),
    description: utils.compactText(tool.description || id, 700),
    category: utils.normalizeCategory(tool.category || 'utility'),
    version: utils.compactText(tool.version || '1.0.0', 40),
    enabled: tool.enabled !== false,
    unavailableReason: utils.compactText(tool.unavailableReason || '', 180),
    source: utils.normalizeSource(tool.source || 'builtin'),
    actionType: utils.compactText(tool.actionType || id, 120),
    riskLevel,
    permissionsRequired,
    requiresApproval: typeof tool.requiresApproval === 'boolean' ? tool.requiresApproval : riskLevel !== 'low' || permissionsRequired.includes('write') || permissionsRequired.includes('danger'),
    workspaceAware: tool.workspaceAware !== false,
    inputSchema: normalizeSchema(tool.inputSchema),
    outputSchema: normalizeSchema(tool.outputSchema),
    rateLimit: {
      windowMs: Number(tool.rateLimit?.windowMs || 60000),
      max: Number(tool.rateLimit?.max || 20)
    },
    timeoutMs: Math.min(Math.max(Number(tool.timeoutMs || 10000), 500), 30000),
    createdAt: tool.createdAt || now,
    updatedAt: tool.updatedAt || now
  };
}

function validateToolDefinition(tool = {}) {
  if (utils.containsSecretLike(tool)) return { ok: false, error: 'SECRET_LIKE_TOOL_METADATA_REJECTED' };
  if (!tool.id) return { ok: false, error: 'TOOL_ID_REQUIRED' };
  const normalized = normalizeToolDefinition(tool);
  if (!normalized.id) return { ok: false, error: 'TOOL_ID_REQUIRED' };
  if (!/^[a-z0-9_.:-]+$/.test(normalized.id)) return { ok: false, error: 'INVALID_TOOL_ID' };
  if (!normalized.name) return { ok: false, error: 'TOOL_NAME_REQUIRED' };
  if (!utils.CATEGORIES.includes(normalized.category)) return { ok: false, error: 'INVALID_TOOL_CATEGORY' };
  if (!utils.RISK_LEVELS.includes(normalized.riskLevel)) return { ok: false, error: 'INVALID_TOOL_RISK' };
  if (normalized.source === 'plugin') return { ok: false, error: 'PLUGIN_SOURCE_DISABLED_IN_PHASE_17' };
  return { ok: true, tool: normalized };
}

module.exports = {
  normalizePermissions,
  normalizeToolDefinition,
  validateToolDefinition
};
