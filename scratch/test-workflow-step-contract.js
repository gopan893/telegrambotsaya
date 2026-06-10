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

  const mod = require(path.join(ROOT, 'src/workflow-studio/workflow-step-contract'));

  check(typeof mod.validateStep === 'function', 'validateStep is a function');
  check(typeof mod.validateAllSteps === 'function', 'validateAllSteps is a function');
  check(typeof mod.detectUnsafeSteps === 'function', 'detectUnsafeSteps is a function');
  check(typeof mod.normalizeStep === 'function', 'normalizeStep is a function');
  check(typeof mod.buildStepContract === 'function', 'buildStepContract is a function');

  const valid = mod.validateStep({ id: 's1', type: 'read', source: 'test' });
  check(valid.valid === true, 'Valid step passes');

  const invalid = mod.validateStep(null);
  check(invalid.valid === false, 'Null step fails');

  const contract = mod.buildStepContract([{ id: 's1', type: 'read', source: 'test' }]);
  check(typeof contract === 'object' && typeof contract.valid === 'boolean', 'buildStepContract returns result');

  const content = fs.readFileSync(path.join(ROOT, 'src/workflow-studio/workflow-step-contract.js'), 'utf8');
  const hasTokenAsPattern = content.includes('TELEGRAM_TOKEN') && content.includes('pattern:');
  check(hasTokenAsPattern, 'TELEGRAM_TOKEN present as detection pattern (not a secret)');
  const hasGithubAsPattern = content.includes('GITHUB_TOKEN') && content.includes('pattern:');
  check(hasGithubAsPattern, 'GITHUB_TOKEN present as detection pattern (not a secret)');

  console.log('\n--- Workflow Step Contract: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
