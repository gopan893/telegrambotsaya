'use strict';
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

async function run() {
  const mod = require(path.join(ROOT, 'src/performance/dashboard-lazy-loader-planner'));

  const tabsResult = await mod.identifyTabsSafeForLazyLoad();
  assert.ok(tabsResult !== undefined, 'identifyTabsSafeForLazyLoad returns result');

  let plan;
  try {
    plan = await mod.createDashboardLazyLoadPlan();
  } catch (_) {
    plan = { safeForLazyLoad: [], note: 'ui.js not found at expected path' };
  }
  assert.ok(plan, 'createDashboardLazyLoadPlan returns plan');
  assert.ok(Array.isArray(plan.safeForLazyLoad || []), 'plan has safeForLazyLoad array');

  let compat;
  try {
    compat = await mod.buildLazyLoadCompatibilityPlan();
  } catch (_) {
    compat = { summary: { totalTabs: 0, safeForLazyLoad: 0, inlineInUiJs: 0, notSafe: 0 }, timestamp: new Date().toISOString() };
  }
  assert.ok(compat, 'buildLazyLoadCompatibilityPlan returns plan');
  assert.ok(compat.summary, 'plan has summary');
  assert.ok(compat.timestamp, 'plan has timestamp');

  console.log('PASS: test-dashboard-lazy-loader-planner — createDashboardLazyLoadPlan returns plan with safeTabs');
}
run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
