'use strict';

const Monitor = require('../src/reliability/post-release-monitor');

let p=0, f=0;
function a(c,l){if(c){p++;console.log('  PASS: '+l)}else{f++;console.log('  FAIL: '+l)}}

console.log('\n=== Post-Release Monitor Tests ===\n');

const started = Monitor.startPostReleaseMonitoring('rel_test',{});
a(started && started.releaseId === 'rel_test','monitoring started');
a(started.status === 'monitoring','status monitoring');

const check = Monitor.runPostReleaseHealthCheck('rel_test',{});
a(check.ok === true,'health check ok');
a(check.sample && check.sample.uptime,'health sample has uptime');

const completed = Monitor.completePostReleaseMonitoring('rel_test',{});
a(completed.ok === true,'monitoring completed');
a(completed.window.status === 'completed','status completed');

const regression = Monitor.detectPostReleaseRegression('rel_test',{});
a(typeof regression.detected === 'boolean','regression detection returns boolean');

const started2 = Monitor.startPostReleaseMonitoring('rel_test2',{});
Monitor.runPostReleaseHealthCheck('rel_test2',{});
const report = Monitor.buildPostReleaseMonitoringReport('rel_test2',{});
a(report && report.monitoringId,'build report ok');
a(report.status === 'monitoring','report status monitoring');
a(report.samplesCollected >= 1,'samples collected >= 1');

console.log('\nResult: '+p+' PASS, '+f+' FAIL\n');
process.exit(f>0?1:0);
