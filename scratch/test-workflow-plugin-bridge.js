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

  const mod = require(path.join(ROOT, 'src/workflow-studio/workflow-plugin-bridge'));

  check(typeof mod.createPluginActionStep === 'function', 'createPluginActionStep is a function');
  check(typeof mod.validatePluginParams === 'function', 'validatePluginParams is a function');
  check(typeof mod.getPluginActionTypes === 'function', 'getPluginActionTypes is a function');

  const noParams = mod.createPluginActionStep();
  check(noParams.ok === false, 'Missing params rejected');

  const step = mod.createPluginActionStep('plugin1', 'invoke');
  check(step.ok === true, 'Create plugin step succeeds');

  const content = fs.readFileSync(path.join(ROOT, 'src/workflow-studio/workflow-plugin-bridge.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Workflow Plugin Bridge: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
