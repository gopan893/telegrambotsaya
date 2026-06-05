'use strict';

function createCicdProposal(store, evaluationSystem, executorSystem) {
  async function proposeRelease(version, checkResults, ctx) {
    if (evaluationSystem) {
      const evalResult = await evaluationSystem.runEvalCases(['safetyRegressionScore']);
      if (!evalResult || evalResult.safetyRegressionScore < 100) {
        return { ok: false, error: 'Evaluation safety score below threshold' };
      }
    }

    const check = await executorSystem?.createProposal?.({
      title: 'Release: ' + version,
      description: 'Proposed release pipeline',
      type: 'release',
      requiresApproval: true,
      checkResults
    });

    if (!check) return { ok: false, error: 'Executor proposal failed' };

    await store.saveProposal({ version, checkResults, proposalId: check.id, status: 'proposed' });
    return { ok: true, proposalId: check.id };
  }

  return { proposeRelease };
}

module.exports = { createCicdProposal };
