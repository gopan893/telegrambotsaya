'use strict';

const assert = require('assert');

console.log('=== Dashboard API Contract v3 Test ===\n');

try {
  const apiContract = require('../src/route-generation/dashboard-api-contract-v3');
  const contract = require('../src/registry-v3/registry-v3-contract');

  const services = { logger: console };

  const item = contract.createRegistryV3Item({
    id: 'test_api',
    type: 'dashboard_api',
    title: 'Test API',
    description: 'A test API endpoint',
    status: 'active',
    riskLevel: 'low',
    actionType: 'read',
    requiresAuth: true
  });

  console.log('Testing buildDashboardApiContractV3...');
  const result = apiContract.buildDashboardApiContractV3(item, services);
  assert.ok(result.success);
  assert.strictEqual(result.contract.id, 'test_api');
  assert.strictEqual(result.contract.path, '/api/dashboard/test_api');
  assert.strictEqual(result.contract.method, 'GET');
  console.log('  PASS: API contract built correctly');

  console.log('Testing validateDashboardApiContractV3...');
  const validation = apiContract.validateDashboardApiContractV3(result.contract, services);
  assert.ok(validation);
  console.log('  PASS: API contract validation executed');

  console.log('Testing normalizeApiContractFromV2...');
  const normalized = apiContract.normalizeApiContractFromV2({ id: 'oldapi', path: '/api/old' }, services);
  assert.ok(normalized);
  console.log('  PASS: v2 API normalized to v3');

  console.log('Testing detectUnsafeDashboardApiContractV3...');
  const unsafe = apiContract.detectUnsafeDashboardApiContractV3(services);
  assert.ok(unsafe);
  console.log('  PASS: unsafe API contract detection executed');

  console.log('Testing buildDashboardApiContractReport...');
  const store = require('../src/registry-v3/registry-v3-store');
  store.clear();
  store.setFrozen({ version: '3.0.0', items: [item] });
  const report = apiContract.buildDashboardApiContractReport({ ...services, store });
  assert.ok(report);
  console.log('  PASS: API contract report built');

  store.clear();

  console.log('\n✅ All dashboard API contract v3 tests passed\n');
  process.exit(0);
} catch (e) {
  console.error('❌ Test failed:', e.message);
  process.exit(1);
}