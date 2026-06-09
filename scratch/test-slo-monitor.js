'use strict';

const SloRegistry = require('../src/reliability/slo-registry');
const SloMonitor = require('../src/reliability/slo-monitor');

let p=0, f=0;
function a(c,l){if(c){p++;console.log('  PASS: '+l)}else{f++;console.log('  FAIL: '+l)}}

SloRegistry.resetStore();
SloRegistry.initializeDefaultSlos();
console.log('\n=== SLO Monitor Tests ===\n');

const status = SloMonitor.evaluateSloStatus({});
a(status.total === 12,'12 SLOs evaluated');
a(['healthy','warning','violated'].includes(status.overall),'overall status valid');
a(status.results.length === 12,'12 results');

const sloList = SloRegistry.listSlos();
const evalResult = SloMonitor.evaluateSloById(sloList[0].id, {});
a(evalResult && evalResult.status,'evaluateSloById returns status');
a(evalResult.name === sloList[0].name,'evaluateSloById matches name');

const burn = SloMonitor.calculateSloBurnRate(sloList[0].id, {});
a(burn && typeof burn.burnRate === 'number','burnRate is number');

const violation = SloMonitor.detectSloViolation({});
a(typeof violation.hasViolation === 'boolean','detectSloViolation returns boolean');

const report = SloMonitor.buildSloReport({});
a(report.total === 12,'report total 12');
a(typeof report.healthPercent === 'number','report healthPercent');

console.log('\nResult: '+p+' PASS, '+f+' FAIL\n');
process.exit(f>0?1:0);
