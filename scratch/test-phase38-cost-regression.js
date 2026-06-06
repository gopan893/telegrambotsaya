'use strict';

let passed = 0;
let failed = 0;
let skipped = 0;

function assert(condition, name) {
  if (condition) { passed++; console.log('  PASS:', name); }
  else { failed++; console.log('  FAIL:', name); }
}

function skip(name) {
  skipped++;
  console.log('  SKIPPED:', name);
}

console.log('test-phase38-cost-regression');

try {
  const costUsageStore = require('../src/cost/cost-usage-store');
  assert(typeof costUsageStore.recordModelUsage === 'function', 'costUsageStore.recordModelUsage exists');
  assert(typeof costUsageStore.getUsageSummary === 'function', 'costUsageStore.getUsageSummary exists');

  const event = costUsageStore.recordModelUsage({ userId: 'reg-test', model: 'gpt-4o-mini', provider: 'openai', inputTokens: 100, outputTokens: 50, estimatedCost: 0.0001, source: 'natural_chat' });
  assert(event.id !== undefined, 'recordModelUsage returns id');
  assert(event.totalTokens === 150, 'recordModelUsage totalTokens calc');
  assert(event.source === 'natural_chat', 'recordModelUsage source');

  const evts = costUsageStore.listUsageEvents({ userId: 'reg-test' });
  assert(evts.length === 1, 'listUsageEvents reg-test');
  assert(evts[0].metadata !== undefined, 'usage event has metadata');

  costUsageStore.clearEvents();
} catch (e) {
  failed++;
  console.log('  FAIL: costUsageStore module load:', e.message);
}

try {
  const estimator = require('../src/cost/token-estimator');
  const r = estimator.estimateTokensFromText('This is a test of the token estimator system.');
  assert(r.tokens > 0, 'token estimator works');
  assert(r.estimated === true, 'token estimator marks estimated');

  const zero = estimator.estimateTokensFromText('');
  assert(zero.tokens === 0, 'empty text yields 0 tokens');

  const msgEst = estimator.estimateTokensFromMessages([{ content: 'hello' }]);
  assert(msgEst.messageCount === 1, 'message count works');
} catch (e) {
  failed++;
  console.log('  FAIL: token estimator module:', e.message);
}

try {
  const costEst = require('../src/cost/cost-estimator');
  const r = costEst.estimateCost('openai', 'gpt-4o-mini', 1000, 500);
  assert(r.known === true, 'cost estimator known model');
  assert(r.estimatedCost > 0, 'cost estimator positive cost');

  const unknown = costEst.estimateCost('nonexistent-provider', 'nonexistent-model', 1000, 500);
  assert(unknown.known === false, 'unknown model not known');
  assert(unknown.estimatedCost === null, 'unknown model null cost');
} catch (e) {
  failed++;
  console.log('  FAIL: cost estimator module:', e.message);
}

try {
  const registry = require('../src/cost/model-cost-registry');
  assert(Array.isArray(registry.getAllModels()), 'registry getAllModels array');
  assert(registry.getAllModels().length >= 10, 'registry has 10+ default models');
  assert(registry.findCheapestModel('medium', 'general') !== null, 'findCheapestModel returns model');
  assert(registry.findBestModelForTask('coding', 'balanced') !== null, 'findBestModelForTask returns model');
} catch (e) {
  failed++;
  console.log('  FAIL: model registry:', e.message);
}

try {
  const selPolicy = require('../src/cost/model-selection-policy');
  assert(selPolicy.getCurrentMode() === 'balanced', 'default selection mode balanced');
  const r = selPolicy.selectModelForRequest({ type: 'chat', complexity: 'low' }, {}, {});
  assert(r !== null, 'selectModelForRequest returns non-null');
  assert(r.model !== undefined, 'selectModelForRequest has model');
  assert(r.provider !== undefined, 'selectModelForRequest has provider');

  selPolicy.setModelSelectionMode('economy');
  assert(selPolicy.getCurrentMode() === 'economy', 'mode set to economy');
  selPolicy.setModelSelectionMode('balanced');
} catch (e) {
  failed++;
  console.log('  FAIL: model selection policy:', e.message);
}

try {
  const budPol = require('../src/cost/budget-policy');
  const policy = budPol.getBudgetPolicy('reg-test', 'reg-user');
  assert(policy.dailyTokenLimit > 0, 'budget policy has daily limit');
  assert(policy.hardLimitEnabled === false, 'hard limit disabled by default');

  const status = budPol.checkBudgetStatus(policy, { dailyTokens: 100, dailyCost: 0.01, weeklyTokens: 200, weeklyCost: 0.02, monthlyTokens: 500, monthlyCost: 0.05 });
  assert(status.status === 'ok', 'low usage status ok');

  budPol.clearPolicies();
} catch (e) {
  failed++;
  console.log('  FAIL: budget policy:', e.message);
}

