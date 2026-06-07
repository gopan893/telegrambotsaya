'use strict';

const assert = require('assert');
const updater = require('../src/research/documentation-update-planner');

(async () => {
  const services = { __researchStore: {}, actorId: 'u1', workspaceId: 'default' };
  const plan = await updater.createDocumentationUpdatePlan({ topic: 'Phase 42 docs', docType: 'phase summary', body: 'Safe docs draft only.' }, services);
  assert(plan.ok, 'update plan created');
  assert.strictEqual(plan.updatePlan.requiresEvaluation, true);
  const proposal = await updater.createDocsUpdateProposal(plan.updatePlan, services);
  assert(proposal.ok, 'docs proposal metadata created');
  assert.strictEqual(proposal.proposal.directFileWrite, false);
  assert(proposal.proposal.nextPrompt.includes('Do not expose secrets'), 'safe prompt generated');
  console.log('test-documentation-update-planner: ok');
})();

