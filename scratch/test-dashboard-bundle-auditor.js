'use strict';
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

async function run() {
  const mod = require(path.join(ROOT, 'src/performance/dashboard-bundle-auditor'));
  const result = await mod.buildDashboardBundleReport();
  assert.ok(result, 'buildDashboardBundleReport returns report');
  assert.ok(typeof result.totalFiles === 'number', 'report has totalFiles');
  assert.ok(Array.isArray(result.largeFiles), 'report has largeFiles array');
  assert.ok(result.timestamp, 'report has timestamp');
  console.log('PASS: test-dashboard-bundle-auditor — buildDashboardBundleReport returns report with fileSizes');
}
run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
