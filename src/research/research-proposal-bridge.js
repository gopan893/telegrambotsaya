'use strict';

const utils = require('./research-utils');
const store = require('./research-store');
const taskManager = require('./research-task-manager');

async function createResearchActionPlan(taskId, services = {}) {
  const task = await taskManager.getResearchTask(taskId, services);
  if (!task) return null;
  return {
    id: utils.createId('rplan'),
    taskId,
    actions: [
      { type: 'docs_update', description: 'Update dokumentasi berdasarkan riset', risk: 'low' },
      { type: 'implementation', description: 'Implementasi berdasarkan riset', risk: 'medium' }
    ],
    status: 'draft',
    createdAt: new Date().toISOString()
  };
}

async function createResearchExecutorProposal(actionPlan, services = {}) {
  if (!actionPlan) return null;
  return {
    id: utils.createId('rprop'),
    actionPlanId: actionPlan.id,
    taskId: actionPlan.taskId,
    type: 'research_action',
    status: 'pending_approval',
    proposal: `Proposal untuk research task ${actionPlan.taskId}: ${actionPlan.actions.map(a => a.description).join(', ')}`,
    requiresEvaluation: true,
    requiresApproval: true,
    createdAt: new Date().toISOString()
  };
}

async function linkResearchTaskToProposal(taskId, proposalId, services = {}) {
  const task = await taskManager.getResearchTask(taskId, services);
  if (!task) return null;
  const proposalIds = [...(task.proposalIds || []), proposalId];
  return taskManager.updateResearchTask(taskId, { proposalIds }, services);
}

module.exports = { createResearchActionPlan, createResearchExecutorProposal, linkResearchTaskToProposal };
