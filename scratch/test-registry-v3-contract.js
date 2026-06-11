'use strict';

const assert = require('assert');

console.log('=== Registry v3 Contract Test ===\n');

try {
  const contract = require('../src/registry-v3/registry-v3-contract');

  console.log('Testing createEmptyRegistryV3Item...');
  const empty = contract.createEmptyRegistryV3Item();
  assert.strictEqual(empty.version, '3.0.0');
  assert.strictEqual(empty.status, 'draft');
  assert.strictEqual(empty.visibility, 'internal');
  assert.strictEqual(empty.riskLevel, 'low');
  assert.strictEqual(Array.isArray(empty.aliases), true);
  assert.strictEqual(empty.enabled, true);
  console.log('  PASS: empty item has correct defaults');

  console.log('Testing createRegistryV3Item...');
  const item = contract.createRegistryV3Item({
    id: 'test_tab',
    type: 'dashboard_tab',
    title: 'Test Tab',
    description: 'A test dashboard tab',
    status: 'active',
    visibility: 'public',
    riskLevel: 'low',
    requiresAuth: true,
    aliases: ['test', 'testing']
  });
  assert.strictEqual(item.id, 'test_tab');
  assert.strictEqual(item.type, 'dashboard_tab');
  assert.strictEqual(item.title, 'Test Tab');
  assert.strictEqual(item.status, 'active');
  assert.strictEqual(item.requiresAuth, true);
  assert.ok(item.aliases.includes('test'));
  console.log('  PASS: item created with all fields');

  console.log('Testing validateRegistryV3ItemContract...');
  const valid = contract.validateRegistryV3ItemContract(item);
  assert.strictEqual(valid.valid, true);
  assert.strictEqual(valid.errors.length, 0);
  console.log('  PASS: valid item passes validation');

  const invalid = contract.validateRegistryV3ItemContract(null);
  assert.strictEqual(invalid.valid, false);
  console.log('  PASS: null item fails validation');

  const criticalBad = contract.validateRegistryV3ItemContract({
    ...item,
    riskLevel: 'critical',
    directRunAllowed: true
  });
  assert.strictEqual(criticalBad.valid, false);
  console.log('  PASS: critical item with directRunAllowed fails');

  console.log('Testing getDashboardTabContract...');
  const tab = contract.getDashboardTabContract(item);
  assert.strictEqual(tab.id, 'test_tab');
  assert.strictEqual(tab.dataTab, 'test_tab');
  assert.strictEqual(tab.href, '#test_tab');
  assert.strictEqual(tab.stable, true);
  console.log('  PASS: tab contract generated correctly');

  console.log('Testing getDashboardApiContract...');
  const api = contract.getDashboardApiContract(item);
  assert.strictEqual(api.id, 'test_tab');
  assert.strictEqual(api.path, '/api/dashboard/test_tab');
  console.log('  PASS: API contract generated correctly');

  console.log('Testing getTelegramCommandContract...');
  const cmd = contract.getTelegramCommandContract(item);
  assert.strictEqual(cmd.id, 'test_tab');
  assert.ok(cmd.handlerName);
  console.log('  PASS: command contract generated correctly');

  console.log('Testing getCapabilityContract...');
  const cap = contract.getCapabilityContract(item);
  assert.strictEqual(cap.id, 'test_tab');
  assert.ok(cap.action);
  console.log('  PASS: capability contract generated correctly');

  console.log('\n✅ All registry v3 contract tests passed\n');
  process.exit(0);
} catch (e) {
  console.error('❌ Test failed:', e.message);
  process.exit(1);
}