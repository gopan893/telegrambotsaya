'use strict';

const utils = require('./devgovernance-utils');
const store = require('./devgovernance-store');

function createPatchPlan(input) {
  if (!input || !input.task) return { ok: false, error: 'Task is required' };
  const plan = {
    id: utils.shortId(),
    task: input.task,
    agent: utils.validateAgentName(input.agent || 'unknown'),
    scope: input.scope || 'unknown',
    affectedAreas: input.affectedAreas || [],
    filesToEdit: input.filesToEdit || [],
    filesToAvoid: input.filesToAvoid || [],
    integrationRequirements: input.integrationRequirements || [],
    testsToRun: input.testsToRun || [],
    riskLevel: input.riskLevel || 'low',
    status: 'draft',
    createdAt: utils.now(),
    updatedAt: utils.now()
  };
  store.addPatchPlan(plan);
  return { ok: true, plan };
}

function updatePatchPlan(planId, update) {
  const plans = store.getPatchPlans();
  const existing = plans.find(p => p.id === planId);
  if (!existing) return { ok: false, error: 'Plan not found' };
  const allowedStatuses = ['draft', 'in_progress', 'ready_for_review', 'blocked', 'done'];
  if (update.status && !allowedStatuses.includes(update.status)) {
    return { ok: false, error: `Invalid status. Allowed: ${allowedStatuses.join(', ')}` };
  }
  const ok = store.updatePatchPlan(planId, update);
  return ok ? { ok: true, planId } : { ok: false, error: 'Update failed' };
}

function getPatchPlan(planId) {
  const plans = store.getPatchPlans();
  return plans.find(p => p.id === planId) || null;
}

function listPatchPlans(filters) {
  let plans = store.getPatchPlans();
  if (filters?.status) plans = plans.filter(p => p.status === filters.status);
  if (filters?.agent) plans = plans.filter(p => p.agent === filters.agent);
  return plans;
}

module.exports = {
  createPatchPlan,
  updatePatchPlan,
  getPatchPlan,
  listPatchPlans
};
