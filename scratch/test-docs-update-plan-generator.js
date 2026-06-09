'use strict';

const docsIntel = require('../src/docs-intel');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error(`FAIL: ${msg}`); } }

async function run() {
  const svc = { fs: require('fs') };

  // Create plan from gap report
  const gaps = await docsIntel.docsGapDetector.detectDocsGaps(svc);
  const gapReport = await docsIntel.docsGapDetector.generateDocsGapReport(svc);
  const plan = await docsIntel.docsUpdatePlanGenerator.createDocsUpdatePlan(gapReport, svc);
  assert(plan.id, 'createDocsUpdatePlan has id');
  assert(plan.totalGaps >= 0, 'plan has totalGaps');
  assert(plan.items.length >= 0, 'plan has items');

  // Prompt
  const prompt = await docsIntel.docsUpdatePlanGenerator.createDocsUpdatePrompt(plan, svc);
  assert(prompt.prompt.includes(plan.id), 'prompt contains plan id');

  // Proposal
  const proposal = await docsIntel.docsUpdatePlanGenerator.createDocsUpdateProposal(plan, svc);
  assert(proposal.status === 'pending_approval', 'proposal is pending_approval');
  assert(proposal.planId === plan.id, 'proposal links to plan');

  console.log(`Result: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });
