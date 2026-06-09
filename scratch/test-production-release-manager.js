'use strict';

const ProdStore = require('../src/release/production-release-store');
const ProdManager = require('../src/release/production-release-manager');

let p=0, f=0;
function a(c,l){if(c){p++;console.log('  PASS: '+l)}else{f++;console.log('  FAIL: '+l)}}

ProdStore.resetStore();
console.log('\n=== Production Release Manager Tests ===\n');

const r = ProdManager.createProductionRelease({version:'v1.0.0'},{});
a(r && r.version === 'v1.0.0','create production release');
a(r.status === 'draft','status draft');

const verify = ProdManager.verifyRcReadyForProduction({env:{TELEGRAM_TOKEN:'x',OWNER_CHAT_ID:'x',DASHBOARD_ADMIN_TOKEN:'x',AUTO_APPROVE_ENABLED:'false',AUTO_RUN_ENABLED:'false',SHELL_EXECUTOR_ENABLED:'false'}});
a(verify && typeof verify.ready === 'boolean','verifyRcReadyForProduction returns ready');

const finalize = ProdManager.finalizeProductionReleasePlan(r.id, {env:{TELEGRAM_TOKEN:'x',OWNER_CHAT_ID:'x',DASHBOARD_ADMIN_TOKEN:'x',AUTO_APPROVE_ENABLED:'false',AUTO_RUN_ENABLED:'false',SHELL_EXECUTOR_ENABLED:'false'}});
a(finalize.ok === true,'finalizeProductionReleasePlan ok with safe env');

const block = ProdManager.blockReleaseIfP0Exists(r.id, {env:{AUTO_APPROVE_ENABLED:'true'}});
a(block.blocked === true,'blockReleaseIfP0Exists blocks on auto-approve');

const summary = ProdManager.buildProductionReleaseSummary(r.id);
a(summary.ok === true,'buildProductionReleaseSummary ok');
a(summary.release.version === 'v1.0.0','summary has version');

ProdStore.resetStore();
console.log('\nResult: '+p+' PASS, '+f+' FAIL\n');
process.exit(f>0?1:0);
