'use strict';

const utils = require('./selfhealing-utils');

function createRepairProposalBridge(store, executorSystem) {
  async function createRepairExecutorProposal(repairPlanId, ctx) {
    const plan = await store.getRepairPlan(repairPlanId);
    if (!plan) return { ok: false, error: 'Repair plan not found' };
    if (!executorSystem) return { ok: false, error: 'Executor system not available' };
    if (plan.status === 'done' || plan.status === 'approved') {
      return { ok: false, error: 'Repair plan already completed or approved' };
    }
    if (!plan.requiresApproval && plan.riskLevel === 'critical') {
      return { ok: false, error: 'Critical repair plan must require approval' };
    }
    const evaluationGatePassed = plan.requiresApproval ? await checkEvaluationGate(plan, ctx) : true;
    if (plan.requiresApproval && !evaluationGatePassed) {
      return { ok: false, error: 'Repair plan requires Evaluation v2 gate but gate not passed' };
    }
    const sanitizedPlan = utils.sanitizeOutput(plan);
    try {
      const proposal = await executorSystem.createProposal({
        title: plan.title,
        description: plan.problemSummary,
        type: 'repair',
        files: plan.filesLikelyAffected || [],
        steps: plan.repairSteps || [],
        tests: plan.testsToRun || [],
        riskLevel: plan.riskLevel,
        requiresApproval: plan.requiresApproval,
        codexPrompt: plan.codexPrompt || '',
        repairPlanId: plan.id,
        workspaceId: ctx.workspaceId || '',
        userId: ctx.userId || ''
      });
      if (proposal && proposal.id) {
        plan.executorProposalId = proposal.id;
        plan.status = 'proposal_ready';
        await store.saveRepairPlan(plan);
        await store.saveProposal({
          id: proposal.id,
          repairPlanId: plan.id,
          status: 'created',
          createdAt: utils.nowISO()
        });
      }
      return { ok: true, proposalId: proposal.id, requiresApproval: plan.requiresApproval };
    } catch (err) {
      return { ok: false, error: 'Failed to create proposal: ' + err.message };
    }
  }

  async function linkRepairPlanToProposal(repairPlanId, proposalId) {
    const plan = await store.getRepairPlan(repairPlanId);
    if (!plan) return { ok: false, error: 'Repair plan not found' };
    plan.executorProposalId = proposalId;
    plan.status = proposalId ? 'proposal_ready' : plan.status;
    await store.saveRepairPlan(plan);
    await store.saveProposal({ repairPlanId, proposalId, status: 'linked', createdAt: utils.nowISO() });
    return { ok: true };
  }

  async function getRepairPlanProposalStatus(repairPlanId) {
    const plan = await store.getRepairPlan(repairPlanId);
    if (!plan) return null;
    if (!plan.executorProposalId || !executorSystem) {
      return { repairPlanId, status: plan.status, proposalExists: false };
    }
    try {
      const proposal = await executorSystem.getProposal(plan.executorProposalId);
      return {
        repairPlanId: plan.id,
        proposalId: plan.executorProposalId,
        proposalStatus: proposal ? proposal.status : 'unknown',
        planStatus: plan.status,
        proposalExists: !!proposal
      };
    } catch (_) {
      return { repairPlanId: plan.id, proposalId: plan.executorProposalId, proposalStatus: 'error', planStatus: plan.status, proposalExists: true };
    }
  }

  async function checkEvaluationGate(plan, ctx) {
    const evalSystem = ctx.evaluationSystem;
    if (!evalSystem) return false;
    try {
      const result = await evalSystem.runEvalCases(['dashboardRegressionScore', 'safetyRegressionScore']);
      return result && result.safetyRegressionScore >= 100;
    } catch (_) {
      return false;
    }
  }

  return { createRepairExecutorProposal, linkRepairPlanToProposal, getRepairPlanProposalStatus };
}

module.exports = { createRepairProposalBridge };
