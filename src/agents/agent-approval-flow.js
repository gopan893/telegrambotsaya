'use strict';

const proposalBuilder = require('./proposal-builder');

function isAgentActor(actorId = '') {
  return /^agent[:_-]/i.test(String(actorId || '')) || ['orchestrator', 'planner', 'coder', 'critic', 'security', 'executor'].includes(String(actorId || '').toLowerCase());
}

function validateHumanApprovalActor(actorId = '') {
  if (!actorId || isAgentActor(actorId)) return { ok: false, reason: 'HUMAN_APPROVER_REQUIRED' };
  return { ok: true, actorId: String(actorId) };
}

function formatProposalCreatedReply(result = {}) {
  if (!result.ok) return `Belum bisa membuat proposal: ${result.reason || result.error || 'PREFLIGHT_BLOCKED'}`;
  return proposalBuilder.summarizeProposalForTelegram(result.proposal, result.actionPlan);
}

function formatApprovalStatus(proposal = {}) {
  return [
    `Proposal: ${proposal.id}`,
    `Status: ${proposal.status}`,
    `Risk: ${proposal.riskLevel}`,
    proposal.status === 'approved' ? `Run: /runexec ${proposal.id}` : '',
    proposal.status === 'pending_approval' ? `Approve: /approve ${proposal.id}` : ''
  ].filter(Boolean).join('\n');
}

module.exports = {
  formatApprovalStatus,
  formatProposalCreatedReply,
  isAgentActor,
  validateHumanApprovalActor
};
