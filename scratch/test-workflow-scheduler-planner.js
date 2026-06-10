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

  const mod = require(path.join(ROOT, 'src/workflow-studio/workflow-scheduler-planner'));

  check(typeof mod.createSchedulePlan === 'function', 'createSchedulePlan is a function');
  check(typeof mod.validateSchedule === 'function', 'validateSchedule is a function');
  check(typeof mod.getNextRunTime === 'function', 'getNextRunTime is a function');

  const invalid = mod.validateSchedule('');
  check(invalid.valid === false, 'Empty cron fails');

  const valid = mod.validateSchedule('0 8 * * *');
  check(valid.valid === true, 'Valid cron passes');

  const content = fs.readFileSync(path.join(ROOT, 'src/workflow-studio/workflow-scheduler-planner.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Workflow Scheduler Planner: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
