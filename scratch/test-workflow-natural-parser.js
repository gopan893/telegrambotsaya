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

  const mod = require(path.join(ROOT, 'src/workflow-studio/workflow-natural-parser'));

  check(typeof mod.parseNaturalLanguage === 'function', 'parseNaturalLanguage is a function');
  check(typeof mod.classifyIntent === 'function', 'classifyIntent is a function');

  const result = mod.parseNaturalLanguage('send a notification about errors');
  check(result.ok === true, 'Parse succeeds');
  check(Array.isArray(result.steps) && result.steps.length > 0, 'Parse produces steps');

  const empty = mod.parseNaturalLanguage('');
  check(empty.ok === false, 'Empty input rejected');

  const intent = mod.classifyIntent('deploy the application');
  check(intent === 'deployment', 'Intent classified as deployment');

  const content = fs.readFileSync(path.join(ROOT, 'src/workflow-studio/workflow-natural-parser.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Workflow Natural Parser: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
