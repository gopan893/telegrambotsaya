'use strict';

const dr = require('../src/disaster-recovery');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL:', msg); } }

async function run() {
  // Create action plan
  const action = dr.drProposalBridge.createDisasterRecoveryActionPlan({
    scope: 'postgres_recovery',
    title: 'Postgres Recovery Action',
    steps: ['Step 1', 'Step 2'],
    sourceDrillId: 'drill_001'
  }, {});
  assert(action.ok, 'createDisasterRecoveryActionPlan returns ok');
  assert(action.actionPlan.scope === 'postgres_recovery', 'action plan scope correct');
  assert(action.actionPlan.status === 'draft', 'action plan status is draft');
  assert(action.actionPlan.steps.length === 2, 'action plan has 2 steps');

  // Create action plan with null
  const badAction = dr.drProposalBridge.createDisasterRecoveryActionPlan(null, {});
  assert(!badAction.ok, 'createDisasterRecoveryActionPlan rejects null');

  // Create executor proposal
  const proposal = dr.drProposalBridge.createDisasterRecoveryExecutorProposal(action.actionPlan, {});
  assert(proposal.ok, 'createDisasterRecoveryExecutorProposal returns ok');
  assert(proposal.proposal.sourceType === 'disaster_recovery_action', 'executor proposal source type');
  assert(proposal.proposal.status === 'draft', 'executor proposal status is draft');
  assert(proposal.proposal.requiresApproval, 'executor proposal requires approval');
  assert(proposal.proposal.requiresEvaluation, 'executor proposal requires evaluation');
  assert(proposal.proposal.note.includes('not executed'), 'executor proposal note says not executed');

  // Create executor proposal with null
  const badProposal = dr.drProposalBridge.createDisasterRecoveryExecutorProposal(null, {});
  assert(!badProposal.ok, 'createDisasterRecoveryExecutorProposal rejects null');

  // Create restore proposal
  const restoreProposal = dr.drProposalBridge.createRestoreProposal('rehearsal_001', {});
  assert(restoreProposal.ok, 'createRestoreProposal returns ok');
  assert(restoreProposal.proposal.sourceType === 'restore_rehearsal', 'restore proposal source type');
  assert(restoreProposal.proposal.sourceId === 'rehearsal_001', 'restore proposal source id');
  assert(restoreProposal.proposal.note.includes('Restore proposal does NOT execute'), 'restore proposal note says not executed');

  // Create restore proposal with null
  const badRestore = dr.drProposalBridge.createRestoreProposal(null, {});
  assert(!badRestore.ok, 'createRestoreProposal rejects null');

  // Create encryption proposal
  const encProposal = dr.drProposalBridge.createBackupEncryptionProposal('plan_001', {});
  assert(encProposal.ok, 'createBackupEncryptionProposal returns ok');
  assert(encProposal.proposal.sourceType === 'backup_encryption_plan', 'encryption proposal source type');
  assert(encProposal.proposal.sourceId === 'plan_001', 'encryption proposal source id');
  assert(encProposal.proposal.note.includes('does NOT execute'), 'encryption proposal note says not executed');

  // Create encryption proposal with null
  const badEnc = dr.drProposalBridge.createBackupEncryptionProposal(null, {});
  assert(!badEnc.ok, 'createBackupEncryptionProposal rejects null');

  // Link proposal
  const link = dr.drProposalBridge.linkDrProposal('drill_001', 'proposal_001', {});
  assert(link.ok, 'linkDrProposal returns ok');
  assert(link.linked, 'linkDrProposal sets linked = true');
  assert(link.status === 'linked', 'link status is linked');

  // Link with null
  const badLink = dr.drProposalBridge.linkDrProposal(null, null, {});
  assert(!badLink.ok, 'linkDrProposal rejects null');

  console.log('Result: ' + pass + ' PASS, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });
