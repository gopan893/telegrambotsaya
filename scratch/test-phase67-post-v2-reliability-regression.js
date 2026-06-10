'use strict';
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..');

async function run() {
  let passed = 0;
  let failed = 0;
  const failures = [];

  function check(ok, msg) {
    if (ok) { console.log('PASS: ' + msg); passed++; }
    else { console.log('FAIL: ' + msg); failed++; failures.push(msg); }
  }

  console.log('=== Phase 67 Post-V2 Watch Reliability Regression ===\n');

  /* 1. Verify all modules exist */
  const moduleFiles = [
    'src/post-v2/post-v2-utils.js',
    'src/post-v2/post-v2-watch-store.js',
    'src/post-v2/post-v2-watch-manager.js',
    'src/post-v2/post-v2-health-window.js',
    'src/post-v2/post-v2-regression-watchdog.js',
    'src/post-v2/post-v2-dashboard-watchdog.js',
    'src/post-v2/post-v2-api-watchdog.js',
    'src/post-v2/post-v2-telegram-watchdog.js',
    'src/post-v2/post-v2-pwa-watchdog.js',
    'src/post-v2/post-v2-performance-watchdog.js',
    'src/post-v2/post-v2-security-privacy-watchdog.js',
    'src/post-v2/post-v2-rollback-advisor.js',
    'src/post-v2/post-v2-reliability-scorecard.js',
    'src/dashboard/post-v2-routes.js',
    'public/dashboard/post-v2.js'
  ];
  for (const f of moduleFiles) {
    check(fs.existsSync(path.join(ROOT, f)), 'Module exists: ' + f);
  }

  /* 2. Load all modules */
  const utils = require(path.join(ROOT, 'src/post-v2/post-v2-utils'));
  const store = require(path.join(ROOT, 'src/post-v2/post-v2-watch-store'));
  const mgr = require(path.join(ROOT, 'src/post-v2/post-v2-watch-manager'));
  const hw = require(path.join(ROOT, 'src/post-v2/post-v2-health-window'));
  const regWd = require(path.join(ROOT, 'src/post-v2/post-v2-regression-watchdog'));
  const dashWd = require(path.join(ROOT, 'src/post-v2/post-v2-dashboard-watchdog'));
  const apiWd = require(path.join(ROOT, 'src/post-v2/post-v2-api-watchdog'));
  const telWd = require(path.join(ROOT, 'src/post-v2/post-v2-telegram-watchdog'));
  const pwaWd = require(path.join(ROOT, 'src/post-v2/post-v2-pwa-watchdog'));
  const perfWd = require(path.join(ROOT, 'src/post-v2/post-v2-performance-watchdog'));
  const secWd = require(path.join(ROOT, 'src/post-v2/post-v2-security-privacy-watchdog'));
  const ra = require(path.join(ROOT, 'src/post-v2/post-v2-rollback-advisor'));
  const sc = require(path.join(ROOT, 'src/post-v2/post-v2-reliability-scorecard'));
  const routes = require(path.join(ROOT, 'src/dashboard/post-v2-routes'));

  check(typeof utils.generateId === 'function', 'utils.generateId loaded');
  check(typeof utils.sanitizeForReport === 'function', 'utils.sanitizeForReport loaded');
  check(typeof store.createPostV2Watch === 'function', 'store.createPostV2Watch loaded');
  check(typeof store.getPostV2Watch === 'function', 'store.getPostV2Watch loaded');
  check(typeof store.getAllPostV2Watches === 'function', 'store.getAllPostV2Watches loaded');

  check(typeof mgr.startPostV2Watch === 'function', 'mgr.startPostV2Watch loaded');
  check(typeof mgr.getPostV2WatchStatus === 'function', 'mgr.getPostV2WatchStatus loaded');
  check(typeof mgr.runPostV2WatchCycle === 'function', 'mgr.runPostV2WatchCycle loaded');
  check(typeof mgr.buildPostV2WatchReport === 'function', 'mgr.buildPostV2WatchReport loaded');

  check(typeof hw.createPostV2HealthWindow === 'function', 'hw.createPostV2HealthWindow loaded');
  check(typeof hw.evaluatePostV2HealthWindow === 'function', 'hw.evaluatePostV2HealthWindow loaded');
  check(typeof hw.buildHealthWindowSummary === 'function', 'hw.buildHealthWindowSummary loaded');

  check(typeof regWd.runPostV2RegressionWatchdog === 'function', 'regWd.runPostV2RegressionWatchdog loaded');
  check(typeof regWd.detectDashboardRegression === 'function', 'regWd.detectDashboardRegression loaded');
  check(typeof regWd.detectApiRegression === 'function', 'regWd.detectApiRegression loaded');
  check(typeof regWd.buildRegressionWatchdogReport === 'function', 'regWd.buildRegressionWatchdogReport loaded');

  check(typeof dashWd.checkAllStableDashboardTabsPostV2 === 'function', 'dashWd.checkAllStableDashboardTabsPostV2 loaded');
  check(typeof dashWd.checkNoOverviewFallbackPostV2 === 'function', 'dashWd.checkNoOverviewFallbackPostV2 loaded');
  check(typeof dashWd.buildDashboardWatchdogReport === 'function', 'dashWd.buildDashboardWatchdogReport loaded');

  check(typeof apiWd.checkDashboardApiContractsPostV2 === 'function', 'apiWd.checkDashboardApiContractsPostV2 loaded');
  check(typeof apiWd.detectApi500PostV2 === 'function', 'apiWd.detectApi500PostV2 loaded');
  check(typeof apiWd.buildApiWatchdogReport === 'function', 'apiWd.buildApiWatchdogReport loaded');

  check(typeof telWd.checkTelegramCommandRegistryPostV2 === 'function', 'telWd.checkTelegramCommandRegistryPostV2 loaded');
  check(typeof telWd.buildTelegramWatchdogReport === 'function', 'telWd.buildTelegramWatchdogReport loaded');

  check(typeof pwaWd.checkPwaCachePolicyPostV2 === 'function', 'pwaWd.checkPwaCachePolicyPostV2 loaded');
  check(typeof pwaWd.checkServiceWorkerVersionPostV2 === 'function', 'pwaWd.checkServiceWorkerVersionPostV2 loaded');
  check(typeof pwaWd.buildPwaWatchdogReport === 'function', 'pwaWd.buildPwaWatchdogReport loaded');

  check(typeof perfWd.checkPostV2PerformanceScore === 'function', 'perfWd.checkPostV2PerformanceScore loaded');
  check(typeof perfWd.buildPerformanceWatchdogReport === 'function', 'perfWd.buildPerformanceWatchdogReport loaded');

  check(typeof secWd.checkSecretRedactionPostV2 === 'function', 'secWd.checkSecretRedactionPostV2 loaded');
  check(typeof secWd.checkEnvValueLeakPostV2 === 'function', 'secWd.checkEnvValueLeakPostV2 loaded');
  check(typeof secWd.checkApprovalBypassPostV2 === 'function', 'secWd.checkApprovalBypassPostV2 loaded');
  check(typeof secWd.buildSecurityPrivacyWatchdogReport === 'function', 'secWd.buildSecurityPrivacyWatchdogReport loaded');

  check(typeof ra.evaluateRollbackNeedPostV2 === 'function', 'ra.evaluateRollbackNeedPostV2 loaded');
  check(typeof ra.buildRollbackRecommendation === 'function', 'ra.buildRollbackRecommendation loaded');
  check(typeof ra.createRollbackProposalFromPostV2Incident === 'function', 'ra.createRollbackProposalFromPostV2Incident loaded');
  check(typeof ra.buildRollbackAdvisorReport === 'function', 'ra.buildRollbackAdvisorReport loaded');

  check(typeof sc.calculatePostV2ReliabilityScore === 'function', 'sc.calculatePostV2ReliabilityScore loaded');
  check(typeof sc.calculateDashboardReliabilityScore === 'function', 'sc.calculateDashboardReliabilityScore loaded');
  check(typeof sc.calculateApiReliabilityScore === 'function', 'sc.calculateApiReliabilityScore loaded');
  check(typeof sc.buildPostV2ReliabilityScorecard === 'function', 'sc.buildPostV2ReliabilityScorecard loaded');

  check(typeof routes.registerPostV2Routes === 'function', 'routes.registerPostV2Routes loaded');

  /* 3. Run core functions */
  store.clearAll();

  const watch = await mgr.startPostV2Watch({ version: 'v2.0.1' }, {});
  check(!!watch && !!watch.id, 'startPostV2Watch works');

  const status = await mgr.getPostV2WatchStatus(watch.id, {});
  check(status.exists === true, 'getPostV2WatchStatus works');

  const cycle = await mgr.runPostV2WatchCycle(watch.id, {});
  check(cycle.ok === true, 'runPostV2WatchCycle works');

  const report = await mgr.buildPostV2WatchReport(watch.id, {});
  check(report.id === watch.id, 'buildPostV2WatchReport works');

  const wh = hw.createPostV2HealthWindow(watch.id, {}, {});
  check(!!wh && wh.status === 'open', 'createPostV2HealthWindow works');

  const evalResult = hw.evaluatePostV2HealthWindow(watch.id, {});
  check(evalResult.passed === true, 'evaluatePostV2HealthWindow works');

  const summary = hw.buildHealthWindowSummary(watch.id, {});
  check(summary.id === wh.id, 'buildHealthWindowSummary works');

  const regResult = regWd.runPostV2RegressionWatchdog(watch.id, {});
  check(Array.isArray(regResult.regressions), 'runPostV2RegressionWatchdog works');

  const dashResult = dashWd.checkAllStableDashboardTabsPostV2({});
  check(typeof dashResult.passed === 'boolean', 'checkAllStableDashboardTabsPostV2 works');

  const noFallback = dashWd.checkNoOverviewFallbackPostV2({});
  check(typeof noFallback.passed === 'boolean', 'checkNoOverviewFallbackPostV2 works');

  const apiChecks = apiWd.checkDashboardApiContractsPostV2({});
  check(Array.isArray(apiChecks), 'checkDashboardApiContractsPostV2 works');

  const telChecks = telWd.checkTelegramCommandRegistryPostV2({});
  check(Array.isArray(telChecks), 'checkTelegramCommandRegistryPostV2 works');

  const pwaCache = pwaWd.checkPwaCachePolicyPostV2({});
  check(Array.isArray(pwaCache), 'checkPwaCachePolicyPostV2 works');

  const perfScore = perfWd.checkPostV2PerformanceScore({});
  check(typeof perfScore.score === 'number', 'checkPostV2PerformanceScore works');

  const secRedact = secWd.checkSecretRedactionPostV2({ sampleOutputs: ['ok'] });
  check(Array.isArray(secRedact), 'checkSecretRedactionPostV2 works');

  const rollbackNeed = ra.evaluateRollbackNeedPostV2(watch.id, {});
  check(typeof rollbackNeed.needed === 'boolean', 'evaluateRollbackNeedPostV2 works');

  const rec = ra.buildRollbackRecommendation(watch.id, {});
  check(rec.proposalOnly === true, 'buildRollbackRecommendation is proposalOnly');

  const incident = { id: 'inc-test', severity: 'critical', detail: 'test' };
  const proposal = ra.createRollbackProposalFromPostV2Incident(incident, {});
  check(!!proposal && proposal.status === 'proposal', 'createRollbackProposalFromPostV2Incident works');
  check(proposal.note.includes('PROPOSAL ONLY'), 'Proposal marked PROPOSAL ONLY');

  const relScore = sc.calculatePostV2ReliabilityScore(watch.id, {});
  check(typeof relScore.overallScore === 'number', 'calculatePostV2ReliabilityScore works');

  const scorecard = sc.buildPostV2ReliabilityScorecard(watch.id, {});
  check(scorecard.watchId === watch.id, 'buildPostV2ReliabilityScorecard works');

  /* 4. Verify no auto rollback */
  check(rec.proposalOnly === true, 'No auto rollback - recommendation is proposalOnly');
  const advisorReport = ra.buildRollbackAdvisorReport(watch.id, {});
  check(advisorReport.noAutoRollback === true, 'No auto rollback - advisorReport has noAutoRollback');
  check(advisorReport.proposalOnly === true, 'No auto rollback - advisorReport is proposalOnly');

  /* 5. Verify no secrets */
  const routeContent = fs.readFileSync(path.join(ROOT, 'src/dashboard/post-v2-routes.js'), 'utf8');
  check(!routeContent.includes('TELEGRAM_TOKEN'), 'Route file does not contain TELEGRAM_TOKEN');
  check(!routeContent.includes('GITHUB_TOKEN'), 'Route file does not contain GITHUB_TOKEN');

  const dashContent = fs.readFileSync(path.join(ROOT, 'public/dashboard/post-v2.js'), 'utf8');
  check(dashContent.includes('UI.renderPostV2'), 'Dashboard JS registers UI.renderPostV2');

  /* 6. Verify proposals only */
  check(rec.proposalOnly === true, 'Rollback recommendation is proposalOnly');
  check(proposal.note.includes('PROPOSAL ONLY'), 'Rollback proposal has PROPOSAL ONLY note');

  /* 7. Syntax checks */
  const syntaxFiles = [
    'src/post-v2/post-v2-utils.js',
    'src/post-v2/post-v2-watch-store.js',
    'src/post-v2/post-v2-watch-manager.js',
    'src/post-v2/post-v2-health-window.js',
    'src/post-v2/post-v2-regression-watchdog.js',
    'src/post-v2/post-v2-dashboard-watchdog.js',
    'src/post-v2/post-v2-api-watchdog.js',
    'src/post-v2/post-v2-telegram-watchdog.js',
    'src/post-v2/post-v2-pwa-watchdog.js',
    'src/post-v2/post-v2-performance-watchdog.js',
    'src/post-v2/post-v2-security-privacy-watchdog.js',
    'src/post-v2/post-v2-rollback-advisor.js',
    'src/post-v2/post-v2-reliability-scorecard.js',
    'src/dashboard/post-v2-routes.js'
  ];
  for (const f of syntaxFiles) {
    try {
      execSync('node --check "' + path.join(ROOT, f) + '"', { stdio: 'pipe' });
      check(true, 'Syntax check passed: ' + f);
    } catch (e) {
      check(false, 'Syntax check failed: ' + f + ' - ' + (e.stderr || '').toString().trim());
    }
  }

  console.log('\n=== Phase 67 Post-V2 Watch Reliability Regression: ' + passed + ' passed, ' + failed + ' failed ===');
  if (failures.length > 0) {
    for (const f of failures) {
      console.error('  FAILED: ' + f);
    }
  }
  if (failed > 0) process.exit(1);
}

run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
