'use strict';
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

async function run() {
  const mod = require(path.join(ROOT, 'src/registry-v2/capability-registry-v2'));
  const capabilities = mod.buildCapabilityRegistryV2();
  assert.ok(Array.isArray(capabilities), 'buildCapabilityRegistryV2 returns array');
  assert.ok(capabilities.length > 0, 'capabilities array is not empty');
  assert.ok(capabilities.every(c => c.id), 'every capability has id');
  assert.ok(capabilities.every(c => c.module), 'every capability has module');
  assert.ok(capabilities.every(c => c.riskLevel), 'every capability has riskLevel');
  console.log('PASS: capability-registry-v2 — ' + capabilities.length + ' capabilities returned');
}

run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
