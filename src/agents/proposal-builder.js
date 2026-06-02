'use strict';

const utils = require('./delegation-utils');

function toExecutorAction(action = {}) {
  return utils.sanitizeDelegationPayload({
    type: action.type,
    targetType: action.targetType,
    targetId: action.targetId,
    description: action.description,
    payload: action.payload || {},
    riskLevel: action.riskLevel || 'medium',
    requiresApproval: true
  });
}

function buildProposalPayload(actionPlan = {}, preflight = {}, options = {}) {
  const risk = preflight.riskLevel || actionPlan.riskLevel || 'medium';
  return utils.sanitizeDelegationPayload({
    actorId: options.actorId || actionPlan.userId,
    userId: actionPlan.userId,
    workspaceId: actionPlan.workspaceId,
    sourceType: 'agent_action_plan',
    sourceId: actionPlan.id,
    title: actionPlan.title || 'Agent execution proposal',
    description: buildProposalDescription(actionPlan, preflight),
    riskLevel: risk,
    proposedActions: (actionPlan.actions || []).map(toExecutorAction)
  });
}

function buildProposalDescription(actionPlan = {}, preflight = {}) {
  const lines = [
    actionPlan.description || actionPlan.title || 'Agent-generated action plan.',
    `Source: ${actionPlan.source}${actionPlan.sourceId ? `/${actionPlan.sourceId}` : ''}`,
    `Risk: ${preflight.riskLevel || actionPlan.riskLevel || 'medium'}`,
    `Approval required: ${preflight.approvalRequired !== false ? 'yes' : 'no'}`,
    preflight.securityReviewRequired ? 'Security review required before risky execution.' : '',
    preflight.ownerAdminRequired ? 'Owner/admin required for this risk level.' : '',
    'Rollback: automatic rollback is not supported; use controlled manual recovery if needed.'
  ];
  return utils.sanitizeDelegationText(lines.filter(Boolean).join('\n'), { max: 1200 });
}

function summarizeProposalForTelegram(proposal = {}, actionPlan = {}) {
  return [
    `Saya buat proposal: ${proposal.title || actionPlan.title || 'Agent action proposal'}.`,
    `Status: ${proposal.status || 'pending_approval'}.`,
    `Risk: ${proposal.riskLevel || actionPlan.riskLevel || 'medium'}.`,
    'Belum dijalankan.',
    `Approve: /approve ${proposal.id}`,
    `Run setelah approve: /runexec ${proposal.id}`
  ].join('\n');
}

function buildSourceSummary(source = {}) {
  return utils.sanitizeDelegationPayload({
    sourceType: source.sourceType || source.source || '',
    sourceId: source.sourceId || source.id || '',
    title: source.title || source.goal || source.question || '',
    status: source.status || '',
    riskLevel: source.riskLevel || ''
  });
}

module.exports = {
  buildProposalDescription,
  buildProposalPayload,
  buildSourceSummary,
  summarizeProposalForTelegram,
  toExecutorAction
};
