'use strict';

const auditor = require('../src/security/permission-auditor');
let pass = 0;
let fail = 0;
function assert(condition, msg) {
  if (condition) { pass++; } else { console.error(`FAIL: ${msg}`); fail++; }
}
function assertEq(a, b, msg) {
  if (a === b) { pass++; } else { console.error(`FAIL: ${msg} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); fail++; }
}

// 1. auditOwnerAdminPermissions with missing OWNER_CHAT_ID
const r1 = auditor.auditOwnerAdminPermissions({ env: {} });
assert(Array.isArray(r1), 'auditOwnerAdminPermissions returns array');
assert(r1.some(f => f.subject === 'OWNER_CHAT_ID'), 'Flags missing OWNER_CHAT_ID');
assert(r1.some(f => f.severity === 'critical'), 'OWNER_CHAT_ID missing is critical');

// 2. auditOwnerAdminPermissions with empty ADMIN_IDS
const r2 = auditor.auditOwnerAdminPermissions({ env: { OWNER_CHAT_ID: '123', ADMIN_IDS: '' } });
assert(r2.some(f => f.subject === 'ADMIN_IDS'), 'Flags empty ADMIN_IDS');

// 3. auditOwnerAdminPermissions with valid values
const r3 = auditor.auditOwnerAdminPermissions({ env: { OWNER_CHAT_ID: '123', ADMIN_IDS: '456,789' } });
assert(r3.some(f => f.severity === 'info'), 'Valid perms includes info findings');

// 4. auditDashboardAccessPolicy with missing token
const r4 = auditor.auditDashboardAccessPolicy({ env: {} });
assert(r4.some(f => f.subject === 'dashboard_access'), 'auditDashboardAccessPolicy checks dashboard');
assert(r4.some(f => f.severity === 'critical'), 'Missing token is critical');

// 5. auditDashboardAccessPolicy with token set
const r5 = auditor.auditDashboardAccessPolicy({ env: { DASHBOARD_ADMIN_TOKEN: 'secret' } });
assert(r5.some(f => f.severity === 'info'), 'Set token produces info');

// 6. auditWorkspacePermissions
const r6 = auditor.auditWorkspacePermissions({});
assert(Array.isArray(r6), 'auditWorkspacePermissions returns array');

// 7. buildPermissionAuditReport correct format
const report = auditor.buildPermissionAuditReport([r1, r2, r3, r4, r5, r6]);
assert(typeof report.totalFindings === 'number', 'Report has totalFindings');
assert(typeof report.totalCritical === 'number', 'Report has totalCritical');
assert(report.bySeverity, 'Report has bySeverity');
assert(Array.isArray(report.findings), 'Report findings is array');

// 8. buildPermissionAuditReport findings have all fields
if (report.findings.length > 0) {
  const f = report.findings[0];
  assert(f.subject !== undefined, 'Finding has subject');
  assert(f.issue !== undefined, 'Finding has issue');
  assert(f.severity !== undefined, 'Finding has severity');
  assert(f.recommendation !== undefined, 'Finding has recommendation');
}

console.log(`\nResults: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
