'use strict';

const assert = require('assert');

console.log('=== Registry v3 Migration Blocker Detector Test ===\n');

try {
  const store = require('../src/registry-v3/registry-v3-store');
  const migrationBlocker = require('../src/registry-v3/registry-v3-migration-blocker-detector');
  const contract = require('../src/registry-v3/registry-v3-contract');

  store.clear();

  const services = { store, logger: console };

  const draft = {
    version: '3.0.0',
    items: [
      contract.createRegistryV3Item({ id: 'tab1', type: 'dashboard_tab', title: 'Tab 1', status: 'active', docs: null, tests: null, riskLevel: 'critical', directRunAllowed: true }),
    ]
  };
  store.setDraft(draft);

  console.log('Testing detectRegistryV3MigrationBlockers...');
  const result = migrationBlocker.detectRegistryV3MigrationBlockers(services);
  assert.ok(result);
  console.log('  PASS: migration blocker detection executed');

  console.log('Testing detectDashboardGenerationBlockers...');
  const dashBlockers = migrationBlocker.detectDashboardGenerationBlockers(services);
  assert.ok(dashBlockers);
  console.log('  PASS: dashboard generation blockers detected');

  console.log('Testing detectApiGenerationBlockers...');
  const apiBlockers = migrationBlocker.detectApiGenerationBlockers(services);
  assert.ok(apiBlockers);
  console.log('  PASS: API generation blockers detected');

  console.log('Testing detectCommandGenerationBlockers...');
  const cmdBlockers = migrationBlocker.detectCommandGenerationBlockers(services);
  assert.ok(cmdBlockers);
  console.log('  PASS: command generation blockers detected');

  console.log('Testing detectCapabilityGenerationBlockers...');
  const capBlockers = migrationBlocker.detectCapabilityGenerationBlockers(services);
  assert.ok(capBlockers);
  console.log('  PASS: capability generation blockers detected');

  console.log('Testing buildMigrationBlockerReport...');
  const report = migrationBlocker.buildMigrationBlockerReport(services);
  assert.ok(report);
  console.log('  PASS: migration blocker report built');

  store.clear();

  console.log('\n✅ All registry v3 migration blocker detector tests passed\n');
  process.exit(0);
} catch (e) {
  console.error('❌ Test failed:', e.message);
  process.exit(1);
}