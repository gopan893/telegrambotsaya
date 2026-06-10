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

  const mod = require(path.join(ROOT, 'src/workflow-studio/workflow-risk-simulator'));

  check(typeof mod.simulateRisk === 'function', 'simulateRisk is a function');
  check(typeof mod.simulateRiskData === 'function', 'simulateRiskData is a function');
  check(typeof mod.classifyWorkflowRisk === 'function', 'classifyWorkflowRisk is a function');

  const noWf = mod.simulateRiskData(null);
  check(noWf.ok === false, 'Null workflow fails');

  const content = fs.readFileSync(path.join(ROOT, 'src/workflow-studio/workflow-risk-simulator.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Workflow Risk Simulator: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
