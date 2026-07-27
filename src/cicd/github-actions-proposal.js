'use strict';

const utils = require('./cicd-utils');

function createGithubActionsProposal(store, evaluationSystem, executorSystem) {
  async function hasEvaluationGate() {
    if (!evaluationSystem) return false;
    try {
      if (typeof evaluationSystem.runEvalCases === 'function') {
        const result = await evaluationSystem.runEvalCases(['cicdSafetyScore', 'deployApprovalBoundaryScore']);
        return (result?.cicdSafetyScore || 100) >= 100 && (result?.deployApprovalBoundaryScore || 100) >= 100;
      }
      if (typeof evaluationSystem.runEvaluationSuite === 'function') {
        const result = await evaluationSystem.runEvaluationSuite({ category: 'cicd', dryRun: true });
        return result?.qualityGateStatus !== 'failed';
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  async function createExecutorProposal(payload) {
    if (!executorSystem?.createProposal) {
      return { ok: false, error: 'Executor system not available' };
    }
    const proposal = await executorSystem.createProposal({
      ...payload,
      requiresApproval: true,
      status: 'pending_approval',
      sourceType: 'cicd'
    });
    return proposal?.id ? { ok: true, proposalId: proposal.id, proposal } : { ok: false, error: 'Executor proposal failed' };
  }

  async function createWorkflowDispatchProposal(workflowId, ref = 'main', inputs = {}, services = {}) {
    const evalOk = await hasEvaluationGate();
    if (!evalOk) return { ok: false, error: 'Evaluation gate not passed', requiresEvaluation: true };
    const result = await createExecutorProposal({
      title: `GitHub workflow dispatch: ${workflowId}`,
      description: `Proposal only. Dispatch workflow ${workflowId} on ${ref}.`,
      type: 'github.workflow_dispatch',
      riskLevel: 'high',
      workflowId,
      ref,
      inputs
    });
    if (result.ok) {
      await store?.saveProposal?.({
        workflowId,
        ref,
        inputs,
        proposalId: result.proposalId,
        status: 'proposed',
        type: 'workflow_dispatch',
        createdAt: utils.nowISO()
      });
    }
    return result;
  }

  async function createDeployProposal(target = 'render', services = {}) {
    const evalOk = await hasEvaluationGate();
    if (!evalOk) return { ok: false, error: 'Evaluation gate not passed', requiresEvaluation: true };
    const result = await createExecutorProposal({
      title: `Deploy proposal: ${target}`,
      description: `Proposal only. Deployment target: ${target}. No deploy hook is called here.`,
      type: 'deploy.proposal',
      riskLevel: 'critical',
      target
    });
    if (result.ok) {
      await store?.saveProposal?.({
        target,
        proposalId: result.proposalId,
        status: 'proposed',
        type: 'deploy',
        createdAt: utils.nowISO()
      });
    }
    return result;
  }

  async function linkCicdProposal(proposalId, workflowId, services = {}) {
    await store?.saveProposal?.({ proposalId, workflowId, status: 'linked', type: 'link', createdAt: utils.nowISO() });
    return { ok: true, proposalId, workflowId };
  }

  return { createWorkflowDispatchProposal, createDeployProposal, linkCicdProposal };
}

module.exports = { createGithubActionsProposal };
