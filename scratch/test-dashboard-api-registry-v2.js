'use strict';
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

async function run() {
  const mod = require(path.join(ROOT, 'src/registry-v2/dashboard-api-registry-v2'));
  const registry = mod.buildDashboardApiRegistryV2();
  assert.ok(Array.isArray(registry), 'buildDashboardApiRegistryV2 returns array');
  assert.ok(registry.length > 0, 'registry has endpoints');
  assert.ok(registry.every(a => a.id), 'every api has id');
  assert.ok(registry.every(a => a.path), 'every api has path');
  assert.ok(registry.every(a => a.path), 'every api has path');
  assert.ok(registry.every(a => a.riskLevel), 'every api has riskLevel');
  console.log('PASS: dashboard-api-registry-v2 — ' + registry.length + ' endpoints returned');
}

run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
