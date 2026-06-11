'use strict';

const assert = require('assert');

console.log('=== Dashboard Route Preview Builder Test ===\n');

try {
  const store = require('../src/registry-v3/registry-v3-store');
  const routePreview = require('../src/route-generation/dashboard-route-preview-builder');
  const contract = require('../src/registry-v3/registry-v3-contract');

  store.clear();

  const services = { store, logger: console };

  const frozen = {
    version: '3.0.0',
    items: [
      contract.createRegistryV3Item({ id: 'overview', type: 'dashboard_tab', title: 'Overview', status: 'active', visibility: 'public' }),
      contract.createRegistryV3Item({ id: 'agents', type: 'dashboard_tab', title: 'Agents', status: 'active', visibility: 'public' }),
      contract.createRegistryV3Item({ id: 'settings', type: 'dashboard_tab', title: 'Settings', status: 'active', visibility: 'admin' }),
    ]
  };
  store.setFrozen(frozen, { contractVersion: '3.0.0' });

  console.log('Testing buildDashboardRoutePreview...');
  const preview = routePreview.buildDashboardRoutePreview(services);
  assert.ok(preview);
  console.log('  PASS: route preview built');

  console.log('Testing buildSidebarPreview...');
  const sidebar = routePreview.buildSidebarPreview(services);
  assert.ok(sidebar);
  console.log('  PASS: sidebar preview built');

  console.log('Testing buildApiRoutePreview...');
  const api = routePreview.buildApiRoutePreview(services);
  assert.ok(api);
  console.log('  PASS: API route preview built');

  console.log('Testing buildMobileNavPreview...');
  const mobile = routePreview.buildMobileNavPreview(services);
  assert.ok(mobile);
  console.log('  PASS: mobile nav preview built');

  console.log('Testing validatePreviewStructure...');
  const vs = routePreview.validatePreviewStructure(services);
  assert.ok(vs);
  console.log('  PASS: preview structure validated');

  store.clear();

  console.log('\n✅ All dashboard route preview builder tests passed\n');
  process.exit(0);
} catch (e) {
  console.error('❌ Test failed:', e.message);
  process.exit(1);
}