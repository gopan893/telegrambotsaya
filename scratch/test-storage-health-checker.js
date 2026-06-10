'use strict';
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

async function run() {
  const mod = require(path.join(ROOT, 'src/boundary/storage-health-checker'));
  const results = mod.checkAllStorageHealth();
  assert.ok(results, 'checkAllStorageHealth should return results');
  assert.ok(Array.isArray(results), 'results should be an array');
  assert.ok(results.length > 0, 'results should contain health statuses');
  results.forEach(r => assert.ok('healthy' in r, 'each result should have healthy property'));
  console.log('PASS: test-storage-health-checker — checkAllStorageHealth returns results with health statuses');
}
run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
