'use strict';

const assert = require('assert');

console.log('=== Registry v3 Conflict Detector Test ===\n');

try {
  const store = require('../src/registry-v3/registry-v3-store');
  const conflictDetector = require('../src/registry-v3/registry-v3-conflict-detector');
  const contract = require('../src/registry-v3/registry-v3-contract');

  store.clear();

  const services = { registryV3Store: store, logger: console };

  const draft = {
    version: '3.0.0',
    items: [
      contract.createRegistryV3Item({ id: 'tab1', type: 'dashboard_tab', title: 'Tab 1' }),
      contract.createRegistryV3Item({ id: 'tab1', type: 'dashboard_api', title: 'Tab 1 Dup' }),
    ]
  };
  store.setFrozen(draft);

  console.log('Testing detectRegistryV3Conflicts...');
  const result = conflictDetector.detectRegistryV3Conflicts(services);
  assert.ok(result);
  console.log('  PASS: conflict detection executed');

  console.log('Testing detectDashboardTabConflictsV3...');
  const tabConflicts = conflictDetector.detectDashboardTabConflictsV3(draft, services);
  assert.ok(tabConflicts);
  console.log('  PASS: tab conflict detection executed');

  console.log('Testing detectApiRouteConflictsV3...');
  const apiConflicts = conflictDetector.detectApiRouteConflictsV3(draft, services);
  assert.ok(apiConflicts);
  console.log('  PASS: API conflict detection executed');

  console.log('Testing detectRendererConflictsV3...');
  const rendererConflicts = conflictDetector.detectRendererConflictsV3(draft, services);
  assert.ok(rendererConflicts);
  console.log('  PASS: renderer conflict detection executed');

  console.log('Testing detectCommandConflictsV3...');
  const cmdConflicts = conflictDetector.detectCommandConflictsV3(draft, services);
  assert.ok(cmdConflicts);
  console.log('  PASS: command conflict detection executed');

  console.log('Testing detectCapabilityConflictsV3...');
  const capConflicts = conflictDetector.detectCapabilityConflictsV3(draft, services);
  assert.ok(capConflicts);
  console.log('  PASS: capability conflict detection executed');

  console.log('Testing detectAliasConflictsV3...');
  const aliasConflicts = conflictDetector.detectAliasConflictsV3(draft, services);
  assert.ok(aliasConflicts);
  console.log('  PASS: alias conflict detection executed');

  console.log('Testing buildRegistryV3ConflictReport...');
  const report = conflictDetector.buildRegistryV3ConflictReport(services);
  assert.ok(report);
  console.log('  PASS: conflict report built');

  store.clear();

  console.log('\n✅ All registry v3 conflict detector tests passed\n');
  process.exit(0);
} catch (e) {
  console.error('❌ Test failed:', e.message);
  process.exit(1);
}