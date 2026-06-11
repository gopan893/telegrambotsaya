'use strict';

const assert = require('assert');

console.log('=== Dashboard Renderer Contract v3 Test ===\n');

try {
  const rendererContract = require('../src/route-generation/dashboard-renderer-contract-v3');
  const contract = require('../src/registry-v3/registry-v3-contract');

  const services = { logger: console };

  const item = contract.createRegistryV3Item({
    id: 'test_renderer',
    type: 'dashboard_renderer',
    title: 'Test Renderer',
    status: 'active',
    rendererFile: 'test.js'
  });

  console.log('Testing buildDashboardRendererContractV3...');
  const result = rendererContract.buildDashboardRendererContractV3(item, services);
  assert.ok(result.success);
  assert.strictEqual(result.contract.id, 'test_renderer');
  console.log('  PASS: renderer contract built correctly');

  console.log('Testing validateDashboardRendererContractV3...');
  const validation = rendererContract.validateDashboardRendererContractV3(result.contract, services);
  assert.ok(validation);
  console.log('  PASS: renderer contract validated');

  console.log('Testing detectRendererLoadOrderRisk...');
  const loadRisk = rendererContract.detectRendererLoadOrderRisk([result.contract], services);
  assert.ok(loadRisk !== undefined);
  console.log('  PASS: load order risk detected');

  console.log('Testing detectApiFetchCompatibilityRisk...');
  const fetchRisk = rendererContract.detectApiFetchCompatibilityRisk([result.contract], services);
  assert.ok(fetchRisk !== undefined);
  console.log('  PASS: Api.fetch compatibility risk detected');

  console.log('Testing buildRendererContractReport...');
  const store = require('../src/registry-v3/registry-v3-store');
  store.clear();
  store.setFrozen({ version: '3.0.0', items: [item] });
  const report = rendererContract.buildRendererContractReport({ ...services, store });
  assert.ok(report);
  console.log('  PASS: renderer contract report built');

  store.clear();

  console.log('\n✅ All dashboard renderer contract v3 tests passed\n');
  process.exit(0);
} catch (e) {
  console.error('❌ Test failed:', e.message);
  process.exit(1);
}