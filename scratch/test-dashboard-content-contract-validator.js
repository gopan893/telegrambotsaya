'use strict';

const assert = require('assert');

console.log('=== Dashboard Content Contract Validator Test ===\n');

try {
  const store = require('../src/registry-v3/registry-v3-store');
  const contentValidator = require('../src/route-generation/dashboard-content-contract-validator');
  const contract = require('../src/registry-v3/registry-v3-contract');

  store.clear();

  const services = { store, logger: console };

  const frozen = {
    version: '3.0.0',
    items: [
      contract.createRegistryV3Item({
        id: 'overview', type: 'dashboard_tab', title: 'Overview', status: 'active',
        expectedContent: ['system status', 'health metrics']
      }),
      contract.createRegistryV3Item({
        id: 'agents', type: 'dashboard_tab', title: 'Agents', status: 'active',
        expectedContent: ['agent list', 'agent status']
      }),
      contract.createRegistryV3Item({
        id: 'incomplete', type: 'dashboard_tab', title: 'Incomplete', status: 'active',
        expectedContent: null
      }),
    ]
  };
  store.setFrozen(frozen, { contractVersion: '3.0.0' });

  console.log('Testing validateDashboardContentContractsV3...');
  const result = contentValidator.validateDashboardContentContractsV3(services);
  assert.ok(result);
  console.log('  PASS: content contracts validated');

  console.log('Testing validateExpectedContentKeywords...');
  const keywordResult = contentValidator.validateExpectedContentKeywords(
    { id: 'overview', expectedContent: ['system status'] }, services
  );
  assert.ok(keywordResult);
  console.log('  PASS: expected content keywords validated');

  console.log('Testing detectContentContractMissing...');
  const missing = contentValidator.detectContentContractMissing(
    { id: 'incomplete', expectedContent: null }, services
  );
  assert.ok(missing);
  console.log('  PASS: missing content detected');

  console.log('Testing buildContentContractValidationReport...');
  const report = contentValidator.buildContentContractValidationReport(services);
  assert.ok(report);
  console.log('  PASS: content validation report built');

  store.clear();

  console.log('\n✅ All dashboard content contract validator tests passed\n');
  process.exit(0);
} catch (e) {
  console.error('❌ Test failed:', e.message);
  process.exit(1);
}