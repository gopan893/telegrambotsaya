'use strict';

const Watchdog = require('../src/reliability/regression-watchdog');

let p=0, f=0;
function a(c,l){if(c){p++;console.log('  PASS: '+l)}else{f++;console.log('  FAIL: '+l)}}

console.log('\n=== Regression Watchdog Tests ===\n');

const dash = Watchdog.watchDashboardRegression({});
a(dash.allPass === true,'dashboard regression all pass');
a(dash.findings.length >= 4,'4+ dashboard checks');

const tg = Watchdog.watchTelegramRegression({});
a(tg.allPass === true,'telegram regression all pass');
a(tg.findings.length >= 5,'5+ telegram checks');

const approval = Watchdog.watchApprovalBoundaryRegression({});
a(approval.allPass === true,'approval boundary all pass');
a(approval.findings.length >= 9,'9+ approval checks');

const sec = Watchdog.watchSecurityPrivacyRegression({});
a(sec.allPass === true,'security/privacy regression all pass');

const deploy = Watchdog.watchDeployRegression({});
a(deploy.allPass === true,'deploy regression all pass');

const incident = Watchdog.createRegressionIncidentIfNeeded({allPass:false, module:'test'}, {});
a(incident.created === true,'incident created for failure');
a(incident.regression.id.includes('reg'),'regression has id');

const noIncident = Watchdog.createRegressionIncidentIfNeeded({allPass:true}, {});
a(noIncident.created === false,'no incident for pass');

console.log('\nResult: '+p+' PASS, '+f+' FAIL\n');
process.exit(f>0?1:0);
