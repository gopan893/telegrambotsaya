'use strict';
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

async function run() {
  const mod = require(path.join(ROOT, 'src/performance/performance-budget-manager'));
  const budgets = await mod.buildDefaultPerformanceBudgets();
  assert.ok(Array.isArray(budgets), 'buildDefaultPerformanceBudgets returns array');
  assert.ok(budgets.length > 0, 'budgets array has items');
  assert.ok(budgets[0].id, 'budget item has id');
  assert.ok(budgets[0].enabled !== undefined, 'budget item has enabled flag');

  const evaluation = await mod.evaluatePerformanceBudgets();
  assert.ok(Array.isArray(evaluation), 'evaluatePerformanceBudgets returns array');
  assert.ok(evaluation.length > 0, 'evaluation array has items');
  assert.ok(evaluation[0].status, 'evaluation item has status');
  console.log('PASS: test-performance-budget-manager — buildDefaultPerformanceBudgets returns budgets array, evaluatePerformanceBudgets returns evaluation');
}
run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
