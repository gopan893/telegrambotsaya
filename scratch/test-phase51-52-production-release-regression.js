'use strict';

const ProdStore = require('../src/release/production-release-store');
const ProdManager = require('../src/release/production-release-manager');
const RolloutGate = require('../src/release/rollout-readiness-gate');
const Planner = require('../src/release/release-rollout-planner');
const GitHubBuilder = require('../src/release/github-release-proposal-builder');
const DeployBuilder = require('../src/release/production-deploy-proposal-builder');
const Checker = require('../src/release/release-verification-checker');
const Announcer = require('../src/release/release-announcement-generator');
const Postmortem = require('../src/release/release-postmortem-template');
const SloRegistry = require('../src/reliability/slo-registry');
const SloMonitor = require('../src/reliability/slo-monitor');
const Scorecard = require('../src/reliability/reliability-scorecard');
const PostReleaseMonitor = require('../src/reliability/post-release-monitor');
const HealthWindow = require('../src/reliability/release-health-window');
const Watchdog = require('../src/reliability/regression-watchdog');
const Alerts = require('../src/reliability/reliability-alerts');

let p=0, f=0;
function a(c,l){if(c){p++;console.log('  PASS: '+l)}else{f++;console.log('  FAIL: '+l)}}

ProdStore.resetStore();
SloRegistry.resetStore();
console.log('\n=== Phase 51-52 Production Release Regression Tests ===\n');

const env = {TELEGRAM_TOKEN:'x',OWNER_CHAT_ID:'x',DASHBOARD_ADMIN_TOKEN:'x',AUTO_APPROVE_ENABLED:'false',AUTO_RUN_ENABLED:'false',SHELL_EXECUTOR_ENABLED:'false',NODE_ENV:'production',PORT:'3000'};

// 1. Production release
const r = ProdManager.createProductionRelease({version:'v1.0.0',sourceRcVersion:'v1.0.0-rc.1'},{});
a(r && r.version === 'v1.0.0','PR: create v1.0.0 release');
a(r.sourceRcVersion === 'v1.0.0-rc.1','PR: source RC version');

// 2. Finalize plan
const fin = ProdManager.finalizeProductionReleasePlan(r.id, {env});
a(fin.ok === true,'PR: finalize plan with safe env');
a(fin.status === 'ready','PR: status ready');

// 3. Rollout readiness
const gate = RolloutGate.runRolloutReadinessGate(r.id, {env});
a(gate.ready === true,'PR: rollout readiness ready');
a(gate.score === 100,'PR: rollout readiness score 100');

// 4. Rollout plan
const plan = Planner.createReleaseRolloutPlan(r.id, {});
a(plan.stages.length === 8,'PR: 8 rollout stages');

// 5. GitHub proposal (no direct action)
const gitTag = GitHubBuilder.buildGitHubTagProposal(r.id, {});
a(gitTag.directAction === false,'PR: GitHub tag proposal-only');
a(gitTag.requiresEvaluation === true,'PR: GitHub tag requires eval');

const gitRelease = GitHubBuilder.buildGitHubReleaseProposal(r.id, {});
a(gitRelease.directAction === false,'PR: GitHub release proposal-only');

// 6. Deploy proposal (no direct action)
const depProp = DeployBuilder.buildProductionDeployProposal(r.id, {});
a(depProp.directAction === false,'PR: deploy proposal-only');
a(depProp.requiresApproval === true,'PR: deploy requires approval');

const renderProp = DeployBuilder.buildRenderDeployProposal(r.id, {});
a(renderProp.directAction === false,'PR: Render deploy proposal-only');

const rollbackProp = DeployBuilder.buildRollbackProposalIfNeeded(r.id, 'test', {});
a(rollbackProp.directAction === false,'PR: rollback proposal-only');

// 7. Verification
const boot = Checker.verifyProductionBoot({});
const dash = Checker.verifyDashboardAfterRelease({});
const tgV = Checker.verifyTelegramAfterRelease({});
const whV = Checker.verifyWebhookHealth({env:{WEBHOOK_URL:'x',PORT:'3000'}});
const storV = Checker.verifyStorageHealth({env:{STORAGE_DRIVER:'postgres',DATABASE_URL:'x'}});
const apiV = Checker.verifyCriticalApiHealth({});
const secV = Checker.verifyNoSecretLeakInReleaseOutputs({});
const verify = Checker.buildReleaseVerificationReport({boot, dashboard:dash, telegram:tgV, webhook:whV, storage:storV, api:apiV, secrets:secV});
a(verify.allPass === true,'PR: verification all pass');

