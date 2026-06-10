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

  const mod = require(path.join(ROOT, 'src/model-strategy/model-budget-governor'));

  check(typeof mod.getBudgetMode === 'function', 'getBudgetMode is a function');
  check(typeof mod.getBudgetConfig === 'function', 'getBudgetConfig is a function');
  check(typeof mod.checkBudget === 'function', 'checkBudget is a function');
  check(typeof mod.getSpendSummary === 'function', 'getSpendSummary is a function');
  check(typeof mod.setBudgetMode === 'function', 'setBudgetMode is a function');
  check(typeof mod.isCriticalTask === 'function', 'isCriticalTask is a function');
  check(mod.BUDGET_MODES && typeof mod.BUDGET_MODES === 'object', 'BUDGET_MODES is exported');

  check(mod.getBudgetMode() === 'normal', 'Default budget mode is normal');
  check(mod.getBudgetMode({ budgetMode: 'economy' }) === 'economy', 'Custom budget mode set');

  const normalConfig = mod.getBudgetConfig('normal');
  check(typeof normalConfig === 'object', 'getBudgetConfig returns object');
  check(typeof normalConfig.maxCostPerSession === 'number', 'Has maxCostPerSession');

  const economyConfig = mod.getBudgetConfig('economy');
  check(economyConfig.maxCostPerSession < normalConfig.maxCostPerSession, 'Economy has lower limit');

  const budgetCheck = mod.checkBudget({ class: 'coding' }, 0.05);
  check(typeof budgetCheck === 'object', 'checkBudget returns object');
  check(typeof budgetCheck.allowed === 'boolean', 'Has allowed');

  const overBudget = mod.checkBudget({ class: 'coding' }, 1.0, { budgetMode: 'economy' });
  check(overBudget.allowed === false, 'Over economy budget detected');

  check(mod.isCriticalTask({ type: 'security_incident' }) === true, 'Security incident is critical');
  check(mod.isCriticalTask({ class: 'coding' }) === false, 'Coding is not critical');

  const summary = mod.getSpendSummary();
  check(typeof summary === 'object', 'getSpendSummary returns object');

  const content = fs.readFileSync(path.join(ROOT, 'src/model-strategy/model-budget-governor.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Model Budget Governor: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
