'use strict';

const utils = require('./delegation-utils');

const AGENT_ACTION_PLANS_KEY = 'agent_action_plans';

function normalizePlanStatus(value = 'draft') {
  const clean = String(value || 'draft').toLowerCase();
  return ['draft', 'reviewing', 'proposal_ready', 'proposal_created', 'rejected', 'cancelled'].includes(clean) ? clean : 'draft';
}

function normalizeSource(value = 'natural_chat') {
  const clean = String(value || 'natural_chat').toLowerCase();
  return ['natural_chat', 'decision', 'council', 'delegation', 'agent_task', 'planner', 'dashboard'].includes(clean) ? clean : 'natural_chat';
}

function sanitizeText(text = '', max = 900) {
  return utils.sanitizeDelegationText(text, { max });
}

function sanitizePayload(value) {
  return utils.sanitizeDelegationPayload(value, { maxItems: 60 });
}

function buildAction(input = {}, base = {}) {
  const riskLevel = utils.normalizeRiskLevel(input.riskLevel || base.riskLevel || 'medium');
  return sanitizePayload({
    id: input.id || utils.createId('agent_action'),
    type: sanitizeText(input.type || '', 120),
    toolId: sanitizeText(input.toolId || '', 120),
    targetType: sanitizeText(input.targetType || base.source || 'manual', 80),
    targetId: sanitizeText(input.targetId || base.sourceId || '', 160),
    workspaceId: utils.normalizeWorkspaceId(input.workspaceId || base.workspaceId),
    userId: String(input.userId || base.userId || ''),
    description: sanitizeText(input.description || input.type || 'Agent action', 520),
    payload: sanitizePayload(input.payload || {}),
    riskLevel,
    requiresApproval: input.requiresApproval !== false,
    reversible: input.reversible !== false && !['danger', 'high'].includes(riskLevel),
    expectedResult: sanitizeText(input.expectedResult || 'Perubahan dilakukan setelah approval manusia.', 360),
    validationPlan: sanitizeText(input.validationPlan || 'Cek result, audit log, dan status source terkait.', 420)
  });
}

function buildActionPlan(input = {}) {
  if (utils.containsSecretLike(input)) {
    const err = new Error('ACTION_PLAN_SECRET_REJECTED');
    err.code = 'ACTION_PLAN_SECRET_REJECTED';
    throw err;
  }
  const now = utils.nowIso();
  const actions = Array.isArray(input.actions) ? input.actions : [];
  const riskLevel = utils.normalizeRiskLevel(input.riskLevel || utils.inferRiskFromText(`${input.title || ''} ${input.description || ''}`));
  const base = {
    workspaceId: utils.normalizeWorkspaceId(input.workspaceId),
    userId: input.userId,
    source: normalizeSource(input.source),
    sourceId: input.sourceId,
    riskLevel
  };
  return sanitizePayload({
    id: input.id || utils.createId('action_plan'),
    workspaceId: base.workspaceId,
    userId: String(input.userId || ''),
    source: base.source,
    sourceId: sanitizeText(input.sourceId || '', 160),
    createdByAgentId: sanitizeText(input.createdByAgentId || 'orchestrator', 80),
    title: sanitizeText(input.title || 'Agent action plan', 180),
    description: sanitizeText(input.description || '', 1200),
    actions: actions.map(action => buildAction(action, base)).slice(0, 12),
    riskLevel,
    approvalRequired: input.approvalRequired !== false || ['medium', 'high', 'danger'].includes(riskLevel),
    securityReviewRequired: Boolean(input.securityReviewRequired || ['high', 'danger'].includes(riskLevel)),
    status: normalizePlanStatus(input.status || 'draft'),
    executorProposalId: sanitizeText(input.executorProposalId || '', 160),
    createdAt: input.createdAt || now,
    updatedAt: now
  });
}

async function loadActionPlans(services = {}) {
  return utils.safeRead(AGENT_ACTION_PLANS_KEY, [], services);
}

async function saveActionPlans(items = [], services = {}) {
  return utils.safeWrite(AGENT_ACTION_PLANS_KEY, Array.isArray(items) ? items : [], services);
}

async function createActionPlan(input = {}, services = {}) {
  const plan = buildActionPlan(input);
  const items = await loadActionPlans(services);
  const next = Array.isArray(items) ? items.concat(plan) : [plan];
  await saveActionPlans(next.slice(-1000), services);
  await utils.auditDelegation('agent_executor/action_plan_created', {
    targetType: 'agent_action_plan',
    id: plan.id,
    workspaceId: plan.workspaceId,
    userId: plan.userId,
    riskLevel: plan.riskLevel,
    actionCount: plan.actions.length,
    decision: 'allowed'
  }, services);
  return plan;
}

async function getActionPlan(planId, services = {}) {
  const items = await loadActionPlans(services);
  return (Array.isArray(items) ? items : []).find(item => String(item.id) === String(planId)) || null;
}

async function listActionPlans(filters = {}, services = {}) {
  const items = await loadActionPlans(services);
  const limit = Math.min(Number(filters.limit || 50), 200);
  return (Array.isArray(items) ? items : [])
    .filter(item => !filters.workspaceId || String(item.workspaceId) === String(filters.workspaceId))
    .filter(item => !filters.userId || String(item.userId) === String(filters.userId))
    .filter(item => !filters.status || String(item.status) === String(filters.status))
    .filter(item => !filters.source || String(item.source) === String(filters.source))
    .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)))
    .slice(0, Number.isFinite(limit) ? limit : 50);
}

async function updateActionPlan(planId, patch = {}, services = {}) {
  const items = await loadActionPlans(services);
  const next = Array.isArray(items) ? items.slice() : [];
  const index = next.findIndex(item => String(item.id) === String(planId));
  if (index < 0) return null;
  const updated = sanitizePayload({
    ...next[index],
    ...patch,
    status: patch.status ? normalizePlanStatus(patch.status) : next[index].status,
    updatedAt: utils.nowIso()
  });
  next[index] = updated;
  await saveActionPlans(next, services);
  return updated;
}

async function cancelActionPlan(planId, services = {}) {
  return updateActionPlan(planId, { status: 'cancelled' }, services);
}

module.exports = {
  AGENT_ACTION_PLANS_KEY,
  buildAction,
  buildActionPlan,
  cancelActionPlan,
  createActionPlan,
  getActionPlan,
  listActionPlans,
  normalizePlanStatus,
  normalizeSource,
  updateActionPlan
};
