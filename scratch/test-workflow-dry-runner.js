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

  const mod = require(path.join(ROOT, 'src/workflow-studio/workflow-dry-runner'));

  check(typeof mod.dryRun === 'function', 'dryRun is a function');
  check(typeof mod.dryRunData === 'function', 'dryRunData is a function');
  check(typeof mod.simulateDryRun === 'function', 'simulateDryRun is a function');

  const noWf = mod.dryRunData(null);
  check(noWf.ok === false, 'Null workflow fails');

  const content = fs.readFileSync(path.join(ROOT, 'src/workflow-studio/workflow-dry-runner.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Workflow Dry Runner: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
