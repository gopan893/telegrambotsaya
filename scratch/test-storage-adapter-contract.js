'use strict';
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

async function run() {
  const mod = require(path.join(ROOT, 'src/boundary/storage-adapter-contract'));
  const result = mod.buildStorageAdapterContractReport();
  assert.ok(result, 'buildStorageAdapterContractReport should return a report');
  assert.ok(Array.isArray(result.results), 'report should have results array');
  assert.ok(result.results.length > 0, 'results array should not be empty');
  console.log('PASS: test-storage-adapter-contract — buildStorageAdapterContractReport returns report with contracts array');
}
run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
