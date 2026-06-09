'use strict';

const docsIntel = require('../src/docs-intel');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error(`FAIL: ${msg}`); } }

async function run() {
  const svc = { fs: require('fs') };

  // Scan
  const inventory = await docsIntel.docsInventoryScanner.scanProjectDocs(svc);
  assert(inventory.length >= 5, 'scanProjectDocs returns at least 5 docs');
  const exists = inventory.filter(d => d.exists);
  assert(exists.length > 0, 'some docs exist');

  // Missing
  const missing = await docsIntel.docsInventoryScanner.detectMissingDocs(svc);
  assert(Array.isArray(missing), 'detectMissingDocs returns array');

  // Empty
  const empty = await docsIntel.docsInventoryScanner.detectEmptyDocs(svc);
  assert(Array.isArray(empty), 'detectEmptyDocs returns array');

  // Report
  const report = await docsIntel.docsInventoryScanner.buildDocsInventoryReport(inventory, svc);
  assert(report.total === inventory.length, 'buildDocsInventoryReport correct total');
  assert(report.summary, 'buildDocsInventoryReport has summary');

  // Gaps
  const gaps = await docsIntel.docsGapDetector.detectDocsGaps(svc);
  assert(Array.isArray(gaps), 'detectDocsGaps returns array');

  const gapReport = await docsIntel.docsGapDetector.generateDocsGapReport(svc);
  assert(gapReport.totalGaps >= 0, 'generateDocsGapReport has totalGaps');

  // Freshness
  const freshness = await docsIntel.docsFreshnessReviewer.reviewDocsFreshness(svc);
  assert(Array.isArray(freshness), 'reviewDocsFreshness returns array');

  // Command coverage
  const cmds = await docsIntel.commandDocsChecker.checkCommandDocsCoverage(svc);
  assert(cmds.total > 0, 'checkCommandDocsCoverage has total');

  // Architecture
  const arch = await docsIntel.architectureDocsChecker.checkArchitectureDocs(svc);
  assert(arch.total >= 0, 'checkArchitectureDocs has total');

  // Update plan
  const plan = await docsIntel.docsUpdatePlanGenerator.createDocsUpdatePlan(gapReport, svc);
  assert(plan.id, 'createDocsUpdatePlan has id');

  const prompt = await docsIntel.docsUpdatePlanGenerator.createDocsUpdatePrompt(plan, svc);
  assert(prompt.prompt, 'createDocsUpdatePrompt has prompt');

  const proposal = await docsIntel.docsUpdatePlanGenerator.createDocsUpdateProposal(plan, svc);
  assert(proposal.status === 'pending_approval', 'createDocsUpdateProposal pending_approval');

  // Report
  const intelReport = await docsIntel.docsReportGenerator.generateDocsIntelReport(report, gapReport, freshness, cmds, svc);
  assert(intelReport.summary, 'generateDocsIntelReport has summary');

  console.log(`Result: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });
