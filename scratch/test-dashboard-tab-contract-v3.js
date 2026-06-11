'use strict';

const assert = require('assert');

console.log('=== Dashboard Tab Contract v3 Test ===\n');

try {
  const tabContract = require('../src/route-generation/dashboard-tab-contract-v3');
  const contract = require('../src/registry-v3/registry-v3-contract');

  const services = { logger: console };

  const item = contract.createRegistryV3Item({
    id: 'test_tab',
    type: 'dashboard_tab',
    title: 'Test Tab',
    description: 'A test dashboard tab',
    status: 'active',
    visibility: 'public',
    requiresAuth: true,
    group: 'General'
  });

  console.log('Testing buildDashboardTabContractV3...');
  const result = tabContract.buildDashboardTabContractV3(item, services);
  assert.ok(result.success);
  assert.strictEqual(result.contract.id, 'test_tab');
  assert.strictEqual(result.contract.dataTab, 'test_tab');
  assert.strictEqual(result.contract.href, '#test_tab');
  assert.strictEqual(result.contract.stable, true);
  console.log('  PASS: tab contract built correctly');

  console.log('Testing buildDashboardTabContractV3 with wrong type...');
  const bad = tabContract.buildDashboardTabContractV3({ ...item, type: 'module' }, services);
  assert.strictEqual(bad.success, false);
  console.log('  PASS: wrong type rejected');

  console.log('Testing validateDashboardTabContractV3...');
  const validation = tabContract.validateDashboardTabContractV3(result.contract, services);
  assert.ok(validation);
  assert.strictEqual(validation.valid, true);
  console.log('  PASS: valid tab contract passes validation');

  const invalidValidation = tabContract.validateDashboardTabContractV3({}, services);
  assert.strictEqual(invalidValidation.valid, false);
  console.log('  PASS: invalid tab contract fails validation');

  console.log('Testing normalizeDashboardTabContractFromV2...');
  const normalized = tabContract.normalizeDashboardTabContractFromV2({ id: 'oldtab', title: 'Old Tab' }, services);
  assert.ok(normalized);
  console.log('  PASS: v2 tab normalized to v3');

  console.log('Testing buildDashboardTabContractReport...');
  const store = require('../src/registry-v3/registry-v3-store');
  store.clear();
  store.setFrozen({ version: '3.0.0', items: [item] });
  const report = tabContract.buildDashboardTabContractReport({ ...services, store });
  assert.ok(report);
  console.log('  PASS: tab contract report built');

  store.clear();

  console.log('\n✅ All dashboard tab contract v3 tests passed\n');
  process.exit(0);
} catch (e) {
  console.error('❌ Test failed:', e.message);
  process.exit(1);
}