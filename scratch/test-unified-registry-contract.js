'use strict';
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

async function run() {
  const mod = require(path.join(ROOT, 'src/registry-v2/unified-registry-contract'));
  const item = mod.createUnifiedItem({ id: 'test-item', type: 'dashboard_tab', title: 'Test', module: 'test' });
  assert.ok(item, 'createUnifiedItem returns item');
  assert.strictEqual(item.id, 'test-item');
  assert.strictEqual(item.type, 'dashboard_tab');
  const errors = mod.validateUnifiedItem(item);
  assert.ok(Array.isArray(errors), 'validateUnifiedItem returns array');
  assert.strictEqual(errors.length, 0, 'valid item has no errors');
  const invalidErrors = mod.validateUnifiedItem({});
  assert.ok(invalidErrors.length > 0, 'invalid item has errors');
  assert.ok(mod.isUnifiedItemValid(item), 'isUnifiedItemValid returns true for valid item');
  console.log('PASS: unified-registry-contract — createUnifiedItem + validateUnifiedItem work correctly');
}

run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
