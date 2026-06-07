'use strict';

function nowIso() {
  return new Date().toISOString();
}

function generatePlanId() {
  return 'plan_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function generateProposalId() {
  return 'proposal_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

let executorStore = null;

function loadExecutorStore() {
  if (executorStore) return executorStore;
  try {
    executorStore = require('../executor/execution-store');
    return executorStore;
  } catch (_) {
    return null;
  }
}

async function createOperatingLoopActionPlan(action, services = {}) {
  if (!action) {
    return { ok: false, error: 'No action provided', plan: null };
  }

  const plan = {
    id: generatePlanId(),
    loopRunId: services.loopRunId || '',
    action,
    status: 'draft',
    requiresEvaluation: action.requiresEvaluation !== false,
    requiresApproval: action.requiresApproval !== false,
    createdAt: nowIso()
  };

  return { ok: true, plan };
}

async function createOperatingLoopExecutorProposal(actionPlan, services = {}) {
  if (!actionPlan) {
    return { ok: false, error: 'No action plan provided', proposal: null, proposalId: null };
  }

  const store = loadExecutorStore();
  if (!store) {
    return { ok: false, error: 'Executor store not available — cannot create proposal', proposal: null, proposalId: null };
  }

  const action = actionPlan.action || {};
  const type = String(action.type || '').toLowerCase();

  let riskLevel = 'low';
  if (type.includes('repair') || type.includes('deploy') || type.includes('rollback')) {
    riskLevel = 'high';
  } else if (type.includes('cost') || type.includes('githubops')) {
    riskLevel = 'medium';
  }

  const proposal = {
    id: generateProposalId(),
    planId: actionPlan.id,
    sourceType: 'operating_loop',
    sourceId: actionPlan.loopRunId || '',
    title: `Operating Loop: ${action.title || 'Untitled'}`,
    description: action.description || '',
    type: action.type || 'plan',
    riskLevel,
    requiresEvaluation: actionPlan.requiresEvaluation,
    requiresApproval: actionPlan.requiresApproval,
    status: 'pending_approval',
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  try {
    await store.upsertExecutionItem(store.EXECUTOR_PROPOSALS_KEY, proposal, services);
    return { ok: true, proposal, proposalId: proposal.id };
  } catch (err) {
    return { ok: false, error: 'Failed to save proposal: ' + err.message, proposal, proposalId: null };
  }
}

async function linkLoopRunToProposal(loopRunId, proposalId, services = {}) {
  if (!loopRunId || !proposalId) {
    return { ok: false, error: 'loopRunId and proposalId are required' };
  }

  const store = loadExecutorStore();
  if (!store) {
    return { ok: true, note: 'Link recorded in memory (executor store unavailable)' };
  }

  const link = {
    id: 'link_' + Date.now().toString(36),
    loopRunId,
    proposalId,
    createdAt: nowIso()
  };

  try {
    await store.appendExecutionItem('loop_proposal_links', link, 500, services);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: 'Failed to link: ' + err.message };
  }
}

async function getLoopPendingProposals(loopRunId, services = {}) {
  if (!loopRunId) return [];

  const store = loadExecutorStore();
  if (!store) return [];

  try {
    const proposals = await store.listExecutionItems(store.EXECUTOR_PROPOSALS_KEY, { status: 'pending_approval' }, services);
    return proposals.filter(p => p.sourceId === loopRunId || p.planId === loopRunId);
  } catch (_) {
    return [];
  }
}

module.exports = {
  createOperatingLoopActionPlan,
  createOperatingLoopExecutorProposal,
  linkLoopRunToProposal,
  getLoopPendingProposals
};
