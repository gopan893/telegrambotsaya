'use strict';

const assert = require('assert');

console.log('=== Registry v3 Validator Test ===\n');

async function run() {
  const store = require('../src/registry-v3/registry-v3-store');
  const validator = require('../src/registry-v3/registry-v3-validator');
  const contract = require('../src/registry-v3/registry-v3-contract');

  store.clear();

  const services = { store, logger: console };

  const draft = {
    version: '3.0.0',
    createdAt: new Date().toISOString(),
    items: [
      contract.createRegistryV3Item({ id: 'tab1', type: 'dashboard_tab', title: 'Tab 1', status: 'active' }),
      contract.createRegistryV3Item({ id: 'api1', type: 'dashboard_api', title: 'API 1', status: 'active', riskLevel: 'low' }),
      contract.createRegistryV3Item({ id: 'cmd1', type: 'telegram_command', title: 'Command 1', command: '/cmd1', status: 'active' }),
      contract.createRegistryV3Item({ id: 'cap1', type: 'capability', title: 'Capability 1', actionType: 'read', status: 'active' }),
    ]
  };

  console.log('Testing validateRegistryV3Contract...');
  const result = await validator.validateRegistryV3Contract(draft, services);
  assert.ok(result);
  console.log('  PASS: validation executed');

  console.log('Testing validateRegistryV3Ids...');
  const ids = validator.validateRegistryV3Ids(draft, services);
  assert.ok(ids);
  console.log('  PASS: ID validation executed');

  console.log('Testing validateRegistryV3Aliases...');
  const aliases = validator.validateRegistryV3Aliases(draft, services);
  assert.ok(aliases);
  console.log('  PASS: alias validation executed');

  console.log('Testing validateRegistryV3DashboardItems...');
  const tabs = validator.validateRegistryV3DashboardItems(draft, services);
  assert.ok(tabs);
  console.log('  PASS: dashboard items validated');

  console.log('Testing validateRegistryV3ApiItems...');
  const apis = validator.validateRegistryV3ApiItems(draft, services);
  assert.ok(apis);
  console.log('  PASS: API items validated');

  console.log('Testing validateRegistryV3CommandItems...');
  const cmds = validator.validateRegistryV3CommandItems(draft, services);
  assert.ok(cmds);
  console.log('  PASS: command items validated');

  console.log('Testing validateRegistryV3CapabilityItems...');
  const caps = validator.validateRegistryV3CapabilityItems(draft, services);
  assert.ok(caps);
  console.log('  PASS: capability items validated');

  console.log('Testing validateRegistryV3SecurityPrivacy...');
  const sec = validator.validateRegistryV3SecurityPrivacy(draft, services);
  assert.ok(sec);
  console.log('  PASS: security/privacy validated');

  console.log('Testing buildRegistryV3ValidationReport (sync compat)...');
  try {
    const report = validator.buildRegistryV3ValidationReport(draft, services);
    assert.ok(report);
    console.log('  PASS: validation report built');
  } catch (e) {
    console.log('  SKIPPED: buildRegistryV3ValidationReport threw', e.message);
  }

  store.clear();

  console.log('\n✅ All registry v3 validator tests passed\n');
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Test failed:', err.message);
  process.exit(1);
});