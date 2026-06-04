'use strict';

var passed = 0;
var failed = 0;

function assert(condition, msg) {
  if (condition) { console.log('  PASS: ' + msg); passed++; }
  else { console.error('  FAIL: ' + msg); failed++; }
}

var dashboardGuard;
try {
  dashboardGuard = require('../src/selfhealing/dashboard-route-guard');
  assert(true, 'dashboard-route-guard module loads');
  assert(typeof dashboardGuard.createDashboardRouteGuard === 'function', 'createDashboardRouteGuard is function');
} catch (e) {
  assert(false, 'dashboard-route-guard module loads: ' + e.message);
}

// Test createDashboardRouteGuard returns expected methods
var guard = dashboardGuard.createDashboardRouteGuard(null, {});
assert(typeof guard.runDashboardGuardCheck === 'function', 'runDashboardGuardCheck method exists');
assert(Array.isArray(guard.KNOWN_TABS), 'KNOWN_TABS is array');
assert(guard.KNOWN_TABS.indexOf('workspaces') >= 0, 'KNOWN_TABS contains workspaces');
assert(guard.KNOWN_TABS.indexOf('overview') >= 0, 'KNOWN_TABS contains overview');
assert(guard.KNOWN_TABS.indexOf('selfhealing') >= 0, 'KNOWN_TABS contains selfhealing');
assert(Array.isArray(guard.CRITICAL_TABS), 'CRITICAL_TABS is array');

// Test tab registry check
guard.runDashboardGuardCheck({ id: 'gd_dashboard_tab_registry' }, {}, {}).then(function(r) {
  assert(r.status === 'passed' || r.status === 'warning', 'tab registry check runs');
});

// Test CSS check with mock content
guard.runDashboardGuardCheck({ id: 'gd_dashboard_css_dark_forms' }, {}, { stylesCssContent: 'input { background: var(--bg-primary); }' }).then(function(r) {
  assert(r.status !== undefined, 'CSS check returns status');
});

// Test SW check with mock content
guard.runDashboardGuardCheck({ id: 'gd_dashboard_sw_no_api_cache' }, {}, { swContent: '/api/dashboard' }).then(function(r) {
  assert(r.status !== undefined, 'SW check returns status');
});

console.log('\n=== Dashboard Route Guard ===');
console.log('Total: ' + (passed + failed) + ' | PASS: ' + passed + ' | FAIL: ' + failed + '\n');
process.exit(failed > 0 ? 1 : 0);
