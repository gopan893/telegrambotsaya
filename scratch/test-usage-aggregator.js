'use strict';

const store = require('../src/cost/cost-usage-store');
const aggregator = require('../src/cost/usage-aggregator');
let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) { passed++; console.log('  PASS:', name); }
  else { failed++; console.log('  FAIL:', name); }
}

console.log('test-usage-aggregator');

store.recordModelUsage({ userId: 'user1', model: 'gpt-4o-mini', provider: 'openai', inputTokens: 100, outputTokens: 50, estimatedCost: 0.0001, source: 'natural_chat', requestType: 'chat' });
store.recordModelUsage({ userId: 'user1', model: 'gpt-4o', provider: 'openai', inputTokens: 500, outputTokens: 200, estimatedCost: 0.002, source: 'agent_router', requestType: 'analysis', agentId: 'agent1' });
store.recordModelUsage({ userId: 'user1', model: 'mistral-small', provider: 'mistral', inputTokens: 200, outputTokens: 100, estimatedCost: 0.0005, source: 'council', requestType: 'council', agentId: 'agent2' });

const daily = aggregator.getDailyUsage('default', 'user1');
assert(daily.totalEvents === 3, 'getDailyUsage totalEvents');
assert(daily.totalTokens > 0, 'getDailyUsage totalTokens');
assert(daily.totalEstimatedCost > 0, 'getDailyUsage totalEstimatedCost');

const weekly = aggregator.getWeeklyUsage('default', 'user1');
assert(weekly.totalEvents === 3, 'getWeeklyUsage totalEvents');

const monthly = aggregator.getMonthlyUsage('default', 'user1');
assert(monthly.totalEvents === 3, 'getMonthlyUsage totalEvents');

const byAgent = aggregator.getUsageByAgent('default', 'user1');
assert(Object.keys(byAgent).length > 0, 'getUsageByAgent has agents');
assert(byAgent['agent1'] !== undefined, 'getUsageByAgent agent1');

const byModel = aggregator.getUsageByModel('default', 'user1');
assert(Object.keys(byModel).length > 0, 'getUsageByModel has models');
assert(byModel['gpt-4o-mini'] !== undefined, 'getUsageByModel gpt-4o-mini');

const byFeature = aggregator.getUsageByFeature('default', 'user1');
assert(Object.keys(byFeature).length > 0, 'getUsageByFeature has features');

const expensive = aggregator.getTopExpensiveWorkflows('default', 'user1', 5);
assert(expensive.length <= 5, 'getTopExpensiveWorkflows limit');
assert(expensive.length > 0, 'getTopExpensiveWorkflows has results');

const trend = aggregator.getCostTrend('default', 'user1', 3);
assert(Array.isArray(trend), 'getCostTrend array');
assert(trend.length <= 3, 'getCostTrend days limit');

store.clearEvents();
console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
