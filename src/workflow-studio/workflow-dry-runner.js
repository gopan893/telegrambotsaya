'use strict';

const store = require('./workflow-store');
const stepContract = require('./workflow-step-contract');

function dryRun(workflowId) {
  const wf = store.getWorkflow(workflowId);
  if (!wf) return { ok: false, error: 'Workflow not found' };
  return dryRunData(wf);
}

function dryRunData(wf) {
  if (!wf) return { ok: false, error: 'No workflow data' };
  const steps = (wf.steps || []).map((step, i) => ({
    index: i,
    id: step.id,
    type: step.type,
    name: step.name,
    wouldExecute: true,
    estimatedLatencyMs: Math.floor(Math.random() * 200) + 50,
    sideEffects: [],
    safe: true
  }));
  const validation = stepContract.buildStepContract(wf.steps);
  return {
    ok: true,
    workflowId: wf.id,
    dryRun: true,
    steps,
    totalSteps: steps.length,
    valid: validation.valid,
    hasUnsafe: validation.hasUnsafe,
    hasHardBlocks: validation.hasHardBlocks,
    estimatedTotalMs: steps.reduce((sum, s) => sum + s.estimatedLatencyMs, 0),
    note: 'READ-ONLY — No real actions executed.',
    timestamp: new Date().toISOString()
  };
}

function simulateDryRun(params) {
  return dryRunData(params);
}

module.exports = { dryRun, dryRunData, simulateDryRun };
