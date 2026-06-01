'use strict';

const auditLog = require('../dashboard/audit-log');
const guards = require('./executor-guards');
const store = require('./execution-store');
const utils = require('./executor-utils');

async function audit(action, proposal = {}, services = {}, extra = {}) {
  try {
    await auditLog.recordAuditLog({
      actorType: extra.actorType || 'executor',
      actorId: extra.actorId || proposal.userId,
      action,
      targetType: 'execution_proposal',
      targetId: proposal.id,
      userId: proposal.userId,
      workspaceId: proposal.workspaceId,
      actorRole: extra.actorRole || '',
      permission: extra.permission || 'approve',
      decision: extra.decision || 'allowed',
      status: extra.status || 'ok',
      beforeSummary: extra.beforeSummary || '',
      afterSummary: {
        proposalId: proposal.id,
        riskLevel: proposal.riskLevel,
        status: proposal.status
      },
      reason: extra.reason || ''
    }, services);
  } catch (_) {}
}

async function getProposal(proposalId, services = {}) {
  return store.getExecutionItem(store.EXECUTOR_PROPOSALS_KEY, proposalId, services);
}

async function submitForApproval(proposal, services = {}) {
  if (!proposal?.id) return { ok: false, reason: 'PROPOSAL_REQUIRED', status: 400 };
  const updated = await store.updateExecutionItem(store.EXECUTOR_PROPOSALS_KEY, proposal.id, {
    status: 'pending_approval',
    requiresApproval: true
  }, services);
  await audit('executor/approval_requested', updated || proposal, services, { actorId: services.actorId || proposal.userId });
  return { ok: true, proposal: updated || proposal };
}

async function listPendingApprovals(options = {}, services = {}) {
  await require('./execution-planner').expireOldProposals(services);
  const userId = String(options.userId || options.actorId || '').trim();
  const workspaceId = await utils.resolveWorkspaceId(userId, options.workspaceId, services);
  const access = await guards.enforceExecutionPermission({
    actorId: options.actorId || userId,
    userId,
    workspaceId,
    permission: 'read',
    riskLevel: 'low',
    action: 'executor/pending'
  }, services);
  if (!access.ok) return [];
  return store.listExecutionItems(store.EXECUTOR_PROPOSALS_KEY, {
    userId: access.userId,
    workspaceId: access.workspaceId,
    status: 'pending_approval',
    limit: options.limit || 50
  }, services);
}

async function approveExecution(proposalId, approverId, services = {}) {
  const proposal = await getProposal(proposalId, services);
  if (!proposal) return { ok: false, reason: 'PROPOSAL_NOT_FOUND', status: 404 };
  if (utils.isExpired(proposal)) {
    const expired = await store.updateExecutionItem(store.EXECUTOR_PROPOSALS_KEY, proposalId, { status: 'expired' }, services);
    return { ok: false, reason: 'PROPOSAL_EXPIRED', status: 400, proposal: expired };
  }
  if (proposal.status !== 'pending_approval') return { ok: false, reason: `INVALID_STATUS_${proposal.status}`, status: 400 };
  const access = await guards.enforceExecutionPermission({
    actorId: approverId,
    userId: proposal.userId,
    workspaceId: proposal.workspaceId,
    permission: 'approve',
    riskLevel: proposal.riskLevel,
    action: 'executor/approve',
    targetId: proposal.id
  }, services);
  if (!access.ok) return { ok: false, reason: access.error, status: 403 };
  const actions = (proposal.proposedActions || []).map(action => ({ ...action, status: 'approved' }));
  const updated = await store.updateExecutionItem(store.EXECUTOR_PROPOSALS_KEY, proposalId, {
    status: 'approved',
    approvedBy: String(approverId || ''),
    approvedAt: utils.nowIso(),
    proposedActions: actions
  }, services);
  await audit('executor/approved', updated, services, { ...access, actorId: approverId });
  return { ok: true, proposal: updated };
}

async function rejectExecution(proposalId, approverId, reason = '', services = {}) {
  const proposal = await getProposal(proposalId, services);
  if (!proposal) return { ok: false, reason: 'PROPOSAL_NOT_FOUND', status: 404 };
  if (!['pending_approval', 'approved', 'draft'].includes(proposal.status)) return { ok: false, reason: `INVALID_STATUS_${proposal.status}`, status: 400 };
  const access = await guards.enforceExecutionPermission({
    actorId: approverId,
    userId: proposal.userId,
    workspaceId: proposal.workspaceId,
    permission: 'approve',
    riskLevel: proposal.riskLevel,
    action: 'executor/reject',
    targetId: proposal.id
  }, services);
  if (!access.ok) return { ok: false, reason: access.error, status: 403 };
  const updated = await store.updateExecutionItem(store.EXECUTOR_PROPOSALS_KEY, proposalId, {
    status: 'rejected',
    rejectedBy: String(approverId || ''),
    rejectedAt: utils.nowIso(),
    errorSummary: utils.compactText(reason || 'Rejected by human approver.', 300)
  }, services);
  await audit('executor/rejected', updated, services, { ...access, actorId: approverId, reason });
  return { ok: true, proposal: updated };
}

async function cancelExecution(proposalId, actorId, services = {}) {
  const proposal = await getProposal(proposalId, services);
  if (!proposal) return { ok: false, reason: 'PROPOSAL_NOT_FOUND', status: 404 };
  if (['completed', 'failed', 'cancelled'].includes(proposal.status)) return { ok: false, reason: `INVALID_STATUS_${proposal.status}`, status: 400 };
  const access = await guards.enforceExecutionPermission({
    actorId,
    userId: proposal.userId,
    workspaceId: proposal.workspaceId,
    permission: 'approve',
    riskLevel: proposal.riskLevel,
    action: 'executor/cancel',
    targetId: proposal.id
  }, services);
  if (!access.ok) return { ok: false, reason: access.error, status: 403 };
  const updated = await store.updateExecutionItem(store.EXECUTOR_PROPOSALS_KEY, proposalId, {
    status: 'cancelled',
    errorSummary: 'Cancelled by human actor.'
  }, services);
  await audit('executor/cancelled', updated, services, { ...access, actorId });
  return { ok: true, proposal: updated };
}

async function getApprovalStatus(proposalId, services = {}) {
  const proposal = await getProposal(proposalId, services);
  if (!proposal) return { ok: false, reason: 'PROPOSAL_NOT_FOUND', status: 404 };
  if (utils.isExpired(proposal) && ['pending_approval', 'draft'].includes(proposal.status)) {
    const expired = await store.updateExecutionItem(store.EXECUTOR_PROPOSALS_KEY, proposalId, { status: 'expired' }, services);
    return { ok: true, proposal: expired, status: 'expired' };
  }
  return { ok: true, proposal, status: proposal.status };
}

module.exports = {
  approveExecution,
  cancelExecution,
  getApprovalStatus,
  listPendingApprovals,
  rejectExecution,
  submitForApproval
};
