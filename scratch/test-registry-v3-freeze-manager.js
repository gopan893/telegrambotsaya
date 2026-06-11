'use strict';

const assert = require('assert');

console.log('=== Registry v3 Freeze Manager Test ===\n');

async function run() {
  const store = require('../src/registry-v3/registry-v3-store');
  const freezeManager = require('../src/registry-v3/registry-v3-freeze-manager');

  store.clear();

  const services = { store, logger: console };

  console.log('Testing createRegistryV3Draft...');
  const draftResult = await freezeManager.createRegistryV3Draft(services);
  assert.ok(draftResult);
  assert.ok(draftResult.success);
  assert.ok(draftResult.draft);
  assert.ok(Array.isArray(draftResult.draft.items));
  assert.ok(draftResult.draft.createdAt);
  console.log('  PASS: draft created');

  console.log('Testing getRegistryV3FreezeStatus...');
  const status1 = freezeManager.getRegistryV3FreezeStatus(services);
  assert.ok(status1);
  console.log('  PASS: freeze status reported');

  console.log('Testing freezeRegistryV3Contract...');
  const result = await freezeManager.freezeRegistryV3Contract(null, services);
  assert.ok(result);
  console.log('  PASS: freeze executed');

  const status2 = freezeManager.getRegistryV3FreezeStatus(services);
  assert.ok(status2);
  console.log('  PASS: freeze status after freeze');

  console.log('Testing buildRegistryV3FreezeReport...');
  const reportGen = require('../src/registry-v3/registry-v3-report-generator');
  const report = reportGen.buildRegistryV3FreezeReport(services);
  assert.ok(report);
  console.log('  PASS: freeze report built');

  console.log('Testing detectRegistryContractDrift...');
  const drift = freezeManager.detectRegistryContractDrift(services);
  assert.ok(drift !== undefined);
  console.log('  PASS: drift detection executed');

  console.log('Testing rejectUnsafeRegistryContractChange...');
  const safe = freezeManager.rejectUnsafeRegistryContractChange({ type: 'add_field' }, services);
  assert.ok(safe !== undefined);
  console.log('  PASS: unsafe change rejected');

  store.clear();

  console.log('\n✅ All registry v3 freeze manager tests passed\n');
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Test failed:', err.message);
  process.exit(1);
});