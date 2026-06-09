'use strict';

const HealthWindow = require('../src/reliability/release-health-window');

let p=0, f=0;
function a(c,l){if(c){p++;console.log('  PASS: '+l)}else{f++;console.log('  FAIL: '+l)}}

console.log('\n=== Release Health Window Tests ===\n');

const opened = HealthWindow.openReleaseHealthWindow('rel_test', 30, {});
a(opened && opened.releaseId === 'rel_test','health window opened');
a(opened.status === 'open','status open');
a(opened.durationMinutes === 30,'duration 30 minutes');

const sample = HealthWindow.recordHealthSample('rel_test', {uptime:99.8,latency:100,errors:0});
a(sample.ok === true,'health sample recorded');
a(sample.sample.uptime === 99.8,'uptime preserved');

const summary = HealthWindow.summarizeHealthWindow('rel_test', {});
a(summary && summary.status === 'healthy','summary healthy');
a(summary.avgUptime > 0,'avg uptime > 0');

const closed = HealthWindow.closeReleaseHealthWindow('rel_test', {});
a(closed.ok === true,'health window closed');
a(closed.window.status === 'closed','status closed');

const noData = HealthWindow.summarizeHealthWindow('nonexistent', {});
a(noData.status === 'no_data','no data for nonexistent');

console.log('\nResult: '+p+' PASS, '+f+' FAIL\n');
process.exit(f>0?1:0);
