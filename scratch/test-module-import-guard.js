'use strict';
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

async function run() {
  const mod = require(path.join(ROOT, 'src/boundary/module-import-guard'));
  const report = mod.buildImportGuardReport();
  assert.ok(report, 'buildImportGuardReport should return a report');
  assert.ok(typeof report.totalIssues === 'number', 'report should have totalIssues');
  assert.ok(Array.isArray(report.missingFiles), 'report should have missingFiles array');
  console.log('PASS: test-module-import-guard — buildImportGuardReport returns report');
}
run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
