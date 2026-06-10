'use strict';

const store = require('./device-store');
const utils = require('./device-utils');
const riskClassifier = require('./device-risk-classifier');

function createPlan(params) {
  if (!params || !params.deviceId || !params.action) {
    return { ok: false, error: 'Missing deviceId or action' };
  }
  const risk = riskClassifier.classifyActionRisk(params.action);
  const plan = {
    id: utils.createId('plan'),
    deviceId: params.deviceId,
    action: params.action,
    params: params.params || {},
    riskLevel: risk.level,
    proposalRequired: risk.proposalRequired,
    status: 'draft',
    proposalId: null,
    dryRunResult: null,
    createdAt: new Date().toISOString()
  };
  store.setActionPlan(plan.id, plan);
  return { ok: true, plan };
}

function getPlan(planId) {
  return store.getActionPlan(planId);
}

function listPlans(filter) {
  return store.listActionPlans(filter);
}

function approvePlan(planId) {
  const plan = store.getActionPlan(planId);
  if (!plan) return { ok: false, error: 'Plan not found' };
  if (plan.status !== 'draft') return { ok: false, error: 'Plan is not in draft status' };
  const updated = { ...plan, status: 'approved', approvedAt: new Date().toISOString() };
  store.setActionPlan(planId, updated);
  return { ok: true, plan: updated };
}

function rejectPlan(planId, reason) {
  const plan = store.getActionPlan(planId);
  if (!plan) return { ok: false, error: 'Plan not found' };
  const updated = { ...plan, status: 'rejected', rejectReason: reason || 'rejected', rejectedAt: new Date().toISOString() };
  store.setActionPlan(planId, updated);
  return { ok: true, plan: updated };
}

function buildPlan(params) {
  return createPlan(params);
}

function summarizePlan(plan) {
  if (!plan) return null;
  return {
    id: plan.id,
    deviceId: plan.deviceId,
    action: plan.action,
    riskLevel: plan.riskLevel,
    status: plan.status,
    proposalRequired: plan.proposalRequired
  };
}

module.exports = {
  createPlan, getPlan, listPlans, approvePlan, rejectPlan, buildPlan, summarizePlan
};
