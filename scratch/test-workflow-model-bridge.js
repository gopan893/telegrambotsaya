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

  const mod = require(path.join(ROOT, 'src/workflow-studio/workflow-model-bridge'));

  check(typeof mod.createModelRouteStep === 'function', 'createModelRouteStep is a function');
  check(typeof mod.validateModelParams === 'function', 'validateModelParams is a function');
  check(typeof mod.getModelRouteTypes === 'function', 'getModelRouteTypes is a function');

  const noParams = mod.createModelRouteStep();
  check(noParams.ok === false, 'Missing model rejected');

  const step = mod.createModelRouteStep('llama2');
  check(step.ok === true, 'Create model step succeeds');
  check(step.step && step.step.type === 'model_route', 'Step has correct type');

  const content = fs.readFileSync(path.join(ROOT, 'src/workflow-studio/workflow-model-bridge.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Workflow Model Bridge: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
