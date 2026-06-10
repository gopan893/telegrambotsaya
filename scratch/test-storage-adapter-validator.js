'use strict';
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

async function run() {
  const mod = require(path.join(ROOT, 'src/boundary/storage-adapter-validator'));
  const result = mod.validateAllStorageAdapters();
  assert.ok(result, 'validateAllStorageAdapters should return a result');
  assert.ok(Array.isArray(result), 'result should be an array');
  assert.ok(result.length >= 4, 'result should contain at least 4 adapter validations');
  console.log('PASS: test-storage-adapter-validator — validateAllStorageAdapters returns validations array');
}
run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
