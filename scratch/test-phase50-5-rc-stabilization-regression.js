'use strict';

const RcStabilizationAuditor = require('../src/release/rc-stabilization-auditor');
const RcBlockerClassifier = require('../src/release/rc-blocker-classifier');
const RcRegressionChecker = require('../src/release/rc-regression-checker');
const RcFixPolicy = require('../src/release/rc-fix-policy');
const RcStabilizationReportGenerator = require('../src/release/rc-stabilization-report-generator');

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

console.log('\n=== Phase 50.5 RC Stabilization Regression Tests ===\n');

// 1. Auditor produces valid full audit
const audit = RcStabilizationAuditor.runRcStabilizationAudit({});
assert(audit && audit.id, 'full audit produces id');
assert(audit.createdAt, 'full audit has createdAt');
assert(audit.results.boot, 'audit has boot results');
assert(audit.results.dashboard, 'audit has dashboard results');
assert(audit.results.telegram, 'audit has telegram results');
assert(audit.results.executor, 'audit has executor results');
assert(audit.results.governance, 'audit has governance results');
assert(audit.results.securityPrivacy, 'audit has securityPrivacy results');
assert(audit.results.releaseDocs, 'audit has releaseDocs results');
assert(audit.results.artifacts, 'audit has artifacts results');
assert(audit.summary.totalFindings > 0, 'audit has findings');

// 2. Blocker classifier correctly identifies P0
const p0Findings = [
  { message: 'AUTO_APPROVE_ENABLED is true — release blocker', category: 'boot' },
  { message: 'node --check telebot.js failed — release blocker', category: 'boot' }
];
for (const f of p0Findings) {
  const c = RcBlockerClassifier.classifyRcFinding(f);
  assert(c.priority === 'P0', `P0: ${f.message}`);
}

// 3. Blocker classifier correctly identifies P1
const p1Findings = [
  { message: 'release docs incomplete', category: 'docs' },
  { message: 'stale pwa cache version', category: 'pwa' }
];
for (const f of p1Findings) {
  const c = RcBlockerClassifier.classifyRcFinding(f);
  assert(c.priority === 'P1', `P1: ${f.message}`);
}

// 4. Blocker summary
const summary = RcBlockerClassifier.buildRcBlockerSummary([...p0Findings, ...p1Findings]);
assert(summary.p0Count === 2, 'summary p0Count = 2');
assert(summary.p1Count === 2, 'summary p1Count = 2');
assert(summary.blocked === true, 'summary blocked');
assert(summary.summary.includes('2 P0'), 'summary text includes 2 P0');

// 5. Regression checker all pass
const regChecks = [
  RcRegressionChecker.checkDashboardRegistryRegression({}),
  RcRegressionChecker.checkDashboardSidebarRegression({}),
  RcRegressionChecker.checkDashboardRendererRegression({}),
  RcRegressionChecker.checkPwaCacheRegression({}),
  RcRegressionChecker.checkTelegramCommandRegression({}),
  RcRegressionChecker.checkNaturalRouterRegression({}),
  RcRegressionChecker.checkApprovalBoundaryRegression({}),
  RcRegressionChecker.checkSecretRedactionRegression({}),
  RcRegressionChecker.checkPrivacyExportRegression({}),
  RcRegressionChecker.checkReleaseCandidateRegression({})
];
for (const check of regChecks) {
  assert(check.pass === true, `regression: ${check.findings[0]?.category || 'unknown'} pass`);
}

// 6. Fix policy P0 allowed
const p0Fix = RcFixPolicy.evaluateRcFixAllowed({ type: 'fix', description: 'boot crash fix — P0', priority: 'P0' });
assert(p0Fix.allowed === true, 'P0 fix allowed');

// 7. Fix policy P1 allowed
const p1Fix = RcFixPolicy.evaluateRcFixAllowed({ type: 'fix', description: 'dashboard route missing — P1', priority: 'P1' });
assert(p1Fix.allowed === true, 'P1 fix allowed');

