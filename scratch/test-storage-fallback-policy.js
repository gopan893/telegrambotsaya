'use strict';
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

async function run() {
  const mod = require(path.join(ROOT, 'src/boundary/storage-fallback-policy'));
  const policy = mod.getStorageFallbackPolicy('core');
  assert.ok(policy, 'getStorageFallbackPolicy should return a policy object');
  assert.ok(policy.primary, 'policy should have primary storage');
  assert.ok(policy.module, 'policy should have module name');
  console.log('PASS: test-storage-fallback-policy — getStorageFallbackPolicy returns policy object');
}
run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
