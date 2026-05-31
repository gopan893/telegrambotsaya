'use strict';

const guards = require('./dashboard-guards');
const auditLog = require('./audit-log');
const softDelete = require('./soft-delete');
const workspace = require('../workspace');

const ACTION_CONFIRM_WORDS = {
  'memory/archive': 'ARCHIVE',
  'memory/restore': 'RESTORE',
  'goal/archive': 'ARCHIVE',
  'goal/restore': 'RESTORE',
  'workflow/archive': 'ARCHIVE',
  'workflow/restore': 'RESTORE'
};

const VALID_GOAL_STATUS = new Set(['active', 'paused', 'completed', 'archived', 'cancelled']);
const VALID_PRIORITY = new Set(['low', 'medium', 'high', 'critical']);

function buildActionResult(action, status, result = null, warnings = []) {
  return guards.preventSecretLeak({
    ok: status === 'ok',
    action,
    status,
    result,
    warnings,
    timestamp: new Date().toISOString()
  });
}

function sanitizeActionPayload(payload = {}) {
  return guards.preventSecretLeak(JSON.parse(JSON.stringify(payload || {})));
}

function rejectSecretLikePayload(payload = {}) {
  const text = JSON.stringify(payload || {});
  const masked = guards.preventSecretLeak(text);
  return masked !== text || masked === '[redacted]';
}

function requireDoubleConfirm(payload = {}, expectedWord = '') {
  if (!expectedWord) return { ok: true };
  const confirmed = payload.confirm === true || payload.confirm === 'true';
  const text = String(payload.confirmationText || '').trim();
  if (!confirmed || text !== expectedWord) {
    return { ok: false, error: 'DOUBLE_CONFIRM_REQUIRED', expectedWord };
  }
  return { ok: true };
}

function validateSafeAction(action, payload = {}) {
  if (!action) return { ok: false, error: 'ACTION_REQUIRED' };
  const userId = guards.validateUserId(payload.userId);
  if (!userId) return { ok: false, error: 'INVALID_USER_ID' };
  if (rejectSecretLikePayload(payload)) return { ok: false, error: 'SECRET_LIKE_PAYLOAD_REJECTED' };
  const expectedWord = ACTION_CONFIRM_WORDS[action];
  const confirm = requireDoubleConfirm(payload, expectedWord);
  if (!confirm.ok) return confirm;
  return { ok: true, userId };
}

function actionPermission(action) {
  if (/archive|restore/.test(String(action))) return 'danger';
  return 'write';
}

async function prepareWorkspaceAction(action, payload, context, services) {
  const base = validateSafeAction(action, payload);
  if (!base.ok) return base;
  const targetWorkspace = payload.workspaceId
    ? await workspace.store.getWorkspace(payload.workspaceId, services)
    : await workspace.store.getDefaultWorkspaceForUser(base.userId, services);
  if (!targetWorkspace) return { ok: false, error: 'WORKSPACE_NOT_FOUND' };
  const actorId = String(context.actorId || base.userId || '').trim();
  const permission = actionPermission(action);
  const allowed = await workspace.permissions.hasWorkspacePermission(actorId, targetWorkspace.id, permission, services);
  const actorRole = await workspace.permissions.getUserRole(targetWorkspace.id, actorId, services);
  if (!allowed) {
    await record(action, { ...payload, userId: base.userId, workspaceId: targetWorkspace.id }, null, null, 'denied', { ...context, actorRole, permission, decision: 'denied' }, services);
    return { ok: false, error: 'WORKSPACE_PERMISSION_DENIED', userId: base.userId, workspaceId: targetWorkspace.id, actorRole, permission };
  }
  return { ok: true, userId: base.userId, workspaceId: targetWorkspace.id, actorRole, permission };
}

function getRepos(services = {}) {
  try {
    return services.storageManager?.getRepositories?.() || services.repositories || null;
  } catch (_) {
    return services.repositories || null;
  }
}

function getPool(services = {}) {
  try {
    return services.storageManager?.getStore?.()?.getPool?.() || null;
  } catch (_) {
    return null;
  }
}

