'use strict';

const store = require('./model-strategy-store');
const utils = require('./model-strategy-utils');
const privacyGuard = require('./model-privacy-guard');
const costEstimator = require('./model-cost-estimator');
const budgetGovernor = require('./model-budget-governor');

const STRATEGIES = {
  economy: { costWeight: 0.8, qualityWeight: 0.2, latencyWeight: 0.5 },
  quality: { costWeight: 0.2, qualityWeight: 0.8, latencyWeight: 0.5 },
  private_local: { costWeight: 0.3, qualityWeight: 0.3, latencyWeight: 0.4, localOnly: true },
  vision: { costWeight: 0.4, qualityWeight: 0.6, requiresVision: true },
  coding: { costWeight: 0.4, qualityWeight: 0.6, requiresCoding: true },
  research: { costWeight: 0.3, qualityWeight: 0.7, requiresLongContext: true },
  fallback: { costWeight: 0.9, qualityWeight: 0.1 },
  manual_review: { costWeight: 0, qualityWeight: 0, requiresHuman: true }
};

function chooseStrategy(task = {}, context = {}, services = {}) {
  const taskType = task.class || task.taskType || 'simple_chat';
  const sensitivity = task.sensitivity || context.sensitivity || 'low';
  const budgetMode = budgetGovernor.getBudgetMode(services);
  if (sensitivity === 'high' || taskType === 'private_lifeos') {
    if (budgetMode === 'emergency_low_cost') return { strategy: 'private_local', reason: 'private_task_emergency', ...STRATEGIES.private_local };
    return { strategy: 'private_local', reason: 'private_data_requires_local', ...STRATEGIES.private_local };
  }
  if (taskType === 'vision') return { strategy: 'vision', reason: 'vision_task', ...STRATEGIES.vision };
  if (/coding|implement|debug|fix|refactor/.test(taskType)) return { strategy: 'coding', reason: 'coding_task', ...STRATEGIES.coding };
  if (/research|compare|analys/.test(taskType)) return { strategy: 'research', reason: 'research_task', ...STRATEGIES.research };
  if (budgetMode === 'economy' || budgetMode === 'emergency_low_cost') {
    return { strategy: 'economy', reason: `budget_mode_${budgetMode}`, ...STRATEGIES.economy };
  }
  if (budgetMode === 'quality') return { strategy: 'quality', reason: 'budget_mode_quality', ...STRATEGIES.quality };
  if (budgetMode === 'private') return { strategy: 'private_local', reason: 'budget_mode_private', ...STRATEGIES.private_local };
  const costEst = costEstimator.estimateCost(task, services);
  if (costEst.estimatedCost > (services.highCostThreshold || 0.05)) {
    return { strategy: 'economy', reason: 'high_estimated_cost', ...STRATEGIES.economy };
  }
  if (taskType === 'simple_chat') return { strategy: 'economy', reason: 'simple_chat_default', ...STRATEGIES.economy };
  return { strategy: 'quality', reason: 'default_quality', ...STRATEGIES.quality };
}

function getAvailableStrategies() {
  return Object.keys(STRATEGIES).map(key => ({ id: key, ...STRATEGIES[key] }));
}

async function recordStrategyChoice(record, services = {}) {
  return store.addRecord('strategies', { id: utils.createId('strat'), ...record, recordedAt: new Date().toISOString() }, services);
}

module.exports = { chooseStrategy, getAvailableStrategies, recordStrategyChoice, STRATEGIES };
