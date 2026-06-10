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

  const mod = require(path.join(ROOT, 'src/local-nodes/local-node-safety-boundary'));

  check(typeof mod.isActionWithinBoundary === 'function', 'isActionWithinBoundary is a function');
  check(typeof mod.validateNodeAction === 'function', 'validateNodeAction is a function');
  check(typeof mod.getBlockedActions === 'function', 'getBlockedActions is a function');
  check(typeof mod.getSafeActions === 'function', 'getSafeActions is a function');
  check(typeof mod.checkBoundaryViolation === 'function', 'checkBoundaryViolation is a function');

  const safe = mod.isActionWithinBoundary('read_state', 'termux');
  check(safe.allowed === true, 'read_state is within boundary');

  const blocked = mod.isActionWithinBoundary('exec_command', 'termux');
  check(blocked.allowed === false, 'exec_command is blocked');

  const blockedActions = mod.getBlockedActions();
  check(Array.isArray(blockedActions) && blockedActions.length > 0, 'getBlockedActions returns array');

  const content = fs.readFileSync(path.join(ROOT, 'src/local-nodes/local-node-safety-boundary.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Local Node Safety Boundary: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
