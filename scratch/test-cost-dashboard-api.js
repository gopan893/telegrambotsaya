'use strict';

const store = require('../src/cost/cost-usage-store');
const registry = require('../src/cost/model-cost-registry');
const budgetPolicy = require('../src/cost/budget-policy');
const alerts = require('../src/cost/cost-alerts');
let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) { passed++; console.log('  PASS:', name); }
  else { failed++; console.log('  FAIL:', name); }
}

console.log('test-cost-dashboard-api');

store.clearEvents();
budgetPolicy.clearPolicies();
alerts.clearAlerts();

store.recordModelUsage({ userId: 'dash-user', model: 'gpt-4o-mini', provider: 'openai', inputTokens: 200, outputTokens: 100, estimatedCost: 0.0003, source: 'natural_chat' });

const usage = store.listUsageEvents({ userId: 'dash-user' });
assert(usage.length === 1, 'listUsageEvents returns records');
assert(usage[0].model === 'gpt-4o-mini', 'usage record model');
assert(usage[0].metadata !== undefined, 'usage has metadata');
assert(usage[0].source !== undefined, 'usage has source');

const summary = store.getUsageSummary({ userId: 'dash-user' });
assert(summary.totalEvents === 1, 'getUsageSummary count');
assert(summary.totalInputTokens === 200, 'getUsageSummary input tokens');
assert(summary.totalEstimatedCost === 0.0003, 'getUsageSummary cost');

const models = registry.getAllModels();
assert(Array.isArray(models), 'getAllModels array');
assert(models.length > 5, 'getAllModels has default models');
const enabledModels = registry.getEnabledModels();
assert(enabledModels.length <= models.length, 'getEnabledModels filtered');

const openaiModel = registry.getModelEntry('openai', 'gpt-4o-mini');
assert(openaiModel !== null, 'getModelEntry found');
assert(openaiModel.inputCostPerMillionTokens === 0.15, 'getModelEntry cost correct');

const policy = budgetPolicy.getBudgetPolicy('dash-ws', 'dash-user');
assert(policy.dailyTokenLimit === 1000000, 'budgetPolicy default daily limit');
const updated = budgetPolicy.updateBudgetPolicy({ workspaceId: 'dash-ws', userId: 'dash-user', dailyTokenLimit: 50000 });
assert(updated.ok === true, 'budgetPolicy update');
assert(updated.policy.dailyTokenLimit === 50000, 'budgetPolicy new limit');

const alertResult = alerts.createCostAlert({ type: 'budget_80_percent', title: '80% Budget', message: 'Test alert', workspaceId: 'dash-ws' });
assert(alertResult.ok === true, 'createCostAlert');
const allAlerts = alerts.listAlerts({});
assert(allAlerts.length === 1, 'listAlerts count');

const stored = store.listUsageEvents({ userId: 'dash-user', model: 'gpt-4o-mini' });
assert(stored.length === 1, 'listUsageEvents with model filter');

const srcFiltered = store.listUsageEvents({ userId: 'dash-user', source: 'natural_chat' });
assert(srcFiltered.length === 1, 'listUsageEvents with source filter');

store.clearEvents();
assert(store.getEventsCount() === 0, 'clearEvents');

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
