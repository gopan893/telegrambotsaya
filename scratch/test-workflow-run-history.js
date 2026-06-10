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

  const mod = require(path.join(ROOT, 'src/workflow-studio/workflow-run-history'));

  check(typeof mod.getRunHistory === 'function', 'getRunHistory is a function');
  check(typeof mod.getRunStats === 'function', 'getRunStats is a function');
  check(typeof mod.getLatestRun === 'function', 'getLatestRun is a function');
  check(typeof mod.formatRunEntry === 'function', 'formatRunEntry is a function');

  const stats = mod.getRunStats();
  check(typeof stats === 'object' && typeof stats.total === 'number', 'getRunStats returns stats');

  const content = fs.readFileSync(path.join(ROOT, 'src/workflow-studio/workflow-run-history.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Workflow Run History: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