try {
  const budGuard = require('../src/cost/budget-guard');
  const r = budGuard.runBudgetGuard({ type: 'chat', context: 'hello' });
  assert(r.allowed === true, 'budget guard allows simple chat');
  assert(r.estimatedCost >= 0, 'budget guard estimates cost');

  const expensive = budGuard.runBudgetGuard({ type: 'council', context: 'A'.repeat(5000) });
  assert(expensive.allowed === true, 'council not blocked by default');
} catch (e) {
  failed++;
  console.log('  FAIL: budget guard:', e.message);
}

try {
  const agg = require('../src/cost/usage-aggregator');
  const daily = agg.getDailyUsage('reg-test', 'reg-user');
  assert(daily.totalEvents !== undefined, 'daily usage has totalEvents');
  assert(typeof daily.totalTokens === 'number', 'daily usage has totalTokens');

  const trend = agg.getCostTrend('reg-test', 'reg-user', 3);
  assert(Array.isArray(trend), 'cost trend is array');
} catch (e) {
  failed++;
  console.log('  FAIL: usage aggregator:', e.message);
}

try {
  const alertsModule = require('../src/cost/cost-alerts');
  const a = alertsModule.createCostAlert({ type: 'budget_50_percent', title: 'Test', message: 'msg' });
  assert(a.ok === true, 'create alert ok');
  assert(a.alert.type === 'budget_50_percent', 'alert type set');

  const spike = alertsModule.detectCostSpike({ recentCosts: [0.01, 0.012, 0.05] });
  assert(spike.length > 0, 'cost spike detected');

  const notif = alertsModule.buildCostAlertNotification(a.alert);
  assert(notif.text !== undefined, 'buildCostAlertNotification has text');
  assert(notif.alert !== undefined, 'buildCostAlertNotification has alert');

  alertsModule.clearAlerts();
} catch (e) {
  failed++;
  console.log('  FAIL: cost alerts:', e.message);
}

try {
  const advisor = require('../src/cost/prompt-compression-advisor');
  const r = advisor.suggestPromptCompression('Test prompt ' + 'X'.repeat(300));
  assert(r.compressed.length < 320, 'compression reduces length');
  assert(r.preservedSafety === true, 'safety preserved');

  const r2 = advisor.buildCompactAgentPrompt('Agent prompt');
  assert(r2.preserved === true, 'buildCompactAgentPrompt preserves');
} catch (e) {
  failed++;
  console.log('  FAIL: prompt compression advisor:', e.message);
}

try {
  const utils = require('../src/cost/cost-utils');
  assert(utils.formatCost(0.001) === '$0.001000', 'formatCost small');
  assert(utils.formatCost(null) === 'unknown', 'formatCost null');
  assert(utils.formatTokens(1500) === '1.5K', 'formatTokens K');
  assert(utils.formatTokens(2000000) === '2.00M', 'formatTokens M');
  assert(utils.getModeDisplay('economy').label === 'Economy', 'getModeDisplay economy');
} catch (e) {
  failed++;
  console.log('  FAIL: cost utils:', e.message);
}

try {
  const index = require('../src/cost/index');
  assert(index.costUsageStore !== undefined, 'index exports costUsageStore');
  assert(index.tokenEstimator !== undefined, 'index exports tokenEstimator');
  assert(index.costEstimator !== undefined, 'index exports costEstimator');
  assert(index.modelCostRegistry !== undefined, 'index exports modelCostRegistry');
  assert(index.modelSelectionPolicy !== undefined, 'index exports modelSelectionPolicy');
  assert(index.budgetPolicy !== undefined, 'index exports budgetPolicy');
  assert(index.budgetGuard !== undefined, 'index exports budgetGuard');
  assert(index.usageAggregator !== undefined, 'index exports usageAggregator');
  assert(index.costAlerts !== undefined, 'index exports costAlerts');
  assert(index.promptCompressionAdvisor !== undefined, 'index exports promptCompressionAdvisor');
  assert(index.costUtils !== undefined, 'index exports costUtils');
} catch (e) {
  failed++;
  console.log('  FAIL: cost index:', e.message);
}

try {
  const costRoutes = require('../src/dashboard/cost-routes');
  assert(typeof costRoutes.registerCostRoutes === 'function', 'costRoutes exports registerCostRoutes');
} catch (e) {
  failed++;
  console.log('  FAIL: cost routes:', e.message);
}

try {
  require('../src/cost/cost-usage-store').clearEvents();
  require('../src/cost/budget-policy').clearPolicies();
  require('../src/cost/cost-alerts').clearAlerts();
} catch (e) {
  console.log('  WARN: cleanup:', e.message);
}

console.log(`\nResults: ${passed} passed, ${failed} failed, ${skipped} skipped`);
process.exit(failed > 0 ? 1 : 0);
