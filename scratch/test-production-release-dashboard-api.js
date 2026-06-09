'use strict';

const ProdStore = require('../src/release/production-release-store');
const ProdManager = require('../src/release/production-release-manager');
const RolloutGate = require('../src/release/rollout-readiness-gate');
const Planner = require('../src/release/release-rollout-planner');
const GitHubBuilder = require('../src/release/github-release-proposal-builder');
const DeployBuilder = require('../src/release/production-deploy-proposal-builder');
const Checker = require('../src/release/release-verification-checker');

let p=0, f=0;
function a(c,l){if(c){p++;console.log('  PASS: '+l)}else{f++;console.log('  FAIL: '+l)}}

ProdStore.resetStore();
console.log('\n=== Production Release Dashboard API Tests ===\n');

const env = {TELEGRAM_TOKEN:'x',OWNER_CHAT_ID:'x',DASHBOARD_ADMIN_TOKEN:'x',AUTO_APPROVE_ENABLED:'false',AUTO_RUN_ENABLED:'false',SHELL_EXECUTOR_ENABLED:'false',NODE_ENV:'production',PORT:'3000'};

const r = ProdManager.createProductionRelease({version:'v1.0.0'},{});
a(r && r.version === 'v1.0.0','GET production-release returns releases');

const fin = ProdManager.finalizeProductionReleasePlan(r.id, {env});
a(fin.ok === true,'POST production-release/:id/readiness ok');

const plan = Planner.createReleaseRolloutPlan(r.id, {});
a(plan.stages.length === 8,'GET production-release/:id/rollout-plan');

const gitProp = GitHubBuilder.buildGitHubTagProposal(r.id, {});
a(gitProp.directAction === false,'POST production-release/:id/github-proposal proposal-only');

const depProp = DeployBuilder.buildProductionDeployProposal(r.id, {});
a(depProp.directAction === false,'POST production-release/:id/deploy-proposal proposal-only');

const boot = Checker.verifyProductionBoot({});
const dash = Checker.verifyDashboardAfterRelease({});
const tg = Checker.verifyTelegramAfterRelease({});
const wh = Checker.verifyWebhookHealth({env:{WEBHOOK_URL:'x',PORT:'3000'}});
const storage = Checker.verifyStorageHealth({env:{STORAGE_DRIVER:'postgres',DATABASE_URL:'x'}});
const api = Checker.verifyCriticalApiHealth({});
const secrets = Checker.verifyNoSecretLeakInReleaseOutputs({});
const verify = Checker.buildReleaseVerificationReport({boot, dashboard:dash, telegram:tg, webhook:wh, storage, api, secrets});
a(verify.allPass === true,'GET production-release/:id/verification');

const summary = ProdManager.buildProductionReleaseSummary(r.id, {env});
a(summary.ok === true,'GET production-release/:id/report');

const gate = RolloutGate.runRolloutReadinessGate(r.id, {env});
a(gate.ready === true,'rollout readiness ready');

ProdStore.resetStore();
console.log('\nResult: '+p+' PASS, '+f+' FAIL\n');
process.exit(f>0?1:0);
