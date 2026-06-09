'use strict';

const docsIntel = require('../src/docs-intel');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error(`FAIL: ${msg}`); } }

async function run() {
  const svc = { fs: require('fs') };

  // Scan
  const inventory = await docsIntel.docsInventoryScanner.scanProjectDocs(svc);
  const report = await docsIntel.docsInventoryScanner.buildDocsInventoryReport(inventory, svc);

  // Gaps
  const gaps = await docsIntel.docsGapDetector.generateDocsGapReport(svc);

  // Freshness
  const freshness = await docsIntel.docsFreshnessReviewer.reviewDocsFreshness(svc);

  // Commands
  const cmds = await docsIntel.commandDocsChecker.checkCommandDocsCoverage(svc);

  // Combined report
  const intelReport = await docsIntel.docsReportGenerator.generateDocsIntelReport(report, gaps, freshness, cmds, svc);
  assert(intelReport.summary, 'generateDocsIntelReport has summary');
  assert(intelReport.inventory, 'report has inventory');
  assert(intelReport.gaps, 'report has gaps');
  assert(intelReport.freshness, 'report has freshness');
  assert(intelReport.commandCoverage, 'report has commandCoverage');

  console.log(`Result: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });
