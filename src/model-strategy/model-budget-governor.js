'use strict';

const store = require('./model-strategy-store');
const utils = require('./model-strategy-utils');

const BUDGET_MODES = {
  normal: { maxCostPerSession: 0.1, allowCloud: true, allowHighCost: true, description: 'Normal budget' },
  economy: { maxCostPerSession: 0.02, allowCloud: true, allowHighCost: false, description: 'Cost saving mode' },
  quality: { maxCostPerSession: 0.5, allowCloud: true, allowHighCost: true, description: 'Quality first' },
  private: { maxCostPerSession: 0.1, allowCloud: false, allowHighCost: false, description: 'Local only, no cloud' },
  emergency_low_cost: { maxCostPerSession: 0.005, allowCloud: false, allowHighCost: false, description: 'Emergency minimal cost' }
};

const CRITICAL_TASK_TYPES = new Set(['security_incident', 'privacy_incident', 'incident_response']);

function getBudgetMode(services = {}) {
  return services.budgetMode || 'normal';
}

function getBudgetConfig(mode = '', services = {}) {
  return BUDGET_MODES[mode] || BUDGET_MODES.normal;
}

function checkBudget(task = {}, estimatedCost = 0, services = {}) {
  const mode = getBudgetMode(services);
  const config = getBudgetConfig(mode, services);
  const isCritical = CRITICAL_TASK_TYPES.has(task.type) || task.priority === 'P0';
  if (isCritical) {
    return { allowed: true, reason: 'critical_task_no_budget_limit', mode, budgetRemaining: config.maxCostPerSession };
  }
  if (estimatedCost > config.maxCostPerSession) {
    return {
      allowed: false,
      reason: `cost_${estimatedCost}_exceeds_budget_${config.maxCostPerSession}`,
      mode,
      estimatedCost,
      budgetLimit: config.maxCostPerSession,
      overBy: +(estimatedCost - config.maxCostPerSession).toFixed(6)
    };
  }
  if (!config.allowHighCost && estimatedCost > 0.03) {
    return { allowed: false, reason: 'high_cost_not_allowed_in_mode', mode, estimatedCost };
  }
  return { allowed: true, reason: 'within_budget', mode, budgetRemaining: +(config.maxCostPerSession - estimatedCost).toFixed(6) };
}

function getSpendSummary(services = {}) {
  const records = store.getRecords('costRecords', null, services);
  const mode = getBudgetMode(services);
  const config = getBudgetConfig(mode, services);
  return { mode, budgetLimit: config.maxCostPerSession, description: config.description };
}

function setBudgetMode(mode = 'normal', services = {}) {
  if (!BUDGET_MODES[mode]) return { success: false, reason: 'invalid_mode', validModes: Object.keys(BUDGET_MODES) };
  services.budgetMode = mode;
  return { success: true, mode, config: BUDGET_MODES[mode] };
}

function isCriticalTask(task = {}) {
  return CRITICAL_TASK_TYPES.has(task.type) || task.priority === 'P0';
}

module.exports = { getBudgetMode, getBudgetConfig, checkBudget, getSpendSummary, setBudgetMode, isCriticalTask, BUDGET_MODES };
