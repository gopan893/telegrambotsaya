'use strict';

function determineApprovalRequirement(action, risk, context) {
  const riskLevel = (risk && risk.riskLevel) || 'read_only';
  const actionType = (action && action.actionType) || 'read';

  if (actionType === 'read' || actionType === 'report') {
    return { requiresApproval: false, requiresExecutor: false, requiresOwner: false, canRunDirectly: true };
  }

  if (actionType === 'dry_run') {
    return { requiresApproval: false, requiresExecutor: false, requiresOwner: false, canRunDirectly: true };
  }

  if (actionType === 'plan') {
    return { requiresApproval: false, requiresExecutor: false, requiresOwner: false, canRunDirectly: true };
  }

  if (actionType === 'proposal') {
    return { requiresApproval: false, requiresExecutor: false, requiresOwner: false, canRunDirectly: true };
  }

  if (riskLevel === 'blocked') {
    return { requiresApproval: false, requiresExecutor: false, requiresOwner: false, canRunDirectly: false, blocked: true };
  }

  if (riskLevel === 'danger') {
    return { requiresApproval: true, requiresExecutor: true, requiresOwner: true, canRunDirectly: false };
  }

  if (riskLevel === 'high') {
    return { requiresApproval: true, requiresExecutor: true, requiresOwner: false, canRunDirectly: false };
  }

  if (actionType === 'external_write' || actionType === 'dangerous' || actionType === 'destructive') {
    return { requiresApproval: true, requiresExecutor: true, requiresOwner: false, canRunDirectly: false };
  }

  if (actionType === 'internal_write') {
    return { requiresApproval: false, requiresExecutor: false, requiresOwner: false, canRunDirectly: true };
  }

  return { requiresApproval: false, requiresExecutor: false, requiresOwner: false, canRunDirectly: true };
}

function requiresExecutorApproval(action, risk, context) {
  const decision = determineApprovalRequirement(action, risk, context);
  return decision.requiresExecutor;
}

function requiresOwnerApproval(action, risk, context) {
  const decision = determineApprovalRequirement(action, risk, context);
  return decision.requiresOwner;
}

function canRunDirectly(action, risk, context) {
  const decision = determineApprovalRequirement(action, risk, context);
  return decision.canRunDirectly && !decision.blocked;
}

function buildApprovalDecision(action, risk, context) {
  const base = determineApprovalRequirement(action, risk, context);
  const actionName = (action && (action.name || action.action || action.id)) || 'unknown';

  return {
    actionName,
    ...base,
    summary: base.canRunDirectly
      ? `"${actionName}" can run directly.`
      : base.blocked
        ? `"${actionName}" is blocked.`
        : `"${actionName}" requires ${[base.requiresOwner && 'owner', base.requiresExecutor && 'executor', 'approval'].filter(Boolean).join(' + ')}.`,
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  determineApprovalRequirement,
  requiresExecutorApproval,
  requiresOwnerApproval,
  canRunDirectly,
  buildApprovalDecision
};
