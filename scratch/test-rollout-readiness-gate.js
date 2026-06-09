'use strict';

const Gate = require('../src/release/rollout-readiness-gate');

let p=0, f=0;
function a(c,l){if(c){p++;console.log('  PASS: '+l)}else{f++;console.log('  FAIL: '+l)}}

console.log('\n=== Rollout Readiness Gate Tests ===\n');

const fullEnv = {TELEGRAM_TOKEN:'x',OWNER_CHAT_ID:'x',DASHBOARD_ADMIN_TOKEN:'x',AUTO_APPROVE_ENABLED:'false',AUTO_RUN_ENABLED:'false',SHELL_EXECUTOR_ENABLED:'false',NODE_ENV:'production',PORT:'3000'};
const report = Gate.runRolloutReadinessGate('test', {env:fullEnv});
a(report && report.ready === true,'rollout readiness ready with safe env');
a(report.totalGates === 5,'5 gates total');
a(report.readyGates === 5,'all 5 gates ready');
a(report.score === 100,'score 100');

const docs = Gate.checkReleaseDocsReady({});
a(docs && docs.total > 0,'docs check returns total');
a(typeof docs.ready === 'boolean','docs check has ready flag');

const env = Gate.checkEnvChecklistReady({env:fullEnv});
a(env.ready === true,'env check ready');
a(env.total >= 7,'env check total >= 7');

const sec = Gate.checkSecurityPrivacyReady({env:{TELEGRAM_TOKEN:'x',DASHBOARD_ADMIN_TOKEN:'x',AUTO_APPROVE_ENABLED:'false',AUTO_RUN_ENABLED:'false',SHELL_EXECUTOR_ENABLED:'false'}});
a(sec.ready === true,'security/privacy check ready');

const deploy = Gate.checkDeployRollbackReady({});
a(deploy.ready === true,'deploy/rollback check ready');

const mon = Gate.checkMonitoringReady({});
a(mon.ready === true,'monitoring check ready');

console.log('\nResult: '+p+' PASS, '+f+' FAIL\n');
process.exit(f>0?1:0);
