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

  const mod = require(path.join(ROOT, 'src/local-nodes/local-node-health-checker'));

  check(typeof mod.checkNodeHealth === 'function', 'checkNodeHealth is a function');
  check(typeof mod.aggregateNodeHealth === 'function', 'aggregateNodeHealth is a function');
  check(typeof mod.detectUnhealthyNodes === 'function', 'detectUnhealthyNodes is a function');

  const stats = mod.aggregateNodeHealth();
  check(typeof stats === 'object' && typeof stats.total === 'number', 'aggregateNodeHealth returns stats');

  const content = fs.readFileSync(path.join(ROOT, 'src/local-nodes/local-node-health-checker.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Local Node Health Checker: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
