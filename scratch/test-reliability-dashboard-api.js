'use strict';

const SloRegistry = require('../src/reliability/slo-registry');
const SloMonitor = require('../src/reliability/slo-monitor');
const Scorecard = require('../src/reliability/reliability-scorecard');
const Monitor = require('../src/reliability/post-release-monitor');
const HealthWindow = require('../src/reliability/release-health-window');
const Watchdog = require('../src/reliability/regression-watchdog');
const ReportGen = require('../src/reliability/reliability-report-generator');

let p=0, f=0;
function a(c,l){if(c){p++;console.log('  PASS: '+l)}else{f++;console.log('  FAIL: '+l)}}

SloRegistry.resetStore();
console.log('\n=== Reliability Dashboard API Tests ===\n');

SloRegistry.initializeDefaultSlos();
const slos = SloRegistry.listSlos();
a(slos.length === 12,'GET /reliability/slos returns 12');

const status = SloMonitor.evaluateSloStatus({});
a(status.total === 12,'POST /reliability/slos/evaluate');

const sc = Scorecard.calculateReliabilityScorecard({});
a(sc.overall >= 95,'GET /reliability/scorecard');

const hw = HealthWindow.openReleaseHealthWindow('rel_test', 30, {});
a(hw.status === 'open','POST /reliability/post-release/:id/start');

const sample = HealthWindow.recordHealthSample('rel_test', {uptime:99.9});
a(sample.ok === true,'POST /reliability/post-release/:id/check');

Monitor.startPostReleaseMonitoring('rel_test', {});
const report = Monitor.buildPostReleaseMonitoringReport('rel_test', {});
a(report.status === 'monitoring','GET /reliability/post-release/:id/report');

const dashWatch = Watchdog.watchDashboardRegression({});
a(dashWatch.allPass === true,'GET /reliability/regressions');

const relReport = ReportGen.generateReliabilityReport(status, sc, [hw], [], {});
a(relReport.reportType === 'reliability_report','reliability report generated');

SloRegistry.resetStore();
console.log('\nResult: '+p+' PASS, '+f+' FAIL\n');
process.exit(f>0?1:0);
