'use strict';
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

async function run() {
  const mod = require(path.join(ROOT, 'src/boundary/storage-access-registry'));
  const result = mod.buildStorageAccessReport();
  assert.ok(result, 'buildStorageAccessReport should return a report');
  assert.ok(Array.isArray(result.unsafe), 'report should have unsafe array');
  assert.ok(result.validation, 'report should have validation');
  assert.ok(typeof result.total === 'number', 'report should have total count');
  console.log('PASS: test-storage-access-registry — buildStorageAccessReport returns report with total, validation, unsafe');
}
run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
