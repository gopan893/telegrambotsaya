'use strict';
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

async function run() {
  const mod = require(path.join(ROOT, 'src/boundary/module-lifecycle-manager'));
  const statuses = mod.listModuleLifecycleStatus();
  assert.ok(statuses, 'listModuleLifecycleStatus should return statuses');
  assert.ok(Array.isArray(statuses), 'statuses should be an array');
  statuses.forEach(s => assert.ok(s.module, 'each status should have module name'));
  console.log('PASS: test-module-lifecycle-manager — listModuleLifecycleStatus returns status array');
}
run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
