'use strict';

const dashboardGuards = require('../dashboard/dashboard-guards');
const auditLog = require('../dashboard/audit-log');
const workspace = require('../workspace');
const utils = require('./executor-utils');

const SECRET_VALUE_PATTERNS = [
  /\b(token|secret|password|api[_\s-]?key|authorization|credential|private\s+key)\b/i,
  /\b(database_url|redis_url|telegram_token|groq_api_key|mistral_api_key|openweather_api_key|tavily_api_key)\b/i,
  /\bpostgres(?:ql)?:\/\/[^:\s]+:[^@\s]+@/i,
  /\brediss?:\/\/[^:\s]+:[^@\s]+@/i,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}\b/i,
  /\b(?:sk|gsk|tvly|ghp|github_pat|xoxb|bot)[-_][A-Za-z0-9_-]{12,}\b/i
];

function containsSecretLike(value = {}) {
  const raw = typeof value === 'string' ? value : JSON.stringify(value || {});
  return SECRET_VALUE_PATTERNS.some(pattern => pattern.test(raw)) || dashboardGuards.preventSecretLeak(raw) !== raw;
}

function sanitizeExecutionPayload(payload = {}) {
  const safe = dashboardGuards.preventSecretLeak(JSON.parse(JSON.stringify(payload || {})));
  return safe;
}

function preventSecretLeakInExecution(input = {}) {
  if (containsSecretLike(input)) return { ok: false, error: 'SECRET_LIKE_PAYLOAD_REJECTED' };
  return { ok: true, value: sanitizeExecutionPayload(input) };
}

function sanitizeExecutionResult(result = {}) {
  return dashboardGuards.preventSecretLeak(result);
}

function validateExecutionInput(input = {}) {
  const title = utils.compactText(input.title || '', 180);
  if (!title) return { ok: false, error: 'TITLE_REQUIRED' };
  const secret = preventSecretLeakInExecution(input);
  if (!secret.ok) return secret;
  return {
    ok: true,
    value: {
      title,
      description: utils.compactText(input.description || '', 1200),
      sourceType: utils.normalizeSourceType(input.sourceType || 'manual'),
      sourceId: utils.compactText(input.sourceId || '', 120)
    }
  };
}

function validateProposedAction(action = {}) {
  const secret = preventSecretLeakInExecution(action);
  if (!secret.ok) return secret;
  const type = utils.compactText(action.type || '', 120);
  if (!type) return { ok: false, error: 'ACTION_TYPE_REQUIRED' };
  return {
    ok: true,
    value: {
      id: action.id || utils.createId('act'),
      type,
      targetType: utils.compactText(action.targetType || '', 80),
      targetId: utils.compactText(action.targetId || action.payload?.taskId || action.payload?.goalId || action.payload?.workflowId || '', 120),
      workspaceId: utils.compactText(action.workspaceId || '', 120),
      userId: utils.compactText(action.userId || '', 80),
      description: utils.compactText(action.description || type, 500),
      payload: sanitizeExecutionPayload(action.payload || {}),
      riskLevel: utils.normalizeRiskLevel(action.riskLevel || 'medium'),
      requiresApproval: action.requiresApproval !== false,
      status: utils.normalizeActionStatus(action.status || 'pending_approval'),
      continueOnError: Boolean(action.continueOnError)
    }
  };
}

async function getPermissionSummary(actorId, workspaceId, services = {}) {
  try {
    return await workspace.permissions.getPermissionSummary(actorId, workspaceId, services);
  } catch (_) {
    return { role: 'none', permissions: [], canRead: false, canWrite: false, canDanger: false };
  }
}

function roleCanApproveRisk(role = '', riskLevel = 'low') {
  const normalizedRole = workspace.utils.normalizeRole(role);
  const risk = utils.normalizeRiskLevel(riskLevel);
  if (risk === 'danger') return ['owner', 'admin'].includes(normalizedRole);
  return ['owner', 'admin', 'editor'].includes(normalizedRole);
}

async function auditDenied(access = {}, services = {}) {
  try {
    await auditLog.recordAuditLog({
      actorType: access.actorType || 'executor',
      actorId: access.actorId,
      action: access.auditAction || 'executor/permission_denied',
      targetType: access.targetType || 'executor',
      targetId: access.targetId || '',
      userId: access.userId,
      workspaceId: access.workspaceId,
      actorRole: access.actorRole || '',
      permission: access.permission || '',
      decision: 'denied',
      status: 'denied',
      reason: access.reason || 'executor permission denied'
    }, services);
  } catch (_) {}
}

async function enforceExecutionPermission({ actorId, userId, workspaceId, permission = 'write', riskLevel = 'medium', action = 'executor/access', targetId = '' } = {}, services = {}) {
  const cleanActorId = String(actorId || userId || '').trim();
  const cleanUserId = String(userId || cleanActorId || '').trim();
  const resolvedWorkspaceId = await utils.resolveWorkspaceId(cleanUserId, workspaceId, services);
  const summary = await getPermissionSummary(cleanActorId, resolvedWorkspaceId, services);
  let allowed = false;
  if (permission === 'read') {
    allowed = await workspace.permissions.canAccessUserData(cleanActorId, cleanUserId, resolvedWorkspaceId, 'read', services);
  } else if (permission === 'approve') {
    allowed = roleCanApproveRisk(summary.role, riskLevel);
  } else if (riskLevel === 'danger') {
    allowed = ['owner', 'admin'].includes(summary.role);
  } else {
    allowed = await workspace.permissions.hasWorkspacePermission(cleanActorId, resolvedWorkspaceId, 'write', services);
  }
  const result = {
    ok: Boolean(allowed),
    actorId: cleanActorId,
    userId: cleanUserId,
    workspaceId: resolvedWorkspaceId,
    actorRole: summary.role,
    permission,
    riskLevel,
    action,
    targetId,
    error: allowed ? null : 'WORKSPACE_PERMISSION_DENIED'
  };
  if (!allowed) {
    await auditDenied({
      ...result,
      auditAction: 'executor/permission_denied',
      reason: `${permission} denied for ${action}`
    }, services);
  }
  return result;
}

async function enforceWorkspaceExecutionAccess(proposal = {}, services = {}, permission = 'read') {
  return enforceExecutionPermission({
    actorId: services.actorId || proposal.userId,
    userId: proposal.userId,
    workspaceId: proposal.workspaceId,
    permission,
    riskLevel: proposal.riskLevel,
    action: 'executor/workspace_access',
    targetId: proposal.id
  }, services);
}

function requireApprovalForRisk(riskLevel = 'low') {
  return ['low', 'medium', 'high', 'danger'].includes(utils.normalizeRiskLevel(riskLevel));
}

module.exports = {
  SECRET_VALUE_PATTERNS,
  containsSecretLike,
  enforceExecutionPermission,
  enforceWorkspaceExecutionAccess,
  preventSecretLeakInExecution,
  requireApprovalForRisk,
  roleCanApproveRisk,
  sanitizeExecutionPayload,
  sanitizeExecutionResult,
  validateExecutionInput,
  validateProposedAction
};
