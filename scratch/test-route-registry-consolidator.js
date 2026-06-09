'use strict';

const con = require('../src/consolidation');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL:', msg); } }

async function run() {
  const svc = {};

  const allRoutes = await con.routeRegistryConsolidator.auditBackendRoutes(svc);
  assert(Array.isArray(allRoutes), 'auditBackendRoutes returns array');

  const apiRoutes = await con.routeRegistryConsolidator.auditDashboardApiRoutes(svc);
  assert(Array.isArray(apiRoutes), 'auditDashboardApiRoutes returns array');

  const conflicts = await con.routeRegistryConsolidator.detectRouteConflicts(svc);
  assert(Array.isArray(conflicts), 'detectRouteConflicts returns array');

  const unprotected = await con.routeRegistryConsolidator.detectUnprotectedDashboardRoutes(svc);
  assert(Array.isArray(unprotected), 'detectUnprotectedDashboardRoutes returns array');

  const report = con.routeRegistryConsolidator.buildRouteRegistryReport(svc);
  assert(report && typeof report === 'object', 'buildRouteRegistryReport returns object');
  assert(report.timestamp, 'report has timestamp');
  assert(Array.isArray(report.rules), 'report has rules array');

  if (allRoutes.length > 0) {
    assert(allRoutes[0].method, 'route has method');
    assert(allRoutes[0].path, 'route has path');
    assert(allRoutes[0].file, 'route has file');
  }

  console.log('Result: ' + pass + ' PASS, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });
