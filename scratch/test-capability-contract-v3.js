'use strict';

const assert = require('assert');

console.log('=== Capability Contract v3 Test ===\n');

try {
  const store = require('../src/registry-v3/registry-v3-store');
  const capContract = require('../src/route-generation/capability-contract-v3');
  const contract = require('../src/registry-v3/registry-v3-contract');

  store.clear();

  const services = { store, logger: console };

  const item = contract.createRegistryV3Item({
    id: 'test_cap',
    type: 'capability',
    title: 'Test Capability',
    action: 'read_data',
    actionType: 'read',
    riskLevel: 'low',
    dataSensitivity: 'low'
  });

  console.log('Testing buildCapabilityContractV3...');
  const result = capContract.buildCapabilityContractV3(item, services);
  assert.ok(result.success);
  assert.strictEqual(result.contract.action, 'test_cap');
  assert.strictEqual(result.contract.riskLevel, 'low');
  assert.strictEqual(result.contract.directRunAllowed, true);
  console.log('  PASS: capability contract built correctly');

  console.log('Testing validateCapabilityContractV3...');
  const validation = capContract.validateCapabilityContractV3(result.contract, services);
  assert.strictEqual(validation.valid, true);
  console.log('  PASS: valid capability passes validation');

  console.log('Testing invalid capability validation...');
  const badCap = {
    action: 'shell_executor', actionType: 'dangerous',
    riskLevel: 'critical', directRunAllowed: true
  };
  const badValidation = capContract.validateCapabilityContractV3(badCap, services);
  assert.strictEqual(badValidation.valid, false);
  console.log('  PASS: shell executor capability blocked');

  console.log('Testing normalizeCapabilityContractFromV2...');
  const normalized = capContract.normalizeCapabilityContractFromV2({ id: 'oldcap', action: 'old_action' }, services);
  assert.ok(normalized);
  console.log('  PASS: v2 capability normalized to v3');

  console.log('Testing detectUnsafeCapabilityContractV3...');
  const unsafe = capContract.detectUnsafeCapabilityContractV3(services);
  assert.ok(unsafe);
  console.log('  PASS: unsafe capability detection executed');

  console.log('Testing buildCapabilityContractReport...');
  store.setFrozen({ version: '3.0.0', items: [item] });
  const report = capContract.buildCapabilityContractReport({ ...services, store });
  assert.ok(report);
  console.log('  PASS: capability contract report built');

  store.clear();

  console.log('\n✅ All capability contract v3 tests passed\n');
  process.exit(0);
} catch (e) {
  console.error('❌ Test failed:', e.message);
  process.exit(1);
}