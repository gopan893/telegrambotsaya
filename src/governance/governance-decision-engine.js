'use strict';

const crypto = require('crypto');
const capabilityRegistry = require('./capability-registry');
const unifiedPermissionEngine = require('./unified-permission-engine');
const unifiedRiskEngine = require('./unified-risk-engine');
const unifiedSecretGuard = require('./unified-secret-guard');
const unifiedApprovalPolicy = require('./unified-approval-policy');
const unifiedEvaluationPolicy = require('./unified-evaluation-policy');
const unifiedCostPolicy = require('./unified-cost-policy');

const DECISION_CACHE = [];

function generateDecisionId() {
  return crypto.createHash('sha1').update(`gov:${Date.now()}:${Math.random()}`).digest('hex').slice(0, 16);
}

function evaluateGovernanceAction(action, actor, context) {
  const actionObj = typeof action === 'string' ? { name: action, action: action, actionType: 'unknown' } : (action || {});
  const actorObj = typeof actor === 'string' ? { id: actor, userId: actor } : (actor || {});
  const ctx = context || {};

  const capability = capabilityRegistry.findCapabilityByAction(actionObj.name || actionObj.action || '');

  const risk = unifiedRiskEngine.buildRiskDecision(actionObj, ctx);
  const permission = unifiedPermissionEngine.checkGovernancePermission(actionObj, actorObj, ctx, {});
  const secretScan = ctx.payload
    ? unifiedSecretGuard.blockSecretUnsafeAction(actionObj.name || '', ctx.payload, ctx.module || capability?.module || '')
    : { blocked: false, reason: null, scan: { hasSecret: false, matches: [] } };
  const approval = unifiedApprovalPolicy.buildApprovalDecision(actionObj, risk, ctx);
  const evalReq = unifiedEvaluationPolicy.determineEvaluationRequirement(actionObj, risk, ctx);
  const evalCase = unifiedEvaluationPolicy.buildGovernanceEvalCase(actionObj, risk, ctx);
  const costGuard = unifiedCostPolicy.determineCostGuardRequirement(actionObj, ctx);
  const costEstimate = unifiedCostPolicy.estimateGovernanceActionCost(actionObj);

  const reasons = [];
  let allowed = false;
  let blocked = false;
  let proposalRequired = false;
  let evaluationRequired = false;
  let executorApprovalRequired = false;
  let ownerApprovalRequired = false;
  let outcome = 'block';

  if (risk.blocked || risk.riskLevel === 'blocked') {
    blocked = true;
    reasons.push('Action blocked by risk engine');
  }

  if (permission.allowed === false) {
    blocked = true;
    reasons.push(...permission.reasons);
  }

  if (secretScan.blocked) {
    blocked = true;
    reasons.push(secretScan.reason);
  }

  if (approval.blocked) {
    blocked = true;
    reasons.push('Action blocked by approval policy');
  }

  if (!blocked) {
    if (approval.requiresOwner) {
      ownerApprovalRequired = true;
    }
    if (approval.requiresExecutor) {
      executorApprovalRequired = true;
    }

    if (approval.canRunDirectly && !approval.requiresApproval && !evalReq.evaluationRequired) {
      allowed = true;
      outcome = risk.riskLevel === 'read_only' ? 'allow_read' : 'allow_dry_run';
    } else if (evalReq.evaluationRequired) {
      evaluationRequired = true;
      proposalRequired = true;
      outcome = 'require_evaluation';
      reasons.push('Evaluation v2 required');
    } else if (approval.requiresApproval || executorApprovalRequired || ownerApprovalRequired) {
      proposalRequired = true;
      outcome = 'require_approval';
      reasons.push('Approval required');
    } else {
      allowed = true;
      outcome = 'create_proposal';
      proposalRequired = true;
    }
  }

  const decisionId = generateDecisionId();
  const sanitizedPayload = ctx.payload
    ? unifiedSecretGuard.redactGovernancePayload(ctx.payload)
    : null;

  const decision = {
    id: decisionId,
    actionId: actionObj.name || actionObj.action || 'unknown',
    capabilityId: capability ? capability.id : null,
    allowed,
    blocked,
    proposalRequired,
    evaluationRequired,
    executorApprovalRequired,
    ownerApprovalRequired,
    riskLevel: risk.riskLevel,
    riskScore: risk.riskScore,
    reasons: [...new Set(reasons)],
    sanitizedPayload,
    outcome,
    role: permission.role,
    timestamp: new Date().toISOString(),
    evalCase: evalCase || null,
    costEstimate
  };

  DECISION_CACHE.push(decision);
  if (DECISION_CACHE.length > 200) DECISION_CACHE.shift();

  return decision;
}

function buildGovernanceDecision(action, checks) {
  return {
    id: generateDecisionId(),
    actionId: (action && (action.name || action.action)) || 'unknown',
    ...checks,
    timestamp: new Date().toISOString()
  };
}

function enforceGovernanceDecision(decision) {
  if (!decision) return { enforced: false, reason: 'No decision provided' };

  if (decision.blocked) {
    return {
      enforced: true,
      action: 'blocked',
      message: 'Action blocked by governance policy',
      decision
    };
  }

  if (decision.allowed) {
    return {
      enforced: true,
      action: decision.outcome === 'allow_read' ? 'allowed_read' : 'allowed_dry_run',
      message: 'Action allowed by governance policy',
      decision
    };
  }

  if (decision.proposalRequired) {
    return {
      enforced: true,
      action: 'proposal_required',
      message: 'Action requires proposal creation',
      decision
    };
  }

  return { enforced: true, action: 'unknown', message: 'Governance decision unclear', decision };
}

function explainGovernanceDecision(decision) {
  if (!decision) return 'No decision data.';

  const parts = [
    `*Governance Decision: ${decision.id}*`,
    `Action: ${decision.actionId}`,
    `Outcome: ${decision.outcome}`,
    `Risk Level: ${decision.riskLevel} (${Math.round(decision.riskScore * 100)}%)`,
    `Role: ${decision.role}`,
    '',
    decision.allowed ? '✅ Action allowed.' : '',
    decision.blocked ? '🛡️ Action blocked.' : '',
    decision.proposalRequired ? '📋 Proposal required.' : '',
    decision.evaluationRequired ? '🔬 Evaluation v2 required.' : '',
    decision.executorApprovalRequired ? '✅ Executor approval required.' : '',
    decision.ownerApprovalRequired ? '👑 Owner approval required.' : '',
    '',
    decision.reasons.length ? `Reasons: ${decision.reasons.join('; ')}` : '',
    '',
    `Timestamp: ${decision.timestamp}`
  ];

  return parts.filter(Boolean).join('\n');
}

function getRecentDecisions(count) {
  return DECISION_CACHE.slice(-(count || 20));
}

module.exports = {
  evaluateGovernanceAction,
  buildGovernanceDecision,
  enforceGovernanceDecision,
  explainGovernanceDecision,
  getRecentDecisions
};
