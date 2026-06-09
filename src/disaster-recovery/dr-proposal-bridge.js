'use strict';

const utils = require('./dr-utils');

function createDisasterRecoveryActionPlan(input, services) {
  if (!input || !input.scope) return { ok: false, error: 'INPUT_REQUIRED' };

  const actionPlan = {
    id: utils.createId('action_plan'),
    scope: input.scope,
    title: input.title || `Action Plan: ${input.scope}`,
    steps: Array.isArray(input.steps) ? input.steps : [],
    sourceDrillId: input.sourceDrillId || '',
    status: 'draft',
    requiresApproval: true,
    createdAt: utils.nowIso(),
    updatedAt: utils.nowIso()
  };

  return { ok: true, actionPlan };
}

function createDisasterRecoveryExecutorProposal(actionPlan, services) {
  if (!actionPlan || !actionPlan.id) return { ok: false, error: 'ACTION_PLAN_REQUIRED' };

  const proposal = {
    id: utils.createId('executor_proposal'),
    sourceType: 'disaster_recovery_action',
    sourceId: actionPlan.id,
    scope: actionPlan.scope,
    title: actionPlan.title,
    status: 'draft',
    steps: actionPlan.steps,
    requiresApproval: true,
    requiresEvaluation: true,
    createdAt: utils.nowIso(),
    note: 'Proposal created - not executed. Requires Evaluation v2 + executor approval before running.'
  };

  return { ok: true, proposal };
}

function createRestoreProposal(rehearsalId, services) {
  if (!rehearsalId) return { ok: false, error: 'REHEARSAL_ID_REQUIRED' };

  const proposal = {
    id: utils.createId('restore_proposal'),
    sourceType: 'restore_rehearsal',
    sourceId: rehearsalId,
    status: 'draft',
    requiresApproval: true,
    requiresEvaluation: true,
    summary: `Restore proposal based on rehearsal ${rehearsalId}`,
    createdAt: utils.nowIso(),
    note: 'Restore proposal does NOT execute. Requires Evaluation v2 + executor approval. Restore/write requires explicit approval.'
  };

  return { ok: true, proposal };
}

function createBackupEncryptionProposal(planId, services) {
  if (!planId) return { ok: false, error: 'PLAN_ID_REQUIRED' };

  const proposal = {
    id: utils.createId('encryption_proposal'),
    sourceType: 'backup_encryption_plan',
    sourceId: planId,
    status: 'draft',
    requiresApproval: true,
    requiresEvaluation: true,
    summary: `Backup encryption proposal based on plan ${planId}`,
    createdAt: utils.nowIso(),
    note: 'Encryption proposal does NOT execute. Requires Evaluation v2 + executor approval. Encryption/write requires explicit approval.'
  };

  return { ok: true, proposal };
}

function linkDrProposal(sourceId, proposalId, services) {
  if (!sourceId || !proposalId) return { ok: false, error: 'SOURCE_AND_PROPOSAL_IDS_REQUIRED' };

  return {
    ok: true,
    sourceId,
    proposalId,
    linked: true,
    note: 'Proposal linked to source. Proposal does not execute. Rejected or stale proposals cannot run.',
    status: 'linked',
    createdAt: utils.nowIso()
  };
}

module.exports = {
  createDisasterRecoveryActionPlan,
  createDisasterRecoveryExecutorProposal,
  createRestoreProposal,
  createBackupEncryptionProposal,
  linkDrProposal
};
