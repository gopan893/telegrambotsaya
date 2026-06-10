'use strict';
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..');

async function run() {
  let passed = 0;
  let failed = 0;
  const failures = [];

  function check(ok, msg) {
    if (ok) { console.log('PASS: ' + msg); passed++; }
    else { console.log('FAIL: ' + msg); failed++; failures.push(msg); }
  }

  const mod = require(path.join(ROOT, 'src/model-strategy/model-cost-estimator'));

  check(typeof mod.estimateCost === 'function', 'estimateCost is a function');
  check(typeof mod.estimateCostForModel === 'function', 'estimateCostForModel is a function');
  check(typeof mod.compareModelCosts === 'function', 'compareModelCosts is a function');
  check(typeof mod.isWithinBudget === 'function', 'isWithinBudget is a function');
  check(mod.COST_TABLE && typeof mod.COST_TABLE === 'object', 'COST_TABLE is exported');

  const task = { input: 'How to deploy a Node.js application to production', model: 'gpt-4o' };
  const cost = mod.estimateCost(task);
  check(typeof cost === 'object', 'estimateCost returns object');
  check(typeof cost.estimatedCost === 'number', 'Has estimatedCost');
  check(cost.estimatedCost > 0, 'Cost is positive');
  check(cost.model === 'gpt-4o', 'Has model name');

  const cheapCost = mod.estimateCost({ ...task, model: 'gpt-4o-mini' });
  check(cheapCost.estimatedCost < cost.estimatedCost, 'Mini model is cheaper');

  const localCost = mod.estimateCost({ ...task, model: 'local-default' });
  check(localCost.estimatedCost === 0, 'Local model is free');

  const forModel = mod.estimateCostForModel('gpt-4o', 500);
  check(typeof forModel === 'object', 'estimateCostForModel returns object');
  check(forModel.estimatedCost > 0, 'Model cost is positive');

  const comparison = mod.compareModelCosts(['gpt-4o', 'gpt-4o-mini', 'local-default'], 500);
  check(Array.isArray(comparison), 'compareModelCosts returns array');
  check(comparison.length === 3, 'Comparison has 3 entries');

  check(mod.isWithinBudget(0.005, 0.01).within === true, 'Within budget');
  check(mod.isWithinBudget(0.02, 0.01).within === false, 'Over budget');

  const content = fs.readFileSync(path.join(ROOT, 'src/model-strategy/model-cost-estimator.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Model Cost Estimator: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