async function readJsonArray(services, key) {
  const value = await services.storageManager?.safeRead?.(key, []);
  return Array.isArray(value) ? value : [];
}

async function writeJsonArray(services, key, items) {
  if (services.storageManager?.safeWrite) return services.storageManager.safeWrite(key, items);
  return false;
}

function summarize(item = {}) {
  if (!item || typeof item !== 'object') return {};
  return guards.sanitizeBeforeAfterSummary({
    id: item.id,
    title: item.title,
    type: item.type,
    status: item.status,
    progress: item.progress,
    content: item.content,
    deletedAt: item.deletedAt || item.deleted_at,
    archivedAt: item.archivedAt
  });
}

function actorFromContext(context = {}) {
  return {
    actorType: 'dashboard',
    actorId: context.actorId || 'admin',
    ip: context.ip || '',
    userAgent: context.userAgent || ''
  };
}

async function record(action, payload, before, after, status, context, services) {
  return auditLog.recordAuditLog({
    ...actorFromContext(context),
    action,
    targetType: action.split('/')[0],
    targetId: payload.memoryId || payload.goalId || payload.workflowId || payload.stepId || '',
    userId: payload.userId,
    workspaceId: payload.workspaceId || context.workspaceId || '',
    actorRole: context.actorRole || '',
    permission: context.permission || '',
    decision: context.decision || (status === 'denied' ? 'denied' : 'allowed'),
    status,
    beforeSummary: summarize(before),
    afterSummary: summarize(after),
    reason: payload.reason || ''
  }, services);
}

function pick(input = {}, fields = []) {
  const out = {};
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(input, field)) out[field] = input[field];
  }
  return out;
}

function validateMemoryPatch(payload = {}) {
  const patch = pick(payload, ['content', 'type', 'tags', 'importance', 'confidence']);
  if (patch.content !== undefined) {
    const valid = guards.validateTextLength(patch.content, 4000, 'content');
    if (!valid.ok) return valid;
    patch.content = valid.value;
  }
  if (patch.tags !== undefined) {
    const valid = guards.validateTags(patch.tags, 12, 40);
    if (!valid.ok) return valid;
    patch.tags = valid.value;
  }
  for (const field of ['importance', 'confidence']) {
    if (patch[field] !== undefined) {
      const valid = guards.validateNumberRange(patch[field], 0, 1, field);
      if (!valid.ok) return valid;
      patch[field] = valid.value;
    }
  }
  return { ok: true, patch };
}

function validateGoalPatch(payload = {}) {
  const patch = pick(payload, ['title', 'description', 'status', 'priority', 'progress', 'targetDate', 'milestones']);
  if (patch.title !== undefined) {
    const valid = guards.validateTextLength(patch.title, 240, 'title');
    if (!valid.ok) return valid;
    patch.title = valid.value;
  }
  if (patch.description !== undefined) patch.description = String(patch.description || '').slice(0, 1200);
  if (patch.status !== undefined && !VALID_GOAL_STATUS.has(String(patch.status))) return { ok: false, error: 'INVALID_STATUS' };
  if (patch.priority !== undefined && !VALID_PRIORITY.has(String(patch.priority))) return { ok: false, error: 'INVALID_PRIORITY' };
  if (patch.progress !== undefined) {
    const valid = guards.validateNumberRange(patch.progress, 0, 100, 'progress');
    if (!valid.ok) return valid;
    patch.progress = valid.value;
  }
  if (patch.milestones !== undefined) {
    patch.metadata = { milestones: Array.isArray(patch.milestones) ? patch.milestones.slice(0, 20) : [] };
    delete patch.milestones;
  }
  return { ok: true, patch };
}

async function updateJsonItem(services, key, userId, id, patch, idField = 'id') {
  const items = await readJsonArray(services, key);
  const index = items.findIndex(item => String(item.userId || item.user_id) === String(userId) && String(item[idField]) === String(id));
  if (index < 0) return null;
  const before = items[index];
  const after = { ...before, ...patch, updatedAt: new Date().toISOString() };
  items[index] = after;
  await writeJsonArray(services, key, items);
  return { before, after };
}

