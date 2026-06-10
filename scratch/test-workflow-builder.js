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

  const mod = require(path.join(ROOT, 'src/workflow-studio/workflow-builder'));

  check(typeof mod.createWorkflow === 'function', 'createWorkflow is a function');
  check(typeof mod.addStep === 'function', 'addStep is a function');
  check(typeof mod.removeStep === 'function', 'removeStep is a function');
  check(typeof mod.getWorkflow === 'function', 'getWorkflow is a function');
  check(typeof mod.listWorkflows === 'function', 'listWorkflows is a function');
  check(typeof mod.deleteWorkflow === 'function', 'deleteWorkflow is a function');

  const noName = mod.createWorkflow({});
  check(noName.ok === false, 'Missing name rejected');

  const result = mod.createWorkflow({ name: 'Test WF' });
  check(result.ok === true, 'Create workflow succeeds');

  const content = fs.readFileSync(path.join(ROOT, 'src/workflow-studio/workflow-builder.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Workflow Builder: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
