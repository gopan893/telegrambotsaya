'use strict';

const utils = require('./routine-utils');

function createRoutineProposalBridge(services = {}) {
  const auditLog = services.auditLog || [];
  const executorSystem = services.executorSystem || null;
  const evaluationSystem = services.evaluationSystem || null;
  const registry = services.registry || null;

  function getStore() {
    return registry?.routineStore || null;
  }

  function createRoutineActionPlan(run, recommendation, svc) {
    const store = getStore();
    if (!store) return { error: 'Store not available' };

    const action = recommendation.action || '';
    const reason = recommendation.reason || '';
    const requiresEval = recommendation.requiresEvaluation === true;

    const actionPlan = {
      id: utils.createId('plan'),
      runId: run.id,
      routineId: run.routineId,
      action,
      reason: utils.sanitizeOutput(reason),
      requiresEvaluation: requiresEval,
      riskLevel: utils.normalizeRiskLevel(recommendation.riskLevel || 'medium'),
      createdAt: utils.nowIso()
    };

    auditLog.push({
      type: 'routine_action_plan_created',
      runId: run.id,
      action,
      requiresEvaluation: requiresEval,
      timestamp: utils.nowIso()
    });

    return actionPlan;
  }

  function createRoutineExecutorProposal(run, actionPlan, svc) {
    const store = getStore();
    if (!store) return { error: 'Store not available' };

    if (actionPlan.requiresEvaluation) {
      if (!evaluationSystem) {
        return { error: 'Evaluation system required but not available' };
      }
      auditLog.push({
        type: 'routine_proposal_requires_evaluation',
        runId: run.id,
        action: actionPlan.action,
        timestamp: utils.nowIso()
      });
    }

    if (!executorSystem) return { error: 'Executor system not available' };

    const proposal = {
      type: 'routine_proposal',
      routineId: run.routineId,
      runId: run.id,
      action: actionPlan.action,
      reason: actionPlan.reason,
      riskLevel: actionPlan.riskLevel,
      status: 'pending_approval',
      evaluationRequired: actionPlan.requiresEvaluation,
      evaluationPassed: false
    };

    auditLog.push({
      type: 'routine_proposal_created',
      runId: run.id,
      action: actionPlan.action,
      riskLevel: actionPlan.riskLevel,
      timestamp: utils.nowIso()
    });

    store.createProposalLink(run.routineId, run.id, proposal.id || 'pending');

    return { proposalId: proposal.id || `prop_${Date.now()}`, status: 'created' };
  }

  function linkRoutineRunToProposal(runId, proposalId, svc) {
    const store = getStore();
    if (!store) return false;
    store.updateRun(runId, {
      proposalIds: (store.getRun(runId)?.proposalIds || []).concat([proposalId])
    });
    store.createProposalLink('unknown', runId, proposalId);
    return true;
  }

  function getRoutineLinkedProposals(runId) {
    const store = getStore();
    if (!store) return [];
    return store.getProposalsForRun(runId);
  }

  return {
    createRoutineActionPlan,
    createRoutineExecutorProposal,
    linkRoutineRunToProposal,
    getRoutineLinkedProposals
  };
}

module.exports = { createRoutineProposalBridge };