async function updateMemory(payload, context, services) {
  const base = await prepareWorkspaceAction('memory/update', payload, context, services);
  if (!base.ok) return buildActionResult('memory/update', 'rejected', null, [base.error]);
  const memoryId = guards.validateId(payload.memoryId);
  if (!memoryId) return buildActionResult('memory/update', 'rejected', null, ['INVALID_MEMORY_ID']);
  const valid = validateMemoryPatch(payload);
  if (!valid.ok) return buildActionResult('memory/update', 'rejected', null, [valid.error]);
  const repos = getRepos(services);
  const before = await repos?.memories?.getMemoryById?.(base.userId, memoryId);
  if (before && workspace.utils.getWorkspaceIdFromData(before, workspace.utils.getPersonalWorkspaceId(base.userId)) !== base.workspaceId) {
    return buildActionResult('memory/update', 'not_found', null, ['MEMORY_NOT_FOUND']);
  }
  valid.patch.metadata = { ...(before?.metadata || {}), ...(valid.patch.metadata || {}), workspaceId: base.workspaceId };
  let after = repos?.memories?.updateMemory
    ? await repos.memories.updateMemory(base.userId, memoryId, valid.patch)
    : null;
  if (!after) {
    const json = await updateJsonItem(services, 'rel_memories', base.userId, memoryId, valid.patch);
    after = json?.after || null;
  }
  if (!after) return buildActionResult('memory/update', 'not_found', null, ['MEMORY_NOT_FOUND']);
  await record('memory/update', { ...payload, workspaceId: base.workspaceId }, before, after, 'ok', { ...context, actorRole: base.actorRole, permission: base.permission }, services);
  return buildActionResult('memory/update', 'ok', { memory: after });
}

async function archiveMemory(payload, context, services) {
  const base = await prepareWorkspaceAction('memory/archive', payload, context, services);
  if (!base.ok) return buildActionResult('memory/archive', 'rejected', null, [base.error]);
  const memoryId = guards.validateId(payload.memoryId);
  if (!memoryId) return buildActionResult('memory/archive', 'rejected', null, ['INVALID_MEMORY_ID']);
  const repos = getRepos(services);
  const before = await repos?.memories?.getMemoryById?.(base.userId, memoryId);
  if (before && workspace.utils.getWorkspaceIdFromData(before, workspace.utils.getPersonalWorkspaceId(base.userId)) !== base.workspaceId) {
    return buildActionResult('memory/archive', 'not_found', null, ['MEMORY_NOT_FOUND']);
  }
  let after = null;
  const pool = getPool(services);
  if (pool) {
    const result = await pool.query(
      `UPDATE memories SET deleted_at = NOW(), updated_at = NOW(), metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb
       WHERE user_id = $1 AND id = $2 RETURNING *`,
      [base.userId, memoryId, JSON.stringify({ archivedBy: context.actorId || 'dashboard-admin', archiveReason: payload.reason || '', workspaceId: base.workspaceId })]
    );
    after = result.rows?.[0] || null;
  } else if (repos?.memories?.softDeleteMemory) {
    const deleted = await repos.memories.softDeleteMemory(base.userId, memoryId);
    after = deleted?.ok && before
      ? softDelete.applySoftDelete(before, { reason: payload.reason, actorId: context.actorId })
      : null;
  } else {
    const json = await updateJsonItem(services, 'rel_memories', base.userId, memoryId, softDelete.applySoftDelete({}, { reason: payload.reason, actorId: context.actorId }));
    after = json?.after || null;
  }
  if (!after) return buildActionResult('memory/archive', 'not_found', null, ['MEMORY_NOT_FOUND']);
  await record('memory/archive', { ...payload, workspaceId: base.workspaceId }, before, after, 'ok', { ...context, actorRole: base.actorRole, permission: base.permission }, services);
  return buildActionResult('memory/archive', 'ok', { memory: after });
}

