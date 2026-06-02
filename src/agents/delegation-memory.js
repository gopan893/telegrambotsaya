'use strict';

const store = require('./agent-task-store');
const utils = require('./delegation-utils');

function shouldSaveDelegationSummary(session = {}, results = [], services = {}) {
  const text = `${session.goal || ''} ${session.originalMessageSummary || ''}`.toLowerCase();
  if (session.approvalRequired) return true;
  if (/\b(phase|roadmap|project|coding|security|deploy|decision|planner|workflow)\b/.test(text)) return true;
  return results.length >= 3;
}

async function createDelegationSummaryMemory(session = {}, results = [], services = {}) {
  const summary = utils.sanitizeDelegationPayload({
    id: utils.createId('delegation_summary'),
    delegationId: session.id,
    workspaceId: session.workspaceId,
    userId: session.userId,
    title: `Delegation: ${utils.sanitizeDelegationText(session.goal || session.originalMessageSummary, { max: 120 })}`,
    content: utils.sanitizeDelegationText(session.finalSummary || session.goal || session.originalMessageSummary, { max: 1000 }),
    agents: session.selectedAgents || [],
    taskCount: (session.tasks || []).length,
    resultCount: results.length,
    approvalRequired: session.approvalRequired,
    createdAt: utils.nowIso()
  });
  const items = await utils.safeRead(utils.DELEGATION_SUMMARIES_KEY, [], services);
  const list = Array.isArray(items) ? items : [];
  list.unshift(summary);
  await utils.safeWrite(utils.DELEGATION_SUMMARIES_KEY, list.slice(0, 1000), services);
  await utils.auditDelegation('agents/delegation_summary_memory_created', {
    delegationId: session.id,
    workspaceId: session.workspaceId,
    userId: session.userId,
    status: 'ok'
  }, services);
  return summary;
}

async function createAgentLearningNotesFromDelegation(session = {}, results = [], services = {}) {
  const notes = [];
  if (!services.learningNotes?.createLearningNote) return notes;
  for (const result of results.slice(0, 5)) {
    if (!result.agentId || !result.resultSummary) continue;
    try {
      const note = await services.learningNotes.createLearningNote({
        agentId: result.agentId,
        workspaceId: session.workspaceId,
        userId: session.userId,
        content: `Delegation learning: ${result.resultSummary}`,
        tags: ['delegation', 'phase23'],
        createdBy: session.userId
      }, services);
      notes.push(note);
    } catch (_) {}
  }
  return notes;
}

async function linkDelegationToPlanner(session = {}, services = {}) {
  return {
    ok: false,
    reason: 'Planner linking is advisory in Phase 23; no automatic planner mutation is performed.',
    delegationId: session.id
  };
}

async function listDelegationSummaries(filters = {}, services = {}) {
  const limit = Math.min(Math.max(Number(filters.limit || 30), 1), 100);
  const workspaceId = filters.workspaceId ? utils.normalizeWorkspaceId(filters.workspaceId) : null;
  const items = await utils.safeRead(utils.DELEGATION_SUMMARIES_KEY, [], services);
  return (Array.isArray(items) ? items : [])
    .filter(item => !workspaceId || item.workspaceId === workspaceId)
    .slice(0, limit)
    .map(utils.sanitizeDelegationPayload);
}

async function saveDelegationSummaryIfUseful(sessionId, services = {}) {
  const session = await store.getDelegation(sessionId, services);
  if (!session) return null;
  const results = await store.listTaskResults({ delegationId: sessionId }, services);
  if (!shouldSaveDelegationSummary(session, results, services)) return null;
  return createDelegationSummaryMemory(session, results, services);
}

module.exports = {
  createAgentLearningNotesFromDelegation,
  createDelegationSummaryMemory,
  linkDelegationToPlanner,
  listDelegationSummaries,
  saveDelegationSummaryIfUseful,
  shouldSaveDelegationSummary
};
