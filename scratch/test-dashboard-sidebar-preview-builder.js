'use strict';

const assert = require('assert');

console.log('=== Dashboard Sidebar Preview Builder Test ===\n');

try {
  const store = require('../src/registry-v3/registry-v3-store');
  const sidebarPreview = require('../src/route-generation/dashboard-sidebar-preview-builder');
  const contract = require('../src/registry-v3/registry-v3-contract');

  store.clear();

  const services = { store, logger: console };

  const frozen = {
    version: '3.0.0',
    items: [
      contract.createRegistryV3Item({ id: 'overview', type: 'dashboard_tab', title: 'Overview', status: 'active', visibility: 'public' }),
      contract.createRegistryV3Item({ id: 'agents', type: 'dashboard_tab', title: 'Agents', status: 'active', visibility: 'public' }),
      contract.createRegistryV3Item({ id: 'executor', type: 'dashboard_tab', title: 'Executor', status: 'active', visibility: 'public' }),
      contract.createRegistryV3Item({ id: 'settings', type: 'dashboard_tab', title: 'Settings', status: 'active', visibility: 'admin' }),
      contract.createRegistryV3Item({ id: 'hidden_tab', type: 'dashboard_tab', title: 'Hidden', status: 'active', visibility: 'hidden' }),
    ]
  };
  store.setFrozen(frozen, { contractVersion: '3.0.0' });

  console.log('Testing generateSidebarPreviewFromRegistryV3...');
  const result = sidebarPreview.generateSidebarPreviewFromRegistryV3(services);
  assert.ok(result);
  console.log('  PASS: sidebar preview generated');

  console.log('Testing validateSidebarPreview...');
  const validation = sidebarPreview.validateSidebarPreview(result, services);
  assert.ok(validation);
  console.log('  PASS: sidebar preview validated');

  console.log('Testing detectMissingStableTabsInSidebarPreview...');
  const missing = sidebarPreview.detectMissingStableTabsInSidebarPreview(result, services);
  assert.ok(missing);
  console.log('  PASS: missing stable tabs detected');

  console.log('Testing detectDuplicateSidebarItems...');
  const dupes = sidebarPreview.detectDuplicateSidebarItems(result, services);
  assert.ok(dupes);
  console.log('  PASS: duplicate sidebar items detected');

  store.clear();

  console.log('\n✅ All dashboard sidebar preview builder tests passed\n');
  process.exit(0);
} catch (e) {
  console.error('❌ Test failed:', e.message);
  process.exit(1);
}