'use strict';

const actionPlanStore = require('./agent-action-plan');
const utils = require('./delegation-utils');

async function routeExecutorResultToSource(proposalId, result = {}, services = {}) {
  const executor = require('../executor');
  const proposal = result.proposal || await executor.executionStore.getExecutionItem(executor.executionStore.EXECUTOR_PROPOSALS_KEY, proposalId, services);
  if (!proposal) return { ok: false, reason: 'PROPOSAL_NOT_FOUND' };
  const routed = [];
  if (proposal.sourceType === 'agent_action_plan' && proposal.sourceId) {
    const plan = await actionPlanStore.updateActionPlan(proposal.sourceId, {
      status: result.ok ? 'proposal_created' : 'reviewing',
      executorProposalId: proposal.id
    }, services);
    routed.push({ sourceType: 'agent_action_plan', sourceId: proposal.sourceId, updated: Boolean(plan) });
  }
  await utils.auditDelegation('agent_executor/result_routed', {
    targetType: 'execution_proposal',
    id: proposal.id,
    workspaceId: proposal.workspaceId,
    userId: proposal.userId,
    resultStatus: result.ok ? 'ok' : 'failed',
    routed
  }, services);
  return { ok: true, proposalId, routed };
}

async function updateDecisionAfterExecution(decisionId, result = {}, services = {}) {
  const decisionStore = require('./decision-store');
  if (!decisionStore.updateDecisionStatus) return { ok: false, reason: 'DECISION_STORE_UNAVAILABLE' };
  const decision = await decisionStore.updateDecisionStatus(decisionId, result.ok ? 'accepted' : 'deferred', { actorId: services.actorId || '' }, services);
  return { ok: Boolean(decision), decision };
}

async function updateDelegationAfterExecution(delegationId, result = {}, services = {}) {
  const engine = require('./delegation-engine');
  const session = await engine.getDelegationSession(delegationId, services);
  if (!session) return { ok: false, reason: 'DELEGATION_NOT_FOUND' };
  return { ok: true, session };
}

async function updateAgentTaskAfterExecution(taskId, result = {}, services = {}) {
  const store = require('./agent-task-store');
  const task = await store.getTask(taskId, services);
  if (!task) return { ok: false, reason: 'AGENT_TASK_NOT_FOUND' };
  return { ok: true, task };
}

async function notifyOrchestratorOfExecutionResult(proposalId, result = {}, services = {}) {
  return {
    ok: true,
    text: `Execution ${result.ok ? 'selesai' : 'gagal'} untuk proposal ${proposalId}.`
  };
}

module.exports = {
  notifyOrchestratorOfExecutionResult,
  routeExecutorResultToSource,
  updateAgentTaskAfterExecution,
  updateDecisionAfterExecution,
  updateDelegationAfterExecution
};
