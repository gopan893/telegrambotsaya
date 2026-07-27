'use strict';

function listRegisteredWorkflows() {
  return [
    {
      id: 'ci.yml',
      name: 'CI Pipeline',
      path: '.github/workflows/ci.yml',
      trigger: 'push,pull_request',
      writeAction: false
    },
    {
      id: 'release-check.yml',
      name: 'Release Check',
      path: '.github/workflows/release-check.yml',
      trigger: 'workflow_dispatch',
      writeAction: true,
      requiresApproval: true,
      requiresEvaluation: true
    },
    {
      id: 'dashboard-regression.yml',
      name: 'Dashboard Regression',
      path: '.github/workflows/dashboard-regression.yml',
      trigger: 'push',
      writeAction: false
    }
  ];
}

function getWorkflow(workflowId) {
  return listRegisteredWorkflows().find(workflow => workflow.id === workflowId || workflow.name === workflowId) || null;
}

function buildWorkflowSummary() {
  const workflows = listRegisteredWorkflows();
  return {
    ok: true,
    total: workflows.length,
    dispatchable: workflows.filter(workflow => workflow.writeAction).length,
    workflows
  };
}

module.exports = { listRegisteredWorkflows, getWorkflow, buildWorkflowSummary };
