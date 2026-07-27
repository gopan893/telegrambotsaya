'use strict';

const utils = require('./githubops-utils');

let _simulatedRuns = [];

function simulateWorkflowDispatch(workflowName, ref, proposalId) {
  const run = {
    id: `wf-${utils.shortId()}`,
    workflow: workflowName,
    ref,
    proposalId: proposalId || null,
    status: 'queued',
    conclusion: null,
    steps: [
      { name: 'Checkout', status: 'pending' },
      { name: 'Setup Node', status: 'pending' },
      { name: 'Install Dependencies', status: 'pending' },
      { name: 'Run Tests', status: 'pending' }
    ],
    timestamp: utils.now()
  };
  _simulatedRuns.push(run);
  return run;
}

function simulateRunProgress(runId) {
  const run = _simulatedRuns.find(r => r.id === runId);
  if (!run) return null;
  run.status = 'in_progress';
  run.steps = run.steps.map((s, i) => ({
    ...s,
    status: i === 0 ? 'completed' : 'in_progress'
  }));
  return run;
}

function simulateRunCompletion(runId, conclusion) {
  const run = _simulatedRuns.find(r => r.id === runId);
  if (!run) return null;
  run.status = 'completed';
  run.conclusion = conclusion || 'success';
  run.steps = run.steps.map(s => ({ ...s, status: 'completed' }));
  return run;
}

function getSimulationStatus(runId) {
  return _simulatedRuns.find(r => r.id === runId) || null;
}

function listSimulations() {
  return [..._simulatedRuns];
}

async function checkWorkflowConclusion(runId, timeoutMs) {
  const start = Date.now();
  const maxWait = Math.min(timeoutMs || 30000, 60000);
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      const run = _simulatedRuns.find(r => r.id === runId);
      if (run && run.status === 'completed') {
        clearInterval(interval);
        resolve(run.conclusion);
      } else if (Date.now() - start > maxWait) {
        clearInterval(interval);
        resolve('timeout');
      }
    }, 2000);
  });
}

module.exports = {
  simulateWorkflowDispatch,
  simulateRunProgress,
  simulateRunCompletion,
  getSimulationStatus,
  listSimulations,
  checkWorkflowConclusion
};