async function restoreMemory(payload, context, services) {
  const base = await prepareWorkspaceAction('memory/restore', payload, context, services);
  if (!base.ok) return buildActionResult('memory/restore', 'rejected', null, [base.error]);
  const memoryId = guards.validateId(payload.memoryId);
  if (!memoryId) return buildActionResult('memory/restore', 'rejected', null, ['INVALID_MEMORY_ID']);
  let after = null;
  const pool = getPool(services);
  if (pool) {
    const result = await pool.query(
      `UPDATE memories SET deleted_at = NULL, updated_at = NOW(), metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb
       WHERE user_id = $1 AND id = $2 RETURNING *`,
      [base.userId, memoryId, JSON.stringify({ restoredBy: context.actorId || 'dashboard-admin', workspaceId: base.workspaceId })]
    );
    after = result.rows?.[0] || null;
  } else {
    const json = await updateJsonItem(services, 'rel_memories', base.userId, memoryId, { deletedAt: null, restoredAt: new Date().toISOString(), restoredBy: context.actorId || 'dashboard-admin', metadata: { workspaceId: base.workspaceId } });
    after = json?.after || null;
  }
  if (!after) return buildActionResult('memory/restore', 'not_found', null, ['MEMORY_NOT_FOUND']);
  await record('memory/restore', { ...payload, workspaceId: base.workspaceId }, { id: memoryId }, after, 'ok', { ...context, actorRole: base.actorRole, permission: base.permission }, services);
  return buildActionResult('memory/restore', 'ok', { memory: after });
}

async function updateGoal(payload, context, services) {
  const base = await prepareWorkspaceAction('goal/update', payload, context, services);
  if (!base.ok) return buildActionResult('goal/update', 'rejected', null, [base.error]);
  const goalId = guards.validateId(payload.goalId);
  if (!goalId) return buildActionResult('goal/update', 'rejected', null, ['INVALID_GOAL_ID']);
  const valid = validateGoalPatch(payload);
  if (!valid.ok) return buildActionResult('goal/update', 'rejected', null, [valid.error]);
  const repos = getRepos(services);
  const before = await repos?.goals?.getGoalById?.(base.userId, goalId);
  if (before && workspace.utils.getWorkspaceIdFromData(before, workspace.utils.getPersonalWorkspaceId(base.userId)) !== base.workspaceId) {
    return buildActionResult('goal/update', 'not_found', null, ['GOAL_NOT_FOUND']);
  }
  valid.patch.metadata = { ...(before?.metadata || {}), ...(valid.patch.metadata || {}), workspaceId: base.workspaceId };
  let after = repos?.goals?.updateGoal ? await repos.goals.updateGoal(base.userId, goalId, valid.patch) : null;
  if (!after) {
    const json = await updateJsonItem(services, 'rel_goals', base.userId, goalId, valid.patch);
    after = json?.after || null;
  }
  if (!after) return buildActionResult('goal/update', 'not_found', null, ['GOAL_NOT_FOUND']);
  await record('goal/update', { ...payload, workspaceId: base.workspaceId }, before, after, 'ok', { ...context, actorRole: base.actorRole, permission: base.permission }, services);
  return buildActionResult('goal/update', 'ok', { goal: after });
}

async function archiveGoal(payload, context, services) {
  return archiveEntity('goal/archive', 'goals', 'rel_goals', 'goalId', payload, context, services);
}

async function restoreGoal(payload, context, services) {
  return restoreEntity('goal/restore', 'goals', 'rel_goals', 'goalId', payload, context, services);
}

async function archiveWorkflow(payload, context, services) {
  return archiveEntity('workflow/archive', 'workflows', 'rel_workflows', 'workflowId', payload, context, services);
}

async function restoreWorkflow(payload, context, services) {
  return restoreEntity('workflow/restore', 'workflows', 'rel_workflows', 'workflowId', payload, context, services);
}

