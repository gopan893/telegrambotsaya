'use strict';

const alerts = require('../src/cost/cost-alerts');
let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) { passed++; console.log('  PASS:', name); }
  else { failed++; console.log('  FAIL:', name); }
}

console.log('test-cost-alerts');

const r1 = alerts.createCostAlert(null);
assert(r1.ok === false, 'createCostAlert null');

const r2 = alerts.createCostAlert({ type: 'test', title: 'Test Alert', message: 'This is a test' });
assert(r2.ok === true, 'createCostAlert basic');
assert(r2.alert.type === 'test', 'createCostAlert type');
assert(r2.alert.severity === 'warning', 'createCostAlert default severity');
assert(r2.alert.acknowledged === false, 'createCostAlert not acknowledged');

const budgetAlerts = alerts.detectBudgetThresholdAlert(
  { dailyCost: 90, monthlyCost: 60, workspaceId: 'ws1', userId: 'user1' },
  { dailyCostLimit: 100, monthlyCostLimit: 100, warningThresholdPercent: 80 },
  {}
);
assert(Array.isArray(budgetAlerts), 'detectBudgetThresholdAlert returns array');

const budgetAlerts2 = alerts.detectBudgetThresholdAlert(
  { dailyCost: 50, monthlyCost: 30, workspaceId: 'ws1', userId: 'user1' },
  { dailyCostLimit: 100, monthlyCostLimit: 100, warningThresholdPercent: 80 },
  {}
);
assert(budgetAlerts2.length === 0, 'detectBudgetThresholdAlert under threshold');

const spikeAlerts = alerts.detectCostSpike({ recentCosts: [0.1, 0.12, 0.5], workspaceId: 'ws1' });
assert(spikeAlerts.length > 0, 'detectCostSpike detected');
assert(spikeAlerts[0].type === 'cost_spike', 'detectCostSpike type');

const spikeAlerts2 = alerts.detectCostSpike({ recentCosts: [] });
assert(spikeAlerts2.length === 0, 'detectCostSpike empty');

const notif = alerts.buildCostAlertNotification(null);
assert(notif.text === 'No alert.', 'buildCostAlertNotification null');

const alertR = alerts.createCostAlert({ type: 'test2', title: 'Test2', message: 'msg', severity: 'critical' });
const notif2 = alerts.buildCostAlertNotification(alertR.alert);
assert(notif2.text.includes('🚨'), 'buildCostAlertNotification critical emoji');

const dup = alerts.suppressDuplicateCostAlert({ type: 'dup', workspaceId: 'w1', userId: 'u1' });
assert(dup === false, 'suppressDuplicateCostAlert first call');

const dup2 = alerts.suppressDuplicateCostAlert({ type: 'dup', workspaceId: 'w1', userId: 'u1' });
assert(dup2 === true, 'suppressDuplicateCostAlert duplicate');

const list = alerts.listAlerts({ limit: 10 });
assert(Array.isArray(list), 'listAlerts returns array');

const ack = alerts.acknowledgeAlert('nonexistent');
assert(ack.ok === false, 'acknowledgeAlert nonexistent');

if (list.length > 0) {
  const ack2 = alerts.acknowledgeAlert(list[0].id);
  assert(ack2.ok === true, 'acknowledgeAlert existing');
}

alerts.clearAlerts();
const listAfter = alerts.listAlerts({});
assert(listAfter.length === 0, 'clearAlerts empties');

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
