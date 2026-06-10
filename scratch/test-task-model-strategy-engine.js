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

  const mod = require(path.join(ROOT, 'src/model-strategy/task-model-strategy-engine'));

  check(typeof mod.chooseStrategy === 'function', 'chooseStrategy is a function');
  check(typeof mod.getAvailableStrategies === 'function', 'getAvailableStrategies is a function');
  check(mod.STRATEGIES && typeof mod.STRATEGIES === 'object', 'STRATEGIES is exported');

  const privateTask = { class: 'private_lifeos', sensitivity: 'high', description: 'Personal note' };
  const privateStrategy = mod.chooseStrategy(privateTask, {});
  check(privateStrategy.strategy === 'private_local', 'Private task uses private_local strategy');

  const codingTask = { class: 'coding', type: 'coding_light', description: 'Fix a bug' };
  const codingStrategy = mod.chooseStrategy(codingTask, {});
  check(typeof codingStrategy.strategy === 'string', 'Coding task has strategy');

  const researchTask = { class: 'research', description: 'Analyze codebase' };
  const researchStrategy = mod.chooseStrategy(researchTask, {});
  check(typeof researchStrategy.strategy === 'string', 'Research task has strategy');

  const strategies = mod.getAvailableStrategies();
  check(Array.isArray(strategies), 'getAvailableStrategies returns array');
  check(strategies.length > 0, 'Has available strategies');

  const content = fs.readFileSync(path.join(ROOT, 'src/model-strategy/task-model-strategy-engine.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Task Model Strategy Engine: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
