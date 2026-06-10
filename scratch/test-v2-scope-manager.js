'use strict';
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

async function run() {
  const mod = require(path.join(ROOT, 'src/v2-planning/v2-scope-manager'));
  const result = await mod.defineV2Scope();
  assert.ok(result, 'defineV2Scope returns result');
  assert.ok(Array.isArray(result.data), 'result.data is array');
  assert.ok(result.data.length > 0, 'result.data has items');
  assert.ok(result.data.every(i => i.hasOwnProperty('category') || i.hasOwnProperty('id')), 'scope items have category/id');
  assert.ok(result.data.every(i => i.hasOwnProperty('priority')), 'scope items have priority');
  console.log('PASS: test-v2-scope-manager — defineV2Scope returns array of scope items with category/id and priority');
}
run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
