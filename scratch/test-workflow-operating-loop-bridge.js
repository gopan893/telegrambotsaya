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

  const mod = require(path.join(ROOT, 'src/workflow-studio/workflow-operating-loop-bridge'));

  check(typeof mod.canConnectToOperatingLoop === 'function', 'canConnectToOperatingLoop is a function');
  check(typeof mod.getOperatingLoopStatus === 'function', 'getOperatingLoopStatus is a function');
  check(typeof mod.submitToOperatingLoop === 'function', 'submitToOperatingLoop is a function');
  check(typeof mod.getOperatingLoopQueue === 'function', 'getOperatingLoopQueue is a function');
  check(typeof mod.approveForOperatingLoop === 'function', 'approveForOperatingLoop is a function');
  check(typeof mod.rejectForOperatingLoop === 'function', 'rejectForOperatingLoop is a function');

  const status = mod.getOperatingLoopStatus();
  check(typeof status === 'object' && status.ok === true, 'getOperatingLoopStatus returns result');

  const content = fs.readFileSync(path.join(ROOT, 'src/workflow-studio/workflow-operating-loop-bridge.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Workflow Operating Loop Bridge: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