async function archiveEntity(action, repoName, jsonKey, idKey, payload, context, services) {
  const base = await prepareWorkspaceAction(action, payload, context, services);
  if (!base.ok) return buildActionResult(action, 'rejected', null, [base.error]);
  const id = guards.validateId(payload[idKey]);
  if (!id) return buildActionResult(action, 'rejected', null, [`INVALID_${idKey.toUpperCase()}`]);
  const pool = getPool(services);
  let after = null;
  if (pool) {
    const table = repoName === 'goals' ? 'goals' : 'workflows';
    const result = await pool.query(
      `UPDATE ${table} SET deleted_at = NOW(), status = 'archived', updated_at = NOW(), metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb
       WHERE user_id = $1 AND id = $2 RETURNING *`,
      [base.userId, id, JSON.stringify({ archivedBy: context.actorId || 'dashboard-admin', archiveReason: payload.reason || '', workspaceId: base.workspaceId })]
    );
    after = result.rows?.[0] || null;
  } else {
    const json = await updateJsonItem(services, jsonKey, base.userId, id, softDelete.applySoftDelete({}, { reason: payload.reason, actorId: context.actorId }));
    after = json?.after || null;
  }
  if (!after) return buildActionResult(action, 'not_found', null, ['TARGET_NOT_FOUND']);
  await record(action, { ...payload, [idKey]: id, workspaceId: base.workspaceId }, { id }, after, 'ok', { ...context, actorRole: base.actorRole, permission: base.permission }, services);
  return buildActionResult(action, 'ok', { [repoName.slice(0, -1)]: after });
}

async function restoreEntity(action, repoName, jsonKey, idKey, payload, context, services) {
  const base = await prepareWorkspaceAction(action, payload, context, services);
  if (!base.ok) return buildActionResult(action, 'rejected', null, [base.error]);
  const id = guards.validateId(payload[idKey]);
  if (!id) return buildActionResult(action, 'rejected', null, [`INVALID_${idKey.toUpperCase()}`]);
  const pool = getPool(services);
  let after = null;
  if (pool) {
    const table = repoName === 'goals' ? 'goals' : 'workflows';
    const result = await pool.query(
      `UPDATE ${table} SET deleted_at = NULL, status = CASE WHEN status = 'archived' THEN 'active' ELSE status END, updated_at = NOW(), metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb
       WHERE user_id = $1 AND id = $2 RETURNING *`,
      [base.userId, id, JSON.stringify({ restoredBy: context.actorId || 'dashboard-admin', workspaceId: base.workspaceId })]
    );
    after = result.rows?.[0] || null;
  } else {
    const json = await updateJsonItem(services, jsonKey, base.userId, id, { deletedAt: null, archivedAt: null, status: 'active', restoredAt: new Date().toISOString(), restoredBy: context.actorId || 'dashboard-admin', metadata: { workspaceId: base.workspaceId } });
    after = json?.after || null;
  }
  if (!after) return buildActionResult(action, 'not_found', null, ['TARGET_NOT_FOUND']);
  await record(action, { ...payload, [idKey]: id, workspaceId: base.workspaceId }, { id }, after, 'ok', { ...context, actorRole: base.actorRole, permission: base.permission }, services);
  return buildActionResult(action, 'ok', { [repoName.slice(0, -1)]: after });
}

async function addWorkflowStep(payload, context, services) {
  const base = await prepareWorkspaceAction('workflow/step/add', payload, context, services);
  if (!base.ok) return buildActionResult('workflow/step/add', 'rejected', null, [base.error]);
  const workflowId = guards.validateId(payload.workflowId);
  const validText = guards.validateTextLength(payload.title || payload.step || payload.text, 500, 'step');
  if (!workflowId || !validText.ok) return buildActionResult('workflow/step/add', 'rejected', null, [workflowId ? validText.error : 'INVALID_WORKFLOW_ID']);
  const repos = getRepos(services);
  const step = await repos?.workflows?.addWorkflowStep?.({
    userId: base.userId,
    workflowId,
    title: validText.value,
    description: payload.description || '',
    stepNumber: payload.stepNumber,
    metadata: { workspaceId: base.workspaceId }
  });
  if (!step) return buildActionResult('workflow/step/add', 'not_found', null, ['WORKFLOW_NOT_FOUND']);
  await record('workflow/step/add', { ...payload, workspaceId: base.workspaceId }, null, step, 'ok', { ...context, actorRole: base.actorRole, permission: base.permission }, services);
  return buildActionResult('workflow/step/add', 'ok', { step });
}

