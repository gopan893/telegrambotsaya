'use strict';

const dashboardGuards = require('../dashboard/dashboard-guards');
const workspace = require('../workspace');
const utils = require('./planner-utils');

function sanitizePlannerText(text = '', max = 1000) {
  return utils.compactText(text, max);
}

function hasSecretLikePayload(value) {
  const raw = typeof value === 'string' ? value : JSON.stringify(value || {});
  const clean = dashboardGuards.preventSecretLeak(raw);
  return clean !== raw || dashboardGuards.SECRET_PATTERNS.some(pattern => pattern.test(raw));
}

function preventSecretLeakInPlanner(input = {}) {
  if (hasSecretLikePayload(input)) {
    return { ok: false, error: 'SECRET_LIKE_PAYLOAD_REJECTED' };
  }
  return { ok: true, value: dashboardGuards.preventSecretLeak(input) };
}

function validatePlanInput(input = {}, options = {}) {
  const title = sanitizePlannerText(input.title, 160);
  if (!title) return { ok: false, error: 'PLAN_TITLE_REQUIRED' };
  if (title.length > 160) return { ok: false, error: 'PLAN_TITLE_TOO_LONG' };
  const secret = preventSecretLeakInPlanner(input);
  if (!secret.ok) return secret;
  return {
    ok: true,
    value: {
      title,
      description: sanitizePlannerText(input.description || '', 1200),
      horizon: utils.normalizeHorizon(input.horizon || options.horizon || 'weekly'),
      status: utils.normalizePlanStatus(input.status || 'draft'),
      linkedGoalIds: utils.uniqueList(input.linkedGoalIds || input.linkedGoals || [], 20),
      linkedWorkflowIds: utils.uniqueList(input.linkedWorkflowIds || input.linkedWorkflows || [], 20),
      assumptions: utils.uniqueList(input.assumptions || [], 20),
      risks: utils.uniqueList(input.risks || [], 20)
    }
  };
}

function validateTaskInput(input = {}, options = {}) {
  const title = sanitizePlannerText(input.title, 180);
  if (!title) return { ok: false, error: 'TASK_TITLE_REQUIRED' };
  const secret = preventSecretLeakInPlanner(input);
  if (!secret.ok) return secret;
  return {
    ok: true,
    value: {
      title,
      description: sanitizePlannerText(input.description || '', 1200),
      status: utils.normalizeTaskStatus(input.status || 'todo'),
      priority: utils.normalizePriority(input.priority || options.priority || 'medium'),
      effort: utils.normalizeEffort(input.effort || 'medium'),
      impact: utils.normalizeImpactUrgency(input.impact || 'medium'),
      urgency: utils.normalizeImpactUrgency(input.urgency || 'medium'),
      dependencies: utils.uniqueList(input.dependencies || [], 30),
      linkedGoalId: sanitizePlannerText(input.linkedGoalId || input.goalId || '', 120),
      linkedWorkflowId: sanitizePlannerText(input.linkedWorkflowId || input.workflowId || '', 120),
      dueDate: utils.normalizeDate(input.dueDate || input.due_date || null)
    }
  };
}

function validatePriority(priority) {
  return utils.normalizePriority(priority);
}

function validateStatus(status, type = 'task') {
  return type === 'plan' ? utils.normalizePlanStatus(status) : utils.normalizeTaskStatus(status);
}

async function enforcePlannerPermission({ actorId, userId, workspaceId, permission = 'read', action = 'planner/access' } = {}, services = {}) {
  const cleanActorId = String(actorId || userId || '').trim();
  const cleanUserId = String(userId || cleanActorId || '').trim();
  const resolvedWorkspaceId = await utils.resolveWorkspaceId(cleanUserId, workspaceId, services);
  const actorRole = await utils.getActorRole(cleanActorId, resolvedWorkspaceId, services);
  let allowed = false;
  try {
    if (permission === 'read') {
      allowed = await workspace.permissions.canAccessUserData(cleanActorId, cleanUserId, resolvedWorkspaceId, 'read', services);
    } else {
      allowed = await workspace.permissions.hasWorkspacePermission(cleanActorId, resolvedWorkspaceId, permission, services);
    }
  } catch (_) {
    allowed = false;
  }
  const result = {
    ok: Boolean(allowed),
    actorId: cleanActorId,
    userId: cleanUserId,
    workspaceId: resolvedWorkspaceId,
    actorRole,
    permission,
    action,
    error: allowed ? null : 'WORKSPACE_PERMISSION_DENIED'
  };
  if (!allowed) {
    await auditDeniedPermission(result, services);
  }
  return result;
}

async function auditDeniedPermission(result = {}, services = {}) {
  try {
    const auditLog = require('../dashboard/audit-log');
    await auditLog.recordAuditLog({
      actorType: 'planner',
      actorId: result.actorId,
      action: `planner/permission_denied/${result.permission || 'read'}`,
      targetType: 'planner',
      targetId: result.action || '',
      userId: result.userId,
      workspaceId: result.workspaceId,
      actorRole: result.actorRole,
      permission: result.permission,
      decision: 'denied',
      status: 'denied',
      reason: 'workspace planner permission denied'
    }, services);
  } catch (_) {}
}

function assertSameWorkspace(item = {}, workspaceId = '') {
  const itemWorkspaceId = item.workspaceId || item.workspace_id || item.metadata?.workspaceId || '';
  return !workspaceId || !itemWorkspaceId || itemWorkspaceId === workspaceId;
}

module.exports = {
  assertSameWorkspace,
  enforcePlannerPermission,
  preventSecretLeakInPlanner,
  sanitizePlannerText,
  validatePlanInput,
  validatePriority,
  validateStatus,
  validateTaskInput
};
