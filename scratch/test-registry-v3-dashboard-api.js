'use strict';
const assert = require('assert');
console.log('=== Registry v3 Dashboard API Test ===\n');

async function run() {
  const store = require('../src/registry-v3/registry-v3-store');
  const contract = require('../src/registry-v3/registry-v3-contract');
  const freezeManager = require('../src/registry-v3/registry-v3-freeze-manager');
  const conflictDetector = require('../src/registry-v3/registry-v3-conflict-detector');
  const compatBridge = require('../src/registry-v3/registry-v3-compatibility-bridge');
  const migrationBlocker = require('../src/registry-v3/registry-v3-migration-blocker-detector');
  const reportGenerator = require('../src/registry-v3/registry-v3-report-generator');

  store.clear();

  const services = { store, logger: console };
  const servicesCD = { registryV3Store: store, logger: console };

  const draft = {
    version: '3.0.0', createdAt: new Date().toISOString(),
    items: [
      contract.createRegistryV3Item({ id: 'overview', type: 'dashboard_tab', title: 'Overview', status: 'active', visibility: 'public' }),
      contract.createRegistryV3Item({ id: 'agents', type: 'dashboard_tab', title: 'Agents', status: 'active', visibility: 'public' }),
      contract.createRegistryV3Item({ id: 'help', type: 'telegram_command', title: 'Help', command: '/help', status: 'active', riskLevel: 'low' }),
    ]
  };

  store.clear();
  const dr = await freezeManager.createRegistryV3Draft(services);
  assert.ok(dr.success, 'draft created');
  console.log('  PASS: draft created');

  const fr = await freezeManager.freezeRegistryV3Contract(null, services);
  assert.ok(fr, 'freeze executed');
  console.log('  PASS: freeze executed');

  store.setFrozen(draft, { contractVersion: '3.0.0' });

  const report = reportGenerator.buildRegistryV3Report(services);
  assert.ok(report, 'report generated');
  console.log('  PASS: report generated');

  const conflicts = conflictDetector.detectRegistryV3Conflicts(servicesCD);
  assert.ok(conflicts, 'conflicts detected');
  console.log('  PASS: conflict detection');

  const compat = compatBridge.buildRegistryV3CompatibilityReport(services);
  assert.ok(compat, 'compat report');
  console.log('  PASS: compatibility report');

  const blockers = migrationBlocker.detectRegistryV3MigrationBlockers(servicesCD);
  assert.ok(blockers, 'blockers detected');
  console.log('  PASS: migration blockers');

  store.clear();
  console.log('\nAll registry v3 dashboard API tests passed\n');
  process.exit(0);
}

run().catch(e => { console.error('FAIL:', e.message); process.exit(1); });