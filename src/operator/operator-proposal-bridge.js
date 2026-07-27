'use strict';

const store = require('./project-operator-store');

let proposals = [];
let idCounter = 100;

function generateId() { return 'opp_' + Date.now() + '_' + (idCounter++); }

function createOperatorActionPlan(taskOrPlan) {
  if (!taskOrPlan) return { ok: false, error: 'No task/plan to create action plan' };
  const actionPlan = {
    id: generateId(),
    sourceId: taskOrPlan.id,
    sourceType: taskOrPlan.type === 'deployment' ? 'task' : (taskOrPlan.phases ? 'plan' : 'task'),
    title: `Action: ${taskOrPlan.title || 'Untitled'}`,
    description: taskOrPlan.description || '',
    actions: buildActions(taskOrPlan),
    riskLevel: taskOrPlan.riskLevel || 'low',
    requiresApproval: taskOrPlan.requiresApproval !== false,
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  proposals.push(actionPlan);
  return { ok: true, actionPlan };
}

function buildActions(taskOrPlan) {
  const actions = [];
  const type = taskOrPlan.type || 'planning';
  if (type === 'coding') actions.push({ type: 'code_change', description: 'Create/update code' });
  if (type === 'deployment') actions.push({ type: 'deploy', description: 'Run deploy', danger: true });
  if (type === 'review' || type === 'testing') actions.push({ type: 'evaluation', description: 'Run evaluation' });
  actions.push({ type: 'review', description: 'Review changes' });
  return actions;
}

function createOperatorExecutorProposal(actionPlan) {
  if (!actionPlan) return { ok: false, error: 'No action plan' };
  const proposal = {
    id: generateId(),
    actionPlanId: actionPlan.id,
    title: `Executor Proposal: ${actionPlan.title}`,
    status: 'pending_approval',
    requiresEvaluation: actionPlan.riskLevel === 'high' || actionPlan.actions.some(a => a.danger),
    requiresApproval: actionPlan.requiresApproval,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  proposals.push(proposal);
  return { ok: true, proposal };
}

function linkOperatorProposal(sourceId, proposalId) {
  const goal = store.listGoals({}).find(g => g.linkedProposals && g.linkedProposals.includes(proposalId));
  if (!goal) {
    const allGoals = store.listGoals({});
    for (const g of allGoals) {
      if (g.linkedTasks && g.linkedTasks.some(tId => tId === sourceId)) {
        store.updateGoal(g.id, { linkedProposals: [...(g.linkedProposals || []), proposalId] });
        return { ok: true, goalId: g.id };
      }
    }
  }
  return { ok: true };
}

function getOperatorLinkedProposals(sourceId) {
  return proposals.filter(p => p.sourceId === sourceId || p.actionPlanId === sourceId);
}

function listAllProposals() {
  return [...proposals];
}

function clearProposals() {
  proposals = [];
}

module.exports = {
  createOperatorActionPlan,
  createOperatorExecutorProposal,
  linkOperatorProposal,
  getOperatorLinkedProposals,
  listAllProposals,
  clearProposals
};
