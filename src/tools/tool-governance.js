'use strict';

const workspace = require('../workspace');
const toolAudit = require('./tool-audit');
const utils = require('./tool-utils');

const rateBuckets = new Map();

function preventSecretLeakInToolInput(input = {}) {
  if (utils.containsSecretLike(input)) return { ok: false, error: 'SECRET_LIKE_TOOL_INPUT_REJECTED' };
  return { ok: true, value: utils.sanitize(input) };
}

function sanitizeToolOutput(output = {}) {
  return utils.sanitize(output);
}

function classifyToolRisk(tool = {}, input = {}, context = {}) {
  const levels = [tool.riskLevel || 'low', context.riskLevel || 'low'];
  if (utils.containsSecretLike(input)) levels.push('danger');
  if (utils.isWriteLikeTool(tool)) levels.push('medium');
  if (/delete|hard|shell|exec|code|env|config/i.test(`${tool.id} ${tool.actionType} ${tool.description}`)) levels.push('danger');
  return utils.RISK_LEVELS[utils.maxRiskLevel(levels)];
}

async function permissionSummary(actorId, workspaceId, services = {}) {
  try {
    return await workspace.permissions.getPermissionSummary(actorId, workspaceId, services);
  } catch (_) {
    return { role: 'none', permissions: [], canRead: false, canWrite: false, canDanger: false, canOps: false };
  }
}

async function checkToolPermission(tool = {}, actor = {}, workspaceId = '', services = {}) {
  const actorId = String(actor.actorId || actor.userId || services.actorId || '').trim();
  const userId = String(actor.userId || actorId || '').trim();
  const resolvedWorkspaceId = await utils.resolveWorkspaceId(userId || actorId, workspaceId, services);
  const summary = await permissionSummary(actorId, resolvedWorkspaceId, services);
  const permissions = Array.isArray(tool.permissionsRequired) ? tool.permissionsRequired : ['read'];
  const risk = utils.normalizeRiskLevel(tool.riskLevel || 'low');
  let allowed = false;
  let permission = permissions.includes('danger') || risk === 'danger'
    ? 'danger'
    : permissions.includes('write')
      ? 'write'
      : permissions.includes('ops')
        ? 'ops'
        : 'read';
  if (permission === 'read') {
    allowed = await workspace.permissions.canAccessUserData(actorId, userId || actorId, resolvedWorkspaceId, 'read', services);
  } else if (permission === 'danger') {
    allowed = ['owner', 'admin'].includes(summary.role);
  } else {
    allowed = await workspace.permissions.hasWorkspacePermission(actorId, resolvedWorkspaceId, permission, services);
  }
  return {
    ok: Boolean(allowed),
    actorId,
    userId: userId || actorId,
    workspaceId: resolvedWorkspaceId,
    actorRole: summary.role,
    permission,
    error: allowed ? null : 'TOOL_PERMISSION_DENIED'
  };
}

function doesToolRequireApproval(tool = {}, input = {}, context = {}) {
  const risk = classifyToolRisk(tool, input, context);
  if (tool.requiresApproval) return true;
  if (risk !== 'low') return true;
  if (utils.isWriteLikeTool(tool)) return true;
  return false;
}

function validateToolInput(tool = {}, input = {}) {
  const secret = preventSecretLeakInToolInput(input);
  if (!secret.ok) return secret;
  const schema = tool.inputSchema || {};
  const required = Array.isArray(schema.required) ? schema.required : [];
  for (const field of required) {
    if (typeof secret.value[field] === 'undefined' || secret.value[field] === '') {
      return { ok: false, error: `TOOL_INPUT_REQUIRED_${String(field).toUpperCase()}` };
    }
  }
  return { ok: true, value: secret.value };
}

function enforceToolRateLimit(tool = {}, actor = {}, services = {}) {
  const limit = tool.rateLimit || {};
  const max = Number(limit.max || 20);
  const windowMs = Number(limit.windowMs || 60000);
  const key = `${tool.id}:${actor.workspaceId || ''}:${actor.actorId || actor.userId || 'anon'}`;
  const now = Date.now();
  const existing = rateBuckets.get(key) || [];
  const recent = existing.filter(ts => now - ts < windowMs);
  if (recent.length >= max) {
    rateBuckets.set(key, recent);
    return { ok: false, error: 'TOOL_RATE_LIMITED' };
  }
  recent.push(now);
  rateBuckets.set(key, recent);
  return { ok: true, remaining: Math.max(0, max - recent.length) };
}

async function buildToolGovernanceDecision(tool = {}, input = {}, context = {}, services = {}) {
  const sanitized = validateToolInput(tool, input);
  if (!sanitized.ok) {
    return {
      allowed: false,
      requiresApproval: false,
      riskLevel: 'danger',
      reason: sanitized.error,
      permission: '',
      sanitizedInput: {},
      warnings: ['input rejected']
    };
  }
  const riskLevel = classifyToolRisk(tool, sanitized.value, context);
  const actor = {
    actorId: context.actorId || services.actorId || context.userId,
    userId: context.userId || services.actorId || context.actorId
  };
  const permission = await checkToolPermission({ ...tool, riskLevel }, actor, context.workspaceId, services);
  if (!permission.ok) {
    await toolAudit.recordToolAudit({
      action: 'tool/permission_denied',
      toolId: tool.id,
      actionType: tool.actionType,
      riskLevel,
      userId: permission.userId,
      workspaceId: permission.workspaceId,
      actorId: permission.actorId,
      actorRole: permission.actorRole,
      permission: permission.permission,
      decision: 'denied',
      status: 'denied',
      reason: permission.error
    }, services);
  }
  const rate = permission.ok ? enforceToolRateLimit(tool, permission, services) : { ok: true };
  if (!rate.ok) {
    await toolAudit.recordToolAudit({
      action: 'tool/rate_limited',
      toolId: tool.id,
      actionType: tool.actionType,
      riskLevel,
      userId: permission.userId,
      workspaceId: permission.workspaceId,
      actorId: permission.actorId,
      actorRole: permission.actorRole,
      permission: permission.permission,
      decision: 'denied',
      status: 'rate_limited',
      reason: rate.error
    }, services);
  }
  const requiresApproval = doesToolRequireApproval({ ...tool, riskLevel }, sanitized.value, context);
  return {
    allowed: Boolean(permission.ok && rate.ok && tool.enabled !== false),
    requiresApproval,
    riskLevel,
    reason: tool.enabled === false ? 'TOOL_DISABLED' : (!permission.ok ? permission.error : (!rate.ok ? rate.error : 'allowed')),
    permission: permission.permission,
    actorRole: permission.actorRole,
    actorId: permission.actorId,
    userId: permission.userId,
    workspaceId: permission.workspaceId,
    sanitizedInput: sanitized.value,
    warnings: requiresApproval ? ['approval required for this tool'] : []
  };
}

module.exports = {
  buildToolGovernanceDecision,
  checkToolPermission,
  classifyToolRisk,
  doesToolRequireApproval,
  enforceToolRateLimit,
  preventSecretLeakInToolInput,
  sanitizeToolOutput,
  validateToolInput
};
