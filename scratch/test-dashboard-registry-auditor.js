'use strict';

const con = require('../src/consolidation');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL:', msg); } }

async function run() {
  const svc = {};

  const tabs = await con.dashboardRegistryAuditor.auditDashboardTabs(svc);
  assert(tabs && typeof tabs === 'object', 'auditDashboardTabs returns object');
  assert(Object.keys(tabs).length > 0, 'found at least 1 tab');

  const renderers = await con.dashboardRegistryAuditor.auditDashboardRenderers(svc);
  assert(Array.isArray(renderers), 'auditDashboardRenderers returns array');

  const sidebar = await con.dashboardRegistryAuditor.auditDashboardSidebar(svc);
  assert(Array.isArray(sidebar), 'auditDashboardSidebar returns array');

  const aliases = await con.dashboardRegistryAuditor.auditDashboardAliases(svc);
  assert(Array.isArray(aliases), 'auditDashboardAliases returns array');

  const fallbacks = await con.dashboardRegistryAuditor.detectKnownTabFallbacks(svc);
  assert(Array.isArray(fallbacks), 'detectKnownTabFallbacks returns array');

  const report = con.dashboardRegistryAuditor.buildDashboardRegistryAuditReport(svc);
  assert(report && typeof report === 'object', 'buildDashboardRegistryAuditReport returns object');
  assert(report.timestamp, 'report has timestamp');
  assert(Array.isArray(report.checks), 'report has checks array');

  if (Object.keys(tabs).length > 0) {
    const firstId = Object.keys(tabs)[0];
    assert(tabs[firstId].id, 'tab has id');
    assert(tabs[firstId].label !== undefined, 'tab has label');
  }

  console.log('Result: ' + pass + ' PASS, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });
