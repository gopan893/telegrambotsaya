'use strict';

const assert = require('assert');

console.log('=== Registry v3 Compatibility Bridge Test ===\n');

try {
  const store = require('../src/registry-v3/registry-v3-store');
  const compatBridge = require('../src/registry-v3/registry-v3-compatibility-bridge');

  store.clear();

  const services = { store, logger: console };

  console.log('Testing mapRegistryV2ToRegistryV3...');
  const mapped = compatBridge.mapRegistryV2ToRegistryV3(services);
  assert.ok(mapped);
  console.log('  PASS: v2 to v3 mapping executed');

  console.log('Testing mapRegistryV3ToLegacyDashboardCompat...');
  const legacy = compatBridge.mapRegistryV3ToLegacyDashboardCompat(services);
  assert.ok(legacy);
  console.log('  PASS: v3 to legacy mapping executed');

  console.log('Testing resolveRegistryV3Item...');
  const resolved = compatBridge.resolveRegistryV3Item('test', 'dashboard_tab', services);
  assert.ok(resolved !== undefined);
  console.log('  PASS: item resolution executed');

  console.log('Testing resolveDashboardTabCompat...');
  const tabResolved = compatBridge.resolveDashboardTabCompat('overview', services);
  assert.ok(tabResolved !== undefined);
  console.log('  PASS: dashboard tab compat resolution executed');

  console.log('Testing resolveApiRouteCompat...');
  const apiResolved = compatBridge.resolveApiRouteCompat('/api/dashboard/test', services);
  assert.ok(apiResolved !== undefined);
  console.log('  PASS: API route compat resolution executed');

  console.log('Testing resolveCommandCompat...');
  const cmdResolved = compatBridge.resolveCommandCompat('/help', services);
  assert.ok(cmdResolved !== undefined);
  console.log('  PASS: command compat resolution executed');

  console.log('Testing buildRegistryV3CompatibilityReport...');
  const report = compatBridge.buildRegistryV3CompatibilityReport(services);
  assert.ok(report);
  console.log('  PASS: compatibility report built');

  store.clear();

  console.log('\n✅ All registry v3 compatibility bridge tests passed\n');
  process.exit(0);
} catch (e) {
  console.error('❌ Test failed:', e.message);
  process.exit(1);
}