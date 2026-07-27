'use strict';

function createProposalBridge(store, executorSystem, evaluationSystem) {
  async function createAutoHealProposal(action, ctx) {
    if (!executorSystem) return { ok: false, error: 'Executor system not available' };
    if (action.requiresEvaluation && !evaluationSystem) return { ok: false, error: 'Evaluation required but system not available' };

    const evalOk = action.requiresEvaluation ? await checkEvalGate() : true;
    if (!evalOk) return { ok: false, error: 'Evaluation gate not passed' };

    const proposal = await executorSystem.createProposal({
      title: 'Auto-heal: ' + action.name,
      description: action.description || 'Auto-healing proposal',
      type: 'autoheal',
      riskLevel: action.riskLevel,
      requiresApproval: true,
      actionId: action.id
    });
    if (proposal?.id) {
      await store.saveProposal({ actionId: action.id, proposalId: proposal.id, status: 'created' });
    }
    return { ok: !!proposal, proposalId: proposal?.id };
  }

  async function checkEvalGate() {
    if (!evaluationSystem) return false;
    try {
      const r = await evaluationSystem.runEvalCases(['safetyRegressionScore']);
      return r?.safetyRegressionScore >= 100;
    } catch (_) { return false; }
  }

  return { createAutoHealProposal };
}

module.exports = { createProposalBridge };
