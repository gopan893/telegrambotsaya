'use strict';
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

async function run() {
  const mod = require(path.join(ROOT, 'src/v2-release/v2-regression-suite-runner'));
  const result = mod.runV2RegressionSuite({});
  assert.ok(result, 'runV2RegressionSuite returns report');
  assert.ok(result.suites, 'report has suites');

  console.log('PASS: test-v2-regression-suite-runner — runV2RegressionSuite returns report with results per suite');
}
run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
