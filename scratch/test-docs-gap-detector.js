'use strict';

const docsIntel = require('../src/docs-intel');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error(`FAIL: ${msg}`); } }

async function run() {
  const svc = { fs: require('fs') };

  // Gap detection
  const gaps = await docsIntel.docsGapDetector.detectDocsGaps(svc);
  assert(Array.isArray(gaps), 'detectDocsGaps returns array');

  // Gap report
  const report = await docsIntel.docsGapDetector.generateDocsGapReport(svc);
  assert(typeof report.totalGaps === 'number', 'generateDocsGapReport totalGaps number');
  assert(report.high >= 0, 'has high count');
  assert(report.medium >= 0, 'has medium count');
  assert(report.summary, 'has summary');

  // Command docs gaps
  const cmdGaps = await docsIntel.docsGapDetector.detectCommandDocsGaps(svc);
  assert(Array.isArray(cmdGaps), 'detectCommandDocsGaps returns array');

  // Dashboard docs gaps
  const dashGaps = await docsIntel.docsGapDetector.detectDashboardDocsGaps(svc);
  assert(Array.isArray(dashGaps), 'detectDashboardDocsGaps returns array');

  console.log(`Result: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });
