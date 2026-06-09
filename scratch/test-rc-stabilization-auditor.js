'use strict';

const RcStabilizationAuditor = require('../src/release/rc-stabilization-auditor');
const path = require('path');
const fs = require('fs');

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
    console.log(`  PASS: ${label}`);
  } else {
    failed++;
    console.error(`  FAIL: ${label}`);
  }
}

console.log('\n=== RC Stabilization Auditor Tests ===\n');

// 1. runRcStabilizationAudit returns valid result
const result = RcStabilizationAuditor.runRcStabilizationAudit({});
assert(result && result.id, 'runRcStabilizationAudit returns result with id');
assert(result.version === 'v1.0.0-rc.1', 'version is v1.0.0-rc.1');
assert(['ready', 'blocked', 'warning', 'unknown'].includes(result.status), 'status is valid');
assert(Array.isArray(result.blockers), 'blockers is array');
assert(Array.isArray(result.warnings), 'warnings is array');
assert(Array.isArray(result.p0Findings), 'p0Findings is array');
assert(Array.isArray(result.p1Findings), 'p1Findings is array');
assert(result.summary && typeof result.summary.totalFindings === 'number', 'summary has totalFindings');
assert(result.createdAt, 'createdAt is set');
assert(result.scores && typeof result.scores.bootSafe === 'boolean', 'scores has bootSafe');

// 2. checkRcPhase50Artifacts
const artifacts = RcStabilizationAuditor.checkRcPhase50Artifacts({});
assert(artifacts && Array.isArray(artifacts.findings), 'artifacts checks returns findings array');
assert(typeof artifacts.total === 'number', 'artifacts has total');
assert(typeof artifacts.present === 'number', 'artifacts has present count');

// 3. checkRcBootSafety with safe env
const safeEnv = {
  AUTO_APPROVE_ENABLED: 'false',
  AUTO_RUN_ENABLED: 'false',
  SHELL_EXECUTOR_ENABLED: 'false',
  DANGEROUS_DEV_MODE: 'false',
  BYPASS_EVALUATION: 'false',
  BYPASS_APPROVAL: 'false',
  TELEGRAM_TOKEN: 'test_token_123',
  OWNER_CHAT_ID: '123456',
  DASHBOARD_ADMIN_TOKEN: 'admin_token_123'
};
const bootSafe = RcStabilizationAuditor.checkRcBootSafety({ env: safeEnv });
assert(bootSafe.bootSafe === true, 'bootSafe is true with safe env');
assert(bootSafe.findings.length === 0 || bootSafe.findings.every(f => f.severity !== 'P0'), 'no P0 findings with safe env');

// 4. checkRcBootSafety with dangerous env
const dangerousEnv = {
  AUTO_APPROVE_ENABLED: 'true',
  AUTO_RUN_ENABLED: 'true',
  SHELL_EXECUTOR_ENABLED: 'true',
  DANGEROUS_DEV_MODE: 'true',
  BYPASS_EVALUATION: 'true',
  BYPASS_APPROVAL: 'true',
  TELEGRAM_TOKEN: '',
  OWNER_CHAT_ID: ''
};
const bootDangerous = RcStabilizationAuditor.checkRcBootSafety({ env: dangerousEnv });
assert(bootDangerous.bootSafe === false, 'bootSafe is false with dangerous env');
assert(bootDangerous.blockerCount >= 8, 'blockerCount >= 8 with all dangerous flags');

// 5. checkRcDashboardSafety
const dashSafe = RcStabilizationAuditor.checkRcDashboardSafety({});
assert(dashSafe.knownTabCount >= 40, 'knownTabCount >= 40');
assert(dashSafe.dashboardSafe === true, 'dashboardSafe is true');

// 6. checkRcTelegramSafety
const tgSafe = RcStabilizationAuditor.checkRcTelegramSafety({});
assert(tgSafe.telegramSafe === true, 'telegramSafe is true');
assert(tgSafe.releaseCommands.length >= 14, 'releaseCommands >= 14');

// 7. checkRcExecutorBoundary
const execSafe = RcStabilizationAuditor.checkRcExecutorBoundary({});
assert(execSafe.executorSafe === true, 'executorSafe is true');
assert(execSafe.dangerousActions.length >= 13, 'dangerousActions >= 13');

// 8. checkRcGovernanceBoundary
const govSafe = RcStabilizationAuditor.checkRcGovernanceBoundary({});
assert(govSafe.governanceSafe === true, 'governanceSafe is true');
assert(govSafe.bypassPaths.length >= 9, 'bypassPaths >= 9');

// 9. checkRcSecurityPrivacyStatus
const spSafe = RcStabilizationAuditor.checkRcSecurityPrivacyStatus({});
assert(spSafe.securityPrivacySafe === true, 'securityPrivacySafe is true');

// 10. checkRcReleaseDocs
const docs = RcStabilizationAuditor.checkRcReleaseDocs({});
assert(docs && Array.isArray(docs.findings), 'docs checks returns findings');

console.log(`\nResult: ${passed} PASS, ${failed} FAIL\n`);
process.exit(failed > 0 ? 1 : 0);
