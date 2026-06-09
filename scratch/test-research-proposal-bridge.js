'use strict';

const research = require('../src/research');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error(`FAIL: ${msg}`); } }

async function run() {
  const svc = { workspaceId: 'test', userId: 'tester' };

  // create task for proposal
  const task = await research.researchTaskManager.createResearchTask({ title: 'Test proposal', query: 'test' }, svc);

  // action plan
  const plan = await research.researchProposalBridge.createResearchActionPlan(task.id, svc);
  assert(plan && plan.taskId === task.id, 'createResearchActionPlan returns plan');
  assert(plan.actions.length > 0, 'action plan has actions');

  // executor proposal
  const proposal = await research.researchProposalBridge.createResearchExecutorProposal(plan, svc);
  assert(proposal && proposal.status === 'pending_approval', 'executor proposal pending_approval');

  // link
  const linked = await research.researchProposalBridge.linkResearchTaskToProposal(task.id, proposal.id, svc);
  assert(linked && linked.proposalIds.includes(proposal.id), 'linkResearchTaskToProposal links proposal');

  // null handling
  const nullPlan = await research.researchProposalBridge.createResearchActionPlan('nonexistent', svc);
  assert(nullPlan === null, 'createResearchActionPlan returns null for nonexistent task');

  console.log(`Result: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });
