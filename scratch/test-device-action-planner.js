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

  const mod = require(path.join(ROOT, 'src/devices/device-action-planner'));

  check(typeof mod.createPlan === 'function', 'createPlan is a function');
  check(typeof mod.getPlan === 'function', 'getPlan is a function');
  check(typeof mod.approvePlan === 'function', 'approvePlan is a function');
  check(typeof mod.rejectPlan === 'function', 'rejectPlan is a function');
  check(typeof mod.buildPlan === 'function', 'buildPlan is a function');

  const noParams = mod.createPlan({});
  check(noParams.ok === false, 'Missing params rejected');

  const content = fs.readFileSync(path.join(ROOT, 'src/devices/device-action-planner.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Device Action Planner: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
