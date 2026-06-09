'use strict';

const Checker = require('../src/release/release-verification-checker');

let p=0, f=0;
function a(c,l){if(c){p++;console.log('  PASS: '+l)}else{f++;console.log('  FAIL: '+l)}}

console.log('\n=== Release Verification Checker Tests ===\n');

const boot = Checker.verifyProductionBoot({});
a(boot && typeof boot.allPass === 'boolean','verifyProductionBoot returns boolean');
a(boot.findings.length === 1,'boot has 1 finding');

const dash = Checker.verifyDashboardAfterRelease({});
a(dash.allPass === true,'dashboard verification pass');
a(dash.findings[0].pass === true,'tabs registered check');

const tg = Checker.verifyTelegramAfterRelease({});
a(tg.allPass === true,'telegram verification pass');

const wh = Checker.verifyWebhookHealth({env:{WEBHOOK_URL:'x',PORT:'3000'}});
a(wh.allPass === true,'webhook verification pass with env');

const storage = Checker.verifyStorageHealth({env:{STORAGE_DRIVER:'postgres',DATABASE_URL:'x'}});
a(storage.allPass === true,'storage verification pass with env');

const api = Checker.verifyCriticalApiHealth({});
a(api.allPass === true,'api verification pass');

const secrets = Checker.verifyNoSecretLeakInReleaseOutputs({});
a(secrets.allPass === true,'no secret leak verification pass');

const report = Checker.buildReleaseVerificationReport({boot, dashboard:dash, telegram:tg, webhook:wh, storage, api, secrets});
a(report.allPass === true,'verification report allPass');
a(Object.keys(report.checks).length === 7,'7 check categories');

console.log('\nResult: '+p+' PASS, '+f+' FAIL\n');
process.exit(f>0?1:0);
