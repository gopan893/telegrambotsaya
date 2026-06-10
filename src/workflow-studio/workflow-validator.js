'use strict';

const store = require('./workflow-store');
const stepContract = require('./workflow-step-contract');
const utils = require('./workflow-utils');

function validateWorkflow(workflowId) {
  const wf = store.getWorkflow(workflowId);
  if (!wf) return { ok: false, errors: ['Workflow not found'] };
  return validateWorkflowData(wf);
}

function validateWorkflowData(wf) {
  if (!wf) return { valid: false, errors: ['No workflow data'] };
  const errors = [];
  if (!wf.name) errors.push('Missing workflow name');
  if (!wf.steps || !Array.isArray(wf.steps) || wf.steps.length === 0) {
    errors.push('Workflow has no steps');
  } else {
    const stepResult = stepContract.validateAllSteps(wf.steps);
    if (!stepResult.valid) errors.push(...stepResult.errors);
  }
  if (wf.trigger && !utils.VALID_TRIGGER_TYPES.includes(wf.trigger.type)) {
    errors.push('Invalid trigger type: ' + wf.trigger.type);
  }
  if (wf.riskLevel && !['low', 'medium', 'high', 'critical'].includes(wf.riskLevel)) {
    errors.push('Invalid risk level: ' + wf.riskLevel);
  }
  return { valid: errors.length === 0, errors };
}

function validateSteps(steps) {
  return stepContract.validateAllSteps(steps);
}

function getValidationReport(workflowId) {
  const wf = store.getWorkflow(workflowId);
  if (!wf) return { ok: false, error: 'Workflow not found' };
  const validation = validateWorkflowData(wf);
  const stepContractResult = stepContract.buildStepContract(wf.steps);
  return {
    ok: true,
    workflowId,
    valid: validation.valid,
    errors: validation.errors,
    stepCount: wf.steps.length,
    unsafeFindings: stepContractResult.unsafeFindings,
    hasHardBlocks: stepContractResult.hasHardBlocks
  };
}

module.exports = { validateWorkflow, validateWorkflowData, validateSteps, getValidationReport };
