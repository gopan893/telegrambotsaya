'use strict';
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

async function run() {
  const mod = require(path.join(ROOT, 'src/v2-release/v2-compatibility-checker'));
  const report = mod.buildV2CompatibilityReport();
  assert.ok(report, 'buildV2CompatibilityReport returns report');
  assert.ok(report.checks, 'report has compatChecks');

  console.log('PASS: test-v2-compatibility-checker — buildV2CompatibilityReport returns report with compatChecks');
}
run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
