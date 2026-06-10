'use strict';
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

async function run() {
  const mod = require(path.join(ROOT, 'src/boundary/env-contract-registry'));
  const report = mod.buildEnvContractReport();
  assert.ok(report, 'buildEnvContractReport should return a report');
  assert.ok(typeof report.total === 'number', 'report should have total count');
  assert.ok(report.total >= 20, 'report should have at least 20 env contracts');
  assert.ok(report.byCategory, 'report should have byCategory');
  console.log('PASS: test-env-contract-registry — buildEnvContractReport returns report with envContracts array, at least 20 entries');
}
run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
