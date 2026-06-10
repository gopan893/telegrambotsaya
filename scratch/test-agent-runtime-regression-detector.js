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

  const mod = require(path.join(ROOT, 'src/agent-runtime/agent-runtime-regression-detector'));

  check(typeof mod.detectRegression === 'function', 'detectRegression is a function');
  check(typeof mod.comparePeriods === 'function', 'comparePeriods is a function');

  const baseline = { avgLatency: 1000, avgCost: 0.01, avgQuality: 0.9, successRate: 0.95 };
  const current = { avgLatency: 5000, avgCost: 0.05, avgQuality: 0.6, successRate: 0.7 };

  const regression = mod.detectRegression(baseline, current);
  check(typeof regression === 'object', 'detectRegression returns object');
  check(regression.hasRegression === true, 'Regression detected');
  check(regression.regressions.length > 0, 'Regressions listed');

  const noBaseline = { avgLatency: 0, avgCost: 0, avgQuality: 0, successRate: 0 };
  const noRegression = mod.detectRegression(noBaseline, current);
  check(noRegression.hasRegression === false || noRegression.regressions.length === 0, 'No regression with zero baseline');

  const goodCurrent = { avgLatency: 1100, avgCost: 0.012, avgQuality: 0.88, successRate: 0.93 };
  const mildRegression = mod.detectRegression(baseline, goodCurrent);
  check(typeof mildRegression === 'object', 'Mild regression detection returns object');

  const periods = mod.comparePeriods([
    { latencyMs: 1000, success: true, createdAt: new Date(Date.now() - 3600000).toISOString() },
    { latencyMs: 2000, success: true, createdAt: new Date().toISOString() }
  ]);
  check(typeof periods === 'object', 'comparePeriods returns object');

  const content = fs.readFileSync(path.join(ROOT, 'src/agent-runtime/agent-runtime-regression-detector.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Agent Runtime Regression Detector: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
