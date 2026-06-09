'use strict';

let pass = 0;
let fail = 0;
function assert(condition, msg) {
  if (condition) { pass++; } else { console.error(`FAIL: ${msg}`); fail++; }
}
function assertEq(a, b, msg) {
  if (a === b) { pass++; } else { console.error(`FAIL: ${msg} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); fail++; }
}

const fs = require('fs');
const path = require('path');
const ROOT = __dirname + '/..';

// ── Phase 58: Mobile/PWA modules ──
const mobileStore = require(ROOT + '/src/mobile/mobile-ux-store');
const mobileProfile = require(ROOT + '/src/mobile/mobile-dashboard-profile');
const mobileNav = require(ROOT + '/src/mobile/mobile-navigation-manager');
const mobileQuickActions = require(ROOT + '/src/mobile/mobile-quick-actions');
const pwaOffline = require(ROOT + '/src/mobile/pwa-offline-controller');
const pwaCache = require(ROOT + '/src/mobile/pwa-cache-policy');
const notifCenter = require(ROOT + '/src/mobile/notification-center');
const errorState = require(ROOT + '/src/mobile/dashboard-error-state-manager');
const reportGen = require(ROOT + '/src/mobile/mobile-ux-report-generator');
const mobileUtils = require(ROOT + '/src/mobile/mobile-utils');

assert(typeof mobileStore.setProfile === 'function', 'M1: mobile-ux-store loaded');
assert(typeof mobileProfile.getMobileDashboardProfile === 'function', 'M2: mobile-dashboard-profile loaded');
assert(typeof mobileNav.buildBottomNavigationItems === 'function', 'M3: mobile-navigation-manager loaded');
assert(typeof mobileQuickActions.listMobileQuickActions === 'function', 'M4: mobile-quick-actions loaded');
assert(typeof pwaOffline.getPwaOfflineStatus === 'function', 'M5: pwa-offline-controller loaded');
assert(typeof pwaCache.getPwaCachePolicy === 'function', 'M6: pwa-cache-policy loaded');
assert(typeof notifCenter.createDashboardNotification === 'function', 'M7: notification-center loaded');
assert(typeof errorState.buildDashboardErrorState === 'function', 'M8: dashboard-error-state-manager loaded');
assert(typeof reportGen.generateMobileUxReport === 'function', 'M9: mobile-ux-report-generator loaded');
assert(typeof mobileUtils.createId === 'function', 'M10: mobile-utils loaded');

// Mobile store CRUD
mobileStore.resetStore();
const profileData = mobileStore.setProfile('testUserId', 'default', { displayName: 'Test' });
assert(profileData.userId === 'testUserId', 'M11: setProfile works');
const got = mobileStore.getProfile('testUserId', 'default');
assert(got.userId === 'testUserId', 'M12: getProfile works');
const updated = mobileStore.setProfile('testUserId', 'default', { compactMode: true });
assert(updated.compactMode === true, 'M13: setProfile update works');

// Profile validation
const validProfile = mobileProfile.validateMobileProfile({ userId: 'OK' });
assert(validProfile.valid === true, 'M14: valid profile passes');

// Navigation: 7 items, 52+ tabs
const navItems = mobileNav.buildBottomNavigationItems({});
assertEq(navItems.length, 7, 'M15: 7 bottom nav items');
assert(Array.isArray(mobileNav.STABLE_TABS) && mobileNav.STABLE_TABS.length >= 52, 'M16: 52+ stable tabs');

// Quick actions: 10 read-only defaults
const actions = mobileQuickActions.listMobileQuickActions(null, {});
assertEq(actions.length, 10, 'M17: 10 default quick actions');
actions.forEach(a => {
  assert(a.riskLevel === 'read', `M18: action ${a.id} is read-only`);
});

// PWA offline
const offlineStatus = pwaOffline.getPwaOfflineStatus({});
assert(offlineStatus.online === true, 'M19: online by default');
const limitations = pwaOffline.explainOfflineLimitations({});
assert(Array.isArray(limitations.worksOffline), 'M20: offline limitations list');

// PWA cache policy
const policy = pwaCache.getPwaCachePolicy({});
assert(Array.isArray(policy.excludedPatterns), 'M21: cache policy has excludedPatterns');
const exclusions = pwaCache.validateServiceWorkerExclusions({});
assert(exclusions.excludedPatterns.some(p => p.includes('/api/dashboard/')), 'M22: /api/dashboard/ excluded');

// Notifications
const nResult = notifCenter.createDashboardNotification({ type: 'security_warning', title: 'Test', sourceModule: 'test' });
assert(nResult.ok === true, 'M24: notification created');
const nId = nResult.notification.id;
assert(nResult.notification.read === false, 'M25: notification starts unread');
notifCenter.markNotificationRead(nId, {});
const allNotifs = notifCenter.listDashboardNotifications({}, {});
assert(allNotifs.length >= 1, 'M26: listDashboardNotifications works');
notifCenter.dismissNotification(nId, {});
const afterDismiss = notifCenter.listDashboardNotifications({}, {});
assert(afterDismiss.length === 0, 'M27: dismissNotification works');

// Error state
const errState = errorState.buildDashboardErrorState(new Error('Something broke'), {});
assert(errState.hasError === true, 'M28: error state created');
const safe = errorState.sanitizeDashboardError({ message: 'secret=abc123', type: 'error' }, {});
assert(typeof safe.message === 'string', 'M29: error sanitized');

// Report
const report = reportGen.generateMobileUxReport({});
assert(typeof report.navigationTabCount === 'number', 'M30: UX report has navigationTabCount');
assert(typeof report.quickActionCount === 'number', 'M31: UX report has quickActionCount');

console.log(`\n=== Phase 58 Mobile: ${pass} passed (cumulative), ${fail} failed ===\n`);

// ── Phase 59: Disaster Recovery modules ──
const drStore = require(ROOT + '/src/disaster-recovery/dr-store');
const drillMgr = require(ROOT + '/src/disaster-recovery/dr-drill-manager');
const planGen = require(ROOT + '/src/disaster-recovery/recovery-plan-generator');
const restoreRunner = require(ROOT + '/src/disaster-recovery/restore-rehearsal-runner');
const encPolicy = require(ROOT + '/src/disaster-recovery/backup-encryption-policy');
const encPlanner = require(ROOT + '/src/disaster-recovery/backup-encryption-planner');
const integrityChecker = require(ROOT + '/src/disaster-recovery/backup-integrity-checker');
const readinessGate = require(ROOT + '/src/disaster-recovery/recovery-readiness-gate');
const secretRotation = require(ROOT + '/src/disaster-recovery/secret-rotation-rehearsal');
const drProposalBridge = require(ROOT + '/src/disaster-recovery/dr-proposal-bridge');
const drReportGen = require(ROOT + '/src/disaster-recovery/dr-report-generator');
const drUtils = require(ROOT + '/src/disaster-recovery/dr-utils');

assert(typeof drStore.createDrill === 'function', 'DR1: dr-store loaded');
assert(typeof drillMgr.createDisasterRecoveryDrill === 'function', 'DR2: dr-drill-manager loaded');
assert(typeof planGen.generateRecoveryPlan === 'function', 'DR3: recovery-plan-generator loaded');
assert(typeof restoreRunner.runRestoreRehearsal === 'function', 'DR4: restore-rehearsal-runner loaded');
assert(typeof encPolicy.getBackupEncryptionPolicy === 'function', 'DR5: backup-encryption-policy loaded');
assert(typeof encPlanner.createBackupEncryptionPlan === 'function', 'DR6: backup-encryption-planner loaded');
assert(typeof integrityChecker.checkBackupInventory === 'function', 'DR7: backup-integrity-checker loaded');
assert(typeof readinessGate.runRecoveryReadinessGate === 'function', 'DR8: recovery-readiness-gate loaded');
assert(typeof secretRotation.createSecretRotationRehearsal === 'function', 'DR9: secret-rotation-rehearsal loaded');
assert(typeof drProposalBridge.createDisasterRecoveryActionPlan === 'function', 'DR10: dr-proposal-bridge loaded');
assert(typeof drReportGen.generateDrReport === 'function', 'DR11: dr-report-generator loaded');
assert(typeof drUtils.createId === 'function', 'DR12: dr-utils loaded');

// Print a separator for readability
async function runDrTests() {
  // Drill CRUD
  const drill = drStore.createDrill({ scope: 'postgres', description: 'Test drill' });
  assert(drill.id, 'DR13: drill created');
  assertEq(drill.status, 'planned', 'DR14: drill status planned');
  const gotDrill = drStore.getDrill(drill.id);
  assert(gotDrill.scope === 'postgres', 'DR15: getDrill works');
  drStore.updateDrill(drill.id, { status: 'completed' });
  assert(drStore.getDrill(drill.id).status === 'completed', 'DR16: updateDrill works');
  drStore.removeDrill(drill.id);
  assert(drStore.getDrill(drill.id) === null, 'DR17: removeDrill works');

  // Drill manager — async
  const managedDrill = await drillMgr.createDisasterRecoveryDrill({ scope: 'full_ai_os_recovery', description: 'Managed drill' }, {});
  assert(managedDrill.ok === true, 'DR18: createDisasterRecoveryDrill ok');
  assert(managedDrill.drill.rehearsalOnly === true, 'DR19: drill is rehearsal-only');
  const dryRun = await drillMgr.runDisasterRecoveryDrillDryRun(managedDrill.drill.id, {});
  assert(dryRun.ok === true, 'DR20: dry run completed');
  const summary = await drillMgr.summarizeDisasterRecoveryDrill(managedDrill.drill.id, {});
  assert(summary.ok === true, 'DR21: summarizeDrill works');

  // Recovery plan generator — scope string, env names only
  const pgPlan = planGen.generateRecoveryPlan('postgres_recovery', {});
  assert(pgPlan.ok === true, 'DR22: postgres plan ok');
  pgPlan.plan.steps.forEach(s => {
    assert(typeof s === 'string' && !s.includes('='), `DR23: step does not contain env values: ${s.substring(0, 40)}`);
  });

  // Restore rehearsal — async, scope string, no actual restore
  const rehearsal = await restoreRunner.runRestoreRehearsal('postgres_recovery', {});
  assert(rehearsal.ok === true, 'DR24: rehearsal ok');
  assert(rehearsal.rehearsal.isRehearsal !== false, 'DR25: rehearsal is rehearsal');

  // Encryption policy
  const ep = encPolicy.getBackupEncryptionPolicy({});
  assert(ep.id === 'default_encryption_policy', 'DR26: encryption policy loaded');
  const validated = encPolicy.validateBackupEncryptionPolicy(ep, {});
  assert(validated.ok === true, 'DR27: encryption policy valid');

  // Encryption planner
  const encPlan = encPlanner.createBackupEncryptionPlan({ scope: 'full' });
  assert(encPlan.ok === true, 'DR28: encryption plan ok');
  assert(Array.isArray(encPlan.plan.steps), 'DR29: plan has steps');

  // Backup integrity
  const inventory = integrityChecker.checkBackupInventory({ type: 'postgres' });
  assert(inventory, 'DR30: backup inventory check ran');

  // Readiness gate — async
  const readiness = await readinessGate.runRecoveryReadinessGate({});
  assert(readiness.gateResult, 'DR31: readiness has result');
  assert(Array.isArray(readiness.blockers), 'DR32: readiness has blockers');

  // Secret rotation
  const rotation = secretRotation.createSecretRotationRehearsal('telegram_token', {});
  assert(rotation.ok === true, 'DR33: rotation ok');
  assert(Array.isArray(rotation.steps), 'DR34: rotation has steps');

  // DR Proposal bridge
  const actionPlan = drProposalBridge.createDisasterRecoveryActionPlan({ scope: 'postgres_recovery', sourceDrillId: 'd1' }, {});
  assert(actionPlan.ok === true, 'DR35: action plan created');
  assert(actionPlan.actionPlan.requiresApproval === true, 'DR36: plan requires approval');

  // DR Report
  const drReport = drReportGen.generateDrReport({ drills: [managedDrill.drill] });
  assert(drReport, 'DR37: DR report generated');

  console.log(`\n=== Phase 59 DR: ${pass} passed (cumulative), ${fail} failed ===\n`);
}

// ── Phase 60: Architecture Consolidation modules ──
async function runConsolidationTests() {
  const consStore = require(ROOT + '/src/consolidation/consolidation-store');
  const archAuditor = require(ROOT + '/src/consolidation/architecture-auditor');
  const dupDetector = require(ROOT + '/src/consolidation/module-duplication-detector');
  const routeConsolidator = require(ROOT + '/src/consolidation/route-registry-consolidator');
  const cmdConsolidator = require(ROOT + '/src/consolidation/command-registry-consolidator');
  const capConsolidator = require(ROOT + '/src/consolidation/capability-registry-consolidator');
  const dashAuditor = require(ROOT + '/src/consolidation/dashboard-registry-auditor');
  const docsAuditor = require(ROOT + '/src/consolidation/docs-consistency-auditor');
  const testMapper = require(ROOT + '/src/consolidation/test-coverage-mapper');
  const perfChecker = require(ROOT + '/src/consolidation/performance-baseline-checker');
  const roadmapGen = require(ROOT + '/src/consolidation/v2-roadmap-generator');
  const consReportGen = require(ROOT + '/src/consolidation/consolidation-report-generator');
  const consUtils = require(ROOT + '/src/consolidation/consolidation-utils');

  assert(typeof consStore.setAuditResult === 'function', 'C1: consolidation-store loaded');
  assert(typeof archAuditor.runArchitectureAudit === 'function', 'C2: architecture-auditor loaded');
  assert(typeof dupDetector.detectDuplicateModules === 'function', 'C3: module-duplication-detector loaded');
  assert(typeof routeConsolidator.auditBackendRoutes === 'function', 'C4: route-registry-consolidator loaded');
  assert(typeof cmdConsolidator.auditTelegramCommands === 'function', 'C5: command-registry-consolidator loaded');
  assert(typeof capConsolidator.auditGovernanceCapabilities === 'function', 'C6: capability-registry-consolidator loaded');
  assert(typeof dashAuditor.auditDashboardTabs === 'function', 'C7: dashboard-registry-auditor loaded');
  assert(typeof docsAuditor.auditDocsConsistency === 'function', 'C8: docs-consistency-auditor loaded');
  assert(typeof testMapper.mapTestsToModules === 'function', 'C9: test-coverage-mapper loaded');
  assert(typeof perfChecker.checkDashboardBundleSizeApprox === 'function', 'C10: performance-baseline-checker loaded');
  assert(typeof roadmapGen.generateV2Roadmap === 'function', 'C11: v2-roadmap-generator loaded');
  assert(typeof consReportGen.generateConsolidationReport === 'function', 'C12: consolidation-report-generator loaded');
  assert(typeof consUtils.sanitizeConsolidationData === 'function', 'C13: consolidation-utils loaded');

  // Store set/get
  consStore.resetStore();
  consStore.setAuditResult('test_audit', { modules: 10, routes: 20 });
  const auditResult = consStore.getAuditResult('test_audit');
  assert(auditResult.modules === 10, 'C14: setAuditResult/getAuditResult works');

  // Architecture audit — async, read-only
  const audit = await archAuditor.runArchitectureAudit({});
  assert(audit, 'C15: architecture audit ran');

  // Duplication detection — read-only
  const dups = await dupDetector.detectDuplicateModules({});
  assert(typeof dups === 'object', 'C16: duplications result returned');

  // Route registry consolidator — read-only
  const routeAudit = routeConsolidator.auditBackendRoutes({});
  assert(routeAudit, 'C17: route registry audit ran');

  // Command registry consolidator — read-only
  const cmdAudit = cmdConsolidator.auditTelegramCommands({});
  assert(cmdAudit, 'C18: command registry audit ran');

  // Capability registry consolidator — read-only
  const capAudit = capConsolidator.auditGovernanceCapabilities({});
  assert(capAudit, 'C19: capability audit ran');

  // Dashboard registry auditor
  const dashRegAudit = dashAuditor.auditDashboardTabs({
    tabs: ['mobile', 'disaster-recovery', 'consolidation']
  });
  assert(dashRegAudit, 'C20: dashboard registry audit ran');

  // Test coverage mapper
  const coverage = testMapper.mapTestsToModules({});
  assert(coverage, 'C21: test coverage mapped');

  // Performance baseline checker
  const baseline = perfChecker.checkDashboardBundleSizeApprox({});
  assert(baseline, 'C22: performance baseline checked');

  // V2 roadmap — read-only
  const roadmap = roadmapGen.generateV2Roadmap({});
  assert(roadmap, 'C23: v2 roadmap generated');
  assert(Array.isArray(roadmap.phases), 'C24: roadmap has phases array');

  // Consolidation report
  const consReport = consReportGen.generateConsolidationReport({ audit, dups, routeAudit, cmdAudit, capAudit, dashRegAudit, coverage, baseline, roadmap });
  assert(consReport, 'C25: consolidation report generated');

  console.log(`\n=== Phase 60 Consolidation: ${pass} passed (cumulative), ${fail} failed ===\n`);
}

// ── Cross-phase wiring checks ──
function runWiringTests() {
  const html = fs.readFileSync(ROOT + '/public/dashboard/index.html', 'utf8');
  const stateJs = fs.readFileSync(ROOT + '/public/dashboard/state.js', 'utf8');
  const swJs = fs.readFileSync(ROOT + '/public/dashboard/service-worker.js', 'utf8');
  const routesJs = fs.readFileSync(ROOT + '/src/dashboard/dashboard-routes.js', 'utf8');

  assert(html.includes('data-tab="mobile"'), 'W1: mobile nav in index.html');
  assert(html.includes('data-tab="disaster-recovery"'), 'W2: DR nav in index.html');
  assert(html.includes('data-tab="consolidation"'), 'W3: consolidation nav in index.html');
  assert(html.includes('mobile.js'), 'W4: mobile.js script in index.html');
  assert(html.includes('notification-center.js'), 'W5: notification-center.js script in index.html');
  assert(html.includes('disaster-recovery.js'), 'W6: disaster-recovery.js script in index.html');
  assert(html.includes('consolidation.js'), 'W7: consolidation.js script in index.html');
  assert(stateJs.includes("'mobile'"), 'W8: mobile tab in state.js');
  assert(stateJs.includes("'disaster-recovery'"), 'W9: DR tab in state.js');
  assert(stateJs.includes("'consolidation'"), 'W10: consolidation tab in state.js');
  assert(swJs.includes('v49-alias-fix'), 'W11: SW cache bumped to v49-alias-fix');
  assert(swJs.includes('mobile.js'), 'W12: mobile.js in SW cache');
  assert(swJs.includes('notification-center.js'), 'W13: notification-center.js in SW cache');
  assert(swJs.includes('disaster-recovery.js'), 'W14: disaster-recovery.js in SW cache');
  assert(swJs.includes('consolidation.js'), 'W15: consolidation.js in SW cache');
  assert(routesJs.includes('./mobile-routes'), 'W16: mobile routes registered in dashboard-routes');
  assert(routesJs.includes('./disaster-recovery-routes'), 'W17: DR routes registered in dashboard-routes');
  assert(routesJs.includes('./consolidation-routes'), 'W18: consolidation routes registered in dashboard-routes');

  // Verify no API routes cached in SW
  const apiPattern = /\/api\/dashboard\/\S+/g;
  let foundApiInSw = false;
  let match;
  while ((match = apiPattern.exec(swJs)) !== null) {
    foundApiInSw = true;
  }
  assert(foundApiInSw === false, 'W19: no /api/dashboard/* routes in SW cache');

  // Verify AGENTS.md updated
  const agentsMd = fs.readFileSync(ROOT + '/AGENTS.md', 'utf8');
  assert(agentsMd.includes('mobile,'), 'W20: mobile in AGENTS.md known tabs');
  assert(agentsMd.includes('disaster-recovery,'), 'W21: DR in AGENTS.md known tabs');
  assert(agentsMd.includes('consolidation,'), 'W22: consolidation in AGENTS.md known tabs');

  console.log(`\n=== Cross-phase wiring: ${pass} passed (cumulative), ${fail} failed ===\n`);
}

(async () => {
  runWiringTests();
  await runDrTests();
  await runConsolidationTests();

  console.log(`\n=== PHASE 58-60 REGRESSION SUMMARY ===`);
  console.log(`Total passed: ${pass}`);
  console.log(`Total failed: ${fail}`);
  if (fail > 0) process.exit(1);
})();