async function markWorkflowStepDone(payload, context, services) {
  const base = await prepareWorkspaceAction('workflow/step/done', payload, context, services);
  if (!base.ok) return buildActionResult('workflow/step/done', 'rejected', null, [base.error]);
  const workflowId = guards.validateId(payload.workflowId);
  if (!workflowId) return buildActionResult('workflow/step/done', 'rejected', null, ['INVALID_WORKFLOW_ID']);
  const repos = getRepos(services);
  let step = null;
  if (payload.stepId && getPool(services)) {
    const result = await getPool(services).query(
      `UPDATE workflow_steps SET status = 'done', completed_at = NOW(), updated_at = NOW()
       WHERE user_id = $1 AND workflow_id = $2 AND id = $3 RETURNING *`,
      [base.userId, workflowId, String(payload.stepId)]
    );
    step = result.rows?.[0] || null;
  } else {
    const stepNumber = Number(payload.stepNumber || payload.stepId);
    if (!Number.isFinite(stepNumber)) return buildActionResult('workflow/step/done', 'rejected', null, ['INVALID_STEP']);
    step = await repos?.workflows?.completeWorkflowStep?.(base.userId, workflowId, stepNumber);
  }
  if (!step) return buildActionResult('workflow/step/done', 'not_found', null, ['STEP_NOT_FOUND']);
  await record('workflow/step/done', { ...payload, workspaceId: base.workspaceId }, null, step, 'ok', { ...context, actorRole: base.actorRole, permission: base.permission }, services);
  return buildActionResult('workflow/step/done', 'ok', { step });
}

async function reorderWorkflowStep(payload, context, services) {
  const base = await prepareWorkspaceAction('workflow/step/reorder', payload, context, services);
  if (!base.ok) return buildActionResult('workflow/step/reorder', 'rejected', null, [base.error]);
  const workflowId = guards.validateId(payload.workflowId);
  const stepId = guards.validateId(payload.stepId);
  const validOrder = guards.validateNumberRange(payload.stepNumber || payload.newStepNumber, 1, 999, 'stepNumber');
  if (!workflowId || !stepId || !validOrder.ok) return buildActionResult('workflow/step/reorder', 'rejected', null, ['INVALID_STEP_ORDER']);
  let step = null;
  const pool = getPool(services);
  if (pool) {
    const result = await pool.query(
      `UPDATE workflow_steps SET step_number = $4, updated_at = NOW()
       WHERE user_id = $1 AND workflow_id = $2 AND id = $3 RETURNING *`,
      [base.userId, workflowId, stepId, validOrder.value]
    );
    step = result.rows?.[0] || null;
  } else {
    const json = await updateJsonItem(services, 'rel_workflow_steps', base.userId, stepId, { stepNumber: validOrder.value });
    step = json?.after || null;
  }
  if (!step) return buildActionResult('workflow/step/reorder', 'not_found', null, ['STEP_NOT_FOUND']);
  await record('workflow/step/reorder', { ...payload, workspaceId: base.workspaceId }, null, step, 'ok', { ...context, actorRole: base.actorRole, permission: base.permission }, services);
  return buildActionResult('workflow/step/reorder', 'ok', { step });
}

async function handleSafeAction(action, payload = {}, context = {}, services = {}) {
  switch (action) {
    case 'memory/update': return updateMemory(payload, context, services);
    case 'memory/archive': return archiveMemory(payload, context, services);
    case 'memory/restore': return restoreMemory(payload, context, services);
    case 'goal/update': return updateGoal(payload, context, services);
    case 'goal/archive': return archiveGoal(payload, context, services);
    case 'goal/restore': return restoreGoal(payload, context, services);
    case 'workflow/step/add': return addWorkflowStep(payload, context, services);
    case 'workflow/step/done': return markWorkflowStepDone(payload, context, services);
    case 'workflow/step/reorder': return reorderWorkflowStep(payload, context, services);
    case 'workflow/archive': return archiveWorkflow(payload, context, services);
    case 'workflow/restore': return restoreWorkflow(payload, context, services);
    default: return buildActionResult(action, 'invalid', null, ['INVALID_ACTION']);
  }
}

module.exports = {
  buildActionResult,
  handleSafeAction,
  rejectSecretLikePayload,
  requireDoubleConfirm,
  sanitizeActionPayload,
  validateSafeAction
};
