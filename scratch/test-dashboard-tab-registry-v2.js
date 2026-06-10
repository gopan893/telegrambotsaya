'use strict';
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

async function run() {
  const mod = require(path.join(ROOT, 'src/registry-v2/dashboard-tab-registry-v2'));
  const registry = mod.buildDashboardTabRegistryV2();
  assert.ok(Array.isArray(registry), 'buildDashboardTabRegistryV2 returns array');
  assert.ok(registry.length >= 20, `expected at least 20 tabs, got ${registry.length}`);
  assert.ok(registry.every(t => t.id), 'every tab has id');
  assert.ok(registry.every(t => t.title), 'every tab has title');
  console.log('PASS: dashboard-tab-registry-v2 — ' + registry.length + ' tabs returned');
}

run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