// 8. Announcement
const ann = Announcer.generateReleaseAnnouncement(r.id, {});
a(ann && ann.title.includes('v1.0.0'),'PR: announcement has version');

// 9. Postmortem
const pm = Postmortem.generatePostmortemTemplate(r.id, {});
a(pm.version === 'v1.0.0','PR: postmortem has version');
a(pm.note.includes('postmortem'),'PR: postmortem note present');

// 10. SLO registry
const slos = SloRegistry.initializeDefaultSlos();
a(slos.length === 12,'SLO: 12 default SLOs');

// 11. SLO monitor
const sloStatus = SloMonitor.evaluateSloStatus({});
a(sloStatus.total === 12,'SLO: evaluate all');
a(sloStatus.overall !== 'unknown','SLO: overall status valid');

// 12. Scorecard
const sc = Scorecard.calculateReliabilityScorecard({});
a(sc.overall >= 95,'SLO: scorecard >= 95 in safe env');

// 13. Post-release monitor
const monStart = PostReleaseMonitor.startPostReleaseMonitoring(r.id, {});
a(monStart.status === 'monitoring','MON: monitoring started');

const monCheck = PostReleaseMonitor.runPostReleaseHealthCheck(r.id, {});
a(monCheck.ok === true,'MON: health check ok');

const monReport = PostReleaseMonitor.buildPostReleaseMonitoringReport(r.id, {});
a(monReport.status === 'monitoring','MON: report status monitoring');

// 14. Health window
const hw = HealthWindow.openReleaseHealthWindow(r.id, 30, {});
a(hw.status === 'open','HW: window opened');

const hwSample = HealthWindow.recordHealthSample(r.id, {uptime:99.9,errors:0});
a(hwSample.ok === true,'HW: sample recorded');

const hwSummary = HealthWindow.summarizeHealthWindow(r.id, {});
a(hwSummary.status === 'healthy','HW: summary healthy');

// 15. Regression watchdog
const wDash = Watchdog.watchDashboardRegression({});
a(wDash.allPass === true,'WD: dashboard regression pass');

const wApproval = Watchdog.watchApprovalBoundaryRegression({});
a(wApproval.allPass === true,'WD: approval boundary all pass');

// 16. Alerts
const alert = Alerts.buildReliabilityAlert({type:'test',severity:'info',message:'test alert'});
a(alert && alert.type === 'test','ALERT: build alert');

const sent = Alerts.sendReliabilityAlert(alert, {});
a(sent.ok === true,'ALERT: send alert');

const rollbackAlert = Alerts.buildRollbackRecommendationAlert('Health check failure');
a(rollbackAlert.severity === 'critical','ALERT: rollback alert critical');
a(rollbackAlert.proposalRequired === true,'ALERT: rollback requires proposal');

// 17. Security: no env values in outputs
const report = ProdManager.buildProductionReleaseSummary(r.id, {env});
a(report.release && !report.release.TELEGRAM_TOKEN,'SEC: no TG token in summary');

const annText = Announcer.generateReleaseAnnouncement(r.id, {env});
a(annText.message && !annText.message.includes('TELEGRAM_TOKEN'),'SEC: no TG token in announcement');

// 18. No auto-approve
const blocked = ProdManager.blockReleaseIfP0Exists('nonexistent', {});
a(blocked.ok === false,'BLOCK: nonexistent release');

// 19. Approval boundary
const apprBoundary = Watchdog.watchApprovalBoundaryRegression({});
const allProposalOnly = apprBoundary.findings.every(f => f.pass === true);
a(allProposalOnly === true,'BOUNDARY: all actions proposal-only');

// 20. Clean up
ProdStore.resetStore();
SloRegistry.resetStore();
console.log('\nResult: '+p+' PASS, '+f+' FAIL\n');
process.exit(f>0?1:0);
