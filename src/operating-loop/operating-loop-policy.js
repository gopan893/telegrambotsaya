'use strict';

const BLOCKED_ACTIONS = [
  'write',
  'external',
  'danger',
  'shell',
  'git_push',
  'deploy',
  'rollback',
  'email_send',
  'calendar_write',
  'webhook_post'
];

const READ_ONLY_TYPES = ['read_report'];
const DRY_RUN_TYPES = ['read_report', 'create_plan'];

async function evaluateLoopPolicy(loop, action, services = {}) {
  if (!action) {
    return buildPolicyDecision(loop, null);
  }
  return buildPolicyDecision(loop, action);
}

function isReadOnlyAction(action) {
  return action && action.type === 'read_report';
}

function isDryRunAction(action) {
  return action && DRY_RUN_TYPES.includes(action.type);
}

function isProposalOnlyAction(action) {
  return !isReadOnlyAction(action) && !isDryRunAction(action);
}

function isBlockedAction(action) {
  if (!action) return false;
  const type = String(action.type || '').toLowerCase();
  return BLOCKED_ACTIONS.includes(type);
}

function requiresUserApproval(action) {
  if (!action) return false;
  if (action.requiresApproval) return true;
  if (isProposalOnlyAction(action)) return true;
  const type = String(action.type || '').toLowerCase();
  if (type.startsWith('create_')) return true;
  return false;
}

function buildPolicyDecision(loop, action) {
  if (!action) {
    return {
      allowed: false,
      blocked: true,
      reason: 'No action provided',
      requiresApproval: false,
      requiresEvaluationGate: false,
      mode: 'blocked'
    };
  }

  if (isBlockedAction(action)) {
    return {
      allowed: false,
      blocked: true,
      reason: `Action type "${action.type}" is in the blocked actions list`,
      requiresApproval: false,
      requiresEvaluationGate: false,
      mode: 'blocked'
    };
  }

  if (isReadOnlyAction(action)) {
    return {
      allowed: true,
      blocked: false,
      reason: 'Read-only action permitted',
      requiresApproval: false,
      requiresEvaluationGate: false,
      mode: 'read_only'
    };
  }

  if (isDryRunAction(action)) {
    return {
      allowed: true,
      blocked: false,
      reason: 'Dry-run action permitted',
      requiresApproval: requiresUserApproval(action),
      requiresEvaluationGate: false,
      mode: 'dry_run'
    };
  }

  if (isProposalOnlyAction(action)) {
    const needsEval = action.requiresEvaluation || String(action.type || '').includes('repair') || String(action.type || '').includes('deploy');

    return {
      allowed: true,
      blocked: false,
      reason: 'Proposal-only action — requires proposal flow',
      requiresApproval: true,
      requiresEvaluationGate: needsEval,
      mode: 'proposal_only'
    };
  }

  return {
    allowed: true,
    blocked: false,
    reason: 'Action permitted by policy',
    requiresApproval: requiresUserApproval(action),
    requiresEvaluationGate: false,
    mode: 'read_only'
  };
}

module.exports = {
  BLOCKED_ACTIONS,
  evaluateLoopPolicy,
  isReadOnlyAction,
  isDryRunAction,
  isProposalOnlyAction,
  isBlockedAction,
  requiresUserApproval,
  buildPolicyDecision
};
