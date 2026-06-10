'use strict';
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

async function run() {
  const mod = require(path.join(ROOT, 'src/registry-v2/registry-v2-compatibility-bridge'));
  const report = mod.buildCompatibilityBridgeReport();
  assert.ok(report, 'buildCompatibilityBridgeReport returns report');
  assert.ok(typeof report.legacyDashboardCount === 'number', 'report has legacyDashboardCount');
  assert.ok(typeof report.legacyCommandCount === 'number', 'report has legacyCommandCount');
  assert.ok(typeof report.legacyCapabilityCount === 'number', 'report has legacyCapabilityCount');
  assert.ok(typeof report.aliasesResolvable === 'number', 'report has aliasesResolvable');
  assert.strictEqual(report.compatMode, 'full', 'compatMode is full');
  console.log('PASS: registry-v2-compatibility-bridge — dashboard=' + report.legacyDashboardCount + ', commands=' + report.legacyCommandCount + ', capabilities=' + report.legacyCapabilityCount + ', aliases=' + report.aliasesResolvable);
}

run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
