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

  const mod = require(path.join(ROOT, 'src/workflow-studio/workflow-rag-bridge'));

  check(typeof mod.createRagSearchStep === 'function', 'createRagSearchStep is a function');
  check(typeof mod.validateRagParams === 'function', 'validateRagParams is a function');
  check(typeof mod.getRagIntents === 'function', 'getRagIntents is a function');

  const noParams = mod.createRagSearchStep();
  check(noParams.ok === false, 'Missing query rejected');

  const step = mod.createRagSearchStep('test query');
  check(step.ok === true, 'Create RAG step succeeds');
  check(step.step && step.step.type === 'rag_search', 'Step has correct type');

  const content = fs.readFileSync(path.join(ROOT, 'src/workflow-studio/workflow-rag-bridge.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Workflow RAG Bridge: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
