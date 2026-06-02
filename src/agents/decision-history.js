'use strict';

const utils = require('./decision-utils');

async function loadDecisions(services = {}) {
  const data = await utils.safeRead(utils.AGENT_DECISIONS_KEY, [], services);
  return Array.isArray(data) ? data : [];
}

async function saveDecisions(items = [], services = {}) {
  return utils.safeWrite(utils.AGENT_DECISIONS_KEY, utils.sanitizeDecisionPayload(items), services);
}

async function appendHistory(entry = {}, services = {}) {
  const items = await utils.safeRead(utils.AGENT_DECISION_HISTORY_KEY, [], services);
  const list = Array.isArray(items) ? items : [];
  const item = utils.sanitizeDecisionPayload({
    id: entry.id || utils.createId('decision_history'),
    ...entry,
    createdAt: entry.createdAt || utils.nowIso()
  });
  list.unshift(item);
  await utils.safeWrite(utils.AGENT_DECISION_HISTORY_KEY, list.slice(0, 2000), services);
  return item;
}

async function createDecisionRecord(input = {}, services = {}) {
  if (utils.containsSecretLike(input)) throw Object.assign(new Error('DECISION_SECRET_REJECTED'), { code: 'DECISION_SECRET_REJECTED' });
  const record = utils.buildDecisionRecord(input);
  const items = await loadDecisions(services);
  items.unshift(record);
  await saveDecisions(items.slice(0, 2000), services);
  await appendHistory({ decisionId: record.id, action: 'created', workspaceId: record.workspaceId, userId: record.userId, summary: record.title }, services);
  await utils.auditDecision('agents/decision_analysis_created', {
    decisionId: record.id,
    workspaceId: record.workspaceId,
    userId: record.userId,
    riskLevel: record.riskLevel,
    approvalRequired: record.approvalRequired,
    status: record.status
  }, services);
  return record;
}

async function getDecisionRecord(decisionId, services = {}) {
  return (await loadDecisions(services)).find(item => item.id === decisionId) || null;
}

async function listDecisionRecords(filters = {}, services = {}) {
  const limit = Math.min(Math.max(Number(filters.limit || 30), 1), 100);
  const workspaceId = filters.workspaceId ? utils.normalizeWorkspaceId(filters.workspaceId) : null;
  const userId = filters.userId ? String(filters.userId) : null;
  const status = filters.status ? String(filters.status) : null;
  const includeArchived = Boolean(filters.includeArchived);
  return (await loadDecisions(services))
    .filter(item => includeArchived || item.status !== 'archived')
    .filter(item => !workspaceId || item.workspaceId === workspaceId)
    .filter(item => !userId || item.userId === userId)
    .filter(item => !status || item.status === status)
    .slice(0, limit)
    .map(utils.sanitizeDecisionPayload);
}

async function updateDecision(decisionId, patch = {}, services = {}) {
  const items = await loadDecisions(services);
  const index = items.findIndex(item => item.id === decisionId);
  if (index < 0) throw new Error('DECISION_NOT_FOUND');
  const next = utils.sanitizeDecisionPayload({
    ...items[index],
    ...patch,
    id: items[index].id,
    workspaceId: items[index].workspaceId,
    updatedAt: utils.nowIso()
  });
  items[index] = next;
  await saveDecisions(items, services);
  return next;
}

async function updateDecisionStatus(decisionId, status, actor = {}, services = {}) {
  const clean = utils.normalizeDecisionStatus(status);
  const decision = await updateDecision(decisionId, {
    status: clean,
    decidedAt: ['accepted', 'rejected', 'deferred'].includes(clean) ? utils.nowIso() : undefined
  }, services);
  await appendHistory({ decisionId, action: `status_${clean}`, workspaceId: decision.workspaceId, userId: decision.userId, actorId: actor.actorId || actor.userId || '' }, services);
  await utils.auditDecision('agents/decision_status_changed', {
    decisionId,
    workspaceId: decision.workspaceId,
    userId: decision.userId,
    status: clean
  }, services);
  return decision;
}

async function archiveDecision(decisionId, actor = {}, services = {}) {
  const decision = await updateDecision(decisionId, { status: 'archived', archivedAt: utils.nowIso() }, services);
  await appendHistory({ decisionId, action: 'archived', workspaceId: decision.workspaceId, userId: decision.userId, actorId: actor.actorId || actor.userId || '' }, services);
  await utils.auditDecision('agents/decision_archived', {
    decisionId,
    workspaceId: decision.workspaceId,
    userId: decision.userId,
    status: 'archived'
  }, services);
  return decision;
}

async function linkDecisionToGoal(decisionId, goalId, services = {}) {
  const decision = await updateDecision(decisionId, { linkedGoalId: String(goalId || '') }, services);
  await appendHistory({ decisionId, action: 'linked_goal', targetId: goalId, workspaceId: decision.workspaceId, userId: decision.userId }, services);
  await utils.auditDecision('agents/decision_linked_to_goal', { decisionId, goalId, workspaceId: decision.workspaceId, userId: decision.userId }, services);
  return decision;
}

async function linkDecisionToPlanner(decisionId, planId, services = {}) {
  const decision = await updateDecision(decisionId, { linkedPlanId: String(planId || '') }, services);
  await appendHistory({ decisionId, action: 'linked_plan', targetId: planId, workspaceId: decision.workspaceId, userId: decision.userId }, services);
  await utils.auditDecision('agents/decision_linked_to_planner', { decisionId, planId, workspaceId: decision.workspaceId, userId: decision.userId }, services);
  return decision;
}

async function searchDecisionHistory(query = '', services = {}) {
  const q = String(query || '').toLowerCase();
  const decisions = await loadDecisions(services);
  return decisions
    .filter(item => !q || `${item.title} ${item.question} ${JSON.stringify(item.recommendation || {})}`.toLowerCase().includes(q))
    .slice(0, 50)
    .map(utils.sanitizeDecisionPayload);
}

module.exports = {
  archiveDecision,
  createDecisionRecord,
  getDecisionRecord,
  linkDecisionToGoal,
  linkDecisionToPlanner,
  listDecisionRecords,
  loadDecisions,
  saveDecisions,
  searchDecisionHistory,
  updateDecision,
  updateDecisionStatus
};
