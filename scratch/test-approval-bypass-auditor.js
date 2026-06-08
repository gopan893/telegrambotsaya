'use strict';

const auditor = require('../src/security/approval-bypass-auditor');
let pass = 0;
let fail = 0;
function assert(condition, msg) {
  if (condition) { pass++; } else { console.error(`FAIL: ${msg}`); fail++; }
}
function assertEq(a, b, msg) {
  if (a === b) { pass++; } else { console.error(`FAIL: ${msg} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); fail++; }
}

// 1. auditApprovalBypassPaths returns all 9 paths
const paths = auditor.auditApprovalBypassPaths({});
assert(Array.isArray(paths), 'auditApprovalBypassPaths returns array');
assertEq(paths.length, 9, 'Returns exactly 9 bypass paths');

// 2. testGithubPushApprovalPath returns expected_blocked
const gp = auditor.testGithubPushApprovalPath({});
assertEq(gp[0].status, 'expected_blocked', 'github_push status expected_blocked');
assertEq(gp[0].directExecutionBlocked, true, 'github_push directExecutionBlocked true');
assertEq(gp[0].path, 'github_push', 'github_push path correct');

// 3. testWorkflowDispatchApprovalPath
const wd = auditor.testWorkflowDispatchApprovalPath({});
assertEq(wd[0].status, 'expected_blocked', 'workflow_dispatch expected_blocked');

// 4. testRenderDeployApprovalPath
const rd = auditor.testRenderDeployApprovalPath({});
assertEq(rd[0].status, 'expected_blocked', 'render_deploy expected_blocked');

// 5. testRollbackApprovalPath
const rb = auditor.testRollbackApprovalPath({});
assertEq(rb[0].status, 'expected_blocked', 'rollback expected_blocked');

// 6. testBackupRestoreApprovalPath
const br = auditor.testBackupRestoreApprovalPath({});
assertEq(br[0].status, 'expected_blocked', 'backup_restore expected_blocked');

// 7. testWebhookPostApprovalPath
const wh = auditor.testWebhookPostApprovalPath({});
assertEq(wh[0].status, 'expected_blocked', 'webhook_post expected_blocked');

// 8. testGmailSendApprovalPath
const gs = auditor.testGmailSendApprovalPath({});
assertEq(gs[0].status, 'expected_blocked', 'gmail_send expected_blocked');

// 9. testCalendarWriteApprovalPath
const cw = auditor.testCalendarWriteApprovalPath({});
assertEq(cw[0].status, 'expected_blocked', 'calendar_write expected_blocked');

// 10. testOperatingLoopBypassPath
const ol = auditor.testOperatingLoopBypassPath({});
assertEq(ol[0].status, 'expected_blocked', 'operating_loop expected_blocked');

// 11. buildApprovalBypassReport.allBlocked is true
const report = auditor.buildApprovalBypassReport([paths]);
assert(report.allBlocked === true, 'buildApprovalBypassReport allBlocked true');
assertEq(report.totalPaths, 9, 'Report totalPaths is 9');

console.log(`\nResults: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
