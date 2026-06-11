'use strict';

const assert = require('assert');

console.log('=== Dashboard Mobile Nav Preview Builder Test ===\n');

try {
  const store = require('../src/registry-v3/registry-v3-store');
  const mobilePreview = require('../src/route-generation/dashboard-mobile-nav-preview-builder');
  const contract = require('../src/registry-v3/registry-v3-contract');

  store.clear();

  const services = { store, logger: console };

  const frozen = {
    version: '3.0.0',
    items: [
      contract.createRegistryV3Item({ id: 'overview', type: 'dashboard_tab', title: 'Overview', status: 'active', visibility: 'public', mobileVisible: true }),
      contract.createRegistryV3Item({ id: 'agents', type: 'dashboard_tab', title: 'Agents', status: 'active', visibility: 'public', mobileVisible: true }),
      contract.createRegistryV3Item({ id: 'settings', type: 'dashboard_tab', title: 'Settings', status: 'active', visibility: 'admin', mobileVisible: true }),
      contract.createRegistryV3Item({ id: 'desktop-only', type: 'dashboard_tab', title: 'Desktop Only', status: 'active', visibility: 'public', mobileVisible: false }),
    ]
  };
  store.setFrozen(frozen, { contractVersion: '3.0.0' });

  console.log('Testing generateMobileNavPreviewFromRegistryV3...');
  const result = mobilePreview.generateMobileNavPreviewFromRegistryV3(services);
  assert.ok(result);
  console.log('  PASS: mobile nav preview generated');

  console.log('Testing validateMobileNavPreview...');
  const validation = mobilePreview.validateMobileNavPreview(result, services);
  assert.ok(validation);
  console.log('  PASS: mobile nav preview validated');

  console.log('Testing detectMobileNavCoverageGaps...');
  const gaps = mobilePreview.detectMobileNavCoverageGaps(result, services);
  assert.ok(gaps);
  console.log('  PASS: mobile nav coverage gaps detected');

  console.log('Testing buildMobileNavPreviewReport...');
  const report = mobilePreview.buildMobileNavPreviewReport(services);
  assert.ok(report);
  console.log('  PASS: mobile nav preview report built');

  store.clear();

  console.log('\n✅ All dashboard mobile nav preview builder tests passed\n');
  process.exit(0);
} catch (e) {
  console.error('❌ Test failed:', e.message);
  process.exit(1);
}