'use strict';

const assert = require('assert');

console.log('=== Phase 76: Registry Contract Freeze + Route Generation Regression Test ===\n');

let total = 0;
let passed = 0;
let failed = 0;
let skipped = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ❌ ${name}: ${e.message}`);
  }
}

function skip(name) {
  total++;
  skipped++;
  console.log(`  ⏭️  SKIPPED: ${name}`);
}

try {
  console.log('Registry v3 Core Modules...');
  test('registry-v3-store loads', () => { assert.ok(require('../src/registry-v3/registry-v3-store')); });
  test('registry-v3-contract loads', () => { assert.ok(require('../src/registry-v3/registry-v3-contract')); });
  test('registry-v3-freeze-manager loads', () => { assert.ok(require('../src/registry-v3/registry-v3-freeze-manager')); });
  test('registry-v3-version-manager loads', () => { assert.ok(require('../src/registry-v3/registry-v3-version-manager')); });
  test('registry-v3-validator loads', () => { assert.ok(require('../src/registry-v3/registry-v3-validator')); });
  test('registry-v3-conflict-detector loads', () => { assert.ok(require('../src/registry-v3/registry-v3-conflict-detector')); });
  test('registry-v3-compatibility-bridge loads', () => { assert.ok(require('../src/registry-v3/registry-v3-compatibility-bridge')); });
  test('registry-v3-migration-blocker-detector loads', () => { assert.ok(require('../src/registry-v3/registry-v3-migration-blocker-detector')); });
  test('registry-v3-report-generator loads', () => { assert.ok(require('../src/registry-v3/registry-v3-report-generator')); });
  test('registry-v3-utils loads', () => { assert.ok(require('../src/registry-v3/registry-v3-utils')); });

  console.log('\nRoute Generation Modules...');
  test('dashboard-tab-contract-v3 loads', () => { assert.ok(require('../src/route-generation/dashboard-tab-contract-v3')); });
  test('dashboard-api-contract-v3 loads', () => { assert.ok(require('../src/route-generation/dashboard-api-contract-v3')); });
  test('dashboard-renderer-contract-v3 loads', () => { assert.ok(require('../src/route-generation/dashboard-renderer-contract-v3')); });
  test('dashboard-route-generation-planner loads', () => { assert.ok(require('../src/route-generation/dashboard-route-generation-planner')); });
  test('dashboard-route-preview-builder loads', () => { assert.ok(require('../src/route-generation/dashboard-route-preview-builder')); });
  test('dashboard-sidebar-preview-builder loads', () => { assert.ok(require('../src/route-generation/dashboard-sidebar-preview-builder')); });
  test('dashboard-mobile-nav-preview-builder loads', () => { assert.ok(require('../src/route-generation/dashboard-mobile-nav-preview-builder')); });
  test('dashboard-content-contract-validator loads', () => { assert.ok(require('../src/route-generation/dashboard-content-contract-validator')); });
  test('route-generation-utils loads', () => { assert.ok(require('../src/route-generation/route-generation-utils')); });

  console.log('\nNew Phase 76 Route Generation Modules...');
  test('telegram-command-contract-v3 loads', () => { assert.ok(require('../src/route-generation/telegram-command-contract-v3')); });
  test('capability-contract-v3 loads', () => { assert.ok(require('../src/route-generation/capability-contract-v3')); });
  test('alias-contract-v3 loads', () => { assert.ok(require('../src/route-generation/alias-contract-v3')); });
  test('command-generation-preview-builder loads', () => { assert.ok(require('../src/route-generation/command-generation-preview-builder')); });
  test('capability-generation-preview-builder loads', () => { assert.ok(require('../src/route-generation/capability-generation-preview-builder')); });
  test('alias-generation-preview-builder loads', () => { assert.ok(require('../src/route-generation/alias-generation-preview-builder')); });
  test('dashboard-generation-report-generator loads', () => { assert.ok(require('../src/route-generation/dashboard-generation-report-generator')); });

  console.log('\nDashboard Integration...');
  test('registry-v3-routes loads', () => { assert.ok(require('../src/dashboard/registry-v3-routes')); });

  console.log('\nDashboard JS Assets Exist...');
  const fs = require('fs');
  const path = require('path');
  const dbDir = path.join(__dirname, '..', 'public', 'dashboard');
  test('registry-v3.js exists', () => { assert.ok(fs.existsSync(path.join(dbDir, 'registry-v3.js'))); });
  test('index.html has registry-v3 nav item', () => {
    const html = fs.readFileSync(path.join(dbDir, 'index.html'), 'utf8');
    assert.ok(html.includes('registry-v3'));
  });

  console.log('\nContract Creation Tests...');
  const contract = require('../src/registry-v3/registry-v3-contract');

  test('create dashboard_tab item', () => {
    const item = contract.createRegistryV3Item({ id: 'test_tab', type: 'dashboard_tab', title: 'Test', status: 'active', visibility: 'public', requiresAuth: true });
    assert.strictEqual(item.id, 'test_tab');
    assert.strictEqual(item.type, 'dashboard_tab');
    assert.strictEqual(item.status, 'active');
    assert.strictEqual(item.requiresAuth, true);
  });

  test('create telegram_command item', () => {
    const item = contract.createRegistryV3Item({ id: 'test_cmd', type: 'telegram_command', title: 'Test Cmd', command: '/testcmd', riskLevel: 'low' });
    assert.strictEqual(item.id, 'test_cmd');
    assert.strictEqual(item.type, 'telegram_command');
  });

  test('create capability item', () => {
    const item = contract.createRegistryV3Item({ id: 'test_cap', type: 'capability', action: 'read_data', actionType: 'read' });
    assert.strictEqual(item.id, 'test_cap');
    assert.strictEqual(item.type, 'capability');
  });

  test('create alias item', () => {
    const item = contract.createRegistryV3Item({ id: 'test_alias', type: 'alias', alias: 'testalias', canonicalId: 'module:test' });
    assert.strictEqual(item.id, 'test_alias');
  });

  test('dashboard_tab contract from item', () => {
    const item = contract.createRegistryV3Item({ id: 'mytab', type: 'dashboard_tab', title: 'My Tab', status: 'active', visibility: 'public' });
    const tab = contract.getDashboardTabContract(item);
    assert.strictEqual(tab.id, 'mytab');
    assert.strictEqual(tab.dataTab, 'mytab');
    assert.strictEqual(tab.href, '#mytab');
    assert.strictEqual(tab.stable, true);
  });

  console.log('\nSafety Boundary Tests...');
  test('critical risk with directRunAllowed fails validation', () => {
    const item = contract.createRegistryV3Item({ id: 'bad', type: 'capability', riskLevel: 'critical', actionType: 'dangerous', directRunAllowed: true });
    const result = contract.validateRegistryV3ItemContract(item);
    assert.strictEqual(result.valid, false);
  });

  test('shell command blocked in command contract', () => {
    const cmdContract = require('../src/route-generation/telegram-command-contract-v3');
    const badCmd = { command: '/shell', actionType: 'dangerous', riskLevel: 'critical', directRunAllowed: true };
    const result = cmdContract.validateTelegramCommandContractV3(badCmd, { logger: console });
    assert.strictEqual(result.valid, false);
  });

  test('shell capability blocked', () => {
    const capContract = require('../src/route-generation/capability-contract-v3');
    const badCap = { action: 'shell_executor', actionType: 'dangerous', riskLevel: 'critical', directRunAllowed: true };
    const result = capContract.validateCapabilityContractV3(badCap, { logger: console });
    assert.strictEqual(result.valid, false);
  });

  console.log('\nSecret Protection Tests...');
  test('sanitizeForDisplay redacts secrets', () => {
    const utils = require('../src/registry-v3/registry-v3-utils');
    const obj = { name: 'test', GITHUB_TOKEN: 'secret123', password: 'secret456' };
    const sanitized = utils.sanitizeForDisplay(obj);
    assert.strictEqual(sanitized.GITHUB_TOKEN, '[REDACTED]');
    assert.strictEqual(sanitized.password, '[REDACTED]');
    assert.strictEqual(sanitized.name, 'test');
  });

  // Skip tests for files that don't exist
  console.log('\nPre-existing Test Status...');

  const scratchDir = path.join(__dirname);
  const requiredTests = [
    'test-registry-v3-contract.js',
    'test-registry-v3-freeze-manager.js',
    'test-registry-v3-version-manager.js',
    'test-registry-v3-validator.js',
    'test-registry-v3-conflict-detector.js',
    'test-registry-v3-compatibility-bridge.js',
    'test-registry-v3-migration-blocker-detector.js',
    'test-dashboard-tab-contract-v3.js',
    'test-dashboard-api-contract-v3.js',
    'test-dashboard-renderer-contract-v3.js',
    'test-dashboard-route-generation-planner.js',
    'test-dashboard-route-preview-builder.js',
    'test-dashboard-sidebar-preview-builder.js',
    'test-dashboard-mobile-nav-preview-builder.js',
    'test-dashboard-content-contract-validator.js',
    'test-telegram-command-contract-v3.js',
    'test-capability-contract-v3.js',
    'test-alias-contract-v3.js',
    'test-registry-v3-dashboard-api.js',
    'test-phase76-registry-route-generation-regression.js',
  ];

  for (const t of requiredTests) {
    const exists = fs.existsSync(path.join(scratchDir, t));
    test(`${t} exists`, () => { assert.ok(exists); });
  }

} catch (e) {
  console.error('❌ Regression test crashed:', e.message);
  failed++;
}

console.log(`\n========================================`);
console.log(`Phase 76 Regression Test Summary`);
console.log(`========================================`);
console.log(`Total: ${total}`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Skipped: ${skipped}`);

if (failed > 0) {
  console.log('\n❌ Some tests failed');
  process.exitCode = 1;
} else {
  console.log('\n✅ All tests passed');
}

process.exit(failed > 0 ? 1 : 0);