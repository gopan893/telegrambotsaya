'use strict';

const { generateId, now, truncate, maskSecrets } = require('./improvement-utils');
const { runImprovementEvaluationGate } = require('./improvement-evaluation-gate');

function createImprovementActionPlan(plan, services) {
  const actionPlan = {
    id: plan.id || generateId(),
    workspaceId: plan.workspaceId || (services && services.workspaceId) || null,
    userId: plan.userId || null,
    source: 'improvement',
    sourceId: plan.id || '',
    title: plan.title || 'Improvement action plan',
    description: truncate(plan.description || plan.title || '', 1200),
    actions: (plan.actions || []).map(a => ({
      id: generateId(),
      type: a.type || 'noop',
      targetType: a.targetType || '',
      targetId: a.targetId || '',
      description: truncate(a.description || a.type || '', 500),
      payload: maskSecrets(a.payload || {}),
      riskLevel: a.riskLevel || plan.riskLevel || 'medium',
      requiresApproval: a.requiresApproval !== false,
      status: 'pending_approval',
    })),
    riskLevel: plan.riskLevel || 'medium',
    requiresApproval: plan.requiresApproval !== false,
    status: 'action_plan_created',
    createdAt: now(),
    updatedAt: now(),
  };
  return actionPlan;
}

function createImprovementExecutorProposal(actionPlan, services) {
  const isRisky = ['high', 'danger'].includes(actionPlan.riskLevel || 'medium');
  let evalResult = null;

  if (isRisky) {
    const plan = {
      id: actionPlan.id,
      title: actionPlan.title,
      description: actionPlan.description,
      actions: actionPlan.actions,
      riskLevel: actionPlan.riskLevel,
    };
    evalResult = runImprovementEvaluationGate(plan, services);
  }

  const existingStore = getStore(services);
  const duplicateCheck = findDuplicatePending(existingStore, actionPlan, services);
  if (duplicateCheck.warning) {
    if (services && services.logger) {
      services.logger.warn(duplicateCheck.message);
    }
  }

  const proposal = {
    id: generateId(),
    actionPlanId: actionPlan.id,
    workspaceId: actionPlan.workspaceId,
    userId: actionPlan.userId,
    title: actionPlan.title,
    description: actionPlan.description,
    riskLevel: actionPlan.riskLevel,
    requiresApproval: actionPlan.requiresApproval !== false,
    status: 'pending_approval',
    proposedActions: (actionPlan.actions || []).map(a => ({
      id: a.id,
      type: a.type,
      targetType: a.targetType,
      targetId: a.targetId,
      description: a.description,
      riskLevel: a.riskLevel,
      requiresApproval: a.requiresApproval,
    })),
    evalResult: evalResult ? maskSecrets(evalResult) : null,
    evalGatePassed: evalResult ? evalResult.passed : true,
    duplicateWarning: duplicateCheck.warning ? duplicateCheck.message : null,
    createdAt: now(),
    updatedAt: now(),
  };

  return proposal;
}

function linkImprovementPlanToProposal(planId, proposalId, services) {
  const store = getStore(services);
  const plan = store.getById('plans', planId);
  if (!plan) return null;
  const existingLinks = plan.linkedProposalIds || [];
  if (!existingLinks.includes(proposalId)) {
    existingLinks.push(proposalId);
  }
  const updated = store.update('plans', planId, {
    linkedProposalIds: existingLinks,
    status: plan.status === 'action_plan_created' ? 'linked_to_proposal' : plan.status,
    updatedAt: now(),
  });
  return updated;
}

function getImprovementLinkedProposals(planId, services) {
  const store = getStore(services);
  const plan = store.getById('plans', planId);
  if (!plan) return [];
  const linkedIds = plan.linkedProposalIds || [];
  return linkedIds
    .map(id => store.getById('proposals', id))
    .filter(Boolean);
}

function findDuplicatePending(store, actionPlan, services) {
  const plans = store.getAll('plans') || [];
  const pendingPlans = plans.filter(p =>
    p.status !== 'archived' &&
    p.status !== 'executed' &&
    p.title === actionPlan.title &&
    p.id !== actionPlan.id
  );
  if (pendingPlans.length > 0) {
    return {
      warning: true,
      message: `Duplicate pending improvement plan detected: "${actionPlan.title}" (${pendingPlans.length} similar pending)`,
    };
  }
  return { warning: false, message: '' };
}

function getStore(services) {
  if (services && services.store) return services.store;
  return require('./improvement-store').getDefaultStore();
}

module.exports = {
  createImprovementActionPlan,
  createImprovementExecutorProposal,
  linkImprovementPlanToProposal,
  getImprovementLinkedProposals,
};
