'use strict';

const store = require('./council-store');
const {
  auditCouncil,
  containsSecretLike,
  createCouncilId,
  nowIso,
  sanitizeCouncilPayload,
  sanitizeCouncilText
} = require('./council-utils');

function shouldSaveCouncilSummary(session = {}) {
  if (!session || session.status !== 'completed') return false;
  if (containsSecretLike(`${session.originalMessage || ''} ${session.finalSummary || ''}`)) return false;
  return ['planning_review', 'decision_review', 'debate', 'risk_review', 'coding_review'].includes(session.mode)
    || Boolean(session.decision?.recommendation);
}

function buildCouncilMemoryItem(session = {}) {
  return sanitizeCouncilPayload({
    id: createCouncilId('council_summary'),
    sessionId: session.id,
    workspaceId: session.workspaceId,
    userId: session.userId,
    mode: session.mode,
    topic: session.topic,
    summary: sanitizeCouncilText(session.finalSummary || session.decision?.recommendation || '', 1200),
    recommendation: sanitizeCouncilText(session.decision?.recommendation || '', 360),
    selectedAgents: session.selectedAgents || [],
    riskLevel: session.riskLevel,
    approvalRequired: Boolean(session.approvalRequired),
    createdAt: nowIso()
  });
}

async function createCouncilSummaryMemory(session = {}, services = {}) {
  if (!shouldSaveCouncilSummary(session)) return { saved: false, reason: 'not_eligible' };
  const item = buildCouncilMemoryItem(session);
  await store.appendSummary(item, services);
  try {
    if (services.agentMemoryStore?.createSharedAgentMemory) {
      await services.agentMemoryStore.createSharedAgentMemory({
        workspaceId: item.workspaceId,
        userId: item.userId,
        type: 'decision',
        title: `Council: ${item.topic}`,
        content: item.summary,
        tags: ['council', item.mode, item.riskLevel].filter(Boolean),
        createdBy: item.userId || services.actorId || 'system'
      }, services);
    }
  } catch (_) {}
  await auditCouncil('agents/council_summary_saved', {
    sessionId: session.id,
    workspaceId: session.workspaceId,
    userId: session.userId,
    mode: session.mode,
    summaryId: item.id
  }, services);
  return { saved: true, item };
}

async function linkCouncilToPlannerOrGoal(session = {}, services = {}) {
  return {
    ok: true,
    linkedGoalIds: session.linkedGoalIds || [],
    linkedPlanIds: session.linkedPlanIds || [],
    note: 'Linking planner/goal disiapkan sebagai safe no-op pada Phase 22.'
  };
}

async function listCouncilSummaries(filters = {}, services = {}) {
  return store.listSummaries(filters, services);
}

module.exports = {
  buildCouncilMemoryItem,
  createCouncilSummaryMemory,
  linkCouncilToPlannerOrGoal,
  listCouncilSummaries,
  shouldSaveCouncilSummary
};