// 8. Fix policy new feature blocked
const newFeat = RcFixPolicy.evaluateRcFixAllowed({ type: 'new_feature', description: 'large new feature' });
assert(newFeat.allowed === false, 'new feature blocked');

// 9. Fix policy shell executor blocked
const shell = RcFixPolicy.evaluateRcFixAllowed({ type: 'fix', description: 'add shell executor feature' });
assert(shell.allowed === false, 'shell executor blocked');

// 10. Report generator
const report = RcStabilizationReportGenerator.generateStabilizationReport(audit, summary, regChecks, []);
assert(report.reportType === 'rc-stabilization-report', 'report type correct');
assert(report.stabilization, 'report has stabilization section');
assert(report.p0Findings, 'report has p0Findings section');
assert(report.p1Findings, 'report has p1Findings section');
assert(report.fixedIssues, 'report has fixedIssues section');
assert(report.testsSummary, 'report has testsSummary section');
assert(report.dashboardStatus, 'report has dashboardStatus section');
assert(report.telegramStatus, 'report has telegramStatus section');
assert(report.executorBoundaryStatus, 'report has executorBoundaryStatus section');
assert(report.securityPrivacyStatus, 'report has securityPrivacyStatus section');
assert(report.releaseReadinessStatus, 'report has releaseReadinessStatus section');
assert(report.phase51Recommendation, 'report has phase51Recommendation section');
assert(report.qualityGates, 'report has qualityGates section');
assert(typeof report.qualityGates.rcStabilizationScore === 'number', 'qualityGates has stabilization score');

// 11. Quality gates validation
assert(report.qualityGates.noDirectExternalWrite === true, 'no direct external write');
assert(report.qualityGates.noSecretLeakage === true, 'no secret leakage');
assert(report.qualityGates.noHardDelete === true, 'no hard delete');
assert(report.qualityGates.noShellExecutor === true, 'no shell executor');

// 12. Report with fixes
const reportWithFixes = RcStabilizationReportGenerator.generateStabilizationReport(audit, summary, regChecks, [
  { description: 'Fixed boot safety check', type: 'fix', category: 'boot', priority: 'P0', status: 'applied' },
  { description: 'Fixed dashboard registry check', type: 'fix', category: 'dashboard', priority: 'P1', status: 'applied' }
]);
assert(reportWithFixes.fixedIssues.count === 2, 'fixed issues count = 2');
assert(reportWithFixes.fixedIssues.items.length === 2, 'fixed issues items length = 2');

// 13. Phase 51 recommendation
const rec = report.phase51Recommendation;
assert(rec.proceedToPhase51 === false, 'proceedToPhase51 = false with P0 blockers');
assert(rec.reason.includes('P0 blockers'), 'reason mentions P0 blockers');

// 14. Report with no blockers
const cleanAudit = RcStabilizationAuditor.runRcStabilizationAudit({
  env: {
    AUTO_APPROVE_ENABLED: 'false', AUTO_RUN_ENABLED: 'false',
    SHELL_EXECUTOR_ENABLED: 'false', DANGEROUS_DEV_MODE: 'false',
    BYPASS_EVALUATION: 'false', BYPASS_APPROVAL: 'false',
    TELEGRAM_TOKEN: 'test123', OWNER_CHAT_ID: '123', DASHBOARD_ADMIN_TOKEN: 'adm123'
  }
});
const cleanSummary = RcBlockerClassifier.buildRcBlockerSummary(cleanAudit.p0Findings.concat(cleanAudit.p1Findings));
const cleanReport = RcStabilizationReportGenerator.generateStabilizationReport(cleanAudit, cleanSummary, regChecks, []);
assert(cleanReport.qualityGates.noAutoApprove === true, 'no auto approve in clean env');

console.log(`\nResult: ${passed} PASS, ${failed} FAIL\n`);
process.exit(failed > 0 ? 1 : 0);
