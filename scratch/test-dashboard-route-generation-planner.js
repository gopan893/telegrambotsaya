'use strict';

const assert = require('assert');

console.log('=== Dashboard Route Generation Planner Test ===\n');

async function run() {
  const store = require('../src/registry-v3/registry-v3-store');
  const routePlanner = require('../src/route-generation/dashboard-route-generation-planner');
  const contract = require('../src/registry-v3/registry-v3-contract');

  store.clear();

  const services = { store, logger: console };

  const frozen = {
    version: '3.0.0',
    createdAt: new Date().toISOString(),
    items: [
      contract.createRegistryV3Item({ id: 'overview', type: 'dashboard_tab', title: 'Overview', status: 'active', visibility: 'public' }),
      contract.createRegistryV3Item({ id: 'agents', type: 'dashboard_tab', title: 'Agents', status: 'active', visibility: 'public' }),
      contract.createRegistryV3Item({ id: 'executor', type: 'dashboard_tab', title: 'Executor', status: 'active', visibility: 'public' }),
    ]
  };
  store.setFrozen(frozen, { contractVersion: '3.0.0' });

  console.log('Testing createDashboardRouteGenerationPlan...');
  const plan = await routePlanner.createDashboardRouteGenerationPlan(services);
  assert.ok(plan);
  console.log('  PASS: route generation plan created');

  console.log('Testing planSidebarGenerationFromRegistryV3...');
  const sidebar = await routePlanner.planSidebarGenerationFromRegistryV3(services);
  assert.ok(sidebar);
  console.log('  PASS: sidebar generation plan created');

  console.log('Testing planRouterGenerationFromRegistryV3...');
  const router = await routePlanner.planRouterGenerationFromRegistryV3(services);
  assert.ok(router);
  console.log('  PASS: router generation plan created');

  console.log('Testing planRendererBindingFromRegistryV3...');
  const renderer = await routePlanner.planRendererBindingFromRegistryV3(services);
  assert.ok(renderer);
  console.log('  PASS: renderer binding plan created');

  console.log('Testing planMobileNavGenerationFromRegistryV3...');
  const mobile = await routePlanner.planMobileNavGenerationFromRegistryV3(services);
  assert.ok(mobile);
  console.log('  PASS: mobile nav plan created');

  console.log('Testing planApiRouteGenerationFromRegistryV3...');
  const api = await routePlanner.planApiRouteGenerationFromRegistryV3(services);
  assert.ok(api);
  console.log('  PASS: API route plan created');

  console.log('Testing buildRouteGenerationPlanReport...');
  const report = routePlanner.buildRouteGenerationPlanReport(services);
  assert.ok(report);
  console.log('  PASS: route plan report built');

  store.clear();

  console.log('\n✅ All dashboard route generation planner tests passed\n');
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Test failed:', err.message);
  process.exit(1);
});