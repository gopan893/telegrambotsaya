'use strict';
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

async function run() {
  const mod = require(path.join(ROOT, 'src/boundary/storage-compatibility-bridge'));
  const report = mod.buildStorageCompatibilityReport();
  assert.ok(report, 'buildStorageCompatibilityReport should return a report');
  assert.ok(typeof report.total === 'number', 'report should have total');
  assert.ok(Array.isArray(report.mappings), 'report should have mappings array');
  console.log('PASS: test-storage-compatibility-bridge — buildStorageCompatibilityReport returns report');
}
run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
