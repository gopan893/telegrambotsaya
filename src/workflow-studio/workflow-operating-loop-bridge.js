'use strict';

const store = require('./workflow-store');
const riskSimulator = require('./workflow-risk-simulator');
const dryRunner = require('./workflow-dry-runner');
const approvalMapper = require('./workflow-approval-mapper');
const proposalBridge = require('./workflow-proposal-bridge');
const validator = require('./workflow-validator');
const runHistory = require('./workflow-run-history');
const scheduler = require('./workflow-scheduler-planner');
const utils = require('./workflow-utils');

function canConnectToOperatingLoop() {
  return true;
}

function getOperatingLoopStatus() {
  const workflows = store.listWorkflows({});
  const running = workflows.filter(w => w.status === 'running');
  const pendingProposals = workflows.filter(w => w.status === 'proposal_created');
  const readyToRun = workflows.filter(w => w.status === 'approved');
  return {
    ok: true,
    totalWorkflows: workflows.length,
    running: running.length,
    pendingProposals: pendingProposals.length,
    readyToRun: readyToRun.length,
    canAcceptWork: running.length < 5
  };
}

function submitToOperatingLoop(workflowId, context) {
  const workflow = store.getWorkflow(workflowId);
  if (!workflow) return { ok: false, error: 'Workflow not found' };
  if (workflow.status === 'running') return { ok: false, error: 'Workflow is already running' };
  if (workflow.status === 'disabled') return { ok: false, error: 'Workflow is disabled' };
  if (workflow.status === 'blocked') return { ok: false, error: 'Workflow is blocked' };

  const canRun = scheduler.checkCanRun(workflowId);
  if (!canRun.ok || !canRun.canRun) {
    return { ok: false, error: canRun.reason || 'Cannot run workflow' };
  }

  const validationResult = validator.validateWorkflow(workflowId);
  if (!validationResult.ok || !validationResult.valid) {
    return { ok: false, error: 'Workflow validation failed', details: validationResult };
  }

  if (workflow.dryRunRequired && workflow.status !== 'approved') {
    const dryRunResult = dryRunner.dryRunWorkflow(workflowId, context);
    if (!dryRunResult.ok) {
      return { ok: false, error: 'Dry-run failed', details: dryRunResult };
    }
  }

  if (workflow.evaluationRequired && workflow.status !== 'approved') {
    const riskResult = riskSimulator.simulateWorkflowRisk(workflowId);
    if (!riskResult.ok) {
      return { ok: false, error: 'Risk simulation failed', details: riskResult };
    }
  }

  if ((workflow.riskLevel === 'critical' || workflow.riskLevel === 'high') && workflow.status !== 'approved') {
    const proposal = proposalBridge.createExecutorProposal(workflowId, context);
    if (!proposal.ok) {
      return { ok: false, error: 'Failed to create proposal', details: proposal };
    }
    return {
      ok: true,
      status: 'proposal_created',
      message: 'Workflow requires approval via executor proposal',
      proposal: proposal.proposal
    };
  }

  store.updateWorkflow(workflowId, { status: 'running' });
  const startTime = Date.now();
  const result = executeWorkflowSteps(workflow, context);
  const duration = Date.now() - startTime;

  runHistory.recordRun(workflowId, {
    status: result.ok ? 'completed' : 'failed',
    startedAt: new Date(startTime).toISOString(),
    completedAt: new Date().toISOString(),
    duration,
    stepsCompleted: result.stepsCompleted || 0,
    error: result.error || null,
    triggeredBy: (context && context.triggeredBy) || 'operating_loop',
    results: result.results || []
  });

  store.updateWorkflow(workflowId, { status: result.ok ? 'completed' : 'failed' });

  return {
    ok: true,
    status: result.ok ? 'completed' : 'failed',
    result,
    duration
  };
}

function executeWorkflowSteps(workflow, context) {
  const steps = workflow.steps || [];
  const results = [];
  let stepsCompleted = 0;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (step.type === 'blocked') {
      return { ok: false, error: `Blocked step encountered at index ${i}`, stepsCompleted, results };
    }
    if (step.type === 'approval_gate') {
      return { ok: false, error: `Approval gate encountered at step ${i} - requires manual approval`, stepsCompleted, results };
    }
    const stepResult = executeSingleStep(step, i, context);
    results.push(stepResult);
    if (stepResult.ok) {
      stepsCompleted++;
    } else if (!step.continueOnError) {
      return { ok: false, error: `Step ${i} failed: ${stepResult.error}`, stepsCompleted, results };
    }
  }

  return { ok: true, stepsCompleted, results };
}

function executeSingleStep(step, index, context) {
  try {
    switch (step.type) {
      case 'read':
      case 'external_read':
        return { ok: true, stepId: step.id, type: step.type, result: 'simulated_read' };
      case 'analyze':
      case 'summarize':
        return { ok: true, stepId: step.id, type: step.type, result: 'simulated_analysis' };
      case 'notify':
        return { ok: true, stepId: step.id, type: 'notify', result: 'notification_simulated' };
      case 'internal_write':
        return { ok: true, stepId: step.id, type: 'internal_write', result: 'write_simulated' };
      case 'external_write':
        return { ok: false, stepId: step.id, type: 'external_write', error: 'External write blocked in operating loop' };
      case 'device_action':
        return { ok: false, stepId: step.id, type: 'device_action', error: 'Device action blocked in operating loop' };
      case 'plugin_action':
        return { ok: true, stepId: step.id, type: 'plugin_action', result: 'plugin_action_simulated' };
      case 'rag_search':
        return { ok: true, stepId: step.id, type: 'rag_search', result: 'rag_search_simulated' };
      case 'model_route':
        return { ok: true, stepId: step.id, type: 'model_route', result: 'model_route_simulated' };
      case 'proposal':
        return { ok: true, stepId: step.id, type: 'proposal', result: 'proposal_created' };
      default:
        return { ok: true, stepId: step.id, type: step.type, result: 'default_simulation' };
    }
  } catch (err) {
    return { ok: false, stepId: step.id, type: step.type, error: err.message };
  }
}

function getOperatingLoopQueue() {
  const workflows = store.listWorkflows({});
  return {
    ok: true,
    queue: workflows
      .filter(w => ['proposal_created', 'approved', 'running'].includes(w.status))
      .map(w => ({
        id: w.id,
        name: w.name,
        status: w.status,
        riskLevel: w.riskLevel,
        stepCount: (w.steps || []).length
      }))
  };
}

function approveForOperatingLoop(workflowId) {
  const workflow = store.getWorkflow(workflowId);
  if (!workflow) return { ok: false, error: 'Workflow not found' };
  if (workflow.status !== 'proposal_created' && workflow.status !== 'validated') {
    return { ok: false, error: 'Workflow must be in proposal_created or validated status' };
  }
  store.updateWorkflow(workflowId, { status: 'approved' });
  return { ok: true, workflowId, status: 'approved' };
}

function rejectForOperatingLoop(workflowId, reason) {
  const workflow = store.getWorkflow(workflowId);
  if (!workflow) return { ok: false, error: 'Workflow not found' };
  store.updateWorkflow(workflowId, { status: 'blocked' });
  return { ok: true, workflowId, status: 'blocked', reason: reason || 'Rejected' };
}

module.exports = {
  canConnectToOperatingLoop, getOperatingLoopStatus,
  submitToOperatingLoop, getOperatingLoopQueue,
  approveForOperatingLoop, rejectForOperatingLoop
};
