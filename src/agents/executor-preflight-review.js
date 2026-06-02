'use strict';

const executor = require('../executor');
const actionPlanStore = require('./agent-action-plan');
const mapper = require('./agent-action-mapper');
const utils = require('./delegation-utils');

const UNSUPPORTED = /\b(shell|code|javascript|env|config|permission\.admin|hard_delete|bulk delete)\b/i;

function riskOrder(level = 'low') {
  return { low: 1, medium: 2, high: 3, danger: 4 }[utils.normalizeRiskLevel(level)] || 1;
}

function maxRisk(actions = [], fallback = 'low') {
  return actions.reduce((max, action) => riskOrder(action.riskLevel) > riskOrder(max) ? action.riskLevel : max, fallback);
}

function detectSecretInActionPlan(actionPlan = {}) {
  return utils.containsSecretLike(actionPlan);
}

function detectUnsupportedAction(actionPlan = {}) {
  const actions = actionPlan.actions || [];
  const unsupported = actions.filter(action => {
    const raw = `${action.type} ${action.description}`;
    return UNSUPPORTED.test(raw) || !mapper.SUPPORTED_ACTIONS.includes(action.type);
  });
  return unsupported.map(action => action.type || action.description);
}

function requireSecurityReview(actionPlan = {}) {
  return ['high', 'danger'].includes(utils.normalizeRiskLevel(actionPlan.riskLevel || maxRisk(actionPlan.actions)));
}

function requireOwnerAdmin(actionPlan = {}) {
  const raw = `${actionPlan.riskLevel} ${(actionPlan.actions || []).map(action => `${action.type} ${action.description}`).join(' ')}`.toLowerCase();
  return utils.normalizeRiskLevel(actionPlan.riskLevel) === 'danger' || /\b(restore|import|permission|admin|env|config|delete)\b/.test(raw);
}

function detectWorkspaceRisk(actionPlan = {}) {
  const warnings = [];
  if (!actionPlan.workspaceId) warnings.push('workspaceId missing; default workspace will be used');
  if ((actionPlan.actions || []).some(action => action.workspaceId && action.workspaceId !== actionPlan.workspaceId)) {
    warnings.push('action workspace differs from action plan workspace');
  }
  return warnings;
}

async function detectDuplicateProposal(actionPlan = {}, services = {}) {
  const proposals = await executor.executionStore.listExecutionItems(executor.executionStore.EXECUTOR_PROPOSALS_KEY, {
    userId: actionPlan.userId,
    workspaceId: actionPlan.workspaceId,
    status: 'pending_approval',
    limit: 100
  }, services);
  const signature = JSON.stringify((actionPlan.actions || []).map(action => ({
    type: action.type,
    targetType: action.targetType,
    targetId: action.targetId,
    payload: action.payload
  })));
  return proposals.find(proposal => {
    if (proposal.sourceType === 'agent_action_plan' && proposal.sourceId === actionPlan.id) return true;
    const other = JSON.stringify((proposal.proposedActions || []).map(action => ({
      type: action.type,
      targetType: action.targetType,
      targetId: action.targetId,
      payload: action.payload
    })));
    return other === signature;
  }) || null;
}

async function runExecutorPreflight(actionPlanOrId, services = {}) {
  const actionPlan = typeof actionPlanOrId === 'string'
    ? await actionPlanStore.getActionPlan(actionPlanOrId, services)
    : actionPlanOrId;
  if (!actionPlan) {
    return {
      allowedToPropose: false,
      allowedToRunDirectly: false,
      riskLevel: 'danger',
      approvalRequired: true,
      securityReviewRequired: true,
      ownerAdminRequired: true,
      warnings: [],
      blockers: ['ACTION_PLAN_NOT_FOUND'],
      sanitizedActionPlan: null
    };
  }
  const warnings = detectWorkspaceRisk(actionPlan);
  const blockers = [];
  const unsupported = detectUnsupportedAction(actionPlan);
  if (unsupported.length) blockers.push(`UNSUPPORTED_ACTION:${unsupported.join(',')}`);
  if (detectSecretInActionPlan(actionPlan)) blockers.push('SECRET_LIKE_ACTION_PLAN_REJECTED');
  if (!Array.isArray(actionPlan.actions) || !actionPlan.actions.length) blockers.push('ACTIONS_REQUIRED');
  const riskLevel = utils.normalizeRiskLevel(maxRisk(actionPlan.actions, actionPlan.riskLevel));
  const duplicate = blockers.length ? null : await detectDuplicateProposal(actionPlan, services);
  if (duplicate) warnings.push(`duplicate pending proposal available: ${duplicate.id}`);

  return {
    allowedToPropose: blockers.length === 0,
    allowedToRunDirectly: false,
    riskLevel,
    approvalRequired: true,
    securityReviewRequired: requireSecurityReview({ ...actionPlan, riskLevel }),
    ownerAdminRequired: requireOwnerAdmin({ ...actionPlan, riskLevel }),
    warnings,
    blockers,
    duplicateProposalId: duplicate?.id || '',
    sanitizedActionPlan: utils.sanitizeDelegationPayload({ ...actionPlan, riskLevel })
  };
}

module.exports = {
  detectDuplicateProposal,
  detectSecretInActionPlan,
  detectUnsupportedAction,
  detectWorkspaceRisk,
  requireOwnerAdmin,
  requireSecurityReview,
  runExecutorPreflight
};
